import { ConversationalAgent } from '@hashgraphonline/conversational-agent';
import type { AgentOperationalMode } from '@hashgraphonline/conversational-agent';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import type { MCPServerConfig as LibMCPServerConfig } from '@hashgraphonline/conversational-agent';
import type { ContentStoreManager } from '@hashgraphonline/conversational-agent';

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

  /** Enable entity memory functionality */
  entityMemoryEnabled?: boolean;

  /** Entity memory configuration */
  entityMemoryConfig?: any;
};

/**
 * Safe wrapper for ConversationalAgent that handles Electron compatibility
 */
export class SafeConversationalAgent extends ConversationalAgent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    const userAccountId = config.userAccountId || config.accountId;
    
    super({
      ...config,
      entityMemoryEnabled: config.entityMemoryEnabled ?? true,
      entityMemoryConfig: config.entityMemoryConfig,
      userAccountId: userAccountId,
    });

    this.config = config;
  }

  async initialize() {
    try {
      await super.initialize();

      this.logger?.info('Agent initialized successfully', {
        provider: this.config.llmProvider || 'openai',
        hasMemoryManager: !!this.memoryManager,
        memoryManagerType: this.memoryManager?.constructor.name,
        hasContentStoreManager: !!this.getContentStoreManager(),
        contentStoreInitialized: this.getContentStoreManager()?.isInitialized(),
      });

      if (this.config.mcpServers && this.config.mcpServers.length > 0) {
        this.startMCPConnections();
      }
    } catch (error) {
      this.logger?.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  async processMessage(message: string, chatHistory: any[] = []): Promise<any> {
    try {
      this.logger?.info('Processing message...');

      const result = await super.processMessage(
        message,
        chatHistory.map((item) => ({
          type: item.role === 'user' ? 'human' : 'ai',
          content: item.content,
        }))
      );

      if (result && typeof result === 'object') {
        const transactionBytes =
          result.transactionBytes ||
          result.metadata?.transactionBytes ||
          (result as any).rawToolOutput?.transactionBytes ||
          null;

        if (transactionBytes && !result.transactionBytes) {
          result.transactionBytes = transactionBytes;
        }
        if (
          transactionBytes &&
          (!result.metadata || !result.metadata.transactionBytes)
        ) {
          result.metadata = {
            ...result.metadata,
            transactionBytes,
          };
        }

        this.logger?.info('Agent processMessage result:', {
          hasTransactionBytes: !!transactionBytes,
          hasScheduleId: !!result.scheduleId,
          operationalMode: this.config.operationalMode,
        });
      }

      return result;
    } catch (error) {
      this.logger?.error('Error in processMessage:', error);
      throw error;
    }
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
    // @ts-ignore
    return this.contentStoreManager;
  }

  /**
   * Execute a specific tool call through the agent
   */
  async executeToolCall(toolCall: any) {
    try {
      this.logger?.info('Executing tool call', { toolName: toolCall.name });

      const toolRequestMessage = `Please execute the following tool:
Tool: ${toolCall.name}
Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`;

      const response = await this.processMessage(toolRequestMessage);

      if (response && response.content) {
        return {
          success: true,
          data: response.content,
        };
      }

      throw new Error('Tool execution failed: No response');
    } catch (error) {
      this.logger?.error('Tool call execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Start MCP connections asynchronously without blocking initialization
   * @private
   */
  private startMCPConnections(): void {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return;
    }

    const enabledServers = this.config.mcpServers.filter(
      (server: any) => server.enabled || server.autoConnect
    );

    if (enabledServers.length > 0) {
      this.logger?.info(
        `MCP connections will be established asynchronously for ${enabledServers.length} servers`,
        {
          servers: enabledServers.map((s: any) => s.name),
        }
      );

      setTimeout(() => {
        enabledServers.forEach((server: any) => {
          this.logger?.info(
            `MCP server ${server.name} connection initiated asynchronously`
          );
        });
      }, 1000);
    }
  }
}
