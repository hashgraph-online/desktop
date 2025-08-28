import { AgentService } from "./agent-service";
import { AgentLoader } from '../src/main/services/AgentLoader';
import { createDatabaseManager } from '../src/main/db/connection';
import type { AgentConfig } from '@hashgraphonline/conversational-agent/dist/types/AgentTypes';

describe('AgentService Initialization Fix', () => {
  let testDbPath: string;
  let agentService: AgentService;

  beforeEach(() => {
    testDbPath = '/tmp/test-agent-service-fix.db';
    const pathProvider = {
      getDatabasePath: () => testDbPath
    };
    
    createDatabaseManager(pathProvider);
    agentService = AgentService.createTestInstance();
  });

  afterEach(async () => {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(testDbPath);
    } catch (_error) {
    }
  });

  describe('AgentLoader Integration', () => {
    it('should be able to call initializeInternal method on AgentService', async () => {
      const agentLoader = AgentLoader.getInstance();
      agentLoader.setAgentService(agentService);

      expect(typeof agentService.initializeInternal).toBe('function');
      
      const config: AgentConfig = {
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        openAiApiKey: 'test-key',
        temperature: 0.7,
        mode: 'agent',
        maxTokens: 1000,
        hederaMode: false,
        hederaAccountId: '',
        hederaPrivateKey: '',
        sessionId: 'test-session',
        formatToolParameters: true,
        contextLimit: 50000,
        conversationId: 'test-conversation'
      };

      const result = await agentService.initializeInternal(config);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('success');
    });

    it('should have mcpService property accessible in AgentLoader', () => {
      const agentLoader = AgentLoader.getInstance();
      
      expect(agentLoader).toBeDefined();
      expect((agentLoader as { mcpService: unknown }).mcpService).toBeDefined();
    });
  });

  describe('Database Manager Fix', () => {
    it('should not throw require errors when initializing database', () => {
      expect(() => {
        createDatabaseManager();
      }).not.toThrow();
    });

    it('should handle missing Electron gracefully', () => {
      const pathProvider = {
        getDatabasePath: () => '/tmp/test-fallback.db'
      };
      
      expect(() => {
        createDatabaseManager(pathProvider);
      }).not.toThrow();
    });
  });

  describe('Method Preservation Fix', () => {
    it('should preserve initializeInternal method after TypeScript compilation', () => {
      const instance = agentService;
      const proto = Object.getPrototypeOf(instance);
      const methods = Object.getOwnPropertyNames(proto);
      
      expect(methods).toContain('initializeInternal');
      expect(typeof instance.initializeInternal).toBe('function');
      expect(instance.initializeInternal).toBeInstanceOf(Function);
    });

    it('should have initializeInternal method accessible via direct invocation', async () => {
      const method = agentService.initializeInternal;
      expect(method).toBeDefined();
      expect(typeof method).toBe('function');
      
      const config: AgentConfig = {
        systemPrompt: 'Test prompt',
        model: 'gpt-4',
        openAiApiKey: 'test-key',
        temperature: 0.7,
        mode: 'agent',
        maxTokens: 1000,
        hederaMode: false,
        hederaAccountId: '',
        hederaPrivateKey: '',
        sessionId: 'test-session-direct',
        formatToolParameters: true,
        contextLimit: 50000,
        conversationId: 'test-conversation-direct'
      };

      const result = method.call(agentService, config);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should maintain method context when accessed through property', () => {
      const methodRef = agentService.initializeInternal;
      expect(methodRef).toBeDefined();
      expect(typeof methodRef).toBe('function');
      expect(methodRef.name).toBe('initializeInternal');
    });
  });

  describe('Session Loading', () => {
    it('should be able to access session service methods', () => {
      expect(typeof agentService.getCurrentSessionId).toBe('function');
      expect(typeof agentService.getSessionContext).toBe('function');
      expect(typeof agentService.updateSessionContext).toBe('function');
    });

    it('should be able to access entity service methods', () => {
      expect(typeof agentService.getStoredEntities).toBe('function');
      expect(typeof agentService.findEntityByName).toBe('function');
      expect(typeof agentService.entityExists).toBe('function');
    });
  });
});