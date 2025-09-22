import { Logger } from '../utils/logger';
import { SafeConversationalAgent } from './safe-conversational-agent';
import type { AgentConfig as SafeAgentConfig } from './safe-conversational-agent';
import { MCPServiceWrapper } from './mcp-service-wrapper';
import { MCPService } from './mcp-service';
import { AgentLoader } from './agent-loader';
import {
  EntityResolver,
  AgentOperationalMode,
} from '@hashgraphonline/conversational-agent';
import type { MCPServerConfig as LibMCPServerConfig } from '@hashgraphonline/conversational-agent';
import type {
  IInitializationService,
  LoadingState,
} from '../interfaces/services';
import type { ServiceDependencies } from '../interfaces/services';
import type { ProgressiveLoadConfig } from '../../shared/types/mcp-performance';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import { getCurrentWallet } from './wallet-context';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import { MCPServer } from '../db/schema';
import { executeWithWallet } from './wallet-executor';
import { startInscriptionViaWallet } from './wallet-bridge-main';
import { setWalletBridgeProvider } from '@hashgraphonline/conversational-agent';
import { SignerProviderRegistry } from '@hashgraphonline/standards-agent-kit';
import { startHCSOperationViaLocalBuilder } from './hcs-start-bytes';
 

interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  modelName?: string;
  operationalMode?: 'autonomous' | 'provideBytes' | 'returnBytes';
  llmProvider?: 'openai' | 'anthropic';
  /** When using Provide Bytes with a connected wallet, generate user txs for this account */
  userAccountId?: string;
  mcpServers?: MCPServer[];
  useProgressiveLoading?: boolean;
  progressiveLoadConfig?: Partial<ProgressiveLoadConfig>;
  verbose?: boolean;
  disableLogging?: boolean;
}

/**
 * Service for managing agent lifecycle and initialization
 */
export class InitializationService implements IInitializationService {
  private logger: Logger;
  private agent: SafeConversationalAgent | null = null;
  private initializing = false;
  private initialized = false;
  private sessionId: string | null = null;
  private lastConfig: AgentConfig | null = null;
  private agentLoader: AgentLoader;
  private entityResolver: EntityResolver | null = null;
  private mcpServiceWrapper: MCPServiceWrapper;
  private mcpService: MCPService;

  constructor(dependencies?: ServiceDependencies) {
    this.logger = new Logger({ module: 'InitializationService' });
    this.mcpServiceWrapper = new MCPServiceWrapper(dependencies);
    this.mcpService = MCPService.getInstance();
    this.agentLoader = AgentLoader.getInstance();

    try {
      setWalletBridgeProvider({
        status: async () => {
          const w = getCurrentWallet();
          return {
            connected: !!w,
            accountId: w?.accountId,
            network: w?.network,
          };
        },
        executeBytes: async (base64, network) => {
          const { transactionId } = await executeWithWallet(base64, network);
          return { transactionId };
        },
        startInscription: async (request, network) => {
          return await startInscriptionViaWallet(request, network);
        },
        startHCS: async (op: string, request: Record<string, unknown>, network) => {
          return await startHCSOperationViaLocalBuilder(op, request, network);
        },
      });

      SignerProviderRegistry.setWalletInfoResolver(async () => {
        const wallet = getCurrentWallet();
        if (!wallet) {
          return null;
        }
        return {
          accountId: wallet.accountId,
          network: wallet.network,
        };
      });

      SignerProviderRegistry.setWalletExecutor(async (base64, network) => {
        const { transactionId } = await executeWithWallet(base64, network);
        return { transactionId };
      });

      try {
        SignerProviderRegistry.setStartHCSDelegate(async (op, request, network) => {
          return await startHCSOperationViaLocalBuilder(op, request, network);
        });
      } catch {}
    } catch {}
  }

  /**
   * Initialize the conversational agent
   */
  async initialize(config: AgentConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }> {
    const startTime = Date.now();
    this.logger.info('Agent initialization starting', {
      llmProvider: config.llmProvider,
      operationalMode: config.operationalMode,
      hasAccountId: !!config.accountId,
      hasApiKey: !!config.openAIApiKey,
      network: config.network,
    });

    if (this.agent && this.initialized && this.lastConfig) {
      const configChanged =
        this.lastConfig.openAIApiKey !== config.openAIApiKey ||
        this.lastConfig.accountId !== config.accountId ||
        this.lastConfig.privateKey !== config.privateKey ||
        this.lastConfig.operationalMode !== config.operationalMode ||
        this.lastConfig.modelName !== config.modelName ||
        this.lastConfig.llmProvider !== config.llmProvider;

      if (!configChanged) {
        this.logger.info('Configuration unchanged, reusing existing agent');
        return {
          success: true,
          sessionId: this.sessionId!,
          coreReadyTimeMs: 0,
          backgroundTasksRemaining: 0,
          loadingPhase: 'completed',
        };
      }

      this.logger.info('Config changed, reinitializing agent...');
      await this.cleanup();
    }

    if (this.initializing) {
      throw new Error(
        'Agent is already initializing. Please wait for the current initialization to complete.'
      );
    }

    this.initializing = true;
    this.lastConfig = { ...config };

    try {
      if (
        !config.accountId ||
        (!config.privateKey && config.operationalMode !== 'provideBytes' && config.operationalMode !== 'returnBytes') ||
        !config.openAIApiKey
      ) {
        throw new Error(
          'Missing required configuration: accountId, privateKey, or API key'
        );
      }

      this.logger.info(
        'Configuration validated, proceeding with initialization'
      );

      if (config.useProgressiveLoading !== false) {
        this.logger.info(
          'Using progressive agent loading for enhanced performance'
        );

        try {
          const agentServiceConfig: AgentConfig = {
            ...config,
            network: config.network as unknown as NetworkType,
          };

          const progressiveResult = await this.agentLoader.loadAgent(
            agentServiceConfig,
            config.progressiveLoadConfig
          );

          if (progressiveResult.success) {
            this.initialized = true;
            this.sessionId = progressiveResult.sessionId!;
            this.entityResolver = new EntityResolver({
              apiKey: config.openAIApiKey,
              modelName: config.modelName || 'gpt-4o-mini',
            });

            if (this.agent) {
              this.setupToolRegistrationCallback(this.agent);
            }

            const initTime = Date.now() - startTime;
            this.logger.info('Progressive agent initialization successful', {
              initTimeMs: initTime,
              sessionId: this.sessionId,
            });

            return {
              success: true,
              sessionId: this.sessionId,
              coreReadyTimeMs: progressiveResult.coreReadyTimeMs,
              backgroundTasksRemaining:
                progressiveResult.backgroundTasksRemaining,
              loadingPhase: 'core-ready',
            };
          } else {
            this.logger.warn(
              'Progressive loading failed, falling back to traditional loading:',
              progressiveResult.error
            );
          }
        } catch (progressiveError) {
          this.logger.warn(
            'Progressive loading threw error, falling back to traditional loading:',
            progressiveError
          );
        }
      }

      this.logger.info('Using traditional agent loading');
      const result = await this.initializeTraditional(config);

      const initTime = Date.now() - startTime;
      if (result.success) {
        this.logger.info('Traditional agent initialization successful', {
          initTimeMs: initTime,
          sessionId: result.sessionId,
        });
      } else {
        this.logger.error('Traditional agent initialization failed', {
          initTimeMs: initTime,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize agent';
      const initTime = Date.now() - startTime;

      this.logger.error('Agent initialization failed completely', {
        error: errorMessage,
        initTimeMs: initTime,
        stack: error instanceof Error ? error.stack : undefined,
      });
      await this.cleanup();
      return {
        success: false,
        error: errorMessage,
        coreReadyTimeMs: initTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed',
      };
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Set up tool registration callback to bridge MCP and Agent services
   */
  private setupToolRegistrationCallback(agent: SafeConversationalAgent): void {
    try {
      this.mcpService.setToolRegistrationCallback((serverId, tools) => {
        this.logger.info(
          `Tools registered for MCP server ${serverId}:`,
          tools.map((t) => t.name)
        );

        const agentWithTools = agent as unknown as {
          registerMCPTools?: (
            serverId: string,
            tools: Array<{ name: string }>
          ) => void;
          registerTools?: (tools: Array<{ name: string }>) => void;
        };
        if (typeof agentWithTools.registerMCPTools === 'function') {
          agentWithTools.registerMCPTools(serverId, tools);
          this.logger.debug(
            `Registered ${tools.length} tools from server ${serverId} with agent`
          );
        } else if (typeof agentWithTools.registerTools === 'function') {
          agentWithTools.registerTools(tools);
          this.logger.debug(
            `Registered ${tools.length} tools from server ${serverId} with agent`
          );
        } else {
          this.logger.warn(
            `Agent does not have tool registration methods for server ${serverId}`
          );
        }
      });

      this.logger.info('Tool registration callback set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up tool registration callback:', error);
    }
  }

  /**
   * Traditional agent initialization (fallback method)
   */
  async initializeTraditional(config: AgentConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }> {
    const startTime = Date.now();
    const initSteps = {
      mcpLoading: false,
      agentCreation: false,
      agentInitialization: false,
      complete: false,
    };

    try {
      this.logger.info('Starting traditional agent initialization');

      this.logger.info('Loading MCP servers...');
      initSteps.mcpLoading = true;

      let mcpServers = config.mcpServers as unknown as
        | LibMCPServerConfig[]
        | undefined;
      if (!mcpServers) {
        try {
          const loadedServers = await this.mcpServiceWrapper.loadServers();
          mcpServers = loadedServers.map((server): LibMCPServerConfig => {
            let command: string;
            let args: string[] = [];

            switch (server.type) {
              case 'filesystem':
                command = 'npx';
                args = [
                  '-y',
                  '@modelcontextprotocol/server-filesystem',
                  (server.config as { rootPath?: string }).rootPath ||
                    process.cwd(),
                ];
                break;
              case 'github':
                command = 'npx';
                args = ['-y', '@modelcontextprotocol/server-github'];
                break;
              case 'postgres':
                command = 'npx';
                args = ['-y', '@modelcontextprotocol/server-postgres'];
                break;
              case 'sqlite': {
                const sqliteConfig = server.config as { path?: string };
                command = 'npx';
                args = [
                  '-y',
                  '@modelcontextprotocol/server-sqlite',
                  sqliteConfig.path || 'database.sqlite',
                ];
                break;
              }
              case 'custom': {
                const isCustomConfig = (
                  config: unknown
                ): config is { command?: string; args?: string | string[] } => {
                  return typeof config === 'object' && config !== null;
                };

                if (isCustomConfig(server.config)) {
                  const customConfig = server.config;
                  command = customConfig.command || 'npx';
                  if (customConfig.args) {
                    args = Array.isArray(customConfig.args)
                      ? customConfig.args
                      : customConfig.args.split(' ');
                  } else {
                    args = [];
                  }
                } else {
                  command = 'npx';
                  args = [];
                }
                break;
              }
              default: {
                const isDefaultConfig = (
                  config: unknown
                ): config is { command?: string } => {
                  return typeof config === 'object' && config !== null;
                };

                if (isDefaultConfig(server.config)) {
                  const defaultConfig = server.config;
                  command = defaultConfig.command || 'echo';
                  args = ['Unknown server type'];
                } else {
                  command = 'echo';
                  args = ['Unknown server type'];
                }
              }
            }

            return {
              name: server.name,
              command,
              args,
              autoConnect: true,
            };
          });

          this.logger.info(`Loaded ${mcpServers.length} MCP servers`);
        } catch (mcpError) {
          this.logger.warn(
            'Failed to load MCP servers, continuing without them:',
            mcpError
          );
          mcpServers = [];
        }
      }

      this.logger.info('Preparing agent configuration...');
      let modelName = config.modelName || 'gpt-4o-mini';
      if (config.llmProvider === 'openai' && modelName.startsWith('openai/')) {
        modelName = modelName.replace('openai/', '');
      }
      if (
        config.llmProvider === 'anthropic' &&
        modelName.startsWith('anthropic/')
      ) {
        modelName = modelName.replace('anthropic/', '');
      }

      const wallet = getCurrentWallet();
      const userAccountId = config.userAccountId || wallet?.accountId || config.accountId;

      const agentConfig: SafeAgentConfig = {
        accountId: config.accountId,
        userAccountId,
        privateKey: config.privateKey,
        network: config.network as unknown as NetworkType,
        openAIApiKey: config.openAIApiKey,
        openAIModelName: modelName,
        operationalMode:
          (config.operationalMode as AgentOperationalMode) || 'autonomous',
        llmProvider: config.llmProvider,
        mcpServers,
        entityMemoryEnabled: true,
        entityMemoryConfig: {
          modelName: modelName || 'gpt-4o',
          storageLimit: 1000,
        },
        verbose: config.verbose ?? false,
        disableLogging: config.disableLogging ?? true,
        walletExecutor: async (base64, net) => {
          return await executeWithWallet(base64, net === 'mainnet' ? 'mainnet' : 'testnet');
        },
      };

      this.logger.info('Creating conversational agent instance...');
      initSteps.agentCreation = true;

      const conversationalAgent = new SafeConversationalAgent(agentConfig);

      this.logger.info('Initializing conversational agent...');
      initSteps.agentInitialization = true;

      const agentInitTimeout = 45000;
      const agentInitPromise = conversationalAgent.initialize();
      const agentTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Agent initialization timed out after ${agentInitTimeout / 1000} seconds`
            )
          );
        }, agentInitTimeout);
      });

      await Promise.race([agentInitPromise, agentTimeoutPromise]);

      this.agent = conversationalAgent;
      this.entityResolver = new EntityResolver({
        apiKey: config.openAIApiKey,
        modelName: config.modelName || 'gpt-4o-mini',
      });
      this.initialized = true;
      this.sessionId = `session-${Date.now()}`;

      this.setupToolRegistrationCallback(conversationalAgent);

      initSteps.complete = true;

      const initTime = Date.now() - startTime;
      this.logger.info('Agent initialized successfully (traditional method)', {
        initTimeMs: initTime,
        sessionId: this.sessionId,
        mcpServerCount: mcpServers?.length || 0,
      });

      return {
        success: true,
        sessionId: this.sessionId,
        coreReadyTimeMs: initTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'completed',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize agent';
      const initTime = Date.now() - startTime;

      let failedStep = 'unknown';
      if (!initSteps.mcpLoading) {
        failedStep = 'mcp-loading';
      } else if (!initSteps.agentCreation) {
        failedStep = 'agent-creation';
      } else if (!initSteps.agentInitialization) {
        failedStep = 'agent-initialization';
      } else if (!initSteps.complete) {
        failedStep = 'completion';
      }

      this.logger.error('Traditional agent initialization failed', {
        error: errorMessage,
        failedStep,
        initTimeMs: initTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: `Agent initialization failed at ${failedStep} step: ${errorMessage}`,
        coreReadyTimeMs: initTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed',
      };
    }
  }

  /**
   * Cleanup agent resources and reset state
   */
  async cleanup(): Promise<void> {
    try {
      if (this.agent) {
        if (this.agent.cleanup) {
          await this.agent.cleanup();
        }
        this.agent = null;
      }
      this.initialized = false;
      this.sessionId = null;
      this.entityResolver = null;
      this.logger.info('Agent cleanup completed');
    } catch (error) {
      this.logger.error('Error during agent cleanup:', error);
    }
  }

  /**
   * Get agent status
   */
  getStatus(): {
    isInitialized: boolean;
    isInitializing: boolean;
    sessionId: string | null;
  } {
    return {
      isInitialized: this.initialized,
      isInitializing: this.initializing,
      sessionId: this.sessionId,
    };
  }

  /**
   * Check if core functionality is ready (for progressive loading)
   */
  isCoreFunctionalityReady(): boolean {
    if (!this.agentLoader) {
      return false;
    }
    return this.agentLoader.isCoreFunctionalityReady();
  }

  /**
   * Get current loading state (for progressive loading)
   */
  getLoadingState(): LoadingState {
    if (!this.agentLoader) {
      return {
        isLoading: true,
        status: 'pending',
        phase: 'pending',
        progress: 0,
      };
    }
    const progressiveState = this.agentLoader.getLoadingState();
    return {
      isLoading:
        !progressiveState.isCoreFunctionalityReady ||
        progressiveState.backgroundTasksRemaining > 0,
      status: progressiveState.currentPhase || 'loading',
      phase: progressiveState.currentPhase,
      progress: progressiveState.totalProgress,
    };
  }

  /**
   * Wait for all background tasks to complete
   */
  async waitForBackgroundTasks(timeoutMs: number = 30000): Promise<boolean> {
    if (!this.agentLoader) {
      return Promise.resolve(true);
    }
    return this.agentLoader.waitForBackgroundTasks(timeoutMs);
  }

  /**
   * Get the current agent instance
   */
  getAgent(): SafeConversationalAgent | null {
    return this.agent;
  }

  /**
   * Get entity resolver instance
   */
  getEntityResolver(): EntityResolver | null {
    return this.entityResolver;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Set agent loader instance
   */
  setAgentLoader(agentLoader: AgentLoader): void {
    this.agentLoader = agentLoader;
  }
}
