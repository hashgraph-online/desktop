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
  });

  describe('preprocessToolParameters', () => {
    test('should return original parameters when no entities provided', async () => {
      const parameters = { name: 'test', value: '123' };
      const result = await parameterService.preprocessToolParameters('test-tool', parameters);

      expect(result).toEqual(parameters);
    });

    test('should convert entity references in parameters', async () => {
      const parameters = { topic: 'Use my-topic for inscription' };
      const entities: MockEntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: MockEntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('topic-123456-hrl');

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities as any,
        'session-123'
      );

      expect(result.topic).toBe('Use topic-123456-hrl for inscription');
    });
  });

  describe('convertParameterEntities', () => {
    test('should convert topic ID entities', async () => {
      const parameterValue = 'Use my-topic for inscription';
      const entities: MockEntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: MockEntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('topic-123456-hrl');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities as any,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use topic-123456-hrl for inscription');
      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123456',
        MockEntityFormat.HRL,
        expect.objectContaining({
          networkType: 'testnet',
          toolPreferences: { topic: 'hrl' }
        })
      );
    });

    test('should handle conversion errors', async () => {
      const parameterValue = 'Use my-topic for inscription';
      const entities: MockEntityAssociation[] = [
        {
          entityId: '0.0.123456',
          entityName: 'my-topic',
          entityType: MockEntityFormat.TOPIC_ID,
          transactionId: 'tx-123'
        }
      ];

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities as any,
        { topic: 'hrl' }
      );

      expect(result).toBe('Use my-topic for inscription'); // Original value preserved
    });
  });

  describe('attachToAgent', () => {
    test('should attach preprocessing callback to agent', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
      const callback = mockAgent.setParameterPreprocessingCallback.mock.calls[0][0];
      expect(typeof callback).toBe('function');
    });

    test('should handle agents without preprocessing callback', () => {
      const mockAgent = {
        someOtherMethod: jest.fn()
      };

      expect(() => {
        parameterService.attachToAgent(mockAgent);
      }).not.toThrow();
    });
  });
});

