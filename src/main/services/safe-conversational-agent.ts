import { ConversationalAgent } from '@hashgraphonline/conversational-agent';
import type {
  AgentOperationalMode,
  ChatResponse,
  SmartMemoryConfig,
} from '@hashgraphonline/conversational-agent';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import type { MCPServerConfig as LibMCPServerConfig } from '@hashgraphonline/conversational-agent';
import type {
  ContentStoreManager,
  FormSubmission,
} from '@hashgraphonline/conversational-agent';
import { ChatHistory } from '../interfaces/services';

interface MCPServerConfiguration {
  name: string;
  enabled: boolean;
  autoConnect?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Configuration interface extending ConversationalAgentOptions with entity memory options
 */
export type AgentConfig = {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  openAIModelName?: string;
  llmProvider?: 'openai' | 'anthropic';
  operationalMode?: AgentOperationalMode;
  userAccountId?: string;
  mcpServers?: LibMCPServerConfig[];
  verbose?: boolean;
  disableLogging?: boolean;
  walletExecutor?: (base64: string, network: 'mainnet' | 'testnet') => Promise<{ transactionId: string }>;

  /** Enable entity memory functionality */
  entityMemoryEnabled?: boolean;

  /** Entity memory configuration */
  entityMemoryConfig?: SmartMemoryConfig;
};

/**
 * Safe wrapper for ConversationalAgent that handles Electron compatibility
 */
export class SafeConversationalAgent extends ConversationalAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    const userAccountId = config.userAccountId || config.accountId;
    const normalizedMode =
      (config.operationalMode as string) === 'provideBytes'
        ? ('returnBytes' as AgentOperationalMode)
        : (config.operationalMode as AgentOperationalMode);

    super({
      ...config,
      operationalMode: normalizedMode,
      entityMemoryEnabled: config.entityMemoryEnabled ?? true,
      entityMemoryConfig: config.entityMemoryConfig,
      userAccountId: userAccountId,
      verbose: true,
      walletExecutor: config.walletExecutor,
    });

    this.config = config;
  }

  async initialize() {
    const initTimeout = 30000;

    try {
      this.logger?.info('Starting SafeConversationalAgent initialization', {
        provider: this.config.llmProvider || 'openai',
        operationalMode: this.config.operationalMode,
        hasAccountId: !!this.config.accountId,
        hasPrivateKey: !!this.config.privateKey,
        mcpServerCount: this.config.mcpServers?.length || 0,
      });

      const initPromise = super.initialize();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Base agent initialization timed out after ${initTimeout / 1000} seconds`
            )
          );
        }, initTimeout);
      });

      await Promise.race([initPromise, timeoutPromise]);

      this.logger?.info('Agent initialized successfully', {
        provider: this.config.llmProvider || 'openai',
        hasMemoryManager: !!this.memoryManager,
        memoryManagerType: this.memoryManager?.constructor.name,
        hasContentStoreManager: !!this.getContentStoreManager(),
        contentStoreInitialized: this.getContentStoreManager()?.isInitialized(),
        mcpServerCount: this.config.mcpServers?.length || 0,
      });

      if (this.config.mcpServers && this.config.mcpServers.length > 0) {
        this.startMCPConnections();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown initialization error';
      this.logger?.error('Failed to initialize SafeConversationalAgent:', {
        error: errorMessage,
        provider: this.config.llmProvider || 'openai',
        operationalMode: this.config.operationalMode,
        stack: error instanceof Error ? error.stack : undefined,
      });

      try {
        await this.cleanup();
      } catch (cleanupError) {
        this.logger?.error(
          'Error during cleanup after initialization failure:',
          cleanupError
        );
      }

      throw new Error(
        `SafeConversationalAgent initialization failed: ${errorMessage}`
      );
    }
  }

  async processMessage(
    message: string,
    conversationIdOrChatHistory?: string | ChatHistory[]
  ): Promise<ChatResponse> {
    try {
      this.logger?.info('Processing message...');

      let conversationalAgentHistory: Array<{
        type: 'human' | 'ai' | 'system';
        content: string;
      }> = [];
      if (Array.isArray(conversationIdOrChatHistory)) {
        conversationalAgentHistory = conversationIdOrChatHistory.map(
          (item: ChatHistory) => ({
            type: ['user', 'assistant', 'system'].includes(item.type as string)
              ? (item.type as 'human' | 'ai' | 'system')
              : 'human',
            content: (item.content as string) || '',
          })
        );
      }

      const result = await super.processMessage(
        message,
        conversationalAgentHistory
      );

      if (result && typeof result === 'object') {
        const resultObj = result as Record<string, unknown>;
        const transactionBytes =
          resultObj.transactionBytes ||
          (resultObj.metadata as Record<string, unknown>)?.transactionBytes ||
          (resultObj.rawToolOutput as Record<string, unknown>)
            ?.transactionBytes ||
          null;

        if (transactionBytes && !resultObj.transactionBytes) {
          resultObj.transactionBytes = transactionBytes;
        }
        if (
          transactionBytes &&
          (!resultObj.metadata ||
            (typeof resultObj.metadata === 'object' &&
              !(resultObj as { metadata: Record<string, unknown> }).metadata
                .transactionBytes))
        ) {
          const existingMeta =
            (resultObj.metadata && typeof resultObj.metadata === 'object'
              ? (resultObj.metadata as Record<string, unknown>)
              : {}) || {};
          resultObj.metadata = {
            ...existingMeta,
            transactionBytes,
          } as Record<string, unknown>;
        }

        const formMsg = (resultObj as { formMessage?: { id?: unknown } })
          .formMessage;
        if (formMsg && resultObj.requiresForm) {
          this.logger?.info(
            'Form generation detected in SafeConversationalAgent:',
            {
              formId: (formMsg as { id?: unknown }).id,
              requiresForm: resultObj.requiresForm,
            }
          );
        }

        this.logger?.info('Agent processMessage result:', {
          hasTransactionBytes: !!transactionBytes,
          hasScheduleId: !!resultObj.scheduleId,
          operationalMode: this.config.operationalMode,
        });
      }

      return result;
    } catch (error) {
      this.logger?.error('Error in processMessage:', error);
      throw error;
    }
  }

  /**
   * Process a form submission via the underlying agent's native API when available
   */
  async processFormSubmission(submission: {
    formId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    timestamp: number;
    context?: {
      originalPrompt?: string;
      partialInput?: Record<string, unknown>;
      chatHistory?: ChatHistory[];
    };
  }): Promise<ChatResponse> {
    const safeSubmissionData = submission?.parameters || {};

    this.logger?.info('SafeConversationalAgent processing form submission:', {
      formId: submission?.formId,
      toolName: submission?.toolName,
      parametersIsNull: submission?.parameters === null,
      parametersIsUndefined: submission?.parameters === undefined,
      safeDataKeys: Object.keys(safeSubmissionData),
    });

    const agent = this.getAgent();

    const hasHandler =
      typeof (agent as { processFormSubmission?: unknown })
        .processFormSubmission === 'function';

    if (hasHandler) {
      const formSubmission: FormSubmission = {
        formId: submission.formId,
        toolName: submission.toolName,
        parameters: safeSubmissionData,
        timestamp: submission.timestamp,
        context: submission.context as unknown as {
          chatHistory?: ChatHistory[];
          metadata?: Record<string, unknown>;
        },
      };

      try {
        const result = await (
          agent as {
            processFormSubmission: (
              submission: FormSubmission
            ) => Promise<ChatResponse>;
          }
        ).processFormSubmission(formSubmission);

        return result;
      } catch (error) {
        this.logger?.error(
          'SafeConversationalAgent form submission error:',
          error
        );
        throw error;
      }
    }

    const fallbackMessage = `Submit form ${submission.formId} with data: ${JSON.stringify(
      safeSubmissionData
    )}`;
    return this.processMessage(
      fallbackMessage,
      submission.context?.chatHistory || []
    );
  }

  async disconnect(): Promise<void> {
    try {
      this.logger?.info('Disconnecting SafeConversationalAgent...');
      await this.cleanup();
      this.logger?.info('SafeConversationalAgent disconnected successfully');
    } catch (error) {
      this.logger?.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Get the ContentStoreManager instance
   */
  getContentStoreManager(): ContentStoreManager | undefined {
    return this.contentStoreManager;
  }

  /**
   * Start MCP connections asynchronously without blocking initialization
   * @private
   */
  private startMCPConnections(): void {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return;
    }

    const serversForLog = this.config.mcpServers.map((s: unknown) => {
      const obj = (s || {}) as Record<string, unknown>;
      return {
        name: (obj.name as string) || 'MCP Server',
        enabled: Boolean(obj.enabled ?? true),
        autoConnect: Boolean(obj.autoConnect ?? true),
      };
    });

    const enabledServers = serversForLog.filter(
      (server) => server.enabled || server.autoConnect
    );

    if (enabledServers.length > 0) {
      this.logger?.info(
        `MCP connections will be established asynchronously for ${enabledServers.length} servers`,
        {
          servers: enabledServers.map((s) => s.name),
        }
      );

      setTimeout(() => {
        enabledServers.forEach((server) => {
          this.logger?.info(
            `MCP server ${server.name} connection initiated asynchronously`
          );
        });
      }, 1000);
    }
  }
}
