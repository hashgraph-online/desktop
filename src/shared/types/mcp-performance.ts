/**
 * Performance optimization types for MCP server connections
 */

export interface MCPConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  healthCheckIntervalMs: number;
  parallelInitializationLimit: number;
}

export interface MCPConnectionPool {
  serverId: string;
  connections: MCPPooledConnection[];
  config: MCPConnectionPoolConfig;
  stats: MCPConnectionStats;
}

export interface MCPPooledConnection {
  id: string;
  serverId: string;
  process: any;
  status: 'idle' | 'active' | 'initializing' | 'error' | 'disposed';
  createdAt: Date;
  lastUsedAt: Date;
  connectionAttempts: number;
  errorCount: number;
  tools?: any[];
}

export interface MCPConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  averageResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastHealthCheck: Date;
}

export interface MCPPerformanceMetrics {
  connectionPoolStats: Map<string, MCPConnectionStats>;
  initializationTime: number;
  parallelConnectionsSuccess: number;
  parallelConnectionsFailure: number;
  avgConnectionLatency: number;
  cacheHitRate: number;
  totalServersManaged: number;
}

export interface ConcurrencyManagerConfig {
  maxConcurrency: number;
  queueTimeoutMs: number;
  priorityLevels: number;
}

export interface ConcurrentTask<T> {
  id: string;
  priority: number;
  execute: () => Promise<T>;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface ConcurrencyStats {
  activeTaskCount: number;
  queuedTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  averageExecutionTime: number;
  averageQueueTime: number;
}

export interface ProgressiveLoadConfig {
  coreAgentTimeoutMs: number;
  mcpConnectionBatchSize: number;
  mcpConnectionDelayMs: number;
  backgroundConnectionsEnabled: boolean;
  loadProgressCallback?: (progress: number, status: string) => void;
}

export interface LoadingPhase {
  name: string;
  weight: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface ProgressiveLoadState {
  currentPhase: string;
  completedPhases: string[];
  totalProgress: number;
  phases: LoadingPhase[];
  isCoreFunctionalityReady: boolean;
  backgroundTasksRemaining: number;
}