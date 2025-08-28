import { AgentService } from "./agent-service";
import type { AgentConfig } from "./agent-service";
import { ConversationalAgent } from '@hashgraphonline/conversational-agent';

jest.mock('@hashgraphonline/conversational-agent', () => ({
  ConversationalAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    processMessage: jest.fn().mockResolvedValue({
      message: 'Test response',
      output: 'Test output',
    }),
  })),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('AgentService', () => {
  let agentService: AgentService;
  const mockConfig: AgentConfig = {
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
    network: 'testnet',
    openAIApiKey: 'test-api-key',
    modelName: 'gpt-4o-mini',
  };

  beforeEach(() => {
    (AgentService as unknown as { instance: undefined }).instance = undefined;
    agentService = AgentService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = AgentService.getInstance();
      const instance2 = AgentService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize agent successfully', async () => {
      const result = await agentService.initialize(mockConfig);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return existing session if already initialized', async () => {
      const result1 = await agentService.initialize(mockConfig);
      expect(result1.success).toBe(true);

      const result2 = await agentService.initialize(mockConfig);
      expect(result2.success).toBe(true);
      expect(result2.sessionId).toBe(result1.sessionId);
    });

    it('should handle initialization error', async () => {
      ConversationalAgent.mockImplementationOnce(() => ({
        initialize: jest
          .fn()
          .mockRejectedValue(new Error('Initialization failed')),
      }));

      const result = await agentService.initialize(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Initialization failed');
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await agentService.initialize(mockConfig);
    });

    it('should send message successfully', async () => {
      const result = await agentService.sendMessage('Hello', []);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.content).toBe('Test response');
    });

    it('should handle send message error', async () => {
      const mockAgent = ConversationalAgent.mock.results[0].value;
      mockAgent.processMessage.mockRejectedValueOnce(new Error('Send failed'));

      const result = await agentService.sendMessage('Hello', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });

    it('should return error if agent not initialized', async () => {
      const uninitializedService = AgentService.getInstance();
      await uninitializedService.disconnect();

      const result = await uninitializedService.sendMessage('Hello', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent not initialized');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await agentService.initialize(mockConfig);

      const result = await agentService.disconnect();

      expect(result.success).toBe(true);
      expect(agentService.isInitialized()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      const status = agentService.getStatus();

      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('isInitializing');
      expect(status).toHaveProperty('sessionId');
    });
  });

  describe('minting context detection bug', () => {
    it('should detect minting context for topic entities without explicit NFT keywords', () => {
      const detectMintingContext = (agentService as unknown as { detectMintingContext: (input: string) => boolean }).detectMintingContext.bind(agentService);
      
      expect(detectMintingContext('Can you mint Forever #1 onto the Token Id we just created?')).toBe(true);
      expect(detectMintingContext('mint Forever #1 onto token')).toBe(true);
      expect(detectMintingContext('Please mint the Forever #1 topic')).toBe(true);
    });
  });

  describe('Type Safety Validation', () => {
    describe('method return types', () => {
      it('should return properly typed status object', () => {
        const status = agentService.getStatus();
        expect(typeof status.isInitialized).toBe('boolean');
        expect(typeof status.isInitializing).toBe('boolean');
        expect(status.sessionId === null || typeof status.sessionId === 'string').toBe(true);
      });

      it('should return boolean for status methods', () => {
        expect(typeof agentService.isInitialized()).toBe('boolean');
        expect(typeof agentService.isInitializing()).toBe('boolean');
        expect(typeof agentService.isCoreFunctionalityReady()).toBe('boolean');
        expect(typeof agentService.entityExists('0.0.123456')).toBe('boolean');
      });

      it('should return properly typed LoadingState', () => {
        const loadingState = agentService.getLoadingState();
        expect(typeof loadingState.isLoading).toBe('boolean');
        expect(typeof loadingState.status).toBe('string');
        expect(loadingState.progress === undefined || typeof loadingState.progress === 'number').toBe(true);
        expect(loadingState.phase === undefined || typeof loadingState.phase === 'string').toBe(true);
      });

      it('should return properly typed entity arrays', () => {
        const entities = agentService.getStoredEntities();
        expect(Array.isArray(entities)).toBe(true);
        
        const entitiesWithType = agentService.getStoredEntities('token');
        expect(Array.isArray(entitiesWithType)).toBe(true);
      });
    });

    describe('async method return types', () => {
      it('should return properly typed Promise results', async () => {
        const waitResult = await agentService.waitForBackgroundTasks(1000);
        expect(typeof waitResult).toBe('boolean');

        const entityResult = await agentService.findEntityByName('test', 'token');
        expect(entityResult === null || typeof entityResult === 'object').toBe(true);

        const disconnectResult = await agentService.disconnect();
        expect(typeof disconnectResult.success).toBe('boolean');
        expect(disconnectResult.error === undefined || typeof disconnectResult.error === 'string').toBe(true);
      });

      it('should handle MCP methods with proper return types', async () => {
        const connectionStatus = await agentService.getMCPConnectionStatus();
        expect(connectionStatus === null || connectionStatus instanceof Map).toBe(true);

        const isConnected = await agentService.isMCPServerConnected('test-server');
        expect(typeof isConnected).toBe('boolean');

        const summary = await agentService.getMCPConnectionSummary();
        expect(typeof summary.total).toBe('number');
        expect(typeof summary.connected).toBe('number');
        expect(typeof summary.pending).toBe('number');
        expect(typeof summary.failed).toBe('number');
      });
    });

    describe('type-safe parameter handling', () => {
      it('should handle entity operations with proper typing', () => {
        expect(() => {
          agentService.storeEntityAssociation('0.0.123456', 'TestToken', 'tx-123');
        }).not.toThrow();

        expect(() => {
          agentService.storeEntityAssociation('0.0.789012', 'TestTopic');
        }).not.toThrow();

        const recentEntity = agentService.getMostRecentEntity('token');
        expect(recentEntity === null || typeof recentEntity === 'object').toBe(true);
      });

      it('should handle performance metrics with proper typing', () => {
        const metrics = agentService.getPerformanceMetrics();
        
        expect(typeof metrics.agentMetrics).toBe('object');
        expect(typeof metrics.agentMetrics.totalRequests).toBe('number');
        expect(typeof metrics.agentMetrics.successfulRequests).toBe('number');
        expect(typeof metrics.agentMetrics.failedRequests).toBe('number');
        expect(typeof metrics.agentMetrics.averageResponseTime).toBe('number');
        expect(typeof metrics.agentMetrics.uptime).toBe('number');

        if (metrics.mcpMetrics) {
          expect(typeof metrics.mcpMetrics.connectedServers).toBe('number');
          expect(typeof metrics.mcpMetrics.totalServers).toBe('number');
          expect(typeof metrics.mcpMetrics.averageLatency).toBe('number');
          expect(typeof metrics.mcpMetrics.errorRate).toBe('number');
        }
      });
    });

    describe('session context type safety', () => {
      it('should handle session context operations safely', () => {
        const mockContext = {
          sessionId: 'test-session-123',
          mode: 'personal' as const,
          topicId: '0.0.789012'
        };

        expect(() => {
          agentService.updateSessionContext(mockContext);
        }).not.toThrow();
        
        const retrievedContext = agentService.getSessionContext();
        expect(retrievedContext === null || typeof retrievedContext === 'object').toBe(true);

        agentService.clearSessionContext();
        expect(agentService.getSessionContext()).toBeNull();
      });
    });
  });
});
