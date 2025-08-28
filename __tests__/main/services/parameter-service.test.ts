import { ParameterService } from '../../../src/main/services/parameter-service';
import { NetworkType } from '@hashgraphonline/standards-sdk';

jest.mock('@hashgraphonline/conversational-agent', () => ({
  EntityFormat: {
    ACCOUNT_ID: 'accountId',
    TOKEN_ID: 'tokenId',
    TOPIC_ID: 'topicId',
    HRL: 'hrl',
    SYMBOL: 'symbol',
    ALIAS: 'alias'
  },
  FormatConverterRegistry: jest.fn()
}));

import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import { EntityFormat } from '@hashgraphonline/conversational-agent';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('ParameterService', () => {
  let parameterService: ParameterService;
  let mockFormatConverterRegistry: jest.Mocked<FormatConverterRegistry>;
  let mockConvertEntity: jest.Mock;

  const mockEntities: EntityAssociation[] = [
    {
      entityId: '0.0.123456',
      entityName: 'MyAccount',
      entityType: EntityFormat.ACCOUNT_ID,
      networkId: '1'
    },
    {
      entityId: '0.0.123457',
      entityName: 'MyToken',
      entityType: EntityFormat.TOKEN_ID,
      networkId: '1'
    },
    {
      entityId: '0.0.123458',
      entityName: 'MyTopic',
      entityType: EntityFormat.TOPIC_ID,
      networkId: '1'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    const { Logger } = require('../../../src/main/utils/logger');
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    mockConvertEntity = jest.fn();
    mockFormatConverterRegistry = {
      convertEntity: mockConvertEntity
    } as any;

    parameterService = new ParameterService(mockFormatConverterRegistry, NetworkType.TESTNET);
  });

  describe('Constructor', () => {
    test('should initialize with correct dependencies', () => {
      expect(parameterService).toBeInstanceOf(ParameterService);
    });
  });

  describe('preprocessParameters', () => {
    test('should process parameters without entities', async () => {
      const parameters = { account: '0.0.123456', amount: '100' };
      const result = await parameterService.preprocessParameters('test-tool', parameters);

      expect(result).toEqual(parameters);
    });

    test('should process parameters with entities and entity resolver', async () => {
      const parameters = { account: 'MyAccount', amount: '100' };
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockResolvedValue('0.0.123456')
      };

      mockConvertEntity.mockResolvedValue('0.0.123456');

      const result = await parameterService.preprocessParameters('test-tool', parameters, mockEntities, {
        entityResolver: mockEntityResolver,
        sessionId: 'test-session'
      });

      expect(mockEntityResolver.resolveReferences).toHaveBeenCalledWith('MyAccount', mockEntities);
      expect(result).toEqual({ account: '0.0.123456', amount: '100' });
    });

    test('should handle array parameters with entities', async () => {
      const parameters = { accounts: ['MyAccount', '0.0.123457'] };
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockImplementation((value) => Promise.resolve(value))
      };

      mockConvertEntity.mockImplementation((entityId) => Promise.resolve(entityId));

      const result = await parameterService.preprocessParameters('test-tool', parameters, mockEntities, {
        entityResolver: mockEntityResolver
      });

      expect(result).toEqual({ accounts: ['0.0.123456', '0.0.123457'] });
    });

    test('should handle entity resolver errors gracefully', async () => {
      const parameters = { account: 'MyAccount' };
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockRejectedValue(new Error('Resolver failed'))
      };

      mockConvertEntity.mockResolvedValue('0.0.123456');

      const result = await parameterService.preprocessParameters('test-tool', parameters, mockEntities, {
        entityResolver: mockEntityResolver
      });

      expect(result).toEqual({ account: '0.0.123456' });
    });

    test('should handle preferences in parameter processing', async () => {
      const parameters = { account: 'MyAccount' };
      const mockEntityResolver = {
        resolveReferences: jest.fn().mockResolvedValue('MyAccount')
      };

      mockConvertEntity.mockResolvedValue('0.0.123456');

      const result = await parameterService.preprocessParameters('test-tool', parameters, mockEntities, {
        entityResolver: mockEntityResolver,
        preferences: { account: 'accountId' }
      });

      expect(result).toEqual({ account: '0.0.123456' });
    });
  });

  describe('attachToAgent', () => {
    test('should attach parameter preprocessing callback to agent', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      const deps = {
        getSessionId: jest.fn().mockReturnValue('test-session'),
        getEntities: jest.fn().mockResolvedValue(mockEntities),
        entityResolver: {
          resolveReferences: jest.fn().mockResolvedValue('resolved')
        }
      };

      parameterService.attachToAgent(mockAgent, deps);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
      expect(deps.getSessionId).toHaveBeenCalled();
      expect(deps.getEntities).toHaveBeenCalledWith('test-session');
    });

    test('should handle agent with getAgent method', () => {
      const mockUnderlyingAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      const mockAgent = {
        getAgent: jest.fn().mockReturnValue(mockUnderlyingAgent)
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockUnderlyingAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });

    test('should handle agent without preprocessing callback', () => {
      const mockAgent = {};

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent).toEqual({});
    });

    test('should use default dependencies when not provided', () => {
      const mockAgent = {
        setParameterPreprocessingCallback: jest.fn()
      };

      parameterService.attachToAgent(mockAgent);

      expect(mockAgent.setParameterPreprocessingCallback).toHaveBeenCalled();
    });
  });

  describe('preprocessToolParameters', () => {
    test('should skip processing when no entities provided', async () => {
      const parameters = { account: '0.0.123456' };

      const result = await parameterService.preprocessToolParameters('test-tool', parameters);

      expect(result).toEqual(parameters);
    });

    test('should process string parameters with entities', async () => {
      const parameters = { account: '0.0.123456' };

      mockConvertEntity.mockResolvedValue('converted-account');

      const result = await parameterService.preprocessToolParameters('test-tool', parameters, mockEntities);

      expect(result).toEqual({ account: 'converted-account' });
    });

    test('should process array parameters with entities', async () => {
      const parameters = { accounts: ['0.0.123456', '0.0.123457'] };

      mockConvertEntity.mockImplementation((entityId) => Promise.resolve(`converted-${entityId}`));

      const result = await parameterService.preprocessToolParameters('test-tool', parameters, mockEntities);

      expect(result).toEqual({
        accounts: ['converted-0.0.123456', 'converted-0.0.123457']
      });
    });

    test('should handle conversion errors gracefully', async () => {
      const parameters = { account: '0.0.123456' };

      mockConvertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.preprocessToolParameters('test-tool', parameters, mockEntities);

      expect(result).toEqual(parameters);
    });

    test('should handle mixed parameter types', async () => {
      const parameters = {
        account: '0.0.123456',
        amount: 100,
        metadata: { key: 'value' },
        accounts: ['0.0.123456', '0.0.123457']
      };

      mockConvertEntity.mockImplementation((entityId) => Promise.resolve(`converted-${entityId}`));

      const result = await parameterService.preprocessToolParameters('test-tool', parameters, mockEntities);

      expect(result).toEqual({
        account: 'converted-0.0.123456',
        amount: 100,
        metadata: { key: 'value' },
        accounts: ['converted-0.0.123456', 'converted-0.0.123457']
      });
    });
  });

  describe('convertParameterEntities', () => {
    test('should convert account entities to accountId format', async () => {
      const parameterValue = 'Use MyAccount for this operation';
      const accountEntity = mockEntities[0];

      mockConvertEntity.mockResolvedValue('0.0.123456');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [accountEntity],
        { account: 'accountId' }
      );

      expect(result).toBe('Use 0.0.123456 for this operation');
      expect(mockConvertEntity).toHaveBeenCalledWith('0.0.123456', EntityFormat.ACCOUNT_ID, {
        networkType: NetworkType.TESTNET,
        sessionId: 'unknown',
        toolPreferences: { account: 'accountId' }
      });
    });

    test('should convert token entities to symbol format', async () => {
      const parameterValue = 'Transfer MyToken';
      const tokenEntity = mockEntities[1];

      mockConvertEntity.mockResolvedValue('MYTOKEN');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [tokenEntity],
        { token: 'symbol' }
      );

      expect(result).toBe('Transfer MYTOKEN');
    });

    test('should convert topic entities to HRL format', async () => {
      const parameterValue = 'Send to MyTopic';
      const topicEntity = mockEntities[2];

      mockConvertEntity.mockResolvedValue('hrl://topic/0.0.123458');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [topicEntity],
        { topic: 'hrl' }
      );

      expect(result).toBe('Send to hrl://topic/0.0.123458');
    });

    test('should handle entity name references', async () => {
      const parameterValue = 'Process MyAccount';
      const accountEntity = mockEntities[0];

      mockConvertEntity.mockResolvedValue('0.0.123456');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [accountEntity],
        { account: 'accountId' }
      );

      expect(result).toBe('Process 0.0.123456');
    });

    test('should skip entities not found in parameter value', async () => {
      const parameterValue = 'Use 0.0.999999';
      const accountEntity = mockEntities[0];

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [accountEntity]
      );

      expect(result).toBe('Use 0.0.999999');
      expect(mockConvertEntity).not.toHaveBeenCalled();
    });

    test('should handle conversion errors gracefully', async () => {
      const parameterValue = 'Use MyAccount';
      const accountEntity = mockEntities[0];

      mockConvertEntity.mockRejectedValue(new Error('Conversion failed'));

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [accountEntity],
        { account: 'accountId' }
      );

      expect(result).toBe('Use MyAccount');
    });

    test('should handle multiple entity types in one parameter', async () => {
      const parameterValue = 'Transfer MyToken from MyAccount to MyTopic';

      mockConvertEntity.mockImplementation((entityId) => {
        if (entityId === '0.0.123457') return Promise.resolve('MYTOKEN');
        if (entityId === '0.0.123456') return Promise.resolve('0.0.123456');
        if (entityId === '0.0.123458') return Promise.resolve('hrl://topic/0.0.123458');
        return Promise.resolve(entityId);
      });

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        mockEntities,
        {
          token: 'symbol',
          account: 'accountId',
          topic: 'hrl'
        }
      );

      expect(result).toBe('Transfer MYTOKEN from 0.0.123456 to hrl://topic/0.0.123458');
    });

    test('should handle regex special characters in entity names', async () => {
      const specialEntity: EntityAssociation = {
        entityId: '0.0.123459',
        entityName: 'Special.Token+Name',
        entityType: EntityFormat.ACCOUNT_ID,
        networkId: '1'
      };

      const parameterValue = 'Use Special.Token+Name here';

      mockConvertEntity.mockResolvedValue('0.0.123459');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [specialEntity],
        { account: 'accountId' }
      );

      expect(result).toBe('Use 0.0.123459 here');
    });

    test('should prefer entity ID over entity name when both match', async () => {
      const parameterValue = 'Process MyAccount which is 0.0.123456';

      mockConvertEntity.mockResolvedValue('converted-account');

      const result = await parameterService.convertParameterEntities(
        parameterValue,
        [mockEntities[0]],
        { account: 'accountId' }
      );

      expect(result).toBe('Process converted-account which is converted-account');
    });
  });
});
