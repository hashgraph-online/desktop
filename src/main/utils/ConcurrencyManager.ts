import { Logger } from './logger';
import type { 
  ConcurrencyManagerConfig, 
  ConcurrentTask, 
  ConcurrencyStats 
} from '../../shared/types/mcp-performance';

/**
 * Semaphore-based concurrency manager for parallel MCP server operations
 */
export class ConcurrencyManager {
  private static instance: ConcurrencyManager;
  private logger: Logger;
  private config: ConcurrencyManagerConfig;
  private semaphore: number;
  private taskQueue: Array<{
    task: ConcurrentTask<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    queuedAt: Date;
  }> = [];
  private activeTasks: Map<string, { 
    task: ConcurrentTask<any>; 
    startedAt: Date;
    timeoutHandle?: NodeJS.Timeout;
  }> = new Map();
  private stats: ConcurrencyStats = {
    activeTaskCount: 0,
    queuedTaskCount: 0,
    completedTaskCount: 0,
    failedTaskCount: 0,
    averageExecutionTime: 0,
    averageQueueTime: 0
  };

  private constructor(config?: Partial<ConcurrencyManagerConfig>) {
    this.logger = new Logger({ module: 'ConcurrencyManager' });
    this.config = {
      maxConcurrency: 5,
      queueTimeoutMs: 30000,
      priorityLevels: 3,
      ...config
    };
    this.semaphore = this.config.maxConcurrency;
    
    this.logger.info('ConcurrencyManager initialized', {
      maxConcurrency: this.config.maxConcurrency,
      queueTimeoutMs: this.config.queueTimeoutMs,
      priorityLevels: this.config.priorityLevels
    });
  }

  static getInstance(config?: Partial<ConcurrencyManagerConfig>): ConcurrencyManager {
    if (!ConcurrencyManager.instance) {
      ConcurrencyManager.instance = new ConcurrencyManager(config);
    }
    return ConcurrencyManager.instance;
  }

  /**
   * Execute a task with concurrency control
   */
  async execute<T>(task: ConcurrentTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedAt = new Date();
      
      const queueItem = { task, resolve, reject, queuedAt };
      this.insertTaskByPriority(queueItem);
      
      this.stats.queuedTaskCount++;
      
      const queueTimeout = setTimeout(() => {
        this.removeFromQueue(task.id);
        reject(new Error(`Task ${task.id} timed out in queue after ${this.config.queueTimeoutMs}ms`));
      }, this.config.queueTimeoutMs);

      const originalResolve = resolve;
      const originalReject = reject;
      
      queueItem.resolve = (value: T | PromiseLike<T>) => {
        clearTimeout(queueTimeout);
        originalResolve(value);
      };
      
      queueItem.reject = (error: any) => {
        clearTimeout(queueTimeout);
        originalReject(error);
      };

      this.logger.debug(`Task ${task.id} queued with priority ${task.priority}`, {
        queueLength: this.taskQueue.length,
        activeTasks: this.activeTasks.size,
        availableSlots: this.semaphore
      });

      this.processQueue();
    });
  }

  /**
   * Execute multiple tasks in parallel with controlled concurrency
   */
  async executeParallel<T>(
    tasks: ConcurrentTask<T>[],
    options?: { 
      failFast?: boolean; 
      maxRetries?: number;
      retryDelayMs?: number;
    }
  ): Promise<Array<{ success: boolean; result?: T; error?: Error; taskId: string }>> {
    const { failFast = false, maxRetries = 2, retryDelayMs = 1000 } = options || {};
    
    this.logger.info(`Executing ${tasks.length} tasks in parallel`, {
      failFast,
      maxRetries,
      retryDelayMs,
      maxConcurrency: this.config.maxConcurrency
    });

    const taskPromises = tasks.map(async (task) => {
      let lastError: Error | null = null;
      let attempts = 0;

      while (attempts <= (task.retryAttempts ?? maxRetries)) {
        try {
          const result = await this.execute(task);
          return { 
            success: true, 
            result, 
            taskId: task.id 
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          attempts++;
          
          this.logger.warn(`Task ${task.id} failed (attempt ${attempts}/${maxRetries + 1}):`, error);
          
          if (attempts <= (task.retryAttempts ?? maxRetries)) {
            await this.delay(retryDelayMs * attempts);
          }
        }
      }

      return { 
        success: false, 
        error: lastError!, 
        taskId: task.id 
      };
    });

    if (failFast) {
      try {
        const results = await Promise.all(taskPromises);
        return results;
      } catch (error) {
        throw new Error(`Parallel execution failed fast: ${error}`);
      }
    } else {
      const results = await Promise.allSettled(taskPromises);
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            error: result.reason instanceof Error 
              ? result.reason 
              : new Error(String(result.reason)),
            taskId: tasks[index].id
          };
        }
      });
    }
  }

  /**
   * Insert task into queue maintaining priority order
   */
  private insertTaskByPriority(queueItem: any): void {
    const insertIndex = this.taskQueue.findIndex(
      item => item.task.priority < queueItem.task.priority
    );
    
    if (insertIndex === -1) {
      this.taskQueue.push(queueItem);
    } else {
      this.taskQueue.splice(insertIndex, 0, queueItem);
    }
  }

  /**
   * Remove task from queue by ID
   */
  private removeFromQueue(taskId: string): boolean {
    const index = this.taskQueue.findIndex(item => item.task.id === taskId);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
      this.stats.queuedTaskCount--;
      return true;
    }
    return false;
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    while (this.semaphore > 0 && this.taskQueue.length > 0) {
      const queueItem = this.taskQueue.shift()!;
      this.semaphore--;
      this.stats.queuedTaskCount--;
      
      const queueTime = Date.now() - queueItem.queuedAt.getTime();
      this.updateAverageQueueTime(queueTime);
      
      this.executeTask(queueItem);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(queueItem: any): Promise<void> {
    const { task, resolve, reject } = queueItem;
    const startedAt = new Date();
    
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (task.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        this.handleTaskCompletion(task.id, false);
        reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`));
      }, task.timeoutMs);
    }

    this.activeTasks.set(task.id, { task, startedAt, timeoutHandle });
    this.stats.activeTaskCount++;

    this.logger.debug(`Started executing task ${task.id}`, {
      priority: task.priority,
      queueTimeMs: Date.now() - queueItem.queuedAt.getTime(),
      activeTasks: this.activeTasks.size,
      remainingSlots: this.semaphore
    });

    try {
      const result = await task.execute();
      
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      this.handleTaskCompletion(task.id, true);
      resolve(result);
      
      this.logger.debug(`Task ${task.id} completed successfully`, {
        executionTimeMs: Date.now() - startedAt.getTime()
      });
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      this.handleTaskCompletion(task.id, false);
      reject(error);
      
      this.logger.error(`Task ${task.id} failed:`, error, {
        executionTimeMs: Date.now() - startedAt.getTime()
      });
    }
  }

  /**
   * Handle task completion and update stats
   */
  private handleTaskCompletion(taskId: string, success: boolean): void {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) {
      this.logger.warn(`Task ${taskId} not found in active tasks`);
      return;
    }

    const executionTime = Date.now() - activeTask.startedAt.getTime();
    this.updateAverageExecutionTime(executionTime);

    this.stats.activeTaskCount--;
    if (success) {
      this.stats.completedTaskCount++;
    } else {
      this.stats.failedTaskCount++;
    }

    this.activeTasks.delete(taskId);
    this.semaphore++;

    this.processQueue();
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const totalCompleted = this.stats.completedTaskCount + this.stats.failedTaskCount;
    if (totalCompleted === 0) {
      this.stats.averageExecutionTime = executionTime;
    } else {
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (totalCompleted - 1) + executionTime) / totalCompleted;
    }
  }

  /**
   * Update average queue time
   */
  private updateAverageQueueTime(queueTime: number): void {
    const totalTasks = this.stats.completedTaskCount + this.stats.failedTaskCount + 1;
    if (totalTasks === 1) {
      this.stats.averageQueueTime = queueTime;
    } else {
      this.stats.averageQueueTime = 
        (this.stats.averageQueueTime * (totalTasks - 1) + queueTime) / totalTasks;
    }
  }

  /**
   * Create a task with default configuration
   */
  createTask<T>(
    id: string,
    execute: () => Promise<T>,
    options?: {
      priority?: number;
      timeoutMs?: number;
      retryAttempts?: number;
    }
  ): ConcurrentTask<T> {
    return {
      id,
      priority: options?.priority ?? 1,
      execute,
      timeoutMs: options?.timeoutMs,
      retryAttempts: options?.retryAttempts
    };
  }

  /**
   * Wait for all active tasks to complete
   */
  async waitForCompletion(timeoutMs?: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeTasks.size > 0 || this.taskQueue.length > 0) {
      if (timeoutMs && (Date.now() - startTime > timeoutMs)) {
        throw new Error(`Timeout waiting for task completion after ${timeoutMs}ms`);
      }
      
      await this.delay(100);
    }
  }

  /**
   * Get current concurrency statistics
   */
  getStats(): ConcurrencyStats {
    return { ...this.stats };
  }

  /**
   * Get detailed status information
   */
  getStatus(): {
    stats: ConcurrencyStats;
    config: ConcurrencyManagerConfig;
    activeTasks: Array<{ id: string; priority: number; startedAt: Date }>;
    queuedTasks: Array<{ id: string; priority: number; queuedAt: Date }>;
    availableSlots: number;
  } {
    return {
      stats: this.getStats(),
      config: this.config,
      activeTasks: Array.from(this.activeTasks.keys()).map(id => {
        const info = this.activeTasks.get(id)!;
        return {
          id,
          priority: info.task.priority,
          startedAt: info.startedAt
        };
      }),
      queuedTasks: this.taskQueue.map(item => ({
        id: item.task.id,
        priority: item.task.priority,
        queuedAt: item.queuedAt
      })),
      availableSlots: this.semaphore
    };
  }

  /**
   * Clear all queued tasks (does not affect running tasks)
   */
  clearQueue(): void {
    const clearedCount = this.taskQueue.length;
    this.taskQueue.forEach(item => {
      item.reject(new Error('Task queue cleared'));
    });
    this.taskQueue = [];
    this.stats.queuedTaskCount = 0;
    this.logger.info(`Cleared ${clearedCount} queued tasks`);
  }

  /**
   * Update concurrency limit
   */
  updateConcurrency(newLimit: number): void {
    if (newLimit < 1) {
      throw new Error('Concurrency limit must be at least 1');
    }
    
    const oldLimit = this.config.maxConcurrency;
    this.config.maxConcurrency = newLimit;
    
    const difference = newLimit - oldLimit;
    this.semaphore += difference;
    
    if (difference > 0) {
      this.processQueue();
    }
    
    this.logger.info(`Updated concurrency limit from ${oldLimit} to ${newLimit}`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup and shutdown the concurrency manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ConcurrencyManager');
    
    this.clearQueue();
    
    try {
      await this.waitForCompletion(10000);
    } catch (error) {
      this.logger.warn('Timeout waiting for active tasks during shutdown:', error);
    }
    
    this.activeTasks.forEach((taskInfo, taskId) => {
      if (taskInfo.timeoutHandle) {
        clearTimeout(taskInfo.timeoutHandle);
      }
      this.logger.warn(`Forcefully terminating active task: ${taskId}`);
    });
    
    this.activeTasks.clear();
    this.semaphore = this.config.maxConcurrency;
    
    this.logger.info('ConcurrencyManager shutdown complete');
  }
}