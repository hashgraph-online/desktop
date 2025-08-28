import { AgentService } from "./agent-service";

jest.mock('@hashgraphonline/conversational-agent', () => ({
  AgentOperationalMode: {},
  EntityResolver: jest.fn(),
  FormatConverterRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    getRegisteredConverters: jest.fn().mockReturnValue([]),
    convertEntity: jest.fn().mockImplementation(async (entityId: string, format: string) => {
      if (entityId.startsWith('0.0.') && format === 'HRL') {
        return `hcs://1/${entityId}`;
      }
      return entityId;
    }),
  })),
  TopicIdToHrlConverter: jest.fn().mockImplementation(() => ({
    convert: jest.fn().mockImplementation(async (topicId: string) => `hcs://1/${topicId}`),
  })),
  EntityFormat: {
    HRL: 'HRL',
    TOKEN_ID: 'TOKEN_ID'
  },
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  TransactionParser: {
    parseTransactionBytes: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../src/main/services/SafeConversationalAgent');
jest.mock('../src/main/services/MCPService');
jest.mock('../src/main/services/AgentLoader');
jest.mock('../src/main/services/EntityService');
jest.mock('../src/main/utils/entity-type-validator');

describe('AgentService NFT Entity Resolution Integration', () => {
  let agentService: AgentService;

  beforeEach(() => {
    (AgentService as { instance?: AgentService }).instance = undefined;
    agentService = AgentService.getInstance();

    const mockAgent = {
      memoryManager: {
        getEntityAssociations: jest.fn().mockReturnValue([
          {
            entityId: '0.0.6624888',
            entityName: 'Forever #1',
            entityType: 'topic',
            createdAt: Date.now(),
          },
        ]),
        storeEntityAssociation: jest.fn(),
      },
    };
    (agentService as { agent?: unknown; initialized?: boolean }).agent = mockAgent;
    (agentService as { agent?: unknown; initialized?: boolean }).initialized = true;
  });

  it('should have parameter preprocessing callback configured', () => {
    expect(typeof (agentService as { preprocessToolParameters?: () => void }).preprocessToolParameters).toBe('function');
  });

  it('should have correct tool metadata for hedera-hts-mint-nft', () => {
    const metadata = (agentService as { getToolMetadata: (toolName: string) => unknown }).getToolMetadata('hedera-hts-mint-nft');
    
    expect(metadata).toBeDefined();
    expect(metadata.entityResolutionPreferences).toBeDefined();
    expect(metadata.entityResolutionPreferences.inscription).toBe('hrl');
    expect(metadata.entityResolutionPreferences.token).toBe('tokenId');
  });

  it('should convert topic ID to HRL format in tool parameters', async () => {
    const toolName = 'hedera-hts-mint-nft';
    const originalParameters = {
      tokenId: '0.0.1234567',
      inscriptionReference: '0.0.6624888', // This should be converted to HRL
      amount: '1'
    };

    const result = await (agentService as { preprocessToolParameters: (toolName: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
      toolName,
      originalParameters
    );

    expect(result.inscriptionReference).toBe('hcs://1/0.0.6624888');
    expect(result.tokenId).toBe('0.0.1234567'); // Should remain unchanged
    expect(result.amount).toBe('1'); // Should remain unchanged
  });

  it('should handle entities in array parameters', async () => {
    const toolName = 'hedera-hts-mint-nft';
    const originalParameters = {
      tokenId: '0.0.1234567',
      metadata: [
        'collection=Forever',
        'reference=0.0.6624888', // This should be converted
        'creator=TestUser'
      ]
    };

    const result = await (agentService as { preprocessToolParameters: (toolName: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
      toolName,
      originalParameters
    );

    expect(result.metadata).toContain('reference=hcs://1/0.0.6624888');
    expect(result.metadata).toContain('collection=Forever');
    expect(result.metadata).toContain('creator=TestUser');
  });

  it('should return original parameters for tools without metadata', async () => {
    const toolName = 'unknown-tool';
    const originalParameters = {
      someParam: '0.0.6624888'
    };

    const result = await (agentService as { preprocessToolParameters: (toolName: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
      toolName,
      originalParameters
    );

    expect(result).toEqual(originalParameters);
  });

  it('should return original parameters when no entities are in memory', async () => {
    const mockAgent = {
      memoryManager: {
        getEntityAssociations: jest.fn().mockReturnValue([]), // No entities
        storeEntityAssociation: jest.fn(),
      },
    };
    (agentService as { agent?: unknown }).agent = mockAgent;

    const toolName = 'hedera-hts-mint-nft';
    const originalParameters = {
      tokenId: '0.0.1234567',
      inscriptionReference: '0.0.6624888',
      amount: '1'
    };

    const result = await (agentService as { preprocessToolParameters: (toolName: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> }).preprocessToolParameters(
      toolName,
      originalParameters
    );

    expect(result).toEqual(originalParameters);
  });
});