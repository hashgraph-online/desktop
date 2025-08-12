import { AgentService } from '../../src/main/services/AgentService';
import type { AgentConfig } from '../../src/main/services/AgentService';

jest.mock('@hashgraphonline/conversational-agent', () => ({
  ConversationalAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    processMessage: jest.fn().mockResolvedValue({
      message: 'Test response',
      output: 'Test output'
    })
  }))
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn()
  }))
}));

describe('AgentService', () => {
  let agentService: AgentService;
  const mockConfig: AgentConfig = {
    accountId: '0.0.123456',
    privateKey: 'test-private-key',
    network: 'testnet',
    openAIApiKey: 'test-api-key',
    modelName: 'gpt-4o-mini'
  };

  beforeEach(() => {
    (AgentService as any).instance = undefined;
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
      const { ConversationalAgent } = require('@hashgraphonline/conversational-agent');
      ConversationalAgent.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed'))
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
      const { ConversationalAgent } = require('@hashgraphonline/conversational-agent');
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
});