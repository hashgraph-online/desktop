import { ipcMain, IpcMainInvokeEvent, app, shell } from 'electron';
import {
  CredentialSchema,
  CredentialRequestSchema,
  IPCResponse,
} from '../../shared/schemas';
import { z } from 'zod';
import { AgentService } from '../services/AgentService';
import type { AgentConfig, ChatHistory } from '../services/AgentService';
import { MCPService } from '../services/MCPService';
import type { MCPServerConfig } from '../services/MCPService';
import { MCPRegistryService } from '../services/MCPRegistryService';
import type { MCPRegistrySearchOptions } from '../services/MCPRegistryService';
import { CredentialManager } from '../services/CredentialManager';
import { HederaMirrorNode } from '@hashgraphonline/standards-sdk';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { NPMService } from '../services/NPMService';
import type {
  PluginInstallOptions,
  PluginInstallProgress,
  PluginPermissions,
  NPMPluginConfig,
} from '../../shared/types/plugin';
import { ConfigService } from '../services/ConfigService';
import { registerTransactionHandlers } from '../handlers/transactionHandlers';
import { MirrorNodeService } from '../services/MirrorNodeService';
import { TransactionParserService } from '../services/TransactionParserService';
import { setupHCS10Handlers } from './hcs10Handlers';
import { UpdateService } from '../services/UpdateService';
import { OpenRouterService } from '../services/OpenRouterService';
import { getEnvironmentConfig } from '../config/environment';

const DEFAULT_SERVICE = 'conversational-agent';

/**
 * Sets up secure IPC handlers for credential management
 * @param credentialManager - The credential manager instance to use
 */
export function setupSecurityHandlers(credentialManager: any): void {
  ipcMain.handle(
    'credential:store',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialSchema.parse(data);
        const result = await credentialManager.store(
          validated.service,
          validated.account,
          validated.password
        );
        return { success: true, data: result };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return { success: false, error: 'Failed to store credential' };
      }
    }
  );

  ipcMain.handle(
    'credential:get',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialRequestSchema.parse(data);
        const result = await credentialManager.get(
          validated.service,
          validated.account
        );
        return { success: true, data: result };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return { success: false, error: 'Failed to retrieve credential' };
      }
    }
  );

  ipcMain.handle(
    'credential:delete',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialRequestSchema.parse(data);
        const result = await credentialManager.delete(
          validated.service,
          validated.account
        );
        return { success: true, data: result };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return { success: false, error: 'Failed to delete credential' };
      }
    }
  );

  ipcMain.handle(
    'credential:clear',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const result = await credentialManager.clear(DEFAULT_SERVICE);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: 'Failed to clear credentials' };
      }
    }
  );
}

/**
 * Sets up agent-related IPC handlers
 */
export function setupAgentHandlers(): void {
  const agentService = AgentService.getInstance();
  const logger = new Logger({ module: 'AgentHandlers' });

  ipcMain.handle(
    'agent:initialize',
    async (
      event: IpcMainInvokeEvent,
      config: AgentConfig
    ): Promise<IPCResponse> => {
      try {
        const configService = ConfigService.getInstance();
        const storedConfig = await configService.load();
        
        const mergedConfig: AgentConfig = {
          accountId: config.accountId || storedConfig.hedera.accountId,
          privateKey: storedConfig.hedera.privateKey,
          network: config.network || storedConfig.hedera.network,
          openAIApiKey: config.llmProvider === 'anthropic' ? storedConfig.anthropic.apiKey : storedConfig.openai.apiKey,
          modelName: config.modelName || (config.llmProvider === 'openai' ? storedConfig.openai.model : storedConfig.anthropic.model),
          operationalMode: config.operationalMode,
          llmProvider: config.llmProvider || storedConfig.llmProvider,
        };
        
        
        const result = await agentService.initialize(mergedConfig);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to initialize agent';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'agent:send-message',
    async (
      event: IpcMainInvokeEvent,
      data: { 
        content: string; 
        chatHistory: ChatHistory[];
        attachments?: Array<{
          name: string;
          data: string;
          type: string;
          size: number;
        }>;
      }
    ): Promise<IPCResponse> => {
      try {
        logger.info('IPC agent:send-message received:', {
          contentLength: data.content?.length || 0,
          historyLength: data.chatHistory?.length || 0,
          attachmentsCount: data.attachments?.length || 0,
          hasAttachments: !!data.attachments && data.attachments.length > 0
        });
        
        const result = await agentService.sendMessageWithAttachments(
          data.content,
          data.chatHistory,
          data.attachments || []
        );
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'agent:disconnect',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const result = await agentService.disconnect();
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to disconnect';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'agent:preload',
    async (
      event: IpcMainInvokeEvent,
      config: AgentConfig
    ): Promise<IPCResponse> => {
      try {
        logger.info('IPC handler agent:preload called');
        logger.info('Preload requested but not implemented');
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to start preload';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'agent:getStatus',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const status = agentService.getStatus();
        return { success: true, data: status };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to get status';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sets up connection test handlers
 */
export function setupConnectionHandlers(): void {
  ipcMain.handle(
    'hedera:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaTest' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'hedera:testConnection',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaTestConnection' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test connection error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'openai:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-')) {
          return { success: false, error: 'Invalid OpenAI API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'OpenAI connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'anthropic:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-ant-')) {
          return { success: false, error: 'Invalid Anthropic API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Anthropic connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-hedera',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaConnectionTest' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-openai',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-')) {
          return { success: false, error: 'Invalid OpenAI API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'OpenAI connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-anthropic',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-ant-')) {
          return { success: false, error: 'Invalid Anthropic API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Anthropic connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sets up config-related IPC handlers
 */
export function setupConfigHandlers(): void {
  const configService = ConfigService.getInstance();
  const logger = new Logger({ module: 'ConfigHandlers' });

  ipcMain.handle('config:load', async (): Promise<any> => {
    try {
      const config = await configService.load();
      logger.info('Config loaded via ConfigService');
      return config;
    } catch (error) {
      logger.error('Failed to load config:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'config:save',
    async (event: IpcMainInvokeEvent, config: any): Promise<void> => {
      try {
        logger.info('Saving config via ConfigService');
        await configService.save(config);
        logger.info('Config saved successfully');
      } catch (error) {
        logger.error('Failed to save config:', error);
        throw error;
      }
    }
  );

  ipcMain.handle('config:getEnvironment', async (): Promise<any> => {
    try {
      const envConfig = getEnvironmentConfig();
      logger.info('Environment config loaded', envConfig);
      return envConfig;
    } catch (error) {
      logger.error('Failed to load environment config:', error);
      throw error;
    }
  });
}

/**
 * Sets up MCP-related IPC handlers
 */
export function setupMCPHandlers(): void {
  const mcpService = MCPService.getInstance();
  const registryService = MCPRegistryService.getInstance();

  ipcMain.handle(
    'mcp:loadServers',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const servers = await mcpService.loadServers();
        return { success: true, data: servers };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load MCP servers';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:saveServers',
    async (
      event: IpcMainInvokeEvent,
      servers: MCPServerConfig[]
    ): Promise<IPCResponse> => {
      try {
        await mcpService.saveServers(servers);
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to save MCP servers';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:testConnection',
    async (
      event: IpcMainInvokeEvent,
      server: MCPServerConfig
    ): Promise<IPCResponse> => {
      try {
        const result = await mcpService.testConnection(server);
        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to test MCP connection';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:connectServer',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await mcpService.connectServer(serverId);
        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to connect to MCP server';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:disconnectServer',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        await mcpService.disconnectServer(serverId);
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to disconnect from MCP server';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:getServerTools',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const tools = await mcpService.getServerTools(serverId);
        return { success: true, data: tools };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to get server tools';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:refreshServerTools',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const tools = await mcpService.refreshServerTools(serverId);
        return { success: true, data: tools };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to refresh server tools';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:validateServerConfig',
    async (
      event: IpcMainInvokeEvent,
      server: MCPServerConfig
    ): Promise<IPCResponse> => {
      try {
        const validationResult = await mcpService.validateServerConfig(server);
        return { success: true, data: validationResult };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to validate server configuration';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:searchRegistry',
    async (
      event: IpcMainInvokeEvent,
      options: MCPRegistrySearchOptions
    ): Promise<IPCResponse> => {
      try {
        const result = await registryService.searchServers(options);
        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to search MCP registry';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:getRegistryServerDetails',
    async (
      event: IpcMainInvokeEvent,
      data: { serverId: string; packageName?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await registryService.getServerDetails(
          data.serverId,
          data.packageName
        );
        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get server details';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:installFromRegistry',
    async (
      event: IpcMainInvokeEvent,
      data: { serverId: string; packageName?: string }
    ): Promise<IPCResponse> => {
      try {
        const searchResult = await registryService.searchServers({
          query: data.serverId,
        });
        const server = searchResult.servers.find(
          (s) => s.id === data.serverId || s.name === data.serverId
        );

        if (server && !registryService.isServerInstallable(server)) {
          return {
            success: false,
            error:
              'This server does not have an npm package or GitHub repository available for installation',
          };
        }

        const registryServer = await registryService.getServerDetails(
          data.serverId,
          data.packageName
        );
        if (!registryServer) {
          if (server) {
            const mcpConfig = registryService.convertToMCPConfig(server);
            if (mcpConfig.config?.command) {
              const serverConfig: MCPServerConfig = {
                id: `registry-${Date.now()}`,
                name: server.name,
                type: 'custom',
                status: 'disconnected',
                enabled: true,
                config: mcpConfig.config,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const servers = await mcpService.loadServers();
              servers.push(serverConfig);
              await mcpService.saveServers(servers);

              return { success: true, data: serverConfig };
            }
          }
          return {
            success: false,
            error:
              'Unable to fetch server details from registry. The server package may not exist or may not be available for installation.',
          };
        }

        const mcpConfig = registryService.convertToMCPConfig(registryServer);
        if (!mcpConfig.config?.command) {
          return {
            success: false,
            error: 'Unable to determine installation command',
          };
        }

        const serverConfig: MCPServerConfig = {
          id: `registry-${Date.now()}`,
          name: mcpConfig.name!,
          type: 'custom',
          status: 'disconnected',
          enabled: true,
          config: mcpConfig.config,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const servers = await mcpService.loadServers();
        servers.push(serverConfig);
        await mcpService.saveServers(servers);

        return { success: true, data: serverConfig };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to install server from registry';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:clearRegistryCache',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        await registryService.clearCache();
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to clear registry cache';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:getCacheStats',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const stats = await registryService.getCacheStats();
        return { success: true, data: stats };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get cache statistics';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'mcp:triggerBackgroundSync',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        (registryService as any).triggerBackgroundSync();
        return {
          success: true,
          data: { message: 'Background sync triggered' },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to trigger background sync';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sets up plugin-related IPC handlers
 */
export function setupPluginHandlers(): void {
  const npmService = NPMService.getInstance();
  const logger = new Logger({ module: 'PluginHandlers' });

  ipcMain.handle(
    'plugin:search',
    async (
      event: IpcMainInvokeEvent,
      data: { query: string; registry?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.searchPlugins(data.query, {
          registry: data.registry,
        });
        return {
          success: result.success,
          data: result.results,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to search plugins';
        logger.error('Plugin search failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:install',
    async (
      event: IpcMainInvokeEvent,
      data: {
        packageName: string;
        options?: PluginInstallOptions;
      }
    ): Promise<IPCResponse> => {
      try {
        const progressCallback = (progress: PluginInstallProgress) => {
          event.sender.send('plugin:installProgress', progress);
        };

        const result = await npmService.installPlugin(
          data.packageName,
          data.options,
          progressCallback
        );

        return {
          success: result.success,
          data: result.plugin,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to install plugin';
        logger.error('Plugin installation failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:uninstall',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.uninstallPlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to uninstall plugin';
        logger.error('Plugin uninstallation failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:update',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const progressCallback = (progress: PluginInstallProgress) => {
          event.sender.send('plugin:updateProgress', progress);
        };

        const result = await npmService.updatePlugin(
          pluginId,
          progressCallback
        );
        return {
          success: result.success,
          data: result.plugin,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update plugin';
        logger.error('Plugin update failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:enable',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.enablePlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to enable plugin';
        logger.error('Plugin enable failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:disable',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.disablePlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to disable plugin';
        logger.error('Plugin disable failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:configure',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; config: Record<string, any> }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        if (plugin.configSchema) {
        }

        plugin.config = data.config;
        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return { success: true, data: plugin };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to configure plugin';
        logger.error('Plugin configuration failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:getPermissions',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        return {
          success: true,
          data: {
            required: plugin.permissions,
            granted: plugin.grantedPermissions,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get plugin permissions';
        logger.error('Get plugin permissions failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:grantPermissions',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; permissions: PluginPermissions }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        plugin.grantedPermissions = data.permissions;
        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return { success: true, data: plugin };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to grant plugin permissions';
        logger.error('Grant plugin permissions failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:revokePermissions',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; permissions: PluginPermissions }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        if (plugin.grantedPermissions) {
          const revokedPermissions = { ...plugin.grantedPermissions };
          Object.keys(data.permissions).forEach((key) => {
            delete revokedPermissions[key as keyof PluginPermissions];
          });
          plugin.grantedPermissions = revokedPermissions;
        }

        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return { success: true, data: plugin.grantedPermissions };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to revoke plugin permissions';
        logger.error('Revoke plugin permissions failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:getInstalled',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        return { success: true, data: plugins };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get installed plugins';
        logger.error('Get installed plugins failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:checkUpdates',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const updates = await Promise.all(
          plugins.map((plugin) => npmService.checkPluginUpdate(plugin.id))
        );

        const availableUpdates = updates.filter((update) => update !== null);
        return { success: true, data: availableUpdates };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to check plugin updates';
        logger.error('Check plugin updates failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:validateConfig',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; config: Record<string, any> }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        return { success: true, data: { valid: true } };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to validate plugin config';
        logger.error('Validate plugin config failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:validateSecurity',
    async (
      event: IpcMainInvokeEvent,
      data: { packageName: string; version?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.validatePackageSecurity(
          data.packageName,
          data.version
        );
        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to validate package security';
        logger.error('Package security validation failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'plugin:clearCache',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        npmService.clearCaches();
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to clear plugin cache';
        logger.error('Clear plugin cache failed:', error);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sets up all IPC handlers
 * @param masterPassword - The master password for credential encryption
 */
export function setupIPCHandlers(masterPassword: string): void {
  const credentialManager = new CredentialManager(masterPassword);
  setupSecurityHandlers(credentialManager);
  setupAgentHandlers();
  setupConnectionHandlers();
  setupConfigHandlers();
  setupMCPHandlers();
  setupPluginHandlers();
  registerTransactionHandlers();
  setupMirrorNodeHandlers();
  setupThemeHandlers();
  setupUpdateHandlers();
  setupHCS10Handlers();
  setupOpenRouterHandlers();
}

/**
 * Sets up IPC handlers for mirror node requests
 */
function setupMirrorNodeHandlers(): void {
  const mirrorNodeService = MirrorNodeService.getInstance();

  ipcMain.handle(
    'mirrorNode:getScheduleInfo',
    async (
      event: IpcMainInvokeEvent,
      scheduleId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const info = await mirrorNodeService.getScheduleInfo(
          scheduleId,
          network
        );
        return { success: true, data: info };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch schedule info',
        };
      }
    }
  );

  ipcMain.handle(
    'mirrorNode:getTransactionByTimestamp',
    async (
      event: IpcMainInvokeEvent,
      timestamp: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const transactions = await mirrorNodeService.getTransactionByTimestamp(
          timestamp,
          network
        );
        return { success: true, data: transactions };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch transaction',
        };
      }
    }
  );

  // Add getTokenInfo handler
  ipcMain.handle(
    'mirrorNode:getTokenInfo',
    async (
      event: IpcMainInvokeEvent,
      tokenId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const tokenInfo = await mirrorNodeService.getTokenInfo(
          tokenId,
          network
        );
        return { success: true, data: tokenInfo };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch token info',
        };
      }
    }
  );

  // Add TransactionParser handlers
  const transactionParserService = TransactionParserService.getInstance();

  ipcMain.handle(
    'transactionParser:validate',
    async (
      event: IpcMainInvokeEvent,
      transactionBytes: string
    ): Promise<IPCResponse> => {
      try {
        const validation = transactionParserService.validateTransactionBytes(transactionBytes);
        return { success: true, data: validation };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to validate transaction bytes',
        };
      }
    }
  );

  ipcMain.handle(
    'transactionParser:parse',
    async (
      event: IpcMainInvokeEvent,
      transactionBytes: string
    ): Promise<IPCResponse> => {
      try {
        const parsed = await transactionParserService.parseTransactionBytes(transactionBytes);
        return { success: true, data: parsed };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to parse transaction bytes',
        };
      }
    }
  );
}

/**
 * Sets up theme-related IPC handlers
 */
function setupThemeHandlers(): void {
  const logger = new Logger({ module: 'ThemeHandlers' });

  ipcMain.handle(
    'theme:set',
    async (
      event: IpcMainInvokeEvent,
      theme: 'light' | 'dark'
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Setting theme to: ${theme}`);
        return { success: true, data: { theme } };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to set theme';
        logger.error('Theme set error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'app:setAutoStart',
    async (
      event: IpcMainInvokeEvent,
      enabled: boolean
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Setting auto start to: ${enabled}`);
        return { success: true, data: { autoStart: enabled } };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to set auto start';
        logger.error('Auto start set error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'app:setLogLevel',
    async (event: IpcMainInvokeEvent, level: string): Promise<IPCResponse> => {
      try {
        logger.info(`Setting log level to: ${level}`);
        return { success: true, data: { logLevel: level } };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to set log level';
        logger.error('Log level set error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'open-external',
    async (event: IpcMainInvokeEvent, url: string): Promise<IPCResponse> => {
      try {
        logger.info(`Opening external URL: ${url}`);
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to open external URL';
        logger.error('Open external error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sets up update-related IPC handlers
 */
export function setupUpdateHandlers(): void {
  const updateService = UpdateService.getInstance();
  const logger = new Logger({ module: 'UpdateHandlers' });

  ipcMain.handle('get-app-version', async (): Promise<string> => {
    return app.getVersion();
  });

  ipcMain.handle('check-for-updates', async (): Promise<void> => {
    try {
      logger.info('Checking for updates via IPC');
      await updateService.checkForUpdates();
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      throw error;
    }
  });

  ipcMain.handle('download-update', async (): Promise<void> => {
    try {
      logger.info('Downloading update via IPC');
      await updateService.downloadUpdate();
    } catch (error) {
      logger.error('Failed to download update:', error);
      throw error;
    }
  });

  ipcMain.handle('install-update', async (): Promise<void> => {
    try {
      logger.info('Installing update via IPC');
      await updateService.installUpdate();
    } catch (error) {
      logger.error('Failed to install update:', error);
      throw error;
    }
  });

  ipcMain.handle('open-repository-url', async (): Promise<void> => {
    try {
      const repositoryUrl = updateService.getRepositoryUrl();
      logger.info(`Opening repository URL: ${repositoryUrl}`);
      await shell.openExternal(repositoryUrl);
    } catch (error) {
      logger.error('Failed to open repository URL:', error);
      throw error;
    }
  });

  ipcMain.handle('get-update-info', async (): Promise<any> => {
    try {
      return {
        currentVersion: updateService.getCurrentVersion(),
        updateInfo: updateService.getUpdateInfo(),
        isUpdateSupported: updateService.isUpdateSupported(),
      };
    } catch (error) {
      logger.error('Failed to get update info:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'set-update-channel',
    async (
      event: IpcMainInvokeEvent,
      channel: 'stable' | 'beta'
    ): Promise<void> => {
      try {
        logger.info(`Setting update channel to: ${channel}`);
        updateService.setUpdateChannel(channel);
      } catch (error) {
        logger.error('Failed to set update channel:', error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    'set-auto-download',
    async (event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      try {
        logger.info(`Setting auto download to: ${enabled}`);
        updateService.setAutoDownload(enabled);
      } catch (error) {
        logger.error('Failed to set auto download:', error);
        throw error;
      }
    }
  );
}

/**
 * Sets up OpenRouter-related IPC handlers
 */
export function setupOpenRouterHandlers(): void {
  const openRouterService = OpenRouterService.getInstance();
  const logger = new Logger({ module: 'OpenRouterHandlers' });

  ipcMain.handle(
    'openrouter:getModels',
    async (
      event: IpcMainInvokeEvent,
      forceRefresh = false
    ): Promise<IPCResponse> => {
      try {
        logger.info('Fetching models from OpenRouter');
        const models = await openRouterService.getModels(forceRefresh);
        return {
          success: true,
          data: models,
        };
      } catch (error) {
        logger.error('Failed to fetch OpenRouter models:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to fetch models',
        };
      }
    }
  );

  ipcMain.handle(
    'openrouter:getModelsByProvider',
    async (
      event: IpcMainInvokeEvent,
      provider: string
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Fetching ${provider} models from OpenRouter`);
        const models = await openRouterService.getModelsByProvider(provider);
        const convertedModels = models.map((model) =>
          openRouterService.convertToInternalFormat(
            model,
            provider as 'openai' | 'anthropic'
          )
        );
        return {
          success: true,
          data: convertedModels,
        };
      } catch (error) {
        logger.error(`Failed to fetch ${provider} models:`, error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to fetch models',
        };
      }
    }
  );

  ipcMain.handle(
    'openrouter:getModel',
    async (
      event: IpcMainInvokeEvent,
      modelId: string
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Fetching model ${modelId} from OpenRouter`);
        const model = await openRouterService.getModel(modelId);
        if (!model) {
          return {
            success: false,
            error: 'Model not found',
          };
        }
        return {
          success: true,
          data: model,
        };
      } catch (error) {
        logger.error(`Failed to fetch model ${modelId}:`, error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to fetch model',
        };
      }
    }
  );
}
