import { AgentLoader } from '../../../src/main/services/agent-loader';
import { ConcurrencyManager } from '../../../src/main/utils/ConcurrencyManager';
import { MCPConnectionPoolManager } from '../../../src/main/services/mcp-connection-pool-manager';
import { MCPService } from '../../../src/main/services/mcp-service';
import { AgentService } from '../../../src/main/services/agent-service';
import type { AgentConfig } from '../../../src/main/services/agent-service';
import type { ProgressiveLoadConfig, LoadingPhase, ProgressiveLoadState } from '../../../shared/types/mcp-performance';

jest.mock('../../../src/main/utils/ConcurrencyManager', () => ({
  ConcurrencyManager: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../../src/main/services/mcp-connection-pool-manager', () => ({
  MCPConnectionPoolManager: {
    getInstance: jest.fn().mockReturnValue({
      getPerformanceMetrics: jest.fn().mockReturnValue({
        totalServersManaged: 5,
        avgConnectionLatency: 150
      })
    })
  }
}));

jest.mock('../../../src/main/services/mcp-service', () => ({
  MCPService: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../../src/main/services/agent-service', () => ({
  AgentService: jest.fn().mockImplementation(() => ({
    validateConfig: jest.fn(),
    initializeAgent: jest.fn(),
    initializeInternal: jest.fn().mockResolvedValue({
      success: true,
      sessionId: 'test-session-123'
    }),
    getSessionId: jest.fn().mockReturnValue('test-session-123'),
    getPerformanceMetrics: jest.fn(),
    setParameterPreprocessingCallback: jest.fn()
  }))
}));

const mockAgentServiceInstance = {
  validateConfig: jest.fn(),
  initializeAgent: jest.fn(),
  initializeInternal: jest.fn().mockResolvedValue({
    success: true,
    sessionId: 'test-session-123'
  }),
  getSessionId: jest.fn().mockReturnValue('test-session-123'),
  getPerformanceMetrics: jest.fn(),
  setParameterPreprocessingCallback: jest.fn()
};

(AgentService as any).getInstance = jest.fn().mockReturnValue(mockAgentServiceInstance);

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn()
}));

describe('AgentLoader', () => {
  let agentLoader: AgentLoader;
  let mockConcurrencyManager: jest.Mocked<ConcurrencyManager>;
  let mockPoolManager: jest.Mocked<MCPConnectionPoolManager>;
  let mockMcpService: jest.Mocked<MCPService>;
  let mockAgentService: jest.Mocked<AgentService>;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    (AgentLoader as any).instance = undefined;

    mockConcurrencyManager = {
      execute: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeTasks: 0,
        queuedTasks: 0,
        completedTasks: 0
      })
    } as jest.Mocked<ConcurrencyManager>;

    mockPoolManager = {
      initializePool: jest.fn(),
      getConnection: jest.fn(),
      releaseConnection: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeConnections: 0,
        availableConnections: 0,
        totalConnections: 0
      }),
      getPerformanceMetrics: jest.fn().mockReturnValue({
        totalServersManaged: 5,
        avgConnectionLatency: 150
      })
    } as jest.Mocked<MCPConnectionPoolManager>;

    mockMcpService = {
      initializeConnections: jest.fn(),
      getConnectionStats: jest.fn().mockReturnValue({
        totalConnections: 0,
        activeConnections: 0,
        failedConnections: 0
      })
    } as jest.Mocked<MCPService>;

    mockAgentService = {
      initializeAgent: jest.fn().mockResolvedValue({
        success: true,
        sessionId: 'test-session-123'
      }),
      initializeInternal: jest.fn().mockResolvedValue({
        success: true,
        sessionId: 'test-session-123'
      }),
      validateConfig: jest.fn(),
      getSessionId: jest.fn().mockReturnValue('test-session-123'),
      getAgentStats: jest.fn().mockReturnValue({
        isInitialized: false,
        sessionId: null,
        lastActivity: null
      }),
      getPerformanceMetrics: jest.fn(),
      setParameterPreprocessingCallback: jest.fn()
    } as jest.Mocked<AgentService>;

    (ConcurrencyManager.getInstance as jest.Mock).mockReturnValue(mockConcurrencyManager);
    (MCPConnectionPoolManager.getInstance as jest.Mock).mockReturnValue(mockPoolManager);
    (MCPService.getInstance as jest.Mock).mockReturnValue(mockMcpService);

    const { Logger } = require('../../../src/main/utils/logger');
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    agentLoader = AgentLoader.getInstance();
    agentLoader.setAgentService(mockAgentService);
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = AgentLoader.getInstance();
      const instance2 = AgentLoader.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with default config', () => {
      expect(ConcurrencyManager.getInstance).toHaveBeenCalledWith({
        maxConcurrency: 5
      });
      expect(MCPConnectionPoolManager.getInstance).toHaveBeenCalled();
      expect(MCPService.getInstance).toHaveBeenCalled();
    });

    test('should accept custom config', () => {
      const customConfig: Partial<ProgressiveLoadConfig> = {
        coreAgentTimeoutMs: 30000,
        mcpConnectionBatchSize: 5
      };

      (AgentLoader as any).instance = undefined;
      const customLoader = AgentLoader.getInstance(customConfig);

      expect(customLoader).toBeInstanceOf(AgentLoader);
    });
  });

  describe('Agent Service Injection', () => {
    test('should set agent service', () => {
      agentLoader.setAgentService(mockAgentService);

      expect((agentLoader as any).agentService).toBe(mockAgentService);
    });
  });

  describe('Phase Initialization', () => {
    test('should initialize phases correctly', () => {
      const phases = (agentLoader as any).loadingPhases;

      expect(phases).toHaveLength(3);
      expect(phases[0]).toEqual({
        name: 'core-validation',
        weight: 10,
        status: 'pending'
      });
      expect(phases[1]).toEqual({
        name: 'core-agent-init',
        weight: 85,
        status: 'pending'
      });
      expect(phases[2]).toEqual({
        name: 'optimization-warmup',
        weight: 5,
        status: 'pending'
      });
    });

    test('should initialize state correctly', () => {
      const state = (agentLoader as any).currentState;

      expect(state.currentPhase).toBe('none');
      expect(state.completedPhases).toEqual([]);
      expect(state.totalProgress).toBe(0);
      expect(state.isCoreFunctionalityReady).toBe(false);
      expect(state.backgroundTasksRemaining).toBe(0);
      expect(state.phases).toHaveLength(3);
    });
  });

  describe('Progressive Agent Loading', () => {
    const mockAgentConfig: AgentConfig = {
      accountId: '0.0.123456',
      network: 'testnet',
      privateKey: 'test-key',
      operatorId: '0.0.123456',
      operatorKey: 'test-operator-key',
      openAIApiKey: 'test-openai-key'
    };

    beforeEach(() => {
      agentLoader.setAgentService(mockAgentService);
    });

    test('should load agent successfully', async () => {
      mockAgentService.validateConfig.mockResolvedValue(true);
      mockAgentService.initializeAgent.mockResolvedValue({
        success: true,
        sessionId: 'test-session-123'
      });

      const result = await agentLoader.loadAgent(mockAgentConfig);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.coreReadyTimeMs).toBeGreaterThan(0);
      expect(result.backgroundTasksRemaining).toBe(0);
    });

    test('should handle core validation failure', async () => {
      const invalidConfig = {
        accountId: '0.0.123456',
        network: 'testnet',
        privateKey: 'test-key'
      };

      const result = await agentLoader.loadAgent(invalidConfig as AgentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required LLM API key');
    });

    test('should handle core agent initialization failure', async () => {
      mockAgentService.validateConfig.mockResolvedValue(true);
      mockAgentService.initializeInternal.mockResolvedValue({
        success: false,
        error: 'Initialization failed'
      });

      const result = await agentLoader.loadAgent(mockAgentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Initialization failed');
    });

    test('should handle unexpected errors', async () => {
      const invalidConfig = {
        accountId: 'invalid-format',
        network: 'testnet',
        privateKey: 'test-key',
        openAIApiKey: 'test-key'
      };

      const result = await agentLoader.loadAgent(invalidConfig as AgentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid accountId format');
    });

    test('should use custom progressive config', async () => {
      const customConfig: Partial<ProgressiveLoadConfig> = {
        coreAgentTimeoutMs: 30000,
        mcpConnectionBatchSize: 5
      };

      mockAgentService.validateConfig.mockResolvedValue(true);
      mockAgentService.initializeAgent.mockResolvedValue({
        success: true,
        sessionId: 'test-session-123'
      });

      const result = await agentLoader.loadAgent(mockAgentConfig, customConfig);

      expect(result.success).toBe(true);
    });
  });

  describe('Phase Execution', () => {
    test('should execute phase successfully', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('phase-result');

      const result = await (agentLoader as any).executePhase('core-validation', mockExecutor);

      expect(result).toBe('phase-result');
      expect(mockExecutor).toHaveBeenCalled();

      const state = (agentLoader as any).currentState;
      const phase = state.phases.find((p: LoadingPhase) => p.name === 'core-validation');
      expect(phase?.status).toBe('completed');
    });

    test('should handle phase execution error', async () => {
      const mockExecutor = jest.fn().mockRejectedValue(new Error('Phase failed'));

      await expect(
        (agentLoader as any).executePhase('core-validation', mockExecutor)
      ).rejects.toThrow('Phase failed');

      const state = (agentLoader as any).currentState;
      const phase = state.phases.find((p: LoadingPhase) => p.name === 'core-validation');
      expect(phase?.status).toBe('failed');
    });

    test('should handle unknown phase', async () => {
      const mockExecutor = jest.fn().mockResolvedValue('result');

      await expect(
        (agentLoader as any).executePhase('unknown-phase', mockExecutor)
      ).rejects.toThrow('Phase unknown-phase not found');
    });
  });

  describe('Core Validation', () => {
    const mockAgentConfig: AgentConfig = {
      accountId: '0.0.123456',
      network: 'testnet',
      privateKey: 'test-key',
      operatorId: '0.0.123456',
      operatorKey: 'test-operator-key',
      openAIApiKey: 'test-openai-key'
    };

    beforeEach(() => {
      agentLoader.setAgentService(mockAgentService);
    });

    test('should validate core config successfully', async () => {
      await expect((agentLoader as any).validateCoreConfig(mockAgentConfig)).resolves.not.toThrow();
    });

    test('should handle validation failure', async () => {
      const invalidConfig = { ...mockAgentConfig, accountId: '' };

      await expect(
        (agentLoader as any).validateCoreConfig(invalidConfig)
      ).rejects.toThrow('Missing required core configuration');
    });

    test('should handle validation error', async () => {
      const invalidConfig = { ...mockAgentConfig, openAIApiKey: '' };

      await expect(
        (agentLoader as any).validateCoreConfig(invalidConfig)
      ).rejects.toThrow('Missing required LLM API key');
    });
  });

  describe('Core Agent Initialization', () => {
    const mockAgentConfig: AgentConfig = {
      accountId: '0.0.123456',
      network: 'testnet',
      privateKey: 'test-key',
      operatorId: '0.0.123456',
      operatorKey: 'test-operator-key'
    };

    beforeEach(() => {
      agentLoader.setAgentService(mockAgentService);
    });

    test('should initialize core agent successfully', async () => {
      mockAgentService.initializeAgent.mockResolvedValue({
        success: true,
        sessionId: 'test-session-123'
      });

      const result = await (agentLoader as any).initializeCoreAgent(mockAgentConfig, 15000);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-123');
      expect(mockAgentService.initializeInternal).toHaveBeenCalledWith({
        ...mockAgentConfig,
        useProgressiveLoading: false
      });
    });

    test('should handle initialization failure', async () => {
      mockAgentService.initializeInternal.mockResolvedValue({
        success: false,
        error: 'Initialization failed'
      });

      const result = await (agentLoader as any).initializeCoreAgent(mockAgentConfig, 15000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Initialization failed');
    });

    test('should handle initialization timeout', async () => {
      mockAgentService.initializeInternal.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, sessionId: 'timeout' }), 200))
      );

      const result = await (agentLoader as any).initializeCoreAgent(mockAgentConfig, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    test('should handle initialization error', async () => {
      mockAgentService.initializeInternal.mockRejectedValue(new Error('Init error'));

      const result = await (agentLoader as any).initializeCoreAgent(mockAgentConfig, 15000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Init error');
    });
  });

  describe('Optimization Warmup', () => {
    test('should perform optimization warmup', async () => {
      await (agentLoader as any).performOptimizationWarmup();

      expect(mockLogger.debug).toHaveBeenCalledWith('Performing optimization warmup');
      expect(mockLogger.debug).toHaveBeenCalledWith('Connection pool metrics collected', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Optimization warmup completed');
    });
  });

  describe('Progress Reporting', () => {
    test('should report progress correctly', () => {
      const progressCallback = jest.fn();
      (agentLoader as any).defaultConfig.loadProgressCallback = progressCallback;

      (agentLoader as any).reportProgress();

      expect(progressCallback).toHaveBeenCalled();
    });

    test('should handle missing progress callback', () => {
      (agentLoader as any).defaultConfig.loadProgressCallback = undefined;

      expect(() => (agentLoader as any).reportProgress()).not.toThrow();
    });
  });







  describe('Error Handling', () => {
    test('should handle missing agent service', async () => {
      const mockAgentConfig: AgentConfig = {
        accountId: '0.0.123456',
        network: 'testnet',
        privateKey: 'test-key',
        operatorId: '0.0.123456',
        operatorKey: 'test-operator-key'
      };

      const result = await agentLoader.loadAgent(mockAgentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required LLM API key');
    });
  });
});
