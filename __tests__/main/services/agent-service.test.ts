jest.mock('@hashgraphonline/conversational-agent', () => ({
  FormatConverterRegistry: jest.fn(),
  TopicIdToHrlConverter: jest.fn(),
  StringNormalizationConverter: jest.fn()
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  NetworkType: {
    MAINNET: 'mainnet',
    TESTNET: 'testnet',
    PREVIEWNET: 'previewnet'
  }
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/agent-loader', () => ({
  AgentLoader: {
    getInstance: jest.fn().mockReturnValue({
      setAgentService: jest.fn(),
      updateConfig: jest.fn(),
      cleanup: jest.fn()
    })
  }
}));

jest.mock('../../../src/main/services/session-service', () => ({
  SessionService: jest.fn().mockImplementation(() => ({
    setSessionId: jest.fn(),
    updateContext: jest.fn(),
    clearContext: jest.fn(),
    getContext: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/parameter-service', () => ({
  ParameterService: jest.fn().mockImplementation(() => ({
    attachToAgent: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/mcp-connection-service', () => ({
  MCPConnectionService: jest.fn().mockImplementation(() => ({
    setAgent: jest.fn(),
    getMCPConnectionStatus: jest.fn().mockResolvedValue(new Map()),
    isMCPServerConnected: jest.fn().mockResolvedValue(false),
    getMCPConnectionSummary: jest.fn().mockResolvedValue({
      total: 0,
      connected: 0,
      pending: 0,
      failed: 0
    })
  }))
}));

jest.mock('../../../src/main/services/memory-service', () => ({
  MemoryService: jest.fn().mockImplementation(() => ({
    setAgent: jest.fn(),
    setSessionIdProvider: jest.fn(),
    storeEntityAssociation: jest.fn().mockResolvedValue('test'),
    getStoredEntities: jest.fn().mockReturnValue([]),
    findEntityByName: jest.fn().mockResolvedValue(null),
    getMostRecentEntity: jest.fn().mockReturnValue(null),
    entityExists: jest.fn().mockReturnValue(false),
    setupEntityHandlers: jest.fn(),
    loadStoredEntities: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../../src/main/services/initialization-service', () => ({
  InitializationService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue({
      success: true,
      sessionId: 'test-session-id',
      coreReadyTimeMs: 100,
      backgroundTasksRemaining: 0,
      loadingPhase: 'complete'
    }),
    initializeTraditional: jest.fn().mockResolvedValue({
      success: true,
      sessionId: 'test-session-id'
    }),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({
      isInitialized: false,
      isInitializing: false,
      sessionId: null
    }),
    isCoreFunctionalityReady: jest.fn().mockReturnValue(false),
    getLoadingState: jest.fn().mockReturnValue({
      isLoading: false,
      status: 'idle'
    }),
    waitForBackgroundTasks: jest.fn().mockResolvedValue(true),
    getAgent: jest.fn().mockReturnValue(null),
    getEntityResolver: jest.fn().mockReturnValue(null),
    setAgentLoader: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/message-service', () => ({
  MessageService: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({
      success: true,
      response: 'test response'
    }),
    sendMessageWithAttachments: jest.fn().mockResolvedValue({
      success: true,
      response: 'test response with attachments'
    }),
    processFormSubmission: jest.fn().mockResolvedValue({
      success: true,
      response: 'form processed'
    }),
    setAgent: jest.fn(),
    setEntityResolver: jest.fn(),
    setParameterService: jest.fn(),
    setOnEntityStored: jest.fn(),
    setSessionContext: jest.fn(),
    resolveEntityReferences: jest.fn().mockResolvedValue('resolved message')
  }))
}));

jest.mock('../../../src/main/services/entity-service', () => ({
  EntityService: jest.fn().mockImplementation(() => ({
    storeEntity: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../../src/main/services/safe-conversational-agent', () => ({
  SafeConversationalAgent: jest.fn()
}));

import { AgentService } from '../../../src/main/services/agent-service';
import type { AgentConfig, SessionContext } from '../../../src/main/services/agent-service';

describe('AgentService', () => {
  let agentService: AgentService;
  let mockLogger: any;
  let mockSessionService: any;
  let mockParameterService: any;
  let mockMCPConnectionService: any;
  let mockMemoryService: any;
  let mockInitializationService: any;
  let mockMessageService: any;
  let mockEntityService: any;
  let mockAgentLoader: any;
  let mockFormatConverterRegistry: any;

  const mockAgentConfig: AgentConfig = {
    accountId: '0.0.123456',
    privateKey: '302e020100300506032b6570042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    network: 'testnet' as any,
    openAIApiKey: 'sk-test1234567890abcdef',
    modelName: 'gpt-4',
    operationalMode: 'autonomous',
    llmProvider: 'openai',
    verbose: false,
    disableLogging: false
  };

  const mockSessionContext: SessionContext = {
    sessionId: 'test-session-123',
    mode: 'personal',
    topicId: '0.0.123456'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AgentService as any).instance = null;

    agentService = AgentService.createTestInstance();

    mockLogger = (agentService as any).logger;
    mockSessionService = (agentService as any).sessionService;
    mockParameterService = (agentService as any).parameterService;
    mockMCPConnectionService = (agentService as any).mcpConnectionService;
    mockMemoryService = (agentService as any).memoryService;
    mockInitializationService = (agentService as any).initializationService;
    mockMessageService = (agentService as any).messageService;
    mockEntityService = (agentService as any).entityService;
    mockAgentLoader = (agentService as any).agentLoader;
    mockFormatConverterRegistry = (agentService as any).formatConverterRegistry;
  });

  describe('Constructor and Setup', () => {
    test('should create agent service with default dependencies', () => {
      expect(agentService).toBeInstanceOf(AgentService);
      expect(mockFormatConverterRegistry.register).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Format converters registered:',
        ['TopicIdToHrlConverter', 'StringNormalizationConverter']
      );
    });

    test('should setup service connections correctly', () => {
      expect(mockMessageService.setParameterService).toHaveBeenCalledWith(mockParameterService);
      expect(mockMessageService.setOnEntityStored).toHaveBeenCalledWith(expect.any(Function));
      expect(mockMemoryService.setSessionIdProvider).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should initialize progressive loader', () => {
      expect(mockAgentLoader.setAgentService).toHaveBeenCalledWith(agentService);
      expect(mockInitializationService.setAgentLoader).toHaveBeenCalledWith(mockAgentLoader);
      expect(mockLogger.debug).toHaveBeenCalledWith('Agent loader initialized with AgentService injection');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return singleton instance', () => {
      const instance1 = AgentService.getInstance();
      const instance2 = AgentService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AgentService);
    });

    test('should create test instance bypassing singleton', () => {
      const instance1 = AgentService.createTestInstance();
      const instance2 = AgentService.createTestInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(AgentService);
      expect(instance2).toBeInstanceOf(AgentService);
    });
  });

  describe('Agent Initialization', () => {
    test('should initialize agent successfully', async () => {
      mockInitializationService.initialize.mockResolvedValue({
        success: true,
        sessionId: 'test-session-id',
        coreReadyTimeMs: 150,
        backgroundTasksRemaining: 2,
        loadingPhase: 'initializing'
      });

      const result = await agentService.initialize(mockAgentConfig);

      expect(result).toEqual({
        success: true,
        sessionId: 'test-session-id',
        coreReadyTimeMs: 150,
        backgroundTasksRemaining: 2,
        loadingPhase: 'initializing'
      });
      expect(mockSessionService.setSessionId).toHaveBeenCalledWith('test-session-id');
    });

    test('should handle initialization failure', async () => {
      mockInitializationService.initialize.mockResolvedValue({
        success: false,
        error: 'Initialization failed'
      });

      const result = await agentService.initialize(mockAgentConfig);

      expect(result).toEqual({
        success: false,
        error: 'Initialization failed'
      });
      expect(mockSessionService.setSessionId).not.toHaveBeenCalled();
    });

    test('should setup agent services when agent is available', async () => {
      const mockAgent = { test: 'agent' };
      const mockEntityResolver = { test: 'resolver' };

      mockInitializationService.initialize.mockResolvedValue({
        success: true,
        sessionId: 'test-session-id'
      });
      mockInitializationService.getAgent.mockReturnValue(mockAgent);
      mockInitializationService.getEntityResolver.mockReturnValue(mockEntityResolver);

      await agentService.initialize(mockAgentConfig);

      expect(mockMCPConnectionService.setAgent).toHaveBeenCalledWith(mockAgent);
      expect(mockMemoryService.setAgent).toHaveBeenCalledWith(mockAgent);
      expect(mockMessageService.setAgent).toHaveBeenCalledWith(mockAgent);
      expect(mockMessageService.setEntityResolver).toHaveBeenCalledWith(mockEntityResolver);
    });

    test('should setup entity handlers and load stored entities', async () => {
      const mockAgent = { test: 'agent' };

      mockInitializationService.initialize.mockResolvedValue({
        success: true,
        sessionId: 'test-session-id'
      });
      mockInitializationService.getAgent.mockReturnValue(mockAgent);

      await agentService.initialize(mockAgentConfig);

      expect(mockMemoryService.setupEntityHandlers).toHaveBeenCalledWith(mockAgent);
      expect(mockMemoryService.loadStoredEntities).toHaveBeenCalledWith(mockAgent);
    });

    test('should initialize agent internally', async () => {
      mockInitializationService.initializeTraditional.mockResolvedValue({
        success: true,
        sessionId: 'internal-session-id'
      });

      const result = await (agentService as any).initializeInternal(mockAgentConfig);

      expect(result).toEqual({
        success: true,
        sessionId: 'internal-session-id'
      });
      expect(mockInitializationService.initializeTraditional).toHaveBeenCalledWith(mockAgentConfig);
    });
  });

  describe('Session Management', () => {
    test('should update session context', () => {
      agentService.updateSessionContext(mockSessionContext);

      expect(mockSessionService.updateContext).toHaveBeenCalledWith(mockSessionContext);
      expect(mockMessageService.setSessionContext).toHaveBeenCalledWith(mockSessionContext);
    });

    test('should clear session context', () => {
      agentService.clearSessionContext();

      expect(mockSessionService.clearContext).toHaveBeenCalled();
    });

    test('should get session context', () => {
      const context = { sessionId: 'test', mode: 'personal' as const };
      mockSessionService.getContext.mockReturnValue(context);

      const result = agentService.getSessionContext();

      expect(result).toBe(context);
      expect(mockSessionService.getContext).toHaveBeenCalled();
    });

    test('should get current session ID', () => {
      mockSessionService.getContext.mockReturnValue(mockSessionContext);

      const sessionId = (agentService as any).getCurrentSessionId();

      expect(sessionId).toBe('test-session-123');
    });

    test('should return null when no session context', () => {
      mockSessionService.getContext.mockReturnValue(null);

      const sessionId = (agentService as any).getCurrentSessionId();

      expect(sessionId).toBeNull();
    });
  });

  describe('Message Processing', () => {
    test('should send message successfully', async () => {
      const content = 'Hello agent';
      const chatHistory = [{ role: 'user', content: 'test' }] as any;

      mockMessageService.sendMessage.mockResolvedValue({
        success: true,
        response: 'Agent response'
      });

      const result = await agentService.sendMessage(content, chatHistory);

      expect(result).toEqual({
        success: true,
        response: 'Agent response'
      });
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(content, chatHistory);
    });

    test('should send message with attachments', async () => {
      const content = 'Message with file';
      const chatHistory = [] as any;
      const attachments = [{
        name: 'test.txt',
        data: 'file content',
        type: 'text/plain',
        size: 1024
      }];

      mockMessageService.sendMessageWithAttachments.mockResolvedValue({
        success: true,
        response: 'Attachment processed'
      });

      const result = await agentService.sendMessageWithAttachments(content, chatHistory, attachments);

      expect(result).toEqual({
        success: true,
        response: 'Attachment processed'
      });
      expect(mockMessageService.sendMessageWithAttachments).toHaveBeenCalledWith(content, chatHistory, attachments);
    });

    test('should process form submission', async () => {
      const formSubmission = {
        formId: 'form-123',
        data: { field1: 'value1' },
        timestamp: Date.now(),
        toolName: 'testTool'
      };
      const chatHistory = [] as any;

      mockMessageService.processFormSubmission.mockResolvedValue({
        success: true,
        response: 'Form processed successfully'
      });

      const result = await agentService.processFormSubmission(formSubmission, chatHistory);

      expect(result).toEqual({
        success: true,
        response: 'Form processed successfully'
      });
      expect(mockMessageService.processFormSubmission).toHaveBeenCalledWith(formSubmission, chatHistory);
    });
  });

  describe('Agent Status and State', () => {
    test('should get agent status', () => {
      const status = {
        isInitialized: true,
        isInitializing: false,
        sessionId: 'test-session'
      };
      mockInitializationService.getStatus.mockReturnValue(status);

      const result = agentService.getStatus();

      expect(result).toBe(status);
      expect(mockInitializationService.getStatus).toHaveBeenCalled();
    });

    test('should check if agent is initialized', () => {
      mockInitializationService.getStatus.mockReturnValue({
        isInitialized: true,
        isInitializing: false,
        sessionId: 'test'
      });

      const result = agentService.isInitialized();

      expect(result).toBe(true);
    });

    test('should check if agent is initializing', () => {
      mockInitializationService.getStatus.mockReturnValue({
        isInitialized: false,
        isInitializing: true,
        sessionId: null
      });

      const result = agentService.isInitializing();

      expect(result).toBe(true);
    });

    test('should get agent instance', () => {
      const mockAgent = { test: 'agent instance' };
      mockInitializationService.getAgent.mockReturnValue(mockAgent);

      const result = agentService.getAgent();

      expect(result).toBe(mockAgent);
      expect(mockInitializationService.getAgent).toHaveBeenCalled();
    });

    test('should check if core functionality is ready', () => {
      mockInitializationService.isCoreFunctionalityReady.mockReturnValue(true);

      const result = agentService.isCoreFunctionalityReady();

      expect(result).toBe(true);
      expect(mockInitializationService.isCoreFunctionalityReady).toHaveBeenCalled();
    });

    test('should get loading state', () => {
      const loadingState = {
        isLoading: true,
        status: 'initializing',
        progress: 75
      };
      mockInitializationService.getLoadingState.mockReturnValue(loadingState);

      const result = agentService.getLoadingState();

      expect(result).toBe(loadingState);
      expect(mockInitializationService.getLoadingState).toHaveBeenCalled();
    });

    test('should wait for background tasks', async () => {
      mockInitializationService.waitForBackgroundTasks.mockResolvedValue(true);

      const result = await agentService.waitForBackgroundTasks(5000);

      expect(result).toBe(true);
      expect(mockInitializationService.waitForBackgroundTasks).toHaveBeenCalledWith(5000);
    });
  });

  describe('Progressive Loading', () => {
    test('should enable progressive loading without config', () => {
      agentService.enableProgressiveLoading();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Progressive loading enabled for next initialization',
        {}
      );
    });

    test('should enable progressive loading with config', () => {
      const config = {
        enablePhase1: true,
        enablePhase2: false,
        timeoutMs: 10000
      };

      agentService.enableProgressiveLoading(config);

      expect(mockAgentLoader.updateConfig).toHaveBeenCalledWith(config);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Progressive loading enabled for next initialization',
        config
      );
    });
  });

  describe('Entity Management', () => {
    test('should get stored entities', () => {
      const entities = [{ id: '1', name: 'test' }] as any;
      mockMemoryService.getStoredEntities.mockReturnValue(entities);

      const result = agentService.getStoredEntities();

      expect(result).toBe(entities);
      expect(mockMemoryService.getStoredEntities).toHaveBeenCalledWith(undefined);
    });

    test('should find entity by name', async () => {
      const entity = { id: '1', name: 'Test Account' } as any;
      mockMemoryService.findEntityByName.mockResolvedValue(entity);

      const result = await agentService.findEntityByName('Test Account');

      expect(result).toBe(entity);
      expect(mockMemoryService.findEntityByName).toHaveBeenCalledWith('Test Account', undefined);
    });

    test('should check if entity exists', () => {
      mockMemoryService.entityExists.mockReturnValue(true);

      const result = agentService.entityExists('entity-123');

      expect(result).toBe(true);
      expect(mockMemoryService.entityExists).toHaveBeenCalledWith('entity-123');
    });

    test('should store entity association', async () => {
      const entityId = '0.0.123456';
      const entityName = 'Test Account';
      const transactionId = '0.0.123456@1234567890.123456789';

      mockMemoryService.storeEntityAssociation.mockResolvedValue('account');

      agentService.storeEntityAssociation(entityId, entityName, transactionId);

      expect(mockMemoryService.storeEntityAssociation).toHaveBeenCalledWith(entityId, entityName, transactionId);
    });

    test('should resolve entity references', async () => {
      const userMessage = 'Use account @test-account';
      const resolvedMessage = 'Use account 0.0.123456';

      mockMessageService.resolveEntityReferences.mockResolvedValue(resolvedMessage);

      const result = await agentService.resolveEntityReferences(userMessage);

      expect(result).toBe(resolvedMessage);
      expect(mockMessageService.resolveEntityReferences).toHaveBeenCalledWith(userMessage);
    });
  });

  describe('MCP Connection Management', () => {
    test('should get MCP connection status', async () => {
      const statusMap = new Map([['server1', 'connected']]);
      mockMCPConnectionService.getMCPConnectionStatus.mockResolvedValue(statusMap);

      const result = await agentService.getMCPConnectionStatus();

      expect(result).toBe(statusMap);
      expect(mockMCPConnectionService.getMCPConnectionStatus).toHaveBeenCalled();
    });

    test('should check if MCP server is connected', async () => {
      mockMCPConnectionService.isMCPServerConnected.mockResolvedValue(true);

      const result = await agentService.isMCPServerConnected('test-server');

      expect(result).toBe(true);
      expect(mockMCPConnectionService.isMCPServerConnected).toHaveBeenCalledWith('test-server');
    });

    test('should get MCP connection summary', async () => {
      const summary = {
        total: 5,
        connected: 3,
        pending: 1,
        failed: 1
      };
      mockMCPConnectionService.getMCPConnectionSummary.mockResolvedValue(summary);

      const result = await agentService.getMCPConnectionSummary();

      expect(result).toBe(summary);
      expect(mockMCPConnectionService.getMCPConnectionSummary).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    test('should get performance metrics', () => {
      const metrics = agentService.getPerformanceMetrics();

      expect(metrics).toEqual({
        agentMetrics: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          uptime: 0
        }
      });
    });
  });

  describe('Cleanup and Disconnection', () => {
    test('should disconnect agent successfully', async () => {
      mockInitializationService.cleanup.mockResolvedValue(undefined);

      const result = await agentService.disconnect();

      expect(result).toEqual({ success: true });
      expect(mockInitializationService.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Agent disconnected successfully');
    });

    test('should handle disconnect failure', async () => {
      const error = new Error('Cleanup failed');
      mockInitializationService.cleanup.mockRejectedValue(error);

      const result = await agentService.disconnect();

      expect(result).toEqual({
        success: false,
        error: 'Cleanup failed'
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to disconnect agent:', error);
    });

    test('should cleanup optimizations', async () => {
      await agentService.cleanupOptimizations();

      expect(mockAgentLoader.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up agent service optimization resources');
    });
  });

  describe('TypeScript Interface Compliance', () => {
    test('should implement all required AgentService methods', () => {
      expect(typeof agentService.initialize).toBe('function');
      expect(typeof agentService.sendMessage).toBe('function');
      expect(typeof agentService.sendMessageWithAttachments).toBe('function');
      expect(typeof agentService.processFormSubmission).toBe('function');
      expect(typeof agentService.disconnect).toBe('function');
      expect(typeof agentService.getStatus).toBe('function');
      expect(typeof agentService.isInitialized).toBe('function');
      expect(typeof agentService.isInitializing).toBe('function');
      expect(typeof agentService.getAgent).toBe('function');
      expect(typeof agentService.isCoreFunctionalityReady).toBe('function');
      expect(typeof agentService.getLoadingState).toBe('function');
      expect(typeof agentService.waitForBackgroundTasks).toBe('function');
      expect(typeof agentService.getPerformanceMetrics).toBe('function');
      expect(typeof agentService.enableProgressiveLoading).toBe('function');
      expect(typeof agentService.getStoredEntities).toBe('function');
      expect(typeof agentService.findEntityByName).toBe('function');
      expect(typeof agentService.getMostRecentEntity).toBe('function');
      expect(typeof agentService.entityExists).toBe('function');
      expect(typeof agentService.storeEntityAssociation).toBe('function');
      expect(typeof agentService.resolveEntityReferences).toBe('function');
      expect(typeof agentService.getMCPConnectionStatus).toBe('function');
      expect(typeof agentService.isMCPServerConnected).toBe('function');
      expect(typeof agentService.getMCPConnectionSummary).toBe('function');
      expect(typeof agentService.cleanupOptimizations).toBe('function');
      expect(typeof agentService.updateSessionContext).toBe('function');
      expect(typeof agentService.clearSessionContext).toBe('function');
      expect(typeof agentService.getSessionContext).toBe('function');
    });
  });
});