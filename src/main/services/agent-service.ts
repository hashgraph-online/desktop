import { Logger } from '../utils/logger';
import {
  FormatConverterRegistry,
  TopicIdToHrlConverter,
} from '@hashgraphonline/conversational-agent';
import { StringNormalizationConverter } from '@hashgraphonline/conversational-agent';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import type { ChatHistory, ServiceDependencies } from '../interfaces/services';
import { AgentLoader } from './agent-loader';
import type { ProgressiveLoadConfig } from '../../shared/types/mcp-performance';
import { SessionService } from './session-service';
import { ParameterService } from './parameter-service';
import { MCPConnectionService } from './mcp-connection-service';
import { MemoryService } from './memory-service';
import { InitializationService } from './initialization-service';
import { MessageService } from './message-service';
import { EntityService } from './entity-service';
import { SafeConversationalAgent } from './safe-conversational-agent';
import type { MCPServer } from '../db/schema';

export interface SessionContext {
  sessionId: string;
  mode: 'personal' | 'hcs10';
  topicId?: string;
}

export interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: NetworkType;
  openAIApiKey: string;
  modelName?: string;
  operationalMode?: 'autonomous' | 'provideBytes';
  llmProvider?: 'openai' | 'anthropic';
  mcpServers?: MCPServer[];
  useProgressiveLoading?: boolean;
  progressiveLoadConfig?: Partial<ProgressiveLoadConfig>;
  verbose?: boolean;
  disableLogging?: boolean;
}

interface LoadingState {
  isLoading: boolean;
  status: string;
  progress?: number;
  phase?: string;
}

interface AgentMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
}

interface MCPMetrics {
  connectedServers: number;
  totalServers: number;
  averageLatency: number;
  errorRate: number;
}

interface ProgressiveLoadingMetrics {
  totalPhases: number;
  completedPhases: number;
  currentPhase?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Facade service that orchestrates all agent-related operations through specialized services
 * Maintains 100% backward compatibility while delegating to focused services
 */
export class AgentService {
  private static instance: AgentService;
  private logger: Logger;

  private sessionService: SessionService;
  private parameterService: ParameterService;
  private mcpConnectionService: MCPConnectionService;
  private memoryService: MemoryService;
  private initializationService: InitializationService;
  private messageService: MessageService;
  private entityService: EntityService;

  private formatConverterRegistry: FormatConverterRegistry;
  private agentLoader: AgentLoader;

  private constructor(
    dependencies?: ServiceDependencies,
    network?: NetworkType
  ) {
    this.logger = new Logger({ module: 'AgentService' });
    this.entityService = new EntityService();

    this.formatConverterRegistry = new FormatConverterRegistry();
    this.setupFormatConverters();

    this.sessionService = new SessionService();
    this.parameterService = new ParameterService(
      this.formatConverterRegistry,
      network
    );
    this.mcpConnectionService = new MCPConnectionService();
    this.memoryService = new MemoryService(this.entityService, network);
    this.initializationService = new InitializationService(dependencies);
    this.messageService = new MessageService();

    this.initializeProgressiveLoader();
    this.setupServiceConnections();
  }

  /**
   * Setup format converters for entity resolution
   */
  private setupFormatConverters(): void {
    this.formatConverterRegistry.register(new TopicIdToHrlConverter());
    this.formatConverterRegistry.register(new StringNormalizationConverter());
    this.logger.debug(
      'Format converters registered:',
      this.formatConverterRegistry.getRegisteredConverters()
    );
  }

  /**
   * Setup connections between services for proper orchestration
   */
  private setupServiceConnections(): void {
    this.messageService.setParameterService(this.parameterService);
    this.messageService.setOnEntityStored(
      (entityId, entityName, transactionId) => {
        this.memoryService.storeEntityAssociation(
          entityId,
          entityName,
          transactionId
        );
      }
    );

    this.memoryService.setSessionIdProvider(() => this.getCurrentSessionId());
  }

  /**
   * Get singleton instance
   */
  static getInstance(dependencies?: ServiceDependencies): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService(dependencies);
    }
    return AgentService.instance;
  }

  /**
   * Create a new instance for testing (bypasses singleton)
   */
  static createTestInstance(dependencies?: ServiceDependencies): AgentService {
    return new AgentService(dependencies);
  }

  /**
   * Initialize the agent loader and inject this service
   */
  private initializeProgressiveLoader(): void {
    this.agentLoader = AgentLoader.getInstance();
    this.agentLoader.setAgentService(this);
    this.initializationService.setAgentLoader(this.agentLoader);
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
    const result = await this.initializationService.initialize(config);

    if (result.success && result.sessionId) {
      this.sessionService.setSessionId(result.sessionId);

      const agent = this.initializationService.getAgent();
      const entityResolver = this.initializationService.getEntityResolver();

      if (agent) {
        this.mcpConnectionService.setAgent(agent);
        this.memoryService.setAgent(agent);
        this.messageService.setAgent(agent);

        if (entityResolver) {
          this.messageService.setEntityResolver(entityResolver);
        }

        this.memoryService.setupEntityHandlers(agent);
        await this.memoryService.loadStoredEntities(agent);
        this.setupParameterPreprocessing(agent);
      }
    }

    return result;
  }

  /**
   * @preserve
   * Internal initialization method for progressive loader
   * This method sets up all service dependencies for agent functionality
   */
  public async initializeInternal(config: AgentConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
  }> {
    const result =
      await this.initializationService.initializeTraditional(config);

    if (result.success && result.sessionId) {
      this.sessionService.setSessionId(result.sessionId);

      const agent = this.initializationService.getAgent();
      const entityResolver = this.initializationService.getEntityResolver();

      if (agent) {
        this.mcpConnectionService.setAgent(agent);
        this.memoryService.setAgent(agent);
        this.messageService.setAgent(agent);

        if (entityResolver) {
          this.messageService.setEntityResolver(entityResolver);
        }

        this.memoryService.setupEntityHandlers(agent);
        await this.memoryService.loadStoredEntities(agent);
        this.setupParameterPreprocessing(agent);
      }
    }

    return {
      success: result.success,
      sessionId: result.sessionId,
      error: result.error,
    };
  }

  /**
   * Setup parameter preprocessing for tool format conversion
   */
  private setupParameterPreprocessing(agent: unknown): void {
    try {
      const currentEntityResolver =
        this.initializationService.getEntityResolver();
      const tryAttach = (target: unknown) => {
        const t = target as {
          setParameterPreprocessingCallback?: (
            callback: (
              toolName: string,
              parameters: Record<string, unknown>,
              toolContext?: {
                entityResolutionPreferences?: Record<string, string>;
              }
            ) => Promise<Record<string, unknown>>
          ) => void;
        };
        if (typeof t.setParameterPreprocessingCallback === 'function') {
          this.parameterService.attachToAgent(t, {
            getSessionId: () => this.getCurrentSessionId(),
            getEntities: async () =>
              this.memoryService.getStoredEntities() as unknown as EntityAssociation[],
            entityResolver: currentEntityResolver || undefined,
          });
          this.logger.info(
            'Parameter preprocessing configured for agent (via ParameterService)'
          );
          return true;
        }
        return false;
      };

      const attachedTop = tryAttach(agent);
      if (!attachedTop) {
        const underlying = (
          agent as { getAgent?: () => unknown }
        )?.getAgent?.();
        if (underlying) {
          void tryAttach(underlying);
        }
      }
    } catch (error) {
      this.logger.error('Failed to setup parameter preprocessing:', error);
    }
  }

  /**
   * Update session context for entity resolution scoping
   */
  updateSessionContext(context: SessionContext): void {
    this.sessionService.updateContext(context);
    this.messageService.setSessionContext(context);
  }

  /**
   * Clear session context
   */
  clearSessionContext(): void {
    this.sessionService.clearContext();
  }

  /**
   * Get current session context
   */
  getSessionContext(): SessionContext | null {
    return this.sessionService.getContext();
  }

  getCurrentSessionId(): string | null {
    const context = this.getSessionContext();
    return context?.sessionId || null;
  }

  async getEntitiesForSession(): Promise<EntityAssociation[]> {
    const allEntities = this.memoryService.getStoredEntities();
    return allEntities as EntityAssociation[];
  }

  /**
   * Send message to agent
   */
  async sendMessage(
    content: string,
    chatHistory: ChatHistory[] = []
  ): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }> {
    return await this.messageService.sendMessage(content, chatHistory);
  }

  /**
   * Send message with attachments
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
    response?: unknown;
    error?: string;
  }> {
    return await this.messageService.sendMessageWithAttachments(
      content,
      chatHistory,
      attachments
    );
  }

  /**
   * Process form submission
   */
  async processFormSubmission(
    formSubmission: {
      formId: string;
      data: Record<string, unknown>;
      timestamp: number;
      toolName: string;
      originalPrompt?: string;
      partialInput?: Record<string, unknown>;
    },
    chatHistory: ChatHistory[] = []
  ): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }> {
    return await this.messageService.processFormSubmission(
      formSubmission,
      chatHistory
    );
  }

  /**
   * Disconnect agent
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.initializationService.cleanup();
      this.logger.info('Agent disconnected successfully');
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to disconnect';
      this.logger.error('Failed to disconnect agent:', error);
      return { success: false, error: errorMessage };
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
    return this.initializationService.getStatus();
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initializationService.getStatus().isInitialized;
  }

  /**
   * Check if agent is initializing
   */
  isInitializing(): boolean {
    return this.initializationService.getStatus().isInitializing;
  }

  /**
   * Get the current agent instance
   */
  getAgent(): SafeConversationalAgent | null {
    return this.initializationService.getAgent();
  }

  /**
   * Check if core functionality is ready
   */
  isCoreFunctionalityReady(): boolean {
    return this.initializationService.isCoreFunctionalityReady();
  }

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return this.initializationService.getLoadingState();
  }

  /**
   * Wait for background tasks to complete
   */
  async waitForBackgroundTasks(timeoutMs: number = 30000): Promise<boolean> {
    return this.initializationService.waitForBackgroundTasks(timeoutMs);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    agentMetrics: AgentMetrics;
    mcpMetrics?: MCPMetrics;
    progressiveLoading?: ProgressiveLoadingMetrics;
  } {
    return {
      agentMetrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        uptime: 0,
      },
    };
  }

  /**
   * Enable progressive loading
   */
  enableProgressiveLoading(config?: Partial<ProgressiveLoadConfig>): void {
    if (config) {
      this.agentLoader.updateConfig(config);
    }
    this.logger.info(
      'Progressive loading enabled for next initialization',
      config || {}
    );
  }

  /**
   * Get stored entities
   */
  getStoredEntities(entityType?: string): EntityAssociation[] {
    return this.memoryService.getStoredEntities(entityType);
  }

  /**
   * Find entity by name
   */
  async findEntityByName(
    name: string,
    entityType?: string
  ): Promise<EntityAssociation | null> {
    return this.memoryService.findEntityByName(name, entityType);
  }

  /**
   * Get most recent entity
   */
  getMostRecentEntity(entityType: string): EntityAssociation | null {
    return this.memoryService.getMostRecentEntity(entityType);
  }

  /**
   * Check if entity exists
   */
  entityExists(entityId: string): boolean {
    return this.memoryService.entityExists(entityId);
  }

  /**
   * Store entity association
   */
  storeEntityAssociation(
    entityId: string,
    entityName: string,
    transactionId?: string
  ): void {
    this.memoryService
      .storeEntityAssociation(entityId, entityName, transactionId)
      .then(async (detectedType) => {
        try {
          const sessionId = this.getCurrentSessionId() || undefined;
          await this.entityService.storeEntity(
            entityId,
            entityName,
            detectedType || 'unknown',
            transactionId,
            sessionId
          );
        } catch (error) {
          this.logger.warn('Failed to persist entity association:', {
            entityId,
            entityName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .catch((error) => {
        this.logger.warn('Failed to store entity association in memory:', {
          entityId,
          entityName,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  /**
   * Resolve entity references
   */
  async resolveEntityReferences(userMessage: string): Promise<string> {
    return this.messageService.resolveEntityReferences(userMessage);
  }

  /**
   * Get MCP connection status
   */
  async getMCPConnectionStatus(): Promise<Map<string, unknown> | null> {
    return this.mcpConnectionService.getMCPConnectionStatus();
  }

  /**
   * Check if MCP server is connected
   */
  async isMCPServerConnected(serverName: string): Promise<boolean> {
    return this.mcpConnectionService.isMCPServerConnected(serverName);
  }

  /**
   * Get MCP connection summary
   */
  async getMCPConnectionSummary(): Promise<{
    total: number;
    connected: number;
    pending: number;
    failed: number;
  }> {
    return this.mcpConnectionService.getMCPConnectionSummary();
  }

  /**
   * Cleanup optimization resources
   */
  async cleanupOptimizations(): Promise<void> {
    this.logger.info('Cleaning up agent service optimization resources');
    if (this.agentLoader) {
      await this.agentLoader.cleanup();
    }
  }
}
