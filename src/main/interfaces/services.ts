import type { EntityAssociation } from '@hashgraphonline/conversational-agent';

/**
 * Dependency injection interfaces for making Electron dependencies optional
 */

export interface DatabasePathProvider {
  getDatabasePath(): string;
}

export interface ElectronDatabasePathProvider extends DatabasePathProvider {
  getDatabasePath(): string;
}

export interface TestDatabasePathProvider extends DatabasePathProvider {
  getDatabasePath(): string;
}

export interface MCPServerProvider {
  loadServers(): Promise<MCPServerConfig[]>;
  getServerById(id: string): Promise<MCPServerConfig | null>;
  saveServer(config: MCPServerConfig): Promise<void>;
  deleteServer(id: string): Promise<void>;
}

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
  config: unknown;
  tools?: Array<Record<string, unknown>>;
  lastConnected?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  connectionHealth?: Record<string, unknown>;
  description?: string;
}

export interface MockMCPServerProvider extends MCPServerProvider {
  loadServers(): Promise<MCPServerConfig[]>;
  getServerById(id: string): Promise<MCPServerConfig | null>;
  saveServer(config: MCPServerConfig): Promise<void>;
  deleteServer(id: string): Promise<void>;
}

/**
 * Dependencies that can be injected into services to remove Electron requirements
 */
export interface ServiceDependencies {
  databasePathProvider?: DatabasePathProvider;
  mcpServerProvider?: MCPServerProvider;
}

/**
 * Factory function type for creating service instances
 */
export type ServiceFactory<T> = (dependencies?: ServiceDependencies) => T;

/**
 * Session context for agent operations
 */
export interface SessionContext {
  sessionId: string;
  mode: 'personal' | 'hcs10';
  topicId?: string;
}

/**
 * Loading state for progressive loading
 */
export interface LoadingState {
  isLoading: boolean;
  status: string;
  progress?: number;
  phase?: string;
}

/**
 * Agent process result from conversational agent
 */
export interface AgentProcessResult {
  message?: string;
  output?: string;
  transactionBytes?: string;
  scheduleId?: string;
  transactionId?: string;
  description?: string;
  notes?: string[];
  error?: string;
  formMessage?: unknown;
  metadata?: Record<string, unknown> & {
    transactionBytes?: string;
    hashLinkBlock?: unknown;
  };
  hashLinkBlock?: unknown;
  intermediateSteps?: unknown[];
  rawToolOutput?: unknown;
  success?: boolean;
  op?: string;
}

/**
 * Chat history interface
 */
export interface ChatHistory {
  type: 'human' | 'ai' | 'system';
  content: string;
}

/**
 * Session management service interface
 */
export interface ISessionService {
  updateContext(context: SessionContext): void;
  getContext(): SessionContext | null;
  clearContext(): void;
  getCurrentSessionId(): string | null;
  hasContext(): boolean;
}

/**
 * Parameter processing service interface
 */
export interface IParameterService {
  preprocessToolParameters(
    toolName: string,
    parameters: Record<string, unknown>,
    entities?: EntityAssociation[],
    sessionId?: string,
    preferences?: Record<string, string>
  ): Promise<Record<string, unknown>>;
  convertParameterEntities(
    parameterValue: string,
    entities: EntityAssociation[],
    preferences?: Record<string, string>
  ): Promise<string>;
}

/**
 * MCP connection monitoring service interface
 */
export interface IMCPConnectionService {
  getMCPConnectionStatus(): Promise<Map<string, unknown> | null>;
  isMCPServerConnected(serverName: string): Promise<boolean>;
  getMCPConnectionSummary(): Promise<{
    total: number;
    connected: number;
    pending: number;
    failed: number;
  }>;
}

/**
 * Memory and entity management service interface
 */
export interface IMemoryService {
  storeEntityAssociation(
    entityId: string,
    entityName: string,
    transactionId?: string
  ): void;
  getStoredEntities(entityType?: string): unknown[];
  findEntityByName(name: string, entityType?: string): Promise<unknown | null>;
  getMostRecentEntity(entityType: string): unknown | null;
  entityExists(entityId: string): boolean;
  setupEntityHandlers(agent: unknown): void;
  loadStoredEntities(agent: unknown): Promise<void>;
}

/**
 * Agent lifecycle and initialization service interface
 */
export interface IInitializationService {
  initialize(config: unknown): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }>;
  initializeTraditional(config: unknown): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs?: number;
    backgroundTasksRemaining?: number;
    loadingPhase?: string;
  }>;
  cleanup(): Promise<void>;
  getStatus(): {
    isInitialized: boolean;
    isInitializing: boolean;
    sessionId: string | null;
  };
  isCoreFunctionalityReady(): boolean;
  getLoadingState(): LoadingState;
  waitForBackgroundTasks(timeoutMs?: number): Promise<boolean>;
}

/**
 * Message processing service interface
 */
export interface IMessageService {
  sendMessage(
    content: string,
    chatHistory?: ChatHistory[]
  ): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }>;
  sendMessageWithAttachments(
    content: string,
    chatHistory?: ChatHistory[],
    attachments?: Array<{
      name: string;
      data: string;
      type: string;
      size: number;
    }>
  ): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }>;
  processFormSubmission(
    formSubmission: {
      formId: string;
      data: Record<string, unknown>;
      timestamp: number;
      toolName: string;
      originalPrompt?: string;
      partialInput?: Record<string, unknown>;
    },
    chatHistory?: ChatHistory[]
  ): Promise<{
    success: boolean;
    response?: unknown;
    error?: string;
  }>;
  extractTransactionBytesFromMessage(messageContent: string): string | null;
  resolveEntityReferences(
    userMessage: string,
    toolContext?: { entityResolutionPreferences?: Record<string, string> }
  ): Promise<string>;
}
