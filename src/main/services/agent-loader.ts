import { Logger } from '../utils/logger';
import { ConcurrencyManager } from '../utils/ConcurrencyManager';
import { MCPConnectionPoolManager } from './mcp-connection-pool-manager';
import { MCPService } from "./mcp-service";
import type {
  ProgressiveLoadConfig,
  LoadingPhase,
  ProgressiveLoadState,
  MCPPerformanceMetrics,
  ConcurrencyStats,
} from '../../shared/types/mcp-performance';
import type { AgentConfig } from "./agent-service";
import { AgentService } from "./agent-service";

/**
 * Agent loader that prioritizes core functionality for fast startup
 * Note: AgentService dependency is injected to avoid circular dependency
 */
export class AgentLoader {
  private static instance: AgentLoader;
  private logger: Logger;
  private concurrencyManager: ConcurrencyManager;
  private poolManager: MCPConnectionPoolManager;
  private mcpService: MCPService;
  private agentService!: AgentService;
  private currentState: ProgressiveLoadState;
  private loadingPhases: LoadingPhase[];

  private defaultConfig: ProgressiveLoadConfig = {
    coreAgentTimeoutMs: 15000,
    mcpConnectionBatchSize: 3,
    mcpConnectionDelayMs: 1000,
    backgroundConnectionsEnabled: true,
    loadProgressCallback: undefined,
  };

  private constructor(config?: Partial<ProgressiveLoadConfig>) {
    this.logger = new Logger({ module: 'AgentLoader' });
    this.concurrencyManager = ConcurrencyManager.getInstance({
      maxConcurrency: 5,
    });
    this.poolManager = MCPConnectionPoolManager.getInstance();
    this.mcpService = MCPService.getInstance();

    this.defaultConfig = { ...this.defaultConfig, ...config };

    this.loadingPhases = this.initializePhases();
    this.currentState = this.initializeState();

    this.logger.info('AgentLoader initialized', {
      coreTimeoutMs: this.defaultConfig.coreAgentTimeoutMs,
      batchSize: this.defaultConfig.mcpConnectionBatchSize,
      backgroundEnabled: this.defaultConfig.backgroundConnectionsEnabled,
    });
  }

  static getInstance(config?: Partial<ProgressiveLoadConfig>): AgentLoader {
    if (!AgentLoader.instance) {
      AgentLoader.instance = new AgentLoader(config);
    }
    return AgentLoader.instance;
  }

  /**
   * Set the AgentService instance to avoid circular dependency
   * This should be called by AgentService after it's initialized
   */
  setAgentService(agentService: AgentService): void {
    this.agentService = agentService;
    this.logger.debug('AgentService injected into AgentLoader');
  }

  /**
   * Initialize loading phases with weights
   */
  private initializePhases(): LoadingPhase[] {
    return [
      {
        name: 'core-validation',
        weight: 10,
        status: 'pending',
      },
      {
        name: 'core-agent-init',
        weight: 85,
        status: 'pending',
      },
      {
        name: 'optimization-warmup',
        weight: 5,
        status: 'pending',
      },
    ];
  }

  /**
   * Initialize progressive load state
   */
  private initializeState(): ProgressiveLoadState {
    return {
      currentPhase: 'none',
      completedPhases: [],
      totalProgress: 0,
      phases: [...this.loadingPhases],
      isCoreFunctionalityReady: false,
      backgroundTasksRemaining: 0,
    };
  }

  /**
   * Load agent with progressive initialization
   */
  async loadAgent(
    config: AgentConfig,
    progressiveConfig?: Partial<ProgressiveLoadConfig>
  ): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    coreReadyTimeMs: number;
    backgroundTasksRemaining: number;
  }> {
    const startTime = Date.now();
    const loadConfig = { ...this.defaultConfig, ...progressiveConfig };

    this.logger.info('Starting progressive agent load', {
      accountId: config.accountId,
      network: config.network,
      coreTimeoutMs: loadConfig.coreAgentTimeoutMs,
    });

    try {
      this.currentState = this.initializeState();
      this.reportProgress();

      await this.executePhase('core-validation', async () => {
        await this.validateCoreConfig(config);
      });

      const coreResult = await this.executePhase(
        'core-agent-init',
        async () => {
          return await this.initializeCoreAgent(
            config,
            loadConfig.coreAgentTimeoutMs
          );
        }
      );

      if (!coreResult.success) {
        return {
          success: false,
          error: coreResult.error,
          coreReadyTimeMs: Date.now() - startTime,
          backgroundTasksRemaining: 0,
        };
      }

      this.currentState.isCoreFunctionalityReady = true;
      const coreReadyTime = Date.now() - startTime;

      this.logger.info(`Core agent functionality ready in ${coreReadyTime}ms`);

      await this.executePhase('optimization-warmup', async () => {
        await this.performOptimizationWarmup();
      });

      this.currentState.backgroundTasksRemaining = 0;
      this.reportProgress();

      return {
        success: true,
        sessionId: coreResult.sessionId,
        coreReadyTimeMs: coreReadyTime,
        backgroundTasksRemaining: this.currentState.backgroundTasksRemaining,
      };
    } catch (error) {
      this.logger.error('Progressive agent load failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Progressive load failed',
        coreReadyTimeMs: Date.now() - startTime,
        backgroundTasksRemaining: 0,
      };
    }
  }

  /**
   * Execute a loading phase with progress tracking
   */
  private async executePhase<T>(
    phaseName: string,
    executor: () => Promise<T>
  ): Promise<T> {
    const phase = this.currentState.phases.find((p) => p.name === phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found`);
    }

    this.currentState.currentPhase = phaseName;
    phase.status = 'in-progress';
    phase.startTime = new Date();

    this.logger.debug(`Starting phase: ${phaseName}`);
    this.reportProgress();

    try {
      const result = await executor();

      phase.status = 'completed';
      phase.endTime = new Date();
      this.currentState.completedPhases.push(phaseName);

      const completedWeight = this.currentState.phases
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.weight, 0);
      this.currentState.totalProgress = Math.min(completedWeight, 100);

      this.logger.debug(
        `Completed phase: ${phaseName} (${phase.endTime.getTime() - phase.startTime!.getTime()}ms)`
      );
      this.reportProgress();

      return result;
    } catch (error) {
      phase.status = 'failed';
      phase.endTime = new Date();
      phase.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Phase ${phaseName} failed:`, error);
      this.reportProgress();

      throw error;
    }
  }

  /**
   * Validate core configuration
   */
  private async validateCoreConfig(config: AgentConfig): Promise<void> {
    if (!config.accountId || !config.privateKey || !config.network) {
      throw new Error(
        'Missing required core configuration: accountId, privateKey, or network'
      );
    }

    if (!config.openAIApiKey) {
      throw new Error('Missing required LLM API key');
    }

    const accountIdRegex = /^\d+\.\d+\.\d+$/;
    if (!accountIdRegex.test(config.accountId)) {
      throw new Error('Invalid accountId format. Expected format: x.x.x');
    }

    this.logger.debug('Core configuration validated successfully');
  }

  /**
   * Initialize core agent without MCP servers
   */
  private async initializeCoreAgent(
    config: AgentConfig,
    timeoutMs: number
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const coreConfig: AgentConfig = {
      ...config,
      useProgressiveLoading: false,
    };

    this.logger.debug(
      'Initializing core agent with MCP servers for native handling'
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Core agent initialization timed out after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      );
    });

    try {
      if (!this.agentService) {
        throw new Error(
          'AgentService not injected. Call setAgentService() first.'
        );
      }

      this.logger.debug(
        'Starting core agent initialization with timeout of',
        timeoutMs,
        'ms'
      );

      const result = await Promise.race([
        this.agentService.initializeInternal(coreConfig),
        timeoutPromise,
      ]);

      this.logger.info('Core agent initialized successfully', {
        sessionId: result.sessionId,
      });

      return {
        success: result.success,
        sessionId: result.sessionId,
        error: result.error,
      };
    } catch (error) {
      this.logger.error('Core agent initialization failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Core agent initialization failed',
      };
    }
  }

  /**
   * Perform optimization warmup
   */
  private async performOptimizationWarmup(): Promise<void> {
    this.logger.debug('Performing optimization warmup');

    const poolMetrics = this.poolManager.getPerformanceMetrics();
    this.logger.debug('Connection pool metrics collected', {
      totalServers: poolMetrics.totalServersManaged,
      avgLatency: poolMetrics.avgConnectionLatency,
    });

    await this.precompileCommonPatterns();

    this.logger.debug('Optimization warmup completed');
  }

  /**
   * Pre-compile common patterns for performance
   */
  private async precompileCommonPatterns(): Promise<void> {
    const patterns = [
      /^\d+\.\d+\.\d+$/,
      /^0x[a-fA-F0-9]+$/,
      /^[A-Za-z0-9_-]+$/,
    ];

    patterns.forEach((pattern) => {
      pattern.test('0.0.123');
      pattern.test('test_value');
    });
  }

  /**
   * Report progress to callback if configured
   */
  private reportProgress(): void {
    if (this.defaultConfig.loadProgressCallback) {
      this.defaultConfig.loadProgressCallback(
        this.currentState.totalProgress,
        this.currentState.currentPhase
      );
    }

    this.logger.debug('Load progress update', {
      phase: this.currentState.currentPhase,
      progress: this.currentState.totalProgress,
      coreReady: this.currentState.isCoreFunctionalityReady,
      backgroundRemaining: this.currentState.backgroundTasksRemaining,
    });
  }

  /**
   * Get current loading state
   */
  getLoadingState(): ProgressiveLoadState {
    return { ...this.currentState };
  }

  /**
   * Check if core functionality is ready
   */
  isCoreFunctionalityReady(): boolean {
    return this.currentState.isCoreFunctionalityReady;
  }

  /**
   * Wait for all background tasks to complete
   */
  async waitForBackgroundTasks(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (this.currentState.backgroundTasksRemaining > 0) {
      if (Date.now() - startTime > timeoutMs) {
        this.logger.warn(
          `Timeout waiting for background tasks: ${this.currentState.backgroundTasksRemaining} remaining`
        );
        return false;
      }

      await this.delay(500);
    }

    return true;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProgressiveLoadConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.logger.info('Progressive load configuration updated', config);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    poolMetrics: MCPPerformanceMetrics;
    concurrencyStats: ConcurrencyStats;
    loadingPhases: LoadingPhase[];
  } {
    return {
      poolMetrics: this.poolManager.getPerformanceMetrics(),
      concurrencyStats: this.concurrencyManager.getStats(),
      loadingPhases: [...this.currentState.phases],
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up ProgressiveAgentLoader');

    await this.concurrencyManager.shutdown();
    await this.poolManager.cleanup();

    this.currentState = this.initializeState();
    this.logger.info('ProgressiveAgentLoader cleanup completed');
  }
}
