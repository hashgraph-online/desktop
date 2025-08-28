import { Logger } from '../utils/logger';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MCPServerValidator } from '../validators/mcp-server-validator';
import type { ValidationResult } from '../validators/mcp-server-validator';
import { MCPConnectionPoolManager } from './mcp-connection-pool-manager';
import { ConcurrencyManager } from '../utils/ConcurrencyManager';
import type {
  ConcurrentTask,
  MCPPerformanceMetrics,
  ConcurrencyStats,
} from '../../shared/types/mcp-performance';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'filesystem' | 'github' | 'postgres' | 'sqlite' | 'custom';
  status:
    | 'connected'
    | 'disconnected'
    | 'connecting'
    | 'handshaking'
    | 'ready'
    | 'error';
  enabled: boolean;
  config: MCPServerConfigValue;
  tools?: MCPServerTool[];
  lastConnected?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  connectionHealth?: MCPConnectionHealth;
  description?: string;
}

export type MCPServerConfigValue =
  | MCPFilesystemConfig
  | MCPGithubConfig
  | MCPPostgresConfig
  | MCPSqliteConfig
  | MCPCustomConfig;

export interface MCPFilesystemConfig {
  type: 'filesystem';
  rootPath: string;
  allowedPaths?: string[];
  excludePaths?: string[];
  readOnly?: boolean;
}

export interface MCPGithubConfig {
  type: 'github';
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface MCPPostgresConfig {
  type: 'postgres';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface MCPSqliteConfig {
  type: 'sqlite';
  path: string;
  readOnly?: boolean;
}

export interface MCPCustomConfig {
  type: 'custom';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPConnectionHealth {
  connectionAttempts: number;
  lastAttemptTime?: Date;
  averageLatency?: number;
  uptime?: number;
  errorRate?: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface MCPServerTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'null';
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}

export interface MCPConnectionResult {
  success: boolean;
  tools?: MCPServerTool[];
  error?: string;
}

/**
 * Service for managing MCP server instances in the main process
 */
export class MCPService {
  private static instance: MCPService;
  private logger: Logger;
  private clientEntries: Map<
    string,
    { client: MCPClient; transport: StdioClientTransport }
  > = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  private configPath: string;
  private validator: MCPServerValidator;
  private connectionHealthMap: Map<string, MCPConnectionHealth> = new Map();
  private connectionStartTimes: Map<string, Date> = new Map();
  private connectingServers: Set<string> = new Set();
  private initializedServers: Set<string> = new Set();
  private poolManager: MCPConnectionPoolManager;
  private concurrencyManager: ConcurrencyManager;
  private performanceOptimizationsEnabled: boolean = true;
  private toolRegistrationCallback?: (
    serverId: string,
    tools: MCPServerTool[]
  ) => void;

  private constructor() {
    this.logger = new Logger({ module: 'MCPService' });

    let userDataPath: string;
    try {
      if (globalThis.require && typeof globalThis.require === 'function') {
        const electron = globalThis.require('electron');
        if (electron.app?.getPath) {
          userDataPath = electron.app.getPath('userData');
        } else {
          userDataPath = path.join(os.homedir(), '.config', 'hashgraph-online');
        }
      } else {
        userDataPath = path.join(os.homedir(), '.config', 'hashgraph-online');
      }
    } catch {
      userDataPath = path.join(os.homedir(), '.config', 'hashgraph-online');
    }

    this.configPath = path.join(userDataPath, 'mcp-servers.json');
    this.validator = new MCPServerValidator();
    this.poolManager = MCPConnectionPoolManager.getInstance();
    this.concurrencyManager = ConcurrencyManager.getInstance({
      maxConcurrency: 5,
      queueTimeoutMs: 30000,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Set callback for tool registration when tools are fetched
   */
  setToolRegistrationCallback(
    callback: (serverId: string, tools: MCPServerTool[]) => void
  ): void {
    this.toolRegistrationCallback = callback;
    this.logger.debug('Tool registration callback set in MCPService');
  }

  /**
   * Load MCP server configurations from disk
   */
  async loadServers(): Promise<MCPServerConfig[]> {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = await fs.promises.readFile(this.configPath, 'utf8');
        let loadedConfigs: MCPServerConfig[];
        try {
          loadedConfigs = JSON.parse(raw);
        } catch (e) {
          const start = raw.indexOf('[');
          const end = raw.lastIndexOf(']');
          if (start !== -1 && end !== -1 && end > start) {
            const slice = raw.slice(start, end + 1);
            loadedConfigs = JSON.parse(slice);
          } else {
            throw e;
          }
        }

        this.serverConfigs = loadedConfigs.map((config: MCPServerConfig) => ({
          ...config,
          status: 'disconnected' as const,
          errorMessage: undefined as string | undefined,
          lastConnected: config.lastConnected,
          tools: config.tools || [],
        }));

        this.logger.info(
          `Loaded ${this.serverConfigs.length} MCP server configurations`
        );
      } else {
        this.serverConfigs = this.getDefaultServers();
        this.logger.info(
          'No MCP server configurations found, creating default filesystem server'
        );
        try {
          await this.saveServers(this.serverConfigs);
        } catch (saveError) {
          this.logger.warn(
            'Failed to save default server configuration:',
            saveError
          );
        }
      }
      return this.serverConfigs;
    } catch (error) {
      this.logger.error('Failed to load MCP server configurations:', error);
      try {
        if (fs.existsSync(this.configPath)) {
          const backupPath = this.configPath + '.bak';
          await fs.promises.copyFile(this.configPath, backupPath);
          this.logger.warn(`Backed up invalid config to ${backupPath}`);
        }
      } catch {}
      this.serverConfigs = this.getDefaultServers();
      this.logger.info('Using default MCP server configuration as fallback');
      return this.serverConfigs;
    }
  }

  /**
   * Save MCP server configurations to disk
   */
  async saveServers(servers: MCPServerConfig[]): Promise<void> {
    try {
      this.serverConfigs = servers;

      const configDir = path.dirname(this.configPath);
      this.logger.debug(`Ensuring config directory exists: ${configDir}`);

      try {
        const stat = await fs.promises.stat(configDir);
        if (!stat.isDirectory()) {
          throw new Error(`${configDir} exists but is not a directory`);
        }
      } catch (error: unknown) {
        const nodeError = error as Error & { code?: string };
        if (nodeError.code === 'ENOENT') {
          this.logger.info(`Creating config directory: ${configDir}`);
          await fs.promises.mkdir(configDir, { recursive: true });

          const verifyDir = await fs.promises.stat(configDir);
          if (!verifyDir.isDirectory()) {
            throw new Error(`Failed to create directory: ${configDir}`);
          }
        } else {
          throw nodeError;
        }
      }

      const data = JSON.stringify(servers, null, 2) + '\n';

      try {
        await fs.promises.writeFile(this.configPath, data, 'utf8');
        this.logger.info(
          `Directly saved ${servers.length} MCP server configurations to ${this.configPath}`
        );
      } catch (writeError: unknown) {
        const error = writeError as Error;
        this.logger.warn(
          `Direct write failed (${error.message}), trying alternative approach`
        );

        const tempPath = path.join(
          os.tmpdir(),
          `mcp-servers-${Date.now()}.json`
        );
        this.logger.debug(`Writing to temp directory: ${tempPath}`);

        await fs.promises.writeFile(tempPath, data, 'utf8');

        const tempExists = await fs.promises
          .access(tempPath)
          .then(() => true)
          .catch(() => false);
        if (!tempExists) {
          throw new Error(`Failed to create temp file at ${tempPath}`);
        }

        const content = await fs.promises.readFile(tempPath, 'utf8');
        await fs.promises.writeFile(this.configPath, content, 'utf8');

        await fs.promises
          .unlink(tempPath)
          .catch((err) =>
            this.logger.warn(`Failed to clean up temp file: ${err}`)
          );

        this.logger.info(
          `Saved ${servers.length} MCP server configurations via temp file`
        );
      }
    } catch (error) {
      this.logger.error('Failed to save MCP server configurations:', error);
      throw error;
    }
  }

  /**
   * Test connection to an MCP server
   */
  async testConnection(
    serverConfig: MCPServerConfig
  ): Promise<MCPConnectionResult> {
    try {
      this.logger.info(
        `Testing connection to MCP server: ${serverConfig.name}`
      );

      const validationResult = await this.validator.validate(serverConfig);

      if (!validationResult.valid) {
        const errorMessages = this.validator.getErrorMessages(
          validationResult.errors
        );
        const detailedError = errorMessages.join('; ');

        this.logger.error(
          `Validation failed for ${serverConfig.name}: ${detailedError}`
        );

        return {
          success: false,
          error: `Configuration validation failed: ${detailedError}`,
        };
      }

      if (validationResult.warnings.length > 0) {
        const warningMessages = this.validator.getWarningMessages(
          validationResult.warnings
        );
        warningMessages.forEach((warning) => {
          this.logger.warn(
            `Validation warning for ${serverConfig.name}: ${warning}`
          );
        });
      }

      const { command, args, env } = this.buildServerCommand(serverConfig);
      this.logger.info(`Spawning MCP server (testConnection)`, {
        serverId: serverConfig.id,
        serverName: serverConfig.name,
        command,
        args,
      });
      const attempt = async (cmd: string, a: string[]) => {
        const transport = new StdioClientTransport({ command: cmd, args: a, env: { ...process.env, ...env }, stderr: 'pipe' });
        const client = new MCPClient({ name: 'conversational-agent', version: '1.0.0' });
        try {
          await client.connect(transport);
          const result = await client.listTools();
          const tools = (result.tools || []).map((t) => this.normalizeSDKTool(t));
          await client.close();
          return { success: true as const, tools };
        } catch (err) {
          try { await client.close(); } catch {}
          return { success: false as const, error: err instanceof Error ? err.message : 'Test connection failed' };
        }
      };

      const primary = await attempt(command, args);
      if (primary.success) return primary;
      if (serverConfig.type === 'custom' && serverConfig.config.type === 'custom') {
        const originalCmd = serverConfig.config.command;
        if (originalCmd === 'uvx' || originalCmd === 'pipx') {
          const pkg = serverConfig.config.args?.[0];
          if (pkg) {
            const moduleName = pkg.replace(/-/g, '_');
            const fb = await attempt('python3', ['-m', moduleName, ...serverConfig.config.args!.slice(1)]);
            if (fb.success) return fb;
          }
        }
      }
      return { success: false, error: primary.error };
    } catch (error) {
      this.logger.error(
        `Connection test failed for ${serverConfig.name}:`,
        error
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Update connection health metrics
   */
  private updateConnectionHealth(
    serverId: string,
    event: 'attempt' | 'success' | 'error',
    error?: string
  ): void {
    let health = this.connectionHealthMap.get(serverId);

    if (!health) {
      health = {
        connectionAttempts: 0,
        errorRate: 0,
      };
      this.connectionHealthMap.set(serverId, health);
    }

    const now = new Date();

    switch (event) {
      case 'attempt':
        health.connectionAttempts++;
        health.lastAttemptTime = now;
        break;

      case 'success': {
        const startTime = this.connectionStartTimes.get(serverId);
        if (startTime) {
          const latency = now.getTime() - startTime.getTime();
          health.averageLatency = health.averageLatency
            ? (health.averageLatency + latency) / 2
            : latency;
        }
        health.uptime = now.getTime();
        break;
      }

      case 'error':
        health.lastError = error;
        health.lastErrorTime = now;
        health.errorRate =
          health.connectionAttempts > 0
            ? ((health.errorRate || 0) * (health.connectionAttempts - 1) + 1) /
              health.connectionAttempts
            : 1;
        break;
    }

    const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
    if (serverConfig) {
      serverConfig.connectionHealth = { ...health };
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectServer(serverId: string): Promise<MCPConnectionResult> {
    try {
      if (
        this.connectingServers.has(serverId) ||
        this.clientEntries.has(serverId)
      ) {
        this.logger.warn(
          `Connection to server ${serverId} already in progress or connected, skipping`
        );
        return {
          success: true,
          tools: [],
        };
      }

      const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
      if (!serverConfig) {
        return {
          success: false,
          error: 'Server configuration not found',
        };
      }

      this.connectingServers.add(serverId);

      const validationResult = await this.validator.validate(serverConfig);

      if (!validationResult.valid) {
        const errorMessages = this.validator.getErrorMessages(
          validationResult.errors
        );
        const detailedError = errorMessages.join('; ');

        this.logger.error(
          `Validation failed for ${serverConfig.name}: ${detailedError}`
        );

        return {
          success: false,
          error: `Configuration validation failed: ${detailedError}`,
        };
      }

      if (validationResult.warnings.length > 0) {
        const warningMessages = this.validator.getWarningMessages(
          validationResult.warnings
        );
        warningMessages.forEach((warning) => {
          this.logger.warn(
            `Validation warning for ${serverConfig.name}: ${warning}`
          );
        });
      }

      if (this.clientEntries.has(serverId)) {
        try {
          await this.disconnectServer(serverId);
        } catch (disconnectError) {
          this.logger.warn(
            `Failed to disconnect existing connection for ${serverId}:`,
            disconnectError
          );
        }
      }

      this.logger.info(`Connecting to MCP server: ${serverConfig.name}`);

      serverConfig.status = 'connecting';
      this.connectionStartTimes.set(serverId, new Date());
      this.updateConnectionHealth(serverId, 'attempt');

      let command: string, args: string[], env: Record<string, string>;
      try {
        ({ command, args, env } = this.buildServerCommand(serverConfig));
      } catch (buildError) {
        this.logger.error(
          `Failed to build command for server ${serverConfig.name}:`,
          buildError
        );
        return {
          success: false,
          error: `Invalid server configuration: ${
            buildError instanceof Error ? buildError.message : 'Unknown error'
          }`,
        };
      }

      this.logger.info(`Spawning MCP server (connectServer)`, {
        serverId: serverConfig.id,
        serverName: serverConfig.name,
        command,
        args,
      });

      const attempt = async (cmd: string, a: string[]) => {
        const transport = new StdioClientTransport({ command: cmd, args: a, env: { ...process.env, ...env }, stderr: 'pipe' });
        const client = new MCPClient({ name: 'conversational-agent', version: '1.0.0' });
        try {
          await client.connect(transport);
          this.clientEntries.set(serverId, { client, transport });
          this.connectingServers.delete(serverId);
          serverConfig.status = 'connected';
          this.logger.info(`Successfully connected to MCP server: ${serverConfig.name}`);
          void this.fetchAndSaveTools(serverId);
          return { success: true as const };
        } catch (err) {
          try { await client.close(); } catch {}
          return { success: false as const, error: err instanceof Error ? err.message : 'Connection failed' };
        }
      };

      const primary = await attempt(command, args);
      if (primary.success) return { success: true, tools: [] };
      if (serverConfig.type === 'custom' && serverConfig.config.type === 'custom') {
        const originalCmd = serverConfig.config.command;
        if (originalCmd === 'uvx' || originalCmd === 'pipx') {
          const pkg = serverConfig.config.args?.[0];
          if (pkg) {
            const moduleName = pkg.replace(/-/g, '_');
            const fb = await attempt('python3', ['-m', moduleName, ...serverConfig.config.args!.slice(1)]);
            if (fb.success) return { success: true, tools: [] };
          }
        }
      }
      this.connectingServers.delete(serverId);
      serverConfig.status = 'error';
      serverConfig.errorMessage = primary.error;
      this.updateConnectionHealth(serverId, 'error', primary.error);
      this.logger.error(`Connection error for ${serverConfig.name}:`, primary.error);
      return { success: false, error: primary.error };
    } catch (error) {
      this.connectingServers.delete(serverId);
      this.logger.error(`Failed to connect to server ${serverId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverId: string): Promise<void> {
    try {
      const entry = this.clientEntries.get(serverId);
      if (entry) {
        try {
          await entry.client.close();
        } catch (e) {
          this.logger.warn(`Error closing client for ${serverId}:`, e);
        }
        this.clientEntries.delete(serverId);
        this.initializedServers.delete(serverId);
        this.logger.info(`Disconnected from MCP server: ${serverId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect from server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get tools from a connected MCP server
   */
  async getServerTools(serverId: string): Promise<MCPServerTool[]> {
    try {
      const entry = this.clientEntries.get(serverId);
      if (!entry) {
        throw new Error('Server not connected');
      }
      const result = await entry.client.listTools();
      const tools = (result.tools || []).map((t) => this.normalizeSDKTool(t));
      return tools;
    } catch (error) {
      this.logger.error(`Failed to get tools from server ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clientEntries.keys()).map(
      (serverId) => this.disconnectServer(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    this.logger.info('Disconnected from all MCP servers');
  }

  /**
   * Fetch and save tools for a server (internal method)
   */
  private async fetchAndSaveTools(serverId: string): Promise<void> {
    setTimeout(async () => {
      try {
        if (!this.clientEntries.has(serverId)) {
          this.logger.warn(
            `Server ${serverId} was disconnected before tools could be fetched`
          );
          return;
        }

        if (this.clientEntries.has(serverId)) {
          this.logger.debug(`Attempting to fetch tools for server ${serverId}`);
          const tools = await this.getServerTools(serverId);
          this.logger.info(
            `Successfully fetched ${tools.length} tools from server ${serverId}`
          );

          const currentServerConfig = this.serverConfigs.find(
            (s) => s.id === serverId
          );
          if (currentServerConfig) {
            this.logger.info(
              `Before updating tools for ${serverId}: existing tools = ${
                (currentServerConfig.tools || []).length
              }`
            );
            currentServerConfig.status = 'ready';
            currentServerConfig.tools = tools;
            currentServerConfig.lastConnected = new Date();
            currentServerConfig.updatedAt = new Date();
            this.updateConnectionHealth(serverId, 'success');

            this.logger.info(
              `After updating tools for ${serverId}: new tools = ${tools.length}`
            );
            this.logger.debug(
              `Tools being saved for ${serverId}:`,
              tools.map((t) => t.name).join(', ')
            );

            await this.saveServers(this.serverConfigs);
            this.logger.info(
              `Server ${serverId} now ready with ${tools.length} tools saved to disk`
            );

            if (this.toolRegistrationCallback && tools.length > 0) {
              try {
                this.toolRegistrationCallback(serverId, tools);
                this.logger.info(
                  `Called tool registration callback for ${serverId} with ${tools.length} tools`
                );
              } catch (callbackError) {
                this.logger.error(
                  `Tool registration callback failed for ${serverId}:`,
                  callbackError
                );
              }
            }

            const verifyConfig = this.serverConfigs.find(
              (s) => s.id === serverId
            );
            if (verifyConfig && verifyConfig.tools) {
              this.logger.info(
                `Verification: ${serverId} has ${verifyConfig.tools.length} tools in memory after save`
              );
            }
          } else {
            this.logger.error(
              `Server config for ${serverId} not found when trying to save tools`
            );
          }
        } else {
          this.logger.warn(
            `Server ${serverId} was disconnected before tools could be fetched`
          );
        }
      } catch (toolsError) {
        this.logger.error(`Failed to fetch tools for ${serverId}:`, toolsError);
        const currentServerConfig = this.serverConfigs.find(
          (s) => s.id === serverId
        );
        if (currentServerConfig) {
          currentServerConfig.status = 'connected';
          currentServerConfig.lastConnected = new Date();
          currentServerConfig.updatedAt = new Date();
          this.updateConnectionHealth(serverId, 'success');

          await this.saveServers(this.serverConfigs);
        }
      }
    }, 1000);
  }

  /**
   * Refresh tools for a connected server
   */
  async refreshServerTools(serverId: string): Promise<MCPServerTool[]> {
    const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
    if (
      !serverConfig ||
      (serverConfig.status !== 'ready' && serverConfig.status !== 'connected')
    ) {
      this.logger.warn(
        `Server ${serverId} is not connected, cannot refresh tools`
      );
      return [];
    }

    try {
      const tools = await this.getServerTools(serverId);
      serverConfig.tools = tools;
      await this.saveServers(this.serverConfigs);
      this.logger.info(
        `Refreshed tools for server ${serverId}: ${tools.length} tools found`
      );
      return tools;
    } catch (error) {
      this.logger.error(
        `Failed to refresh tools for server ${serverId}:`,
        error
      );
      return serverConfig.tools || [];
    }
  }

  /**
   * Build command and arguments for starting an MCP server
   */
  private buildServerCommand(serverConfig: MCPServerConfig): {
    command: string;
    args: string[];
    env: Record<string, string>;
  } {
    const env: Record<string, string> = {};

    switch (serverConfig.type) {
      case 'filesystem':
        if (serverConfig.config.type === 'filesystem') {
          return {
            command: 'npx',
            args: [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              serverConfig.config.rootPath || process.cwd(),
            ],
            env,
          };
        }
        break;

      case 'github':
        if (serverConfig.config.type === 'github') {
          env.GITHUB_PERSONAL_ACCESS_TOKEN = serverConfig.config.token;
        }
        return {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env,
        };

      case 'postgres':
        if (serverConfig.config.type === 'postgres') {
          env.POSTGRES_CONNECTION_STRING = `postgresql://${serverConfig.config.username}:${serverConfig.config.password}@${serverConfig.config.host}:${serverConfig.config.port}/${serverConfig.config.database}`;
          return {
            command: 'npx',
            args: ['@modelcontextprotocol/server-postgres'],
            env,
          };
        }
        break;

      case 'sqlite':
        if (serverConfig.config.type === 'sqlite') {
          return {
            command: 'npx',
            args: [
              '@modelcontextprotocol/server-sqlite',
              serverConfig.config.path,
            ],
            env,
          };
        }
        break;

      case 'custom':
        if (serverConfig.config.type === 'custom') {
          const command = serverConfig.config.command;
          const args = serverConfig.config.args || [];
          if (command === 'npx') {
            return {
              command: 'npx',
              args,
              env: { ...env, ...serverConfig.config.env },
            };
          }
          return {
            command,
            args,
            env: { ...env, ...serverConfig.config.env },
          };
        }
        throw new Error(`Invalid custom server configuration`);

      default:
        throw new Error(`Unsupported server type: ${serverConfig.type}`);
    }

    throw new Error(
      `Invalid configuration for server type: ${serverConfig.type}`
    );
  }

  /**
   * Validate JSON schema type safely
   */
  private validateSchemaType(
    type: unknown
  ): 'object' | 'string' | 'number' | 'boolean' | 'array' | 'null' | undefined {
    const validTypes = [
      'object',
      'string',
      'number',
      'boolean',
      'array',
      'null',
    ] as const;
    type ValidType = (typeof validTypes)[number];

    if (typeof type === 'string' && validTypes.includes(type as ValidType)) {
      return type as ValidType;
    }
    return undefined;
  }

  /**
   * Validate JSON schema properties safely
   */
  private validateProperties(
    properties: unknown
  ): Record<string, JSONSchema> | undefined {
    if (
      typeof properties === 'object' &&
      properties !== null &&
      !Array.isArray(properties)
    ) {
      return properties as Record<string, JSONSchema>;
    }
    return undefined;
  }

  /**
   * Validate JSON schema required array safely
   */
  private validateRequired(required: unknown): string[] | undefined {
    if (
      Array.isArray(required) &&
      required.every((item) => typeof item === 'string')
    ) {
      return required;
    }
    return undefined;
  }

  /**
   * Parse tools from server output
   */
  private normalizeSDKTool(tool: unknown): MCPServerTool {
    if (typeof tool !== 'object' || tool === null) {
      return {
        name: 'unknown',
        description: '',
        inputSchema: { type: 'object' },
      };
    }
    const t = tool as Record<string, unknown>;
    const name = typeof t.name === 'string' ? t.name : 'unknown';
    const description =
      typeof t.description === 'string'
        ? t.description
        : typeof t.title === 'string'
          ? t.title
          : '';
    const rawSchema =
      (t['inputSchema'] as unknown) ?? (t['input_schema'] as unknown);
    let inputSchema: JSONSchema = { type: 'object' };
    if (rawSchema && typeof rawSchema === 'object') {
      const rs = rawSchema as Record<string, unknown>;
      inputSchema = {
        type: this.validateSchemaType(rs.type) || 'object',
        properties: this.validateProperties(rs.properties),
        required: this.validateRequired(rs.required),
      };
    }
    return { name, description, inputSchema };
  }

  /**
   * Get all server configurations
   */
  getServerConfigs(): MCPServerConfig[] {
    return this.serverConfigs;
  }

  /**
   * Get connection health for a server
   */
  getConnectionHealth(serverId: string): MCPConnectionHealth | undefined {
    return this.connectionHealthMap.get(serverId);
  }

  /**
   * Get connected server IDs
   */
  getConnectedServerIds(): string[] {
    return Array.from(this.clientEntries.keys());
  }

  /**
   * Get default server configurations
   */
  private getDefaultServers(): MCPServerConfig[] {
    let homePath: string;
    try {
      if (globalThis.require && typeof globalThis.require === 'function') {
        const electron = globalThis.require('electron');
        homePath = electron.app?.getPath?.('home') || os.homedir();
      } else {
        homePath = os.homedir();
      }
    } catch {
      homePath = os.homedir();
    }

    return [
      {
        id: 'default-filesystem',
        name: 'Local Filesystem',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: homePath,
        },
        tools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * Validate server configuration without attempting connection
   */
  async validateServerConfig(
    serverConfig: MCPServerConfig
  ): Promise<ValidationResult> {
    return this.validator.validate(serverConfig);
  }

  /**
   * Clear validation cache
   */
  clearValidationCache(): void {
    this.validator.clearCache();
  }

  /**
   * Connect multiple servers in parallel with optimizations
   */
  async connectServersParallel(
    serverIds: string[],
    options?: {
      maxConcurrency?: number;
      failFast?: boolean;
      useConnectionPool?: boolean;
    }
  ): Promise<Array<{ serverId: string; success: boolean; error?: string }>> {
    const {
      maxConcurrency = 5,
      failFast = false,
      useConnectionPool = this.performanceOptimizationsEnabled,
    } = options || {};

    this.logger.info(`Connecting ${serverIds.length} servers in parallel`, {
      maxConcurrency,
      failFast,
      useConnectionPool,
    });

    const connectionTasks: ConcurrentTask<MCPConnectionResult>[] =
      serverIds.map((serverId, index) => {
        const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
        if (!serverConfig) {
          throw new Error(`Server configuration not found for ${serverId}`);
        }

        return this.concurrencyManager.createTask(
          `connect-${serverId}`,
          async () => {
            if (useConnectionPool) {
              await this.poolManager.initializePool(serverConfig);
            }
            return await this.connectServer(serverId);
          },
          {
            priority: 3 - Math.min(index, 2),
            timeoutMs: 30000,
            retryAttempts: 2,
          }
        );
      });

    const originalConcurrency =
      this.concurrencyManager.getStatus().config.maxConcurrency;
    if (maxConcurrency !== originalConcurrency) {
      this.concurrencyManager.updateConcurrency(maxConcurrency);
    }

    try {
      const results = await this.concurrencyManager.executeParallel(
        connectionTasks,
        {
          failFast,
          maxRetries: 1,
        }
      );

      if (maxConcurrency !== originalConcurrency) {
        this.concurrencyManager.updateConcurrency(originalConcurrency);
      }

      const formatted = results.map((result) => ({
        serverId: result.taskId.replace('connect-', ''),
        success: result.success,
        error: result.error?.message,
      }));

      const successful = formatted.filter((r) => r.success).length;
      this.logger.info(`Parallel connection completed`, {
        successful,
        failed: formatted.length - successful,
        total: formatted.length,
      });

      return formatted;
    } catch (error) {
      if (maxConcurrency !== originalConcurrency) {
        this.concurrencyManager.updateConcurrency(originalConcurrency);
      }
      throw error;
    }
  }

  /**
   * Get performance metrics from optimization systems
   */
  getPerformanceMetrics(): {
    poolMetrics?: MCPPerformanceMetrics;
    concurrencyStats?: ConcurrencyStats;
    enabled: boolean;
  } {
    if (!this.performanceOptimizationsEnabled) {
      return { enabled: false };
    }

    return {
      poolMetrics: this.poolManager.getPerformanceMetrics(),
      concurrencyStats: this.concurrencyManager.getStats(),
      enabled: true,
    };
  }

  /**
   * Enable or disable performance optimizations
   */
  setPerformanceOptimizations(enabled: boolean): void {
    this.performanceOptimizationsEnabled = enabled;
    this.logger.info(
      `Performance optimizations ${enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Optimized connection method that uses pooling when available
   */
  async connectServerOptimized(serverId: string): Promise<MCPConnectionResult> {
    if (!this.performanceOptimizationsEnabled) {
      return this.connectServer(serverId);
    }

    const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
    if (!serverConfig) {
      return {
        success: false,
        error: 'Server configuration not found',
      };
    }

    try {
      await this.poolManager.initializePool(serverConfig);

      const connection = await this.poolManager.acquireConnection(serverId);
      if (!connection) {
        this.logger.warn(
          `Could not acquire pooled connection for ${serverId}, falling back to direct connection`
        );
        return this.connectServer(serverId);
      }

      serverConfig.status = 'connected';
      serverConfig.lastConnected = new Date();

      this.logger.info(`Connected to server ${serverId} using connection pool`);

      return {
        success: true,
        tools: (connection.tools || []).map((tool) => {
          const inputSchema: JSONSchema = tool.inputSchema
            ? {
                type:
                  this.validateSchemaType(tool.inputSchema.type) || 'object',
                properties: this.validateProperties(
                  tool.inputSchema.properties
                ),
                required: this.validateRequired(tool.inputSchema.required),
              }
            : { type: 'object' as const };

          return {
            name: tool.name,
            description: tool.description || '',
            inputSchema,
          };
        }),
      };
    } catch (error) {
      this.logger.error(`Optimized connection failed for ${serverId}:`, error);
      return this.connectServer(serverId);
    }
  }

  /**
   * Batch connect servers with intelligent scheduling
   */
  async connectServersBatch(
    serverConfigs: MCPServerConfig[],
    batchSize: number = 3,
    delayMs: number = 1000
  ): Promise<void> {
    if (!this.performanceOptimizationsEnabled) {
      for (const config of serverConfigs) {
        try {
          await this.connectServer(config.id);
        } catch (error) {
          this.logger.warn(`Failed to connect ${config.id}:`, error);
        }
      }
      return;
    }

    this.logger.info(`Connecting ${serverConfigs.length} servers in batches`, {
      batchSize,
      delayMs,
    });

    for (let i = 0; i < serverConfigs.length; i += batchSize) {
      const batch = serverConfigs.slice(i, i + batchSize);
      const batchIds = batch.map((s) => s.id);

      this.logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}`, {
        serverIds: batchIds,
      });

      try {
        await this.connectServersParallel(batchIds, {
          maxConcurrency: batchSize,
          failFast: false,
          useConnectionPool: true,
        });
      } catch (error) {
        this.logger.error(
          `Batch connection failed for servers ${batchIds.join(', ')}:`,
          error
        );
      }

      if (i + batchSize < serverConfigs.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Cleanup performance optimization resources
   */
  async cleanupOptimizations(): Promise<void> {
    if (this.performanceOptimizationsEnabled) {
      this.logger.info('Cleaning up performance optimization resources');
      await this.poolManager.cleanup();
      await this.concurrencyManager.shutdown();
    }
  }
}
