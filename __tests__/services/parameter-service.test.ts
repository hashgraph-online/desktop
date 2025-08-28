import { ParameterService } from '../../src/main/services/parameter-service';
import { NetworkType } from '@hashgraphonline/standards-sdk';

enum MockMockEntityFormat {
  ACCOUNT_ID = 'ACCOUNT_ID',
  TOKEN_ID = 'TOKEN_ID',
  TOPIC_ID = 'TOPIC_ID',
  HRL = 'HRL',
  ALIAS = 'ALIAS',
  SYMBOL = 'SYMBOL'
}

interface MockMockEntityAssociation {
  entityId: string;
  entityName: string;
  entityType: MockMockEntityFormat;
}

interface MockFormatConverterRegistry {
  convertEntity: jest.Mock;
}

jest.mock('@hashgraphonline/conversational-agent', () => ({
  MockEntityFormat: MockMockEntityFormat,
  FormatConverterRegistry: jest.fn()
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  NetworkType: {
    TESTNET: 'testnet',
    MAINNET: 'mainnet'
  }
}));

jest.mock('../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('ParameterService', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: MockFormatConverterRegistry;

  beforeEach(() => {
    mockFormatConverterRegistry = {
      convertEntity: jest.fn()
    };

    parameterService = new ParameterService(
      mockFormatConverterRegistry as any,
      'testnet' as any
    );
  });

  describe('constructor', () => {
    it('should create instance with provided dependencies', () => {
      expect(parameterService).toBeInstanceOf(ParameterService);
    });
  });

  describe('preprocessParameters', () => {
    const mockEntityResolver = {
      resolveReferences: jest.fn()
    };

    beforeEach(() => {
      mockEntityResolver.resolveReferences.mockResolvedValue('resolved-value');
      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-value');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return parameters as-is when no entity resolver provided', async () => {
      const parameters = { key1: 'value1', key2: 'value2' };
      const result = await parameterService.preprocessParameters('test-tool', parameters);
      
      expect(result).toEqual(parameters);
    });

    it('should return parameters as-is when no entities provided', async () => {
      const parameters = { key1: 'value1', key2: 'value2' };
      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        [],
        { entityResolver: mockEntityResolver }
      );
      
      expect(result).toEqual(parameters);
    });

    it('should process string parameters through entity resolver', async () => {
      const parameters = { accountId: 'test-account', amount: 'test-amount' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('test-account', entities);
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('test-amount', entities);
      expect(result).toEqual({
        accountId: 'converted-value',
        amount: 'converted-value'
      });
    });

    it('should process array parameters', async () => {
      const parameters = { accounts: ['account1', 'account2', 123] };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'account1', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('account1', entities);
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('account2', entities);
      expect(result).toEqual({
        accounts: ['converted-value', 'converted-value', 123]
      });
    });

    it('should handle AI phase failure gracefully', async () => {
      mockEntityResolver.resolveReferences.mockRejectedValue(new Error('AI failure'));
      
      const parameters = { key: 'value' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(result).toEqual({ key: 'converted-value' });
    });

    it('should handle deterministic phase failure', async () => {
      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));
      
      const parameters = { key: 'value' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(result).toEqual(parameters);
    });

    it('should include session ID and preferences in options', async () => {
      const parameters = { key: 'value' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'alias' };

      await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        {
          entityResolver: mockEntityResolver,
          sessionId: 'session-123',
          preferences
        }
      );

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalled();
    });
  });

  describe('attachToAgent', () => {
    it('should attach to agent with setParameterPreprocessingCallback', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });

    it('should attach to nested agent via getAgent', () => {
      const mockNestedAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };
      
      const mockAgent = {
        getAgent: jest.fn().mockReturnValue(mockNestedAgent)
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent.getAgent).toHaveBeenCalled();
      expect(mockNestedAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });

    it('should handle agent without callback method', () => {
      const mockAgent = {};

      expect(() => parameterService.attachToAgent(mockAgent)).not.toThrow();
    });

    it('should use provided dependencies', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };
      
      const deps = {
        getSessionId: jest.fn().mockReturnValue('session-123'),
        getEntities: jest.fn().mockResolvedValue([]),
        entityResolver: mockEntityResolver
      };

      parameterService.attachToAgent(mockAgent, deps);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });

    it('should handle getAgent returning null', () => {
      const mockAgent = {
        getAgent: jest.fn().mockReturnValue(null)
      };

      expect(() => parameterService.attachToAgent(mockAgent)).not.toThrow();
    });
  });

  describe('preprocessToolParameters', () => {
    it('should return original parameters when no entities provided', async () => {
      const parameters = { key1: 'value1', key2: 'value2' };
      const result = await parameterService.preprocessToolParameters('test-tool', parameters);
      
      expect(result).toEqual(parameters);
    });

    it('should return original parameters when empty entities array', async () => {
      const parameters = { key1: 'value1', key2: 'value2' };
      const result = await parameterService.preprocessToolParameters('test-tool', parameters, []);
      
      expect(result).toEqual(parameters);
    });

    it('should process string parameters with entity conversion', async () => {
      const parameters = { accountId: '0.0.123' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-account');

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result).toEqual({ accountId: 'converted-account' });
    });

    it('should process array parameters with entity conversion', async () => {
      const parameters = { accounts: ['0.0.123', '0.0.456', 789] };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'account1', entityType: MockEntityFormat.ACCOUNT_ID },
        { entityId: '0.0.456', entityName: 'account2', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      mockFormatConverterRegistry.convertEntity
        .mockResolvedValueOnce('converted-123')
        .mockResolvedValueOnce('converted-456');

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result).toEqual({
        accounts: ['converted-123', 'converted-456', 789]
      });
    });

    it('should handle conversion errors gracefully', async () => {
      const parameters = { accountId: '0.0.123' };
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result).toEqual(parameters);
    });

    it('should include session ID in logging', async () => {
      const parameters = { key: 'value' };
      const entities: MockEntityAssociation[] = [];

      await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities,
        'session-123'
      );

      expect(parameters).toEqual({ key: 'value' });
    });
  });

  describe('convertParameterEntities', () => {
    beforeEach(() => {
      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-value');
    });

    it('should return original value when no entities match', async () => {
      const parameterValue = 'no-match';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'different', entityType: MockEntityFormat.ACCOUNT_ID }
      ];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities
      );

      expect(result).toBe(parameterValue);
    });

    it('should convert TOPIC_ID with HRL preference', async () => {
      const parameterValue = 'Topic: 0.0.123';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test-topic', entityType: MockEntityFormat.TOPIC_ID }
      ];
      const preferences = { inscription: 'hrl' };

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('hrl://testnet/topic/123');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123',
        MockEntityFormat.HRL,
        expect.objectContaining({
          networkType: 'testnet',
          toolPreferences: preferences
        })
      );
      expect(result).toBe('Topic: hrl://testnet/topic/123');
    });

    it('should convert TOPIC_ID with topicId preference', async () => {
      const parameterValue = '0.0.123';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.TOPIC_ID }
      ];
      const preferences = { topic: 'topicId' };

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.123',
        MockEntityFormat.TOPIC_ID,
        expect.any(Object)
      );
    });

    it('should convert TOKEN_ID with tokenId preference', async () => {
      const parameterValue = '0.0.456';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.456', entityName: 'test-token', entityType: MockEntityFormat.TOKEN_ID }
      ];
      const preferences = { token: 'tokenId' };

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.456',
        MockEntityFormat.TOKEN_ID,
        expect.any(Object)
      );
    });

    it('should convert TOKEN_ID with symbol preference', async () => {
      const parameterValue = '0.0.456';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.456', entityName: 'test-token', entityType: MockEntityFormat.TOKEN_ID }
      ];
      const preferences = { token: 'symbol' };

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.456',
        MockEntityFormat.SYMBOL,
        expect.any(Object)
      );
    });

    it('should convert ACCOUNT_ID with accountId preference', async () => {
      const parameterValue = '0.0.789';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.789', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'accountId' };

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.789',
        MockEntityFormat.ACCOUNT_ID,
        expect.any(Object)
      );
    });

    it('should convert ACCOUNT_ID with alias preference', async () => {
      const parameterValue = '0.0.789';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.789', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'alias' };

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.789',
        MockEntityFormat.ALIAS,
        expect.any(Object)
      );
    });

    it('should handle supplyKey and adminKey preferences', async () => {
      const parameterValue = '0.0.789';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.789', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      
      const supplyKeyResult = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { supplyKey: 'accountId' }
      );

      const adminKeyResult = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        { adminKey: 'accountId' }
      );

      expect(mockFormatConverterRegistry.convertEntity).toHaveBeenCalledWith(
        '0.0.789',
        MockEntityFormat.ACCOUNT_ID,
        expect.any(Object)
      );
      expect(supplyKeyResult).toBe('converted-value');
      expect(adminKeyResult).toBe('converted-value');
    });

    it('should convert by entity name match', async () => {
      const parameterValue = 'Use test-account for transfer';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'accountId' };

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('0.0.123');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(result).toBe('Use 0.0.123 for transfer');
    });

    it('should handle special characters in entity names', async () => {
      const parameterValue = 'Use my-special.account@domain for this';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'my-special.account@domain', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'accountId' };

      mockFormatConverterRegistry.convertEntity.mockResolvedValue('0.0.123');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(result).toBe('Use 0.0.123 for this');
    });

    it('should handle format conversion failures', async () => {
      const parameterValue = '0.0.123';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'accountId' };

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(result).toBe(parameterValue);
    });

    it('should handle non-Error exceptions', async () => {
      const parameterValue = '0.0.123';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      const preferences = { account: 'accountId' };

      mockFormatConverterRegistry.convertEntity.mockRejectedValue('String error');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities,
        preferences
      );

      expect(result).toBe(parameterValue);
    });

    it('should not convert when no target format is determined', async () => {
      const parameterValue = '0.0.123';
      const entities: MockEntityAssociation[] = [
        { entityId: '0.0.123', entityName: 'test', entityType: MockEntityFormat.ACCOUNT_ID }
      ];
      
      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities
      );

      expect(mockFormatConverterRegistry.convertEntity).not.toHaveBeenCalled();
      expect(result).toBe(parameterValue);
    });
  });
});