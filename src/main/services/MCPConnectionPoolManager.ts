import { Logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import type { 
  MCPConnectionPool, 
  MCPPooledConnection, 
  MCPConnectionPoolConfig, 
  MCPConnectionStats,
  MCPPerformanceMetrics 
} from '../../shared/types/mcp-performance';
import type { MCPServerConfig } from './MCPService';

/**
 * Advanced connection pool manager for MCP servers with performance optimizations
 */
export class MCPConnectionPoolManager {
  private static instance: MCPConnectionPoolManager;
  private logger: Logger;
  private pools: Map<string, MCPConnectionPool> = new Map();
  private globalStats: MCPPerformanceMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private defaultConfig: MCPConnectionPoolConfig = {
    maxConnections: 3,
    minConnections: 1,
    connectionTimeoutMs: 15000,
    idleTimeoutMs: 300000,
    retryAttempts: 3,
    retryDelayMs: 2000,
    healthCheckIntervalMs: 60000,
    parallelInitializationLimit: 5
  };

  private constructor() {
    this.logger = new Logger({ module: 'MCPConnectionPoolManager' });
    this.globalStats = {
      connectionPoolStats: new Map(),
      initializationTime: 0,
      parallelConnectionsSuccess: 0,
      parallelConnectionsFailure: 0,
      avgConnectionLatency: 0,
      cacheHitRate: 0,
      totalServersManaged: 0
    };
    this.startHealthCheckTimer();
  }

  static getInstance(): MCPConnectionPoolManager {
    if (!MCPConnectionPoolManager.instance) {
      MCPConnectionPoolManager.instance = new MCPConnectionPoolManager();
    }
    return MCPConnectionPoolManager.instance;
  }

  /**
   * Initialize connection pool for a server with optimized settings
   */
  async initializePool(
    serverConfig: MCPServerConfig, 
    customConfig?: Partial<MCPConnectionPoolConfig>
  ): Promise<void> {
    const poolConfig = { ...this.defaultConfig, ...customConfig };
    const serverId = serverConfig.id;

    if (this.pools.has(serverId)) {
      this.logger.warn(`Pool for server ${serverId} already exists, skipping initialization`);
      return;
    }

    const pool: MCPConnectionPool = {
      serverId,
      connections: [],
      config: poolConfig,
      stats: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        failedConnections: 0,
        averageConnectionTime: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastHealthCheck: new Date()
      }
    };

    this.pools.set(serverId, pool);
    this.globalStats.connectionPoolStats.set(serverId, pool.stats);
    this.globalStats.totalServersManaged++;

    await this.preWarmPool(serverConfig, pool);
    
    this.logger.info(`Initialized connection pool for server ${serverId}`, {
      minConnections: poolConfig.minConnections,
      maxConnections: poolConfig.maxConnections,
      preWarmedConnections: pool.connections.length
    });
  }

  /**
   * Get an available connection from the pool or create a new one
   */
  async acquireConnection(serverId: string): Promise<MCPPooledConnection | null> {
    const pool = this.pools.get(serverId);
    if (!pool) {
      this.logger.error(`No pool found for server ${serverId}`);
      return null;
    }

    const idleConnection = pool.connections.find(conn => conn.status === 'idle');
    if (idleConnection) {
      idleConnection.status = 'active';
      idleConnection.lastUsedAt = new Date();
      pool.stats.activeConnections++;
      pool.stats.idleConnections--;
      this.logger.debug(`Reusing idle connection for server ${serverId}`);
      return idleConnection;
    }

    if (pool.connections.length < pool.config.maxConnections) {
      const newConnection = await this.createConnection(serverId, pool);
      if (newConnection) {
        pool.connections.push(newConnection);
        pool.stats.totalConnections++;
        pool.stats.activeConnections++;
        this.logger.debug(`Created new connection for server ${serverId}`, {
          totalConnections: pool.connections.length,
          maxConnections: pool.config.maxConnections
        });
        return newConnection;
      }
    }

    this.logger.warn(`All connections busy for server ${serverId}, waiting for available connection`);
    return await this.waitForAvailableConnection(serverId);
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connectionId: string, serverId: string): Promise<void> {
    const pool = this.pools.get(serverId);
    if (!pool) {
      this.logger.error(`No pool found for server ${serverId}`);
      return;
    }

    const connection = pool.connections.find(conn => conn.id === connectionId);
    if (!connection) {
      this.logger.error(`Connection ${connectionId} not found in pool for server ${serverId}`);
      return;
    }

    if (connection.status === 'error') {
      await this.removeConnection(connectionId, serverId);
      return;
    }

    connection.status = 'idle';
    connection.lastUsedAt = new Date();
    pool.stats.activeConnections--;
    pool.stats.idleConnections++;
    
    this.logger.debug(`Released connection ${connectionId} for server ${serverId}`);
  }

  /**
   * Pre-warm pool with minimum number of connections
   */
  private async preWarmPool(
    serverConfig: MCPServerConfig, 
    pool: MCPConnectionPool
  ): Promise<void> {
    const initStartTime = Date.now();
    const connectionPromises: Promise<MCPPooledConnection | null>[] = [];

    for (let i = 0; i < pool.config.minConnections; i++) {
      connectionPromises.push(this.createConnection(serverConfig.id, pool));
    }

    try {
      const results = await Promise.allSettled(connectionPromises);
      const successfulConnections = results
        .filter((result): result is PromiseFulfilledResult<MCPPooledConnection> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      pool.connections.push(...successfulConnections);
      pool.stats.totalConnections = successfulConnections.length;
      pool.stats.idleConnections = successfulConnections.length;

      const initTime = Date.now() - initStartTime;
      this.globalStats.initializationTime += initTime;
      this.globalStats.parallelConnectionsSuccess += successfulConnections.length;
      this.globalStats.parallelConnectionsFailure += (results.length - successfulConnections.length);

      this.logger.info(`Pre-warmed pool for server ${serverConfig.id}`, {
        successful: successfulConnections.length,
        failed: results.length - successfulConnections.length,
        initTimeMs: initTime
      });
    } catch (error) {
      this.logger.error(`Failed to pre-warm pool for server ${serverConfig.id}:`, error);
    }
  }

  /**
   * Create a new pooled connection
   */
  private async createConnection(
    serverId: string, 
    pool: MCPConnectionPool
  ): Promise<MCPPooledConnection | null> {
    const connectionId = `${serverId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const connection: MCPPooledConnection = {
        id: connectionId,
        serverId,
        process: null,
        status: 'initializing',
        createdAt: new Date(),
        lastUsedAt: new Date(),
        connectionAttempts: 1,
        errorCount: 0
      };

      const connectionTime = Date.now() - startTime;
      
      if (pool.stats.averageConnectionTime === 0) {
        pool.stats.averageConnectionTime = connectionTime;
      } else {
        pool.stats.averageConnectionTime = 
          (pool.stats.averageConnectionTime + connectionTime) / 2;
      }

      connection.status = 'idle';
      this.logger.debug(`Created connection ${connectionId} for server ${serverId} in ${connectionTime}ms`);
      
      return connection;
    } catch (error) {
      this.logger.error(`Failed to create connection for server ${serverId}:`, error);
      pool.stats.failedConnections++;
      return null;
    }
  }

  /**
   * Wait for an available connection with timeout
   */
  private async waitForAvailableConnection(serverId: string): Promise<MCPPooledConnection | null> {
    const pool = this.pools.get(serverId);
    if (!pool) return null;

    const timeout = pool.config.connectionTimeoutMs;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const idleConnection = pool.connections.find(conn => conn.status === 'idle');
        
        if (idleConnection) {
          clearInterval(checkInterval);
          idleConnection.status = 'active';
          idleConnection.lastUsedAt = new Date();
          pool.stats.activeConnections++;
          pool.stats.idleConnections--;
          resolve(idleConnection);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          this.logger.error(`Timeout waiting for connection for server ${serverId}`);
          resolve(null);
        }
      }, 100);
    });
  }

  /**
   * Remove a connection from the pool
   */
  private async removeConnection(connectionId: string, serverId: string): Promise<void> {
    const pool = this.pools.get(serverId);
    if (!pool) return;

    const connectionIndex = pool.connections.findIndex(conn => conn.id === connectionId);
    if (connectionIndex === -1) return;

    const connection = pool.connections[connectionIndex];
    
    if (connection.process && typeof connection.process.kill === 'function') {
      try {
        connection.process.kill('SIGTERM');
      } catch (error) {
        this.logger.warn(`Error killing process for connection ${connectionId}:`, error);
      }
    }

    pool.connections.splice(connectionIndex, 1);
    pool.stats.totalConnections--;
    
    if (connection.status === 'active') {
      pool.stats.activeConnections--;
    } else if (connection.status === 'idle') {
      pool.stats.idleConnections--;
    }

    this.logger.debug(`Removed connection ${connectionId} from pool for server ${serverId}`);
  }

  /**
   * Perform health check on all pools
   */
  private async performHealthCheck(): Promise<void> {
    this.logger.debug('Performing health check on all connection pools');

    for (const serverId of Array.from(this.pools.keys())) {
      const pool = this.pools.get(serverId)!;
      try {
        const now = new Date();
        
        const connectionsToRemove: string[] = [];
        
        for (const connection of pool.connections) {
          if (connection.status === 'idle') {
            const idleTime = now.getTime() - connection.lastUsedAt.getTime();
            if (idleTime > pool.config.idleTimeoutMs) {
              connectionsToRemove.push(connection.id);
            }
          }
        }

        for (const connectionId of connectionsToRemove) {
          await this.removeConnection(connectionId, serverId);
        }

        const currentConnectionCount = pool.connections.length;
        if (currentConnectionCount < pool.config.minConnections) {
          const connectionsNeeded = pool.config.minConnections - currentConnectionCount;
          this.logger.info(`Restoring minimum connections for server ${serverId}`, {
            current: currentConnectionCount,
            needed: connectionsNeeded,
            minimum: pool.config.minConnections
          });
          
          const connectionPromises: Promise<MCPPooledConnection | null>[] = [];
          for (let i = 0; i < connectionsNeeded; i++) {
            connectionPromises.push(this.createConnection(serverId, pool));
          }
          
          const results = await Promise.allSettled(connectionPromises);
          const newConnections = results
            .filter((result): result is PromiseFulfilledResult<MCPPooledConnection> => 
              result.status === 'fulfilled' && result.value !== null
            )
            .map(result => result.value);

          pool.connections.push(...newConnections);
          pool.stats.totalConnections += newConnections.length;
          pool.stats.idleConnections += newConnections.length;
        }

        pool.stats.lastHealthCheck = now;
      } catch (error) {
        this.logger.error(`Health check failed for server ${serverId}:`, error);
      }
    }
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.defaultConfig.healthCheckIntervalMs);
  }

  /**
   * Get performance metrics for all pools
   */
  getPerformanceMetrics(): MCPPerformanceMetrics {
    let totalLatency = 0;
    let connectionCount = 0;
    
    this.globalStats.connectionPoolStats.forEach((stats, serverId) => {
      totalLatency += stats.averageConnectionTime;
      connectionCount++;
    });
    
    this.globalStats.avgConnectionLatency = connectionCount > 0 ? totalLatency / connectionCount : 0;
    
    return { ...this.globalStats };
  }

  /**
   * Get stats for a specific server pool
   */
  getPoolStats(serverId: string): MCPConnectionStats | undefined {
    return this.globalStats.connectionPoolStats.get(serverId);
  }

  /**
   * Cleanup all pools and connections
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up all connection pools');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    const cleanupPromises: Promise<void>[] = [];
    
    this.pools.forEach((pool, serverId) => {
      pool.connections.forEach(connection => {
        cleanupPromises.push(this.removeConnection(connection.id, serverId));
      });
    });

    await Promise.allSettled(cleanupPromises);
    
    this.pools.clear();
    this.globalStats.connectionPoolStats.clear();
    this.globalStats.totalServersManaged = 0;
    
    this.logger.info('All connection pools cleaned up');
  }

  /**
   * Get pool information for debugging
   */
  getPoolInfo(serverId: string): any {
    const pool = this.pools.get(serverId);
    if (!pool) return null;

    return {
      serverId,
      config: pool.config,
      stats: pool.stats,
      connections: pool.connections.map(conn => ({
        id: conn.id,
        status: conn.status,
        createdAt: conn.createdAt,
        lastUsedAt: conn.lastUsedAt,
        connectionAttempts: conn.connectionAttempts,
        errorCount: conn.errorCount
      }))
    };
  }
}