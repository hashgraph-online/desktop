jest.mock('@hashgraphonline/conversational-agent', () => ({
  EntityFormat: {
    ACCOUNT_ID: 'ACCOUNT_ID',
    TOKEN_ID: 'TOKEN_ID',
    TOPIC_ID: 'TOPIC_ID',
    HRL: 'HRL',
    ALIAS: 'ALIAS',
    SYMBOL: 'SYMBOL'
  },
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

import { ParameterService } from '../../src/main/services/parameter-service';

describe('ParameterService', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: any;

  beforeEach(() => {
    mockFormatConverterRegistry = {
      convertEntity: jest.fn().mockResolvedValue('converted-value')
    };

    parameterService = new ParameterService(
      mockFormatConverterRegistry,
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
      resolveReferences: jest.fn().mockResolvedValue('resolved-value')
    };

    beforeEach(() => {
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
      const entities = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: 'ACCOUNT_ID' }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('test-account', entities);
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('test-amount', entities);
    });

    it('should process array parameters', async () => {
      const parameters = { accounts: ['account1', 'account2', 123] };
      const entities = [
        { entityId: '0.0.123', entityName: 'account1', entityType: 'ACCOUNT_ID' }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('account1', entities);
      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('account2', entities);
    });

    it('should handle AI phase failure gracefully', async () => {
      mockEntityResolver.resolveReferences.mockRejectedValue(new Error('AI failure'));
      
      const parameters = { key: 'value' };
      const entities = [
        { entityId: '0.0.123', entityName: 'test', entityType: 'ACCOUNT_ID' }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(result).toBeDefined();
    });

    it('should handle deterministic phase failure', async () => {
      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));
      
      const parameters = { key: 'value' };
      const entities = [
        { entityId: '0.0.123', entityName: 'test', entityType: 'ACCOUNT_ID' }
      ];

      const result = await parameterService.preprocessParameters(
        'test-tool',
        parameters,
        entities,
        { entityResolver: mockEntityResolver }
      );

      expect(result).toEqual(parameters);
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
      const entities = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: 'ACCOUNT_ID' }
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
      const entities = [
        { entityId: '0.0.123', entityName: 'account1', entityType: 'ACCOUNT_ID' },
        { entityId: '0.0.456', entityName: 'account2', entityType: 'ACCOUNT_ID' }
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
      const entities = [
        { entityId: '0.0.123', entityName: 'test', entityType: 'ACCOUNT_ID' }
      ];

      mockFormatConverterRegistry.convertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.preprocessToolParameters(
        'test-tool',
        parameters,
        entities
      );

      expect(result).toEqual(parameters);
    });
  });

  describe('convertParameterEntities', () => {
    beforeEach(() => {
      mockFormatConverterRegistry.convertEntity.mockResolvedValue('converted-value');
    });

    it('should return original value when no entities match', async () => {
      const parameterValue = 'no-match';
      const entities = [
        { entityId: '0.0.123', entityName: 'different', entityType: 'ACCOUNT_ID' }
      ];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        entities
      );

      expect(result).toBe(parameterValue);
    });

    it('should convert TOPIC_ID with HRL preference', async () => {
      const parameterValue = 'Topic: 0.0.123';
      const entities = [
        { entityId: '0.0.123', entityName: 'test-topic', entityType: 'TOPIC_ID' }
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
        'HRL',
        expect.objectContaining({
          networkType: 'testnet',
          toolPreferences: preferences
        })
      );
      expect(result).toBe('Topic: hrl://testnet/topic/123');
    });

    it('should handle conversion errors', async () => {
      const parameterValue = '0.0.123';
      const entities = [
        { entityId: '0.0.123', entityName: 'test', entityType: 'ACCOUNT_ID' }
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

    it('should handle entity name conversion', async () => {
      const parameterValue = 'Use test-account for transfer';
      const entities = [
        { entityId: '0.0.123', entityName: 'test-account', entityType: 'ACCOUNT_ID' }
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

    it('should not convert when no target format is determined', async () => {
      const parameterValue = '0.0.123';
      const entities = [
        { entityId: '0.0.123', entityName: 'test', entityType: 'ACCOUNT_ID' }
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