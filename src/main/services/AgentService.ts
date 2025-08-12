import { SafeConversationalAgent } from './SafeConversationalAgent';
import type { AgentConfig as SafeAgentConfig } from './SafeConversationalAgent';
import type { AgentOperationalMode } from '@hashgraphonline/conversational-agent';
import type { MCPServerConfig as LibMCPServerConfig } from '@hashgraphonline/conversational-agent';
import { Logger } from '../utils/logger';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import { MCPService } from './MCPService';
import type { MCPServerConfig } from './MCPService';
import { AgentLoader } from './AgentLoader';
import type { ProgressiveLoadConfig } from '../../shared/types/mcp-performance';

export interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  modelName?: string;
  operationalMode?: 'autonomous' | 'returnBytes';
  llmProvider?: 'openai' | 'anthropic';
  mcpServers?: MCPServerConfig[];
  useProgressiveLoading?: boolean;
  progressiveLoadConfig?: Partial<ProgressiveLoadConfig>;
  verbose?: boolean;
  disableLogging?: boolean;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    transactionId?: string;
    scheduleId?: string;
    notes?: string[];
    transactionBytes?: string;
    [key: string]: any;
  };
}

export interface ChatHistory {
  type: 'human' | 'ai';
  content: string;
}

/**
 * Service for managing the ConversationalAgent instance in the main process
 */
export class AgentService {
  private static instance: AgentService;
  private agent: SafeConversationalAgent | null = null;
  private logger: Logger;
  private initializing = false;
  private initialized = false;
  private sessionId: string | null = null;
  private lastConfig: AgentConfig | null = null;
  private agentLoader!: AgentLoader;

  private constructor() {
    this.logger = new Logger({ module: 'AgentService' });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
      AgentService.instance.initializeProgressiveLoader();
    }
    return AgentService.instance;
  }

  /**
   * Initialize the agent loader and inject this service
   */
  private initializeProgressiveLoader(): void {
    this.agentLoader = AgentLoader.getInstance();
    this.agentLoader.setAgentService(this);
    this.logger.debug('Agent loader initialized with AgentService injection');
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
    if (this.agent && this.initialized && this.lastConfig) {
      const configChanged =
        this.lastConfig.openAIApiKey !== config.openAIApiKey ||
        this.lastConfig.accountId !== config.accountId ||
        this.lastConfig.privateKey !== config.privateKey ||
        this.lastConfig.operationalMode !== config.operationalMode ||
        this.lastConfig.modelName !== config.modelName ||
        this.lastConfig.llmProvider !== config.llmProvider;

      if (!configChanged) {
        return {
          success: true,
          sessionId: this.sessionId!,
          coreReadyTimeMs: 0,
          backgroundTasksRemaining: 0,
          loadingPhase: 'completed',
        };
      }

      this.logger.info('Config changed, reinitializing agent...', {
        modeChanged: this.lastConfig.operationalMode !== config.operationalMode,
        modelChanged: this.lastConfig.modelName !== config.modelName,
        providerChanged: this.lastConfig.llmProvider !== config.llmProvider,
        oldMode: this.lastConfig.operationalMode,
        newMode: config.operationalMode,
        oldModel: this.lastConfig.modelName,
        newModel: config.modelName,
      });
      this.agent = null;
      this.initialized = false;
    }

    if (this.initializing) {
      throw new Error('Agent is already initializing');
    }

    this.initializing = true;
    this.lastConfig = { ...config };

    try {
      if (config.useProgressiveLoading !== false) {
        this.logger.info(
          'Using progressive agent loading for enhanced performance'
        );

        if (!this.agentLoader) {
          this.initializeProgressiveLoader();
        }
        const progressiveResult = await this.agentLoader.loadAgent(
          config,
          config.progressiveLoadConfig
        );

        if (progressiveResult.success) {
          this.initialized = true;
          this.sessionId = progressiveResult.sessionId!;

          if (!this.agent) {
            this.logger.warn(
              'Agent not set after progressive initialization, this may indicate an issue'
            );
          }

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
      }

      this.logger.info('Using traditional agent loading');
      return await this.initializeTraditional(config);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize agent';
      this.logger.error('Failed to initialize agent:', error);

      return {
        success: false,
        error: errorMessage,
        coreReadyTimeMs: 0,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed',
      };
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Internal initialization method for progressive loader
   * This bypasses the initializing check to allow recursive calls
   */
  async initializeInternal(config: AgentConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
  }> {
    return await this.initializeTraditional(config);
  }

  /**
   * Traditional agent initialization (fallback method)
   */
  private async initializeTraditional(config: AgentConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }> {
    const startTime = Date.now();

    try {
      let mcpServers = config.mcpServers as unknown as
        | LibMCPServerConfig[]
        | undefined;
      if (!mcpServers) {
        const mcpService = MCPService.getInstance();
        const loadedServers = await mcpService.loadServers();

        mcpServers = loadedServers.map((server): LibMCPServerConfig => {
          let command: string;
          let args: string[] = [];

          switch (server.type) {
            case 'filesystem':
              command = 'npx';
              args = [
                '-y',
                '@modelcontextprotocol/server-filesystem',
                server.config.rootPath || process.cwd(),
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
            case 'sqlite':
              command = 'npx';
              args = [
                '-y',
                '@modelcontextprotocol/server-sqlite',
                server.config.path,
              ];
              break;
            case 'custom':
              command = server.config.command || 'npx';
              if (server.config.args) {
                args = Array.isArray(server.config.args)
                  ? server.config.args
                  : server.config.args.split(' ');
              } else {
                args = [];
              }
              break;
            default:
              command = server.config.command || 'echo';
              args = ['Unknown server type'];
          }

          return {
            name: server.name,
            command,
            args,
            autoConnect: true,
          };
        });
      }


      let modelName = config.modelName || 'gpt-4o-mini';
      if (config.llmProvider === 'openai' && modelName.startsWith('openai/')) {
        modelName = modelName.replace('openai/', '');
      }
      if (config.llmProvider === 'anthropic' && modelName.startsWith('anthropic/')) {
        modelName = modelName.replace('anthropic/', '');
      }

      const agentConfig: SafeAgentConfig = {
        accountId: config.accountId,
        privateKey: config.privateKey,
        network: config.network,
        openAIApiKey: config.openAIApiKey,
        openAIModelName: modelName,
        operationalMode:
          (config.operationalMode as AgentOperationalMode) || 'autonomous',
        llmProvider: config.llmProvider,
        mcpServers,
        entityMemoryEnabled: true,
        entityMemoryConfig: {},
        verbose: config.verbose ?? false,
        disableLogging: config.disableLogging ?? true,
      };

      const conversationalAgent = new SafeConversationalAgent(agentConfig);
      await conversationalAgent.initialize();

      this.agent = conversationalAgent;
      this.initialized = true;
      this.sessionId = `session-${Date.now()}`;

      if (mcpServers && mcpServers.length > 0) {
        const underlyingAgent = conversationalAgent.getAgent();
        this.logger.info(`Initiating background MCP connections for ${mcpServers.length} servers...`);
        
        setTimeout(() => {
          underlyingAgent.connectMCPServers().catch((error: any) => {
            this.logger.error('Failed to initiate MCP server connections:', error);
          });
        }, 100);
      }

      this.logger.info('Agent initialized successfully (traditional method)');
      const initTime = Date.now() - startTime;

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
      this.logger.error('Traditional agent initialization failed:', error);

      return {
        success: false,
        error: errorMessage,
        coreReadyTimeMs: Date.now() - startTime,
        backgroundTasksRemaining: 0,
        loadingPhase: 'failed',
      };
    }
  }

  /**
   * Extract transaction bytes from message content
   */
  private extractTransactionBytesFromMessage(
    messageContent: string
  ): string | null {
    this.logger.info('Attempting to extract transaction bytes from message:', {
      contentLength: messageContent.length,
      contentPreview: messageContent.substring(0, 300) + '...',
      hasCodeBlocks: messageContent.includes('```'),
    });

    const codeBlockRegex = /```[a-z]*\n([A-Za-z0-9+/]{50,}={0,2})\n```/g;
    const matches = [...messageContent.matchAll(codeBlockRegex)];

    this.logger.info('Code block regex matches found:', matches.length);

    for (const match of matches) {
      const potentialBytes = match[1];
      this.logger.info('Testing potential bytes from code block:', {
        length: potentialBytes?.length,
        preview: potentialBytes?.substring(0, 50) + '...',
      });

      if (potentialBytes && potentialBytes.length > 50) {
        try {
          Buffer.from(potentialBytes, 'base64');
          this.logger.info(
            'Valid base64 transaction bytes found in code block'
          );
          return potentialBytes;
        } catch (error) {
          this.logger.warn('Invalid base64 in code block:', error);
          continue;
        }
      }
    }

    const inlineRegex = /([A-Za-z0-9+/]{100,}={0,2})/g;
    const inlineMatches = [...messageContent.matchAll(inlineRegex)];

    this.logger.info('Inline regex matches found:', inlineMatches.length);

    for (const match of inlineMatches) {
      const potentialBytes = match[1];
      this.logger.info('Testing potential bytes inline:', {
        length: potentialBytes?.length,
        preview: potentialBytes?.substring(0, 50) + '...',
      });

      if (potentialBytes && potentialBytes.length > 100) {
        try {
          Buffer.from(potentialBytes, 'base64');
          this.logger.info('Valid base64 transaction bytes found inline');
          return potentialBytes;
        } catch (error) {
          this.logger.warn('Invalid base64 inline:', error);
          continue;
        }
      }
    }

    this.logger.warn('No valid transaction bytes found in message content');
    return null;
  }

  /**
   * Send message to agent
   */
  async sendMessage(
    content: string,
    chatHistory: ChatHistory[] = []
  ): Promise<{
    success: boolean;
    response?: AgentMessage;
    error?: string;
  }> {
    if (!this.agent || !this.initialized) {
      return {
        success: false,
        error: 'Agent not initialized',
      };
    }

    try {
      this.logger.info('Sending message to agent:', {
        content,
        historyLength: chatHistory.length,
      });

      const response = await this.agent.processMessage(content, chatHistory);

      this.logger.info(
        '[AgentService] Full agent response structure:',
        JSON.stringify(
          {
            hasMessage: !!response.message,
            hasOutput: !!response.output,
            hasTransactionBytes: !!response.transactionBytes,
            hasScheduleId: !!response.scheduleId,
            hasMetadata: !!response.metadata,
            hasIntermediateSteps: !!response.intermediateSteps,
            hasRawToolOutput: !!response.rawToolOutput,
            transactionBytesValue: response.transactionBytes,
            metadataTransactionBytes: response.metadata?.transactionBytes,
            messageLength: response.message?.length,
            outputLength: response.output?.length,
            directScheduleId: response.scheduleId,
            directSuccess: response.success,
            directOp: response.op,
            hasError: !!response.error,
            errorMessage: response.error,
          },
          null,
          2
        )
      );

      if (response.error) {
        this.logger.warn(
          '[AgentService] Agent returned error:',
          response.error
        );
        
        // Handle tool schema errors with a more user-friendly message
        if (response.error.includes('Received tool input did not match expected schema')) {
          response.message = 'I encountered an issue formatting the transfer request. Please try rephrasing your request, for example: "Send 1 HBAR to account 0.0.800"';
          response.output = response.message;
        }
      }

      if (Array.isArray(response.intermediateSteps)) {
        for (const step of response.intermediateSteps) {
          if (
            step.observation &&
            typeof step.observation === 'string' &&
            step.observation.toLowerCase().includes('error')
          ) {
            this.logger.warn(
              '[AgentService] Tool execution error detected:',
              step.observation
            );
          }
          if (
            step.observation &&
            typeof step.observation === 'object' &&
            step.observation.error
          ) {
            this.logger.warn(
              '[AgentService] Tool execution error in step:',
              step.observation.error
            );
          }
        }
      }

      if (response.message) {
        this.logger.info(
          '[AgentService] Message content (first 500 chars):',
          response.message.substring(0, 500)
        );
      }
      if (response.output) {
        this.logger.info(
          '[AgentService] Output content (first 500 chars):',
          response.output.substring(0, 500)
        );
      }

      const scheduleId = response.scheduleId;
      const description = response.description;

      if (scheduleId) {
        this.logger.info('Found schedule ID directly on response:', scheduleId);
      } else {
        this.logger.warn(
          'No schedule ID found on response. Check the agent configuration.'
        );
      }

      let transactionBytes =
        response.transactionBytes || response.metadata?.transactionBytes;
      this.logger.info('[AgentService] Initial transaction bytes check:', {
        fromResponse: !!response.transactionBytes,
        fromMetadata: !!response.metadata?.transactionBytes,
        value: transactionBytes
          ? transactionBytes.substring(0, 50) + '...'
          : 'none',
      });

      if (!transactionBytes) {
        const messageContent = response.message || response.output || '';
        this.logger.info(
          '[AgentService] No direct transaction bytes, attempting extraction from message content'
        );
        const extractedBytes =
          this.extractTransactionBytesFromMessage(messageContent);
        if (extractedBytes) {
          transactionBytes = extractedBytes;
          this.logger.info(
            '[AgentService] Successfully extracted transaction bytes from message:',
            {
              bytesLength: extractedBytes.length,
              preview: extractedBytes.substring(0, 50) + '...',
            }
          );
        } else {
          this.logger.warn(
            '[AgentService] Failed to extract transaction bytes from message content'
          );
        }
      }

      const agentMessage: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response.error || response.message || response.output || '',
        timestamp: new Date(),
        metadata: {
          transactionId: response.transactionId,
          scheduleId: scheduleId,
          notes: response.notes,
          transactionBytes: transactionBytes,
          description: description || response.description,
          isError: !!response.error,
          ...response.metadata,
        },
      };

      this.logger.info('Returning agent message:', {
        ...agentMessage,
        content: agentMessage.content?.substring(0, 100) + '...',
        metadata: {
          ...agentMessage.metadata,
          hasTransactionBytes: !!agentMessage.metadata?.transactionBytes,
          transactionBytesLength:
            agentMessage.metadata?.transactionBytes?.length || 0,
        },
      });

      return {
        success: true,
        response: agentMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message';
      this.logger.error('Failed to send message:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sends a message to the agent with file attachments using content references
   */
  async sendMessageWithAttachments(
    content: string,
    chatHistory: ChatHistory[] = [],
    attachments: Array<{
      name: string;
      data: string;
      type: string;
      size: number;
    }> = []
  ): Promise<{
    success: boolean;
    response?: AgentMessage;
    error?: string;
  }> {
    if (!this.agent || !this.initialized) {
      return {
        success: false,
        error: 'Agent not initialized',
      };
    }

    try {
      let processedContent = content;

      if (attachments.length > 0) {
        this.logger.info(
          'Processing attachments with content reference system:',
          {
            attachmentCount: attachments.length,
            totalSize: attachments.reduce((sum, att) => sum + att.size, 0),
            attachmentNames: attachments.map((a) => a.name),
          }
        );

        const contentStoreManager = this.agent.getContentStoreManager();
        
        this.logger.info('Using ContentStoreManager for attachment storage:', {
          hasContentStoreManager: !!contentStoreManager,
          isInitialized: contentStoreManager?.isInitialized(),
        });

        if (contentStoreManager && contentStoreManager.isInitialized()) {
          const contentReferences: string[] = [];

          for (const attachment of attachments) {
            try {
              const base64Data = attachment.data.includes('base64,')
                ? attachment.data.split('base64,')[1]
                : attachment.data;
              const buffer = Buffer.from(base64Data, 'base64');

              this.logger.info('Attempting to store content for file:', {
                fileName: attachment.name,
                bufferSize: buffer.length,
                originalSize: attachment.size,
                contentType: attachment.type,
              });

              const contentRef = await contentStoreManager.storeContentIfLarge(
                buffer,
                {
                  mimeType: attachment.type,
                  source: 'user_upload',
                  fileName: attachment.name,
                  tags: ['attachment', 'user_file'],
                }
              );

              this.logger.info('Content storage result:', {
                fileName: attachment.name,
                contentRefCreated: !!contentRef,
                contentRefId: contentRef?.referenceId,
              });

              if (contentRef) {
                if (attachment.type.startsWith('image/')) {
                  contentReferences.push(
                    `[Image File: ${attachment.name}] (content-ref:${contentRef.referenceId})`
                  );
                } else {
                  contentReferences.push(
                    `[File: ${attachment.name}] (content-ref:${contentRef.referenceId})`
                  );
                }

                this.logger.info('Stored attachment as content reference:', {
                  fileName: attachment.name,
                  referenceId: contentRef.referenceId,
                  originalSize: attachment.size,
                  contentType: attachment.type,
                });
              } else {
                if (attachment.size < 50000) {
                  if (attachment.type.startsWith('image/')) {
                    contentReferences.push(
                      `![${attachment.name}](data:${attachment.type};base64,${base64Data})`
                    );
                  } else {
                    contentReferences.push(
                      `[File: ${attachment.name} (${(
                        attachment.size / 1024
                      ).toFixed(1)}KB)]\nContent: ${base64Data}`
                    );
                  }
                } else {
                  contentReferences.push(
                    `[File: ${attachment.name} (${(
                      attachment.size / 1024
                    ).toFixed(1)}KB) - Content too large to include inline]`
                  );
                }

                this.logger.info(
                  'Content not stored as reference (size-based decision):',
                  {
                    fileName: attachment.name,
                    size: attachment.size,
                    includeInline: attachment.size < 50000,
                  }
                );
              }
            } catch (error) {
              this.logger.error('Failed to process attachment:', {
                fileName: attachment.name,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              contentReferences.push(
                `[File: ${attachment.name} - Error processing file: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }]`
              );
            }
          }

          const fileList = attachments
            .map((file) => {
              const sizeStr =
                file.size > 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                  : `${(file.size / 1024).toFixed(1)}KB`;
              return `📎 ${file.name} (${sizeStr})`;
            })
            .join('\n');

          processedContent = content
            ? `${content}\n\nAttached files:\n${fileList}\n\n${contentReferences.join(
                '\n'
              )}`
            : `Attached files:\n${fileList}\n\n${contentReferences.join('\n')}`;

          this.logger.info('Final processed message length:', {
            originalContentLength: content.length,
            processedContentLength: processedContent.length,
            attachmentsProcessed: contentReferences.length,
          });
        } else {
          this.logger.warn(
            'Content storage not available, creating simple file references'
          );

          const fileReferences = attachments.map((attachment) => {
            const sizeStr =
              attachment.size > 1024 * 1024
                ? `${(attachment.size / (1024 * 1024)).toFixed(1)}MB`
                : `${(attachment.size / 1024).toFixed(1)}KB`;

            if (attachment.type.startsWith('image/')) {
              return `📎 Image: ${attachment.name} (${sizeStr}, ${attachment.type})`;
            } else {
              return `📎 File: ${attachment.name} (${sizeStr}, ${attachment.type})`;
            }
          });

          processedContent = content
            ? `${content}\n\nAttached files:\n${fileReferences.join('\n')}`
            : `Attached files:\n${fileReferences.join('\n')}`;

          this.logger.warn(
            'Created simple file references without content storage'
          );
        }
      }

      this.logger.info('Sending processed message to agent:', {
        messageLength: processedContent.length,
        messagePreview: processedContent.substring(0, 200) + '...',
      });

      return await this.sendMessage(processedContent, chatHistory);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to send message with attachments';
      this.logger.error('Failed to send message with attachments:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Disconnect agent
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      this.agent = null;
      this.initialized = false;
      this.initializing = false;
      this.sessionId = null;

      this.logger.info('Agent disconnected successfully');

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to disconnect';
      this.logger.error('Failed to disconnect agent:', error);

      return {
        success: false,
        error: errorMessage,
      };
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
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if agent is initializing
   */
  isInitializing(): boolean {
    return this.initializing;
  }

  /**
   * Get the current agent instance
   */
  getAgent(): SafeConversationalAgent | null {
    return this.agent;
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
  getLoadingState(): any {
    if (!this.agentLoader) {
      return {
        phase: 'pending',
        progress: 0,
        coreReady: false,
        mcpConnectionsReady: false,
        backgroundTasksComplete: false,
      };
    }
    return this.agentLoader.getLoadingState();
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
   * Get performance metrics from all optimization systems
   */
  getPerformanceMetrics(): {
    agentMetrics: any;
    mcpMetrics?: any;
    progressiveLoading?: any;
  } {
    const mcpService = MCPService.getInstance();

    return {
      agentMetrics: {
        initialized: this.initialized,
        initializing: this.initializing,
        sessionId: this.sessionId,
        hasAgent: !!this.agent,
      },
      mcpMetrics: mcpService.getPerformanceMetrics(),
      progressiveLoading: this.agentLoader
        ? this.agentLoader.getPerformanceMetrics()
        : null,
    };
  }

  /**
   * Force progressive loading for next initialization
   */
  enableProgressiveLoading(config?: Partial<ProgressiveLoadConfig>): void {
    if (!this.agentLoader) {
      this.initializeProgressiveLoader();
    }
    if (config) {
      this.agentLoader.updateConfig(config);
    }
    this.logger.info(
      'Progressive loading enabled for next initialization',
      config || {}
    );
  }

  /**
   * Cleanup performance optimization resources
   */
  async cleanupOptimizations(): Promise<void> {
    this.logger.info('Cleaning up agent service optimization resources');
    if (this.agentLoader) {
      await this.agentLoader.cleanup();
    }

    const mcpService = MCPService.getInstance();
    await mcpService.cleanupOptimizations();
  }

  /**
   * Store entity association in memory for later resolution
   */
  storeEntityAssociation(
    entityId: string,
    entityName: string,
    entityType: string,
    transactionId?: string
  ): void {
    try {
      if (!this.agent) {
        this.logger.warn(
          'Cannot store entity association: Agent not initialized'
        );
        return;
      }

      const safeAgent = this.agent as any;
      if (
        safeAgent.memoryManager &&
        typeof safeAgent.memoryManager.storeEntityAssociation === 'function'
      ) {
        safeAgent.memoryManager.storeEntityAssociation(
          entityId,
          entityName,
          entityType,
          transactionId
        );
        this.logger.info('Stored entity association:', {
          entityName,
          entityType,
          entityId,
          transactionId,
        });
      } else {
        this.logger.warn('Memory manager not available for entity storage');
      }
    } catch (error) {
      this.logger.error('Failed to store entity association:', error);
    }
  }

  /**
   * Reinitialize agent with performance optimizations
   */
  async reinitializeWithOptimizations(
    config: AgentConfig,
    progressiveConfig?: Partial<ProgressiveLoadConfig>
  ): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    performanceGain?: string;
  }> {
    const startTime = Date.now();

    if (this.agent) {
      await this.disconnect();
    }

    const optimizedConfig = {
      ...config,
      useProgressiveLoading: true,
      progressiveLoadConfig: {
        coreAgentTimeoutMs: 3000,
        mcpConnectionBatchSize: 3,
        mcpConnectionDelayMs: 1000,
        backgroundConnectionsEnabled: true,
        ...progressiveConfig,
      },
    };

    const result = await this.initialize(optimizedConfig);

    if (result.success && result.coreReadyTimeMs) {
      const performanceGain =
        result.coreReadyTimeMs < 5000
          ? `${Math.round(
              ((5000 - result.coreReadyTimeMs) / 5000) * 100
            )}% faster`
          : 'Standard performance';

      return {
        ...result,
        performanceGain,
      };
    }

    return result;
  }

  /**
   * Get MCP connection status for all servers
   * @returns {Promise<Map<string, any> | null>} Connection status map or null if agent not initialized
   */
  async getMCPConnectionStatus(): Promise<Map<string, any> | null> {
    if (!this.agent || !this.initialized) {
      this.logger.warn('Cannot get MCP status: agent not initialized');
      return null;
    }

    try {
      if (typeof (this.agent as any).getMCPConnectionStatus === 'function') {
        return (this.agent as any).getMCPConnectionStatus();
      }

      this.logger.debug('Agent does not support MCP connection status');
      return new Map();
    } catch (error) {
      this.logger.error('Failed to get MCP connection status:', error);
      return null;
    }
  }

  /**
   * Check if a specific MCP server is connected
   * @param {string} serverName - Name of the server to check
   * @returns {Promise<boolean>} True if connected, false otherwise
   */
  async isMCPServerConnected(serverName: string): Promise<boolean> {
    if (!this.agent || !this.initialized) {
      return false;
    }

    try {
      if (typeof (this.agent as any).isMCPServerConnected === 'function') {
        return (this.agent as any).isMCPServerConnected(serverName);
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check MCP server connection status for ${serverName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get summary of MCP connection status
   * @returns {Promise<{total: number, connected: number, pending: number, failed: number}>}
   */
  async getMCPConnectionSummary(): Promise<{
    total: number;
    connected: number;
    pending: number;
    failed: number;
  }> {
    const status = await this.getMCPConnectionStatus();

    if (!status) {
      return { total: 0, connected: 0, pending: 0, failed: 0 };
    }

    let connected = 0;
    let pending = 0;
    let failed = 0;

    status.forEach((serverStatus: any) => {
      if (serverStatus.connected === true) {
        connected++;
      } else if (serverStatus.error) {
        failed++;
      } else {
        pending++;
      }
    });

    return {
      total: status.size,
      connected,
      pending,
      failed,
    };
  }
}
