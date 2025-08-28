import { ConversationalAgent } from '../../conversational-agent/src/conversational-agent';
import { AgentService } from "./agent-service";
import { ParameterService } from '../src/main/services/parameter-service';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Tests the timing of entity resolution in conversational flow
 * Demonstrates bug where entities are resolved before tool selection
 */
describe('ConversationalAgent Entity Resolution Timing', () => {
  let conversationalAgent: ConversationalAgent;
  let _agentService: AgentService;
  let parameterService: ParameterService;
  let logger: Logger;

  beforeEach(async () => {
    logger = new Logger({ module: 'ConversationalEntityResolutionTest' });
    
    _agentService = new AgentService(logger);
    parameterService = new ParameterService(logger);
    
    conversationalAgent = new ConversationalAgent({ 
      logger,
      enableMemory: true 
    });
  });

  describe('Entity Resolution Timing Bug', () => {
    it('should resolve entities after tool selection, not before', async () => {
      const entityData = {
        entityId: '0.0.6626196',
        entityName: 'Forever #1',
        entityType: 'topic' as const,
        sessionId: 'test-session-123'
      };

      const mockMemoryManager = {
        getEntityAssociations: () => [entityData],
        addEntity: jest.fn(),
        updateEntity: jest.fn()
      };
      
      interface ConversationalAgentWithMemory {
        memoryManager: typeof mockMemoryManager;
      }
      (conversationalAgent as unknown as ConversationalAgentWithMemory).memoryManager = mockMemoryManager;

      const mockEntityTools = {
        resolveEntities: {
          call: jest.fn().mockResolvedValue(
            'mint https://kiloscribe.com/api/inscription-cdn/0.0.6626196?network=testnet onto token we created'
          )
        }
      };
      
      interface ConversationalAgentWithTools {
        entityTools: typeof mockEntityTools;
      }
      (conversationalAgent as unknown as ConversationalAgentWithTools).entityTools = mockEntityTools;

      const mockAgent = {
        chat: jest.fn().mockImplementation(async (message: string, _context: unknown) => {
          expect(message).toContain('https://kiloscribe.com/api/inscription-cdn/0.0.6626196');
          expect(message).not.toContain('hcs://1/0.0.6626196');
          
          return { content: 'NFT minting failed - wrong entity format' };
        })
      };
      
      interface ConversationalAgentWithAgent {
        agent: typeof mockAgent;
      }
      (conversationalAgent as unknown as ConversationalAgentWithAgent).agent = mockAgent;

      const result = await conversationalAgent.chat('mint Forever #1 onto token we created');

      expect(mockEntityTools.resolveEntities.call).toHaveBeenCalledWith({
        message: 'mint Forever #1 onto token we created',
        entities: [{ 
          entityId: '0.0.6626196',
          entityName: 'Forever #1', 
          entityType: 'topic'
        }]
      });

      expect(mockAgent.chat).toHaveBeenCalledWith(
        'mint https://kiloscribe.com/api/inscription-cdn/0.0.6626196?network=testnet onto token we created',
        expect.any(Object)
      );

      expect(result.content).toContain('NFT minting failed');
    });

    it('should allow parameter preprocessing to convert entities with tool context', async () => {
      const entityData = {
        entityId: '0.0.6626196',
        entityName: 'Forever #1',
        entityType: 'topic' as const,
        sessionId: 'test-session-123'
      };

      const result = await parameterService.convertParameterEntities(
        'mint Forever #1 onto token we created',
        [entityData],
        { inscription: 'hrl' } // Tool prefers HRL format
      );

      expect(result).toContain('hcs://1/0.0.6626196');
      expect(result).not.toContain('https://kiloscribe.com');
    });
  });

  describe('Proposed Fix Validation', () => {
    it('should skip early entity resolution and rely on parameter preprocessing', async () => {
      const entityData = {
        entityId: '0.0.6626196',
        entityName: 'Forever #1',
        entityType: 'topic' as const,
        sessionId: 'test-session-123'
      };

      const _mockMemoryManager = {
        getEntityAssociations: () => [entityData],
        addEntity: jest.fn(),
        updateEntity: jest.fn()
      };

      const testAgent = new ConversationalAgent({ 
        logger,
        enableMemory: false  // This should skip early resolution
      });

      const mockAgent = {
        chat: jest.fn().mockResolvedValue({ 
          content: 'Tool will receive unmodified message for parameter preprocessing' 
        })
      };

      interface TestAgentWithMocks {
        agent: typeof mockAgent;
        memoryManager: null;
      }
      const testAgentWithMocks = testAgent as unknown as TestAgentWithMocks;
      testAgentWithMocks.agent = mockAgent;
      testAgentWithMocks.memoryManager = null; // Disable early resolution

      const result = await testAgent.chat('mint Forever #1 onto token we created');

      expect(mockAgent.chat).toHaveBeenCalledWith(
        'mint Forever #1 onto token we created', // Original message, no early resolution
        expect.any(Object)
      );

      expect(result.content).toContain('Tool will receive unmodified message');
    });
  });
});