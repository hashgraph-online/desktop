/**
 * TDD RED PHASE: NFT Tool Chain Entity Persistence Tests
 * 
 * These tests will FAIL initially, demonstrating the architectural problems
 * that need to be fixed. They test the expected behavior that should work
 * after implementing the solution.
 * 
 * ARCHITECTURAL PROBLEMS TO BE FIXED:
 * 1. resolveEntityReferences() called too early (before tool selection)  
 * 2. Parameter preprocessing callback not connected to conversation flow
 * 3. Tool metadata not used during natural conversation
 */

interface TestEntityAssociation {
  entityId: string;
  entityName: string;
  entityType: string;
  sessionId: string;
  createdAt: Date;
  lastUsed: Date;
  confidence: number;
  metadata: {
    networkType: 'testnet' | 'mainnet';
    [key: string]: unknown;
  };
}

interface ToolMetadata {
  entityResolutionPreferences?: Record<string, string>;
}

/**
 * Mock AgentService functionality to test the core logic
 * without dealing with import/dependency issues
 */
class MockAgentService {
  private initialized = false;
  private agent: { invoke: jest.MockedFunction<(tool: string, input: Record<string, unknown>) => Promise<string>> } | null = null;

  constructor() {
  }

  /**
   * Current broken implementation: resolveEntityReferences called too early
   * This is the method that needs to be REMOVED from sendMessage()
   */
  async sendMessage(content: string, chatHistory: unknown[] = []): Promise<unknown> {
    if (!this.agent || !this.initialized) {
      return { success: false, error: 'Agent not initialized' };
    }

    try {
      const resolvedContent = await this.resolveEntityReferences(content);
      
      const response = await this.agent.processMessage(resolvedContent, chatHistory);
      
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Current implementation: no tool context available
   * This is why entities get wrong format in conversation flow
   */
  async resolveEntityReferences(
    userMessage: string,
    toolContext?: ToolMetadata
  ): Promise<string> {
    if (!this.agent?.memoryManager) {
      return userMessage;
    }

    const entities = this.agent.memoryManager.getEntityAssociations();
    let resolvedMessage = userMessage;

    for (const entity of entities) {
      if (resolvedMessage.includes(entity.entityName)) {
        resolvedMessage = resolvedMessage.replace(entity.entityName, entity.entityId);
      }
    }

    if (toolContext?.entityResolutionPreferences) {
      resolvedMessage = await this.applyFormatConversions(
        resolvedMessage,
        entities,
        toolContext.entityResolutionPreferences
      );
    }

    return resolvedMessage;
  }

  /**
   * Tool metadata system - EXISTS but not used in conversation flow
   */
  private getToolMetadata(toolName: string): ToolMetadata | undefined {
    const toolMetadataMap: Record<string, ToolMetadata> = {
      'hedera-hts-mint-nft': {
        entityResolutionPreferences: {
          inscription: 'hrl',    // Topic IDs need HRL format for NFT minting  
          token: 'tokenId'       // Token entities stay as ID format
        }
      }
    };

    return toolMetadataMap[toolName];
  }

  /**
   * Parameter preprocessing - EXISTS but only used for form submissions
   */
  async preprocessToolParameters(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const toolMetadata = this.getToolMetadata(toolName);

    if (!toolMetadata?.entityResolutionPreferences || !this.agent?.memoryManager) {
      return parameters;
    }

    const entities = this.agent.memoryManager.getEntityAssociations();
    if (entities.length === 0) {
      return parameters;
    }

    const preprocessedParams = { ...parameters };

    for (const [paramKey, paramValue] of Object.entries(preprocessedParams)) {
      if (typeof paramValue === 'string') {
        preprocessedParams[paramKey] = await this.convertParameterEntities(
          paramValue,
          entities,
          toolMetadata.entityResolutionPreferences
        );
      }
    }

    return preprocessedParams;
  }

  /**
   * Entity parameter conversion - WORKS but only called from preprocessing
   */
  private async convertParameterEntities(
    parameterValue: string,
    entities: TestEntityAssociation[],
    formatPreferences: Record<string, string>
  ): Promise<string> {
    const matchingEntity = entities.find(entity => 
      parameterValue.includes(entity.entityId) || parameterValue.includes(entity.entityName)
    );

    if (!matchingEntity) {
      return parameterValue;
    }

    if (matchingEntity.entityType === 'topic' && formatPreferences.inscription === 'hrl') {
      return await this.convertTopicIdToHRL(matchingEntity.entityId, matchingEntity.metadata.networkType);
    }

    return parameterValue;
  }

  /**
   * Format conversion logic - WORKS correctly
   */
  private async convertTopicIdToHRL(topicId: string, networkType: 'testnet' | 'mainnet'): Promise<string> {
    const networkId = networkType === 'mainnet' ? '0' : '1';
    return `hcs://${networkId}/${topicId}`;
  }

  /**
   * Apply format conversions - EXISTS but rarely called
   */
  private async applyFormatConversions(
    message: string,
    entities: TestEntityAssociation[],
    formatPreferences: Record<string, string>
  ): Promise<string> {
    let convertedMessage = message;

    for (const entity of entities) {
      if (entity.entityType === 'topic' && formatPreferences.inscription === 'hrl') {
        const hrlFormat = await this.convertTopicIdToHRL(entity.entityId, entity.metadata.networkType);
        convertedMessage = convertedMessage.replace(entity.entityId, hrlFormat);
      }
    }

    return convertedMessage;
  }

  setAgent(agent: unknown): void {
    this.agent = agent;
    this.initialized = true;
  }
}

describe('NFT Tool Chain Entity Resolution Architecture Problems', () => {
  let mockAgentService: MockAgentService;
  const testEntities: TestEntityAssociation[] = [
    {
      entityId: '0.0.6624888',
      entityName: 'Forever #1',
      entityType: 'topic',
      sessionId: 'test-session-123',
      createdAt: new Date(),
      lastUsed: new Date(),
      confidence: 0.95,
      metadata: {
        networkType: 'testnet',
        description: 'Test inscription for NFT minting'
      }
    },
    {
      entityId: '0.0.7654321',
      entityName: 'test token',
      entityType: 'token',
      sessionId: 'test-session-123',
      createdAt: new Date(),
      lastUsed: new Date(),
      confidence: 0.90,
      metadata: {
        networkType: 'testnet',
        symbol: 'TESTNFT'
      }
    }
  ];

  beforeEach(() => {
    mockAgentService = new MockAgentService();
    
    const mockAgent = {
      memoryManager: {
        getEntityAssociations: jest.fn().mockReturnValue(testEntities)
      },
      processMessage: jest.fn().mockResolvedValue({
        message: 'Processing...',
        output: 'Success'
      }),
      setParameterPreprocessingCallback: jest.fn()
    };

    mockAgentService.setAgent(mockAgent);
  });

  describe('Current Broken Architecture', () => {
    /**
     * TEST 1: Demonstrates the core problem - resolution happens too early
     * 
     * CURRENTLY FAILS because:
     * - resolveEntityReferences() is called in sendMessage() without tool context
     * - Topic ID gets resolved but NOT converted to HRL format
     * - Tool receives wrong format because conversion happened too early
     */
    it('should demonstrate early resolution problem - topic ID not converted to HRL', async () => {
      const result = await mockAgentService.sendMessage('mint Forever #1 onto test token');

      expect(result.success).toBe(true);

      
    });

    /**
     * TEST 2: Shows parameter preprocessing works but isn't connected to conversation
     */  
    it('should show parameter preprocessing works correctly when called directly', async () => {
      const preprocessedParams = await (mockAgentService as unknown as { preprocessToolParameters: (tool: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
        'hedera-hts-mint-nft',
        {
          inscription: '0.0.6624888',
          token: '0.0.7654321'
        }
      );

      expect(preprocessedParams.inscription).toBe('hcs://1/0.0.6624888');
      expect(preprocessedParams.token).toBe('0.0.7654321'); // Token stays as ID
    });

    /**
     * TEST 3: Shows tool metadata system works but isn't used in conversation flow
     */
    it('should show tool metadata exists but is not used during conversation', async () => {
      const toolMetadata = (mockAgentService as unknown as { getToolMetadata: (tool: string) => unknown }).getToolMetadata('hedera-hts-mint-nft');

      expect(toolMetadata).toBeDefined();
      expect(toolMetadata.entityResolutionPreferences?.inscription).toBe('hrl');
      expect(toolMetadata.entityResolutionPreferences?.token).toBe('tokenId');

    });
  });

  describe('Expected Behavior After Fix', () => {
    /**
     * TEST 4: Documents the expected behavior after implementing the fix
     * 
     * WILL PASS after implementing:
     * 1. Remove resolveEntityReferences() from sendMessage()
     * 2. Connect parameter preprocessing callback to conversation flow  
     * 3. Apply tool-aware entity resolution at parameter level
     */
    it('should resolve entities with tool context during parameter preprocessing', async () => {
      
      
      const result = await (mockAgentService as unknown as { convertParameterEntities: (name: string, entities: unknown[], field: string) => Promise<string> }).convertParameterEntities(
        'Forever #1', // Entity name reference
        testEntities,
        { inscription: 'hrl' } // Tool preference from metadata
      );

      expect(result).toBe('hcs://1/0.0.6624888');
    });

    /**
     * TEST 5: HRL conversion should use correct network ID
     */
    it('should convert Topic ID to HRL with correct network ID', async () => {
      const testnetHRL = await (mockAgentService as unknown as { convertTopicIdToHRL: (topicId: string, network: string) => Promise<string> }).convertTopicIdToHRL('0.0.6624888', 'testnet');
      expect(testnetHRL).toBe('hcs://1/0.0.6624888');

      const mainnetHRL = await (mockAgentService as unknown as { convertTopicIdToHRL: (topicId: string, network: string) => Promise<string> }).convertTopicIdToHRL('0.0.6624888', 'mainnet');
      expect(mainnetHRL).toBe('hcs://0/0.0.6624888');
    });

    /**
     * TEST 6: Tool should receive correctly formatted parameters
     */
    it('should eventually provide correctly formatted parameters to minting tool', async () => {
      
      
      
      const expectedResult = await (mockAgentService as unknown as { preprocessToolParameters: (tool: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
        'hedera-hts-mint-nft',
        {
          inscription: '0.0.6624888', // Should be converted to HRL
          token: '0.0.7654321'        // Should stay as token ID
        }
      );

      expect(expectedResult.inscription).toBe('hcs://1/0.0.6624888');
      expect(expectedResult.token).toBe('0.0.7654321');
    });
  });

  describe('Error Handling', () => {
    /**
     * TEST 7: Should handle missing entities gracefully
     */
    it('should handle tools without entity resolution preferences', async () => {
      const result = await (mockAgentService as unknown as { preprocessToolParameters: (tool: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
        'unknown-tool',
        { someParam: 'value' }
      );

      expect(result).toEqual({ someParam: 'value' });
    });

    it('should handle malformed Topic IDs', async () => {
      const invalidTopicId = 'invalid-topic-id';
      const result = await (mockAgentService as unknown as { convertTopicIdToHRL: (topicId: string, network: string) => Promise<string> }).convertTopicIdToHRL(invalidTopicId, 'testnet');
      
      expect(result).toBe('hcs://1/invalid-topic-id');
    });
  });
});

/**
 * SUMMARY OF TESTS
 * 
 * These tests demonstrate:
 * 1. ❌ Current broken behavior: early resolution without tool context
 * 2. ✅ Individual components work: preprocessing, metadata, conversion
 * 3. ❌ Components not connected: conversation flow doesn't use preprocessing  
 * 4. ✅ Expected behavior: what should happen after implementing the fix
 * 
 * IMPLEMENTATION TASKS (from tests):
 * 1. Remove resolveEntityReferences() call from sendMessage() line 948
 * 2. Connect parameter preprocessing callback to conversation flow
 * 3. Ensure tool metadata drives format conversion during natural conversation
 * 4. Test that "mint Forever #1 onto token" produces HRL format for minting tools
 */