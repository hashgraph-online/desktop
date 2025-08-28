import { ParameterService } from '../../../src/main/services/parameter-service';

enum MockEntityFormat {
  ACCOUNT_ID = 'ACCOUNT_ID',
  TOKEN_ID = 'TOKEN_ID',
  TOPIC_ID = 'TOPIC_ID',
  HRL = 'HRL',
  ALIAS = 'ALIAS',
  SYMBOL = 'SYMBOL'
}

interface MockEntityAssociation {
  entityId: string;
  entityName: string;
  entityType: MockEntityFormat;
  transactionId: string;
}

jest.mock('@hashgraphonline/conversational-agent', () => ({
  EntityFormat: MockEntityFormat,
  FormatConverterRegistry: jest.fn()
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  NetworkType: {
    TESTNET: 'testnet',
    MAINNET: 'mainnet'
  },
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('ParameterService - Core Functionality', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFormatConverterRegistry = {
      convertEntity: jest.fn(),
      register: jest.fn(),
      getRegisteredConverters: jest.fn().mockReturnValue(['converter1'])
    };

    const { FormatConverterRegistry } = require('@hashgraphonline/conversational-agent');
    const { NetworkType } = require('@hashgraphonline/standards-sdk');

    (FormatConverterRegistry as jest.MockedFunction<any>).mockImplementation(
      () => mockFormatConverterRegistry
    );

    parameterService = new ParameterService(mockFormatConverterRegistry, NetworkType.TESTNET);
  });

  describe('Constructor', () => {
    test('should create ParameterService with required dependencies', () => {
      expect(parameterService).toBeDefined();
    });
  });

  describe('preprocessParameters', () => {
    test('should return original parameters when no entities provided', async () => {
      const parameters = { name: 'test', value: '123' };
      const result = await parameterService.preprocessParameters('test-tool', parameters);

      expect(result).toEqual(parameters);
    });

    test('should process parameters with AI entity resolver', async () => {
      const parameters = { topic: 'my-topic', account: 'my-account' };
      const entities: MockEntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: MockEntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        },
        {
          entityId: '0.0.789012',
          entityName: 'my-account',
          entityType: MockEntityFormat.ACCOUNT_ID,
          transactionId: 'tx-456'
        }
      ];

      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation(async (message: string) => {
          if (message === 'my-topic') return '0.0.123456';
          if (message === 'my-account') return '0.0.789012';
          return message;
        })
      };

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities as any,
        {
          entityResolver: mockEntityResolver,
          preferences: { topic: 'hrl', account: 'hrl' }
        }
      );

      expect(result.topic).toBe('topic-123456-hrl');
      expect(result.account).toBe('account-789012-hrl');
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledTimes(2);
    });

    test('should handle AI resolver errors gracefully', async () => {
      const parameters = { topic: 'my-topic' };
      const entities: MockEntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: MockEntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      const mockEntityResolver = {
        resolveReferences: jest.fn().mockRejectedValue(new Error('AI resolution failed'))
      };

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-topic');

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities as any,
        {
          entityResolver: mockEntityResolver,
          preferences: { topic: 'hrl' }
        }
      );

      expect(result.topic).toBe('converted-topic');
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('my-topic', entities);
    });

    test('should process array parameters with entity resolver', async () => {
      const parameters = {
        topics: ['topic1', 'topic2'],
        accounts: ['account1', 'account2']
      };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.111111',
          entityName: 'topic1',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-1'
        },
        {
          entityId: '0.0.222222',
          entityName: 'account1',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-2'
        }
      ];

      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation(async (message: string) => {
          if (message === 'topic1') return '0.0.111111';
          if (message === 'account1') return '0.0.222222';
          return message;
        })
      };

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic1-hrl')
        .mockResolvedValueOnce('account1-hrl');

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        {
          entityResolver: mockEntityResolver,
          preferences: { topic: 'hrl', account: 'hrl' }
        }
      );

      expect(result.topics).toEqual(['topic1-hrl', 'topic2']);
      expect(result.accounts).toEqual(['account1-hrl', 'account2']);
    });

    test('should handle mixed parameter types', async () => {
      const parameters = {
        topic: 'my-topic',
        number: 123,
        boolean: true,
        array: ['item1', 'item2'],
        object: { nested: 'value' }
      };

      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-topic');

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        {
          preferences: { topic: 'hrl' }
        }
      );

      expect(result.topic).toBe('converted-topic');
      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
      expect(result.array).toEqual(['item1', 'item2']);
      expect(result.object).toEqual({ nested: 'value' });
    });
  });

  describe('preprocessToolParameters', () => {
    test('should return original parameters when no entities provided', async () => {
      const parameters = { name: 'test', value: '123' };
      const result = await parameterService.preprocessToolParameters('test-tool', parameters);

      expect(result).toEqual(parameters);
    });

    test('should convert entity references in string parameters', async () => {
      const parameters = {
        topic: 'Use my-topic for inscription',
        account: 'Transfer to my-account'
      };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        },
        {
          entityId: '0.0.789012',
          entityName: 'my-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-456'
        }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities,
        'session-123'
      );

      expect(result.topic).toBe('Use topic-123456-hrl for inscription');
      expect(result.account).toBe('Transfer to account-789012-hrl');
    });

    test('should convert entity references in array parameters', async () => {
      const parameters = {
        topics: ['my-topic', 'other-topic'],
        accounts: ['my-account', 'other-account']
      };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        },
        {
          entityId: '0.0.789012',
          entityName: 'my-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-456'
        }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockResolvedValueOnce('account-789012-hrl');

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result.topics).toEqual(['topic-123456-hrl', 'other-topic']);
      expect(result.accounts).toEqual(['account-789012-hrl', 'other-account']);
    });

    test('should handle conversion errors gracefully', async () => {
      const parameters = { topic: 'my-topic' };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result.topic).toBe('my-topic'); // Original value preserved on error
    });

    test('should return original parameters when conversion results in same value', async () => {
      const parameters = { topic: 'my-topic' };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('my-topic'); // Same value

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result.topic).toBe('my-topic');
    });
  });

  describe('convertParameterEntities', () => {
    test('should convert topic ID entities based on preferences', async () => {
      const parameterValue = 'Use my-topic for inscription';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('topic-123456-hrl');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use topic-123456-hrl for inscription');
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123456',
        EntityFormat.HRL,
        {
          networkType: NetworkType.TESTNET,
          sessionId: 'unknown',
          toolPreferences: { topic: 'hrl' }
        }
      );
    });

    test('should convert token ID entities based on preferences', async () => {
      const parameterValue = 'Transfer my-token';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-token',
          entityType: EntityFormat.TOKEN_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('TOKEN_SYMBOL');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { token: 'symbol' }
      );

      expect(result).toBe('Transfer TOKEN_SYMBOL');
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123456',
        EntityFormat.SYMBOL,
        {
          networkType: NetworkType.TESTNET,
          sessionId: 'unknown',
          toolPreferences: { token: 'symbol' }
        }
      );
    });

    test('should convert account ID entities based on preferences', async () => {
      const parameterValue = 'Send to my-account';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('account-alias');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { account: 'alias' }
      );

      expect(result).toBe('Send to account-alias');
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123456',
        EntityFormat.ALIAS,
        {
          networkType: NetworkType.TESTNET,
          sessionId: 'unknown',
          toolPreferences: { account: 'alias' }
        }
      );
    });

    test('should handle multiple entity types in same parameter', async () => {
      const parameterValue = 'Transfer my-token from my-account to other-account';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.111111',
          entityName: 'my-token',
          entityType: EntityFormat.TOKEN_ID,
          transactionId: 'tx-1'
        },
        {
          entityId: '0.0.222222',
          entityName: 'my-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-2'
        },
        {
          entityId: '0.0.333333',
          entityName: 'other-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-3'
        }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('TOKEN_SYMBOL')
        .mockResolvedValueOnce('account-222222-alias')
        .mockResolvedValueOnce('account-333333-alias');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        {
          token: 'symbol',
          account: 'alias',
          supplyKey: 'accountId',
          adminKey: 'accountId'
        }
      );

      expect(result).toBe('Transfer TOKEN_SYMBOL from account-222222-alias to account-333333-alias');
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledTimes(3);
    });

    test('should handle entity ID replacement with regex escaping', async () => {
      const parameterValue = 'Use 0.0.123.456 for topic';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123.456',
          entityName: 'special-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('special-topic-hrl');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use special-topic-hrl for topic');
    });

    test('should handle entity name replacement with special characters', async () => {
      const parameterValue = 'Use Topic #123 (Special) for inscription';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'Topic #123 (Special)',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('topic-123456-hrl');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use topic-123456-hrl for inscription');
    });

    test('should skip entities that are not found in parameter value', async () => {
      const parameterValue = 'Use some-topic for inscription';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'different-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use some-topic for inscription');
      expect(mockFormatConverterRegistry.convertEntity).not.toHaveBeenCalled();
    });

    test('should handle conversion errors for individual entities', async () => {
      const parameterValue = 'Use my-topic and my-token';
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        },
        {
          entityId: '0.0.789012',
          entityName: 'my-token',
          entityType: EntityFormat.TOKEN_ID,
          transactionId: 'tx-456'
        }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-123456-hrl')
        .mockRejectedValueOnce(new Error('Token conversion failed'));

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { topic: 'hrl', token: 'symbol' }
      );

      expect(result).toBe('Use topic-123456-hrl and my-token');
    });

    test('should return original value when no conversions apply', async () => {
      const parameterValue = 'Simple text without entities';
      const entities: EntityAssociation[] = [];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities
      );

      expect(result).toBe('Simple text without entities');
    });

    test('should handle empty entities array', async () => {
      const parameterValue = 'Some parameter value';
      const entities: EntityAssociation[] = [];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities
      );

      expect(result).toBe('Some parameter value');
    });
  });

  describe('attachToAgent', () => {
    test('should attach preprocessing callback to agent with setParameterPreprocessingCallback', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      const deps = {
        getSessionId: jest.fn().mockReturnValue('session-123'),
        getEntities: jest.fn().mockResolvedValue([]),
        entityResolver: {
          resolveReferences: jest.fn().mockResolvedValue('resolved')
        }
      };

      parameterService.attachToAgent(mockAgent, deps);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
      const callback = mockAgent.setParameterPreprocessingCallback.mock.calls[0][0];
      expect(typeof callback).toBe('function');
    });

    test('should attach to underlying agent when getAgent method exists', () => {
      const mockUnderlyingAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      const mockAgent = {
        getAgent: jest.fn().mockReturnValue(mockUnderlyingAgent)
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockUnderlyingAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });

    test('should handle agents without preprocessing callback', () => {
      const mockAgent = {
        someOtherMethod: jest.fn()
      };

      expect(() => {
        parameterService.attachToAgent(mockAgent);
      }).not.toThrow();
    });

    test('should handle undefined dependencies', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
      const callback = mockAgent.setParameterPreprocessingCallback.mock.calls[0][0];
      expect(typeof callback).toBe('function');
    });

    test('should call preprocessing with correct parameters', async () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'test-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      const deps = {
        getSessionId: jest.fn().mockReturnValue('session-123'),
        getEntities: jest.fn().mockResolvedValue(entities),
        entityResolver: {
          resolveReferences: jest.fn().mockResolvedValue('resolved-topic')
        }
      };

      parameterService.attachToAgent(mockAgent, deps);

      const callback = mockAgent.setParameterPreprocessingCallback.mock.calls[0][0];
      const result = await callback('test-tool', { topic: 'test-topic' });

      expect(deps.getSessionId).toHaveBeenCalled();
      expect(deps.getEntities).toHaveBeenCalledWith('session-123');
      expect(deps.entityResolver.resolveReferences).toHaveBeenCalledWith('test-topic', entities);
      expect(result).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete workflow from AI resolution to format conversion', async () => {
      const parameters = {
        message: 'Create inscription on my-topic using my-token',
        amount: '100',
        recipient: 'my-account'
      };

      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.111111',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-1'
        },
        {
          entityId: '0.0.222222',
          entityName: 'my-token',
          entityType: EntityFormat.TOKEN_ID,
          transactionId: 'tx-2'
        },
        {
          entityId: '0.0.333333',
          entityName: 'my-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-3'
        }
      ];

      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation(async (message: string) => {
          const matches = {
            'my-topic': '0.0.111111',
            'my-token': '0.0.222222',
            'my-account': '0.0.333333'
          };
          return matches[message as keyof typeof matches] || message;
        })
      };

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('topic-111111-hrl')
        .mockResolvedValueOnce('TOKEN_SYMBOL')
        .mockResolvedValueOnce('account-333333-alias');

      const result = await parameterService.preprocessParameters(
        'inscription-tool',
        parameters,
        entities,
        {
          entityResolver: mockEntityResolver,
          preferences: {
            topic: 'hrl',
            token: 'symbol',
            account: 'alias'
          },
          sessionId: 'session-123'
        }
      );

      expect(result.message).toBe('Create inscription on topic-111111-hrl using TOKEN_SYMBOL');
      expect(result.amount).toBe('100');
      expect(result.recipient).toBe('account-333333-alias');
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledTimes(3);
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledTimes(3);
    });

    test('should handle mixed successful and failed conversions', async () => {
      const parameters = {
        description: 'Transfer token from account to account',
        tokenId: 'my-token',
        fromAccount: 'sender-account',
        toAccount: 'receiver-account'
      };

      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.111111',
          entityName: 'my-token',
          entityType: EntityFormat.TOKEN_ID,
          transactionId: 'tx-1'
        },
        {
          entityId: '0.0.222222',
          entityName: 'sender-account',
          entityType: EntityFormat.ACCOUNT_ID,
          transactionId: 'tx-2'
        }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('TOKEN_SYMBOL')
        .mockResolvedValueOnce('sender-account-id');

      const result = await parameterService.preprocessToolParameters(
        'transfer-tool',
        parameters,
        entities,
        'session-123'
      );

      expect(result.description).toBe('Transfer TOKEN_SYMBOL from sender-account-id to receiver-account');
      expect(result.tokenId).toBe('TOKEN_SYMBOL');
      expect(result.fromAccount).toBe('sender-account-id');
      expect(result.toAccount).toBe('receiver-account'); // Not converted due to missing entity
    });

    test('should handle large parameter sets efficiently', async () => {
      const parameters: Record<string, string> = {};
      const entities: EntityAssociation[] = [];

      for (let i = 0; i < 50; i++) {
        parameters[`param${i}`] = `value${i}`;
        entities.push({
          entityId: `0.0.${100000 + i}`,
          entityName: `entity${i}`,
          entityType: EntityFormat.TOPIC_ID,
          transactionId: `tx-${i}`
        });
      }

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-value');

      const startTime = Date.now();
      const result = await parameterService.preprocessToolParameters(
        'bulk-tool',
        parameters,
        entities
      );
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling', () => {
    test('should handle format converter registry errors', async () => {
      const parameters = { topic: 'my-topic' };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Registry error'));

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result.topic).toBe('my-topic'); // Original value preserved
    });

    test('should handle malformed entities gracefully', async () => {
      const parameters = { topic: 'some-topic' };
      const entities: EntityAssociation[] = [
        {
          entityId: '', // Empty entity ID
          entityName: 'malformed-entity',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      const result = await parameterService.convertParameterEntities(
        parameters.topic,
        entities
      );

      expect(result).toBe('some-topic');
    });

    test('should handle undefined preferences', async () => {
      const parameters = { topic: 'my-topic' };
      const entities: EntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: EntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      const result = await parameterService.convertParameterEntities(
        parameters.topic,
        entities,
        undefined // No preferences
      );

      expect(result).toBe('my-topic'); // No conversion applied without preferences
    });
  });
});
