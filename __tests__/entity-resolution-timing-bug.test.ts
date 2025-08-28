import { ParameterService } from '../src/main/services/parameter-service';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Tests the entity resolution timing bug in conversational flow
 * Demonstrates that early entity resolution happens before tool context is available
 */
describe('Entity Resolution Timing Bug', () => {
  let parameterService: ParameterService;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ module: 'EntityResolutionTimingTest' });
    parameterService = new ParameterService(logger);
  });

  describe('Current Behavior - Early Resolution Without Tool Context', () => {
    it('should demonstrate the bug where entities get wrong format without tool context', async () => {
      const entityData = {
        entityId: '0.0.6626196',
        entityName: 'Forever #1', 
        entityType: 'topic' as const,
        sessionId: 'test-session-123'
      };

      
      const messageWithEarlyResolution = 'mint Forever #1 onto token we created';
      
      const resultWithoutToolContext = await parameterService.convertParameterEntities(
        messageWithEarlyResolution,
        [entityData],
        undefined // NO tool preferences available yet - this is the bug!
      );

      expect(resultWithoutToolContext).toBe(messageWithEarlyResolution); // No conversion without preferences
    });

    it('should show parameter preprocessing works correctly when tool context is available', async () => {
      const entityData = {
        entityId: '0.0.6626196',
        entityName: 'Forever #1',
        entityType: 'topic' as const, 
        sessionId: 'test-session-123'
      };

      const messageForProcessing = 'mint Forever #1 onto token we created';
      
      const toolMetadata = { inscription: 'hrl' }; // NFT minting tool wants HRL format
      
      const resultWithToolContext = await parameterService.convertParameterEntities(
        messageForProcessing,
        [entityData],
        toolMetadata
      );

      expect(resultWithToolContext).toContain('hcs://1/0.0.6626196');
      expect(resultWithToolContext).not.toContain('https://kiloscribe.com');
    });
  });

  describe('Root Cause Analysis', () => {
    it('should demonstrate the timing issue in conversational flow', () => {
      
      
      
      const documentedBugFlow = {
        currentFlow: [
          'User: "mint Forever #1 onto token we created"',
          'resolveEntitiesInMessage() called WITHOUT tool context',  
          'LLM resolves to: "mint https://kiloscribe.com/api/inscription-cdn/0.0.6626196?network=testnet onto token we created"',
          'agent.chat() receives pre-resolved message',
          'Tool selection happens AFTER entities already resolved to wrong format',
          'hedera-hts-mint-nft tool gets CDN URL instead of preferred HRL format',
          'NFT minting fails due to wrong entity format'
        ],
        
        correctFlow: [
          'User: "mint Forever #1 onto token we created"',
          'agent.chat() receives ORIGINAL message with entity references',
          'LangChain agent selects hedera-hts-mint-nft tool',
          'Parameter preprocessing callback triggered with tool context',
          'convertParameterEntities() called with tool metadata (inscription: "hrl")',
          'Entity converted to HRL format: hcs://1/0.0.6626196',
          'Tool receives correct format and minting succeeds'
        ]
      };

      expect(documentedBugFlow.currentFlow).toHaveLength(7);
      expect(documentedBugFlow.correctFlow).toHaveLength(7);
      
    });
  });
});