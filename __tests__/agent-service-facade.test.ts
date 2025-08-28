import { AgentService } from "./agent-service";
import type { AgentConfig, SessionContext, ChatHistory } from "./agent-service";

jest.mock('../src/main/services/session-service');
jest.mock('../src/main/services/parameter-service');
jest.mock('../src/main/services/mcp-connection-service');
jest.mock('../src/main/services/memory-service');
jest.mock('../src/main/services/initialization-service');
jest.mock('../src/main/services/message-service');
jest.mock('../src/main/services/EntityService');
jest.mock('../src/main/services/AgentLoader');

describe('AgentService Facade', () => {
  let agentService: AgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    agentService = AgentService.createTestInstance();
  });

  describe('singleton behavior', () => {
    it('should return the same instance when calling getInstance', () => {
      const instance1 = AgentService.getInstance();
      const instance2 = AgentService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create different instances when calling createTestInstance', () => {
      const instance1 = AgentService.createTestInstance();
      const instance2 = AgentService.createTestInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('session management', () => {
    it('should update session context through session service', () => {
      const context: SessionContext = {
        sessionId: 'test-session-123',
        mode: 'personal',
        topicId: '0.0.12345'
      };

      agentService.updateSessionContext(context);

      expect(agentService.getSessionContext()).toBeDefined();
    });

    it('should clear session context', () => {
      const context: SessionContext = {
        sessionId: 'test-session-456',
        mode: 'hcs10'
      };

      agentService.updateSessionContext(context);
      agentService.clearSessionContext();

      expect(agentService.getSessionContext()).toBeNull();
    });
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      const config: AgentConfig = {
        accountId: '0.0.123',
        privateKey: 'test-private-key',
        network: 'testnet' as 'mainnet' | 'testnet',
        openAIApiKey: 'test-api-key',
        modelName: 'gpt-4o-mini',
        operationalMode: 'autonomous',
        llmProvider: 'openai'
      };

      const result = await agentService.initialize(config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle initialization failure gracefully', async () => {
      const invalidConfig = {} as AgentConfig;

      const result = await agentService.initialize(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('message processing', () => {
    it('should send message through message service', async () => {
      const content = 'Hello, agent!';
      const chatHistory: ChatHistory[] = [
        { type: 'human', content: 'Previous message' }
      ];

      const result = await agentService.sendMessage(content, chatHistory);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should send message with attachments', async () => {
      const content = 'Process this file';
      const attachments = [
        {
          name: 'test.txt',
          data: 'base64data',
          type: 'text/plain',
          size: 100
        }
      ];

      const result = await agentService.sendMessageWithAttachments(content, [], attachments);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should process form submissions', async () => {
      const formSubmission = {
        formId: 'test-form-123',
        data: { field1: 'value1', field2: 'value2' },
        timestamp: Date.now(),
        toolName: 'test-tool',
        originalPrompt: 'Execute test tool'
      };

      const result = await agentService.processFormSubmission(formSubmission);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('entity management', () => {
    it('should store entity association', () => {
      const entityId = '0.0.12345';
      const entityName = 'test-entity';
      const entityType = 'account';
      const transactionId = 'tx-123';

      agentService.storeEntityAssociation(entityId, entityName, entityType, transactionId);

      expect(agentService.entityExists(entityId)).toBe(false);
    });

    it('should get stored entities', () => {
      const entities = agentService.getStoredEntities();

      expect(Array.isArray(entities)).toBe(true);
    });

    it('should get stored entities by type', () => {
      const entities = agentService.getStoredEntities('account');

      expect(Array.isArray(entities)).toBe(true);
    });

    it('should find entity by name', async () => {
      const result = await agentService.findEntityByName('test-entity');

      expect(result).toBeNull();
    });

    it('should get most recent entity', () => {
      const result = agentService.getMostRecentEntity('account');

      expect(result).toBeNull();
    });
  });

  describe('MCP connection management', () => {
    it('should get MCP connection status', async () => {
      const status = await agentService.getMCPConnectionStatus();

      expect(status).toBeNull();
    });

    it('should check if MCP server is connected', async () => {
      const isConnected = await agentService.isMCPServerConnected('test-server');

      expect(typeof isConnected).toBe('boolean');
    });

    it('should get MCP connection summary', async () => {
      const summary = await agentService.getMCPConnectionSummary();

      expect(summary).toBeDefined();
      expect(typeof summary.total).toBe('number');
      expect(typeof summary.connected).toBe('number');
      expect(typeof summary.pending).toBe('number');
      expect(typeof summary.failed).toBe('number');
    });
  });

  describe('status and state management', () => {
    it('should get agent status', () => {
      const status = agentService.getStatus();

      expect(status).toBeDefined();
      expect(typeof status.isInitialized).toBe('boolean');
      expect(typeof status.isInitializing).toBe('boolean');
    });

    it('should check if agent is initialized', () => {
      const isInitialized = agentService.isInitialized();

      expect(typeof isInitialized).toBe('boolean');
    });

    it('should check if agent is initializing', () => {
      const isInitializing = agentService.isInitializing();

      expect(typeof isInitializing).toBe('boolean');
    });

    it('should get loading state', () => {
      const loadingState = agentService.getLoadingState();

      expect(loadingState).toBeDefined();
      expect(typeof loadingState.isLoading).toBe('boolean');
      expect(typeof loadingState.status).toBe('string');
    });

    it('should check core functionality readiness', () => {
      const isReady = agentService.isCoreFunctionalityReady();

      expect(typeof isReady).toBe('boolean');
    });
  });

  describe('cleanup and disconnection', () => {
    it('should disconnect successfully', async () => {
      const result = await agentService.disconnect();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should cleanup optimization resources', async () => {
      await expect(agentService.cleanupOptimizations()).resolves.not.toThrow();
    });
  });

  describe('progressive loading', () => {
    it('should enable progressive loading', () => {
      const config = { timeoutMs: 30000 };

      expect(() => agentService.enableProgressiveLoading(config)).not.toThrow();
    });

    it('should wait for background tasks', async () => {
      const result = await agentService.waitForBackgroundTasks(5000);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('entity reference resolution', () => {
    it('should resolve entity references', async () => {
      const message = 'Send to my-account';
      const toolContext = {
        entityResolutionPreferences: { account: 'accountId' }
      };

      const result = await agentService.resolveEntityReferences(message, toolContext);

      expect(typeof result).toBe('string');
    });
  });

  describe('performance metrics', () => {
    it('should get performance metrics', () => {
      const metrics = agentService.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.agentMetrics).toBeDefined();
      expect(typeof metrics.agentMetrics.totalRequests).toBe('number');
      expect(typeof metrics.agentMetrics.successfulRequests).toBe('number');
      expect(typeof metrics.agentMetrics.failedRequests).toBe('number');
      expect(typeof metrics.agentMetrics.averageResponseTime).toBe('number');
      expect(typeof metrics.agentMetrics.uptime).toBe('number');
    });
  });
});