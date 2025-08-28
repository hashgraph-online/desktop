import { MemoryService } from '../../../src/main/services/memory-service';
import { NetworkType } from '@hashgraphonline/standards-sdk';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';

jest.mock('@hashgraphonline/conversational-agent', () => ({
  EntityFormat: {
    ACCOUNT_ID: 'accountId',
    TOKEN_ID: 'tokenId',
    TOPIC_ID: 'topicId',
    CONTRACT_ID: 'contractId',
    HRL: 'hrl'
  }
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/entity-service', () => ({
  EntityService: jest.fn().mockImplementation(() => ({
    storeEntity: jest.fn().mockResolvedValue(undefined),
    getEntitiesBySession: jest.fn().mockResolvedValue({
      success: true,
      data: []
    }),
    loadAllActiveEntities: jest.fn().mockResolvedValue({
      success: true,
      data: []
    })
  }))
}));

jest.mock('../../../src/main/services/safe-conversational-agent', () => ({
  SafeConversationalAgent: jest.fn().mockImplementation(() => ({
    memoryManager: {
      storeEntityAssociation: jest.fn(),
      getEntityAssociations: jest.fn().mockReturnValue([]),
      clear: jest.fn()
    },
    inscribePlugin: {
      getTools: jest.fn().mockReturnValue([
        {
          setEntityCreationHandler: jest.fn(),
          name: 'TestTool'
        }
      ])
    }
  }))
}));

import { SafeConversationalAgent } from '../../../src/main/services/safe-conversational-agent';
import { EntityService } from '../../../src/main/services/entity-service';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockEntityService: any;
  let mockAgent: any;
  let mockLogger: any;

  const mockEntityAssociation: EntityAssociation = {
    entityId: '0.0.123456',
    entityName: 'TestAccount',
    entityType: 'accountId',
    transactionId: 'test-tx-id',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    networkId: '1'
  };

  const mockEntityAssociations: EntityAssociation[] = [
    mockEntityAssociation,
    {
      entityId: '0.0.234567',
      entityName: 'TestToken',
      entityType: 'tokenId',
      transactionId: 'test-tx-2',
      createdAt: new Date('2024-01-01T10:30:00Z'),
      networkId: '1'
    },
    {
      entityId: '0.0.345678',
      entityName: 'TestTopic',
      entityType: 'topicId',
      createdAt: new Date('2024-01-01T09:00:00Z'),
      networkId: '1'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    const entityService = new EntityService();
    memoryService = new MemoryService(entityService, NetworkType.TESTNET);

    mockEntityService = entityService;
    mockAgent = new SafeConversationalAgent();

    memoryService.setAgent(mockAgent);

    const { Logger } = require('../../../src/main/utils/logger');
    mockLogger = Logger();
  });

  describe('Service Initialization', () => {
    test('should create MemoryService instance', () => {
      const entityService = new EntityService();
      const service = new MemoryService(entityService, NetworkType.TESTNET);

      expect(service).toBeInstanceOf(MemoryService);
    });

    test('should set agent', () => {
      const newAgent = new SafeConversationalAgent();
      memoryService.setAgent(newAgent);

      expect(memoryService).toBeDefined();
    });

    test('should set session ID provider', () => {
      const provider = () => 'test-session-123';
      memoryService.setSessionIdProvider(provider);

      expect(memoryService).toBeDefined();
    });
  });

  describe('Entity Association Storage', () => {
    test('should store valid Hedera entity association', async () => {
      const entityId = '0.0.123456';
      const entityName = 'TestAccount';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBe('accountId');
      expect(mockAgent.memoryManager.storeEntityAssociation).toHaveBeenCalledWith(
        entityId,
        entityName,
        'accountId',
        undefined
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Stored entity association:', {
        entityName,
        entityType: 'accountId',
        entityId,
        transactionId: undefined
      });
    });

    test('should store entity association with transaction ID', async () => {
      const entityId = '0.0.123456';
      const entityName = 'TestAccount';
      const transactionId = 'test-tx-123';

      const result = await memoryService.storeEntityAssociation(entityId, entityName, transactionId);

      expect(result).toBe('accountId');
      expect(mockAgent.memoryManager.storeEntityAssociation).toHaveBeenCalledWith(
        entityId,
        entityName,
        'accountId',
        transactionId
      );
    });

    test('should store token ID entity', async () => {
      const entityId = '0.0.123456';
      const entityName = 'TestToken';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBe('accountId'); // Will be detected as accountId format
      expect(mockAgent.memoryManager.storeEntityAssociation).toHaveBeenCalled();
    });

    test('should store topic ID entity', async () => {
      const entityId = '0.0.123456';
      const entityName = 'TestTopic';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBe('accountId');
      expect(mockAgent.memoryManager.storeEntityAssociation).toHaveBeenCalled();
    });

    test('should skip non-Hedera entity associations', async () => {
      const entityId = 'not-a-hedera-id';
      const entityName = 'TestEntity';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBeUndefined();
      expect(mockAgent.memoryManager.storeEntityAssociation).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping non-ID entity association for strict types',
        expect.objectContaining({
          entityName,
          entityId,
          reason: 'entityId is not a Hedera entity ID'
        })
      );
    });

    test('should handle agent not set', async () => {
      const newService = new MemoryService(mockEntityService, NetworkType.TESTNET);
      const entityId = '0.0.123456';
      const entityName = 'TestAccount';

      const result = await newService.storeEntityAssociation(entityId, entityName);

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot store entity association: Agent not set');
    });

    test('should handle memory manager not available', async () => {
      mockAgent.memoryManager = null;

      const entityId = '0.0.123456';
      const entityName = 'TestAccount';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBe('accountId');
      expect(mockLogger.warn).toHaveBeenCalledWith('Memory manager not available for entity storage');
    });

    test('should handle entity format detection errors', async () => {
      const formatConverterRegistry = {
        detectEntityFormat: jest.fn().mockRejectedValue(new Error('Detection failed'))
      };

      (memoryService as any).formatConverterRegistry = formatConverterRegistry;

      const entityId = '0.0.123456';
      const entityName = 'TestAccount';

      const result = await memoryService.storeEntityAssociation(entityId, entityName);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to store entity association:', expect.any(Error));
    });
  });

  describe('Entity Retrieval', () => {
    test('should get all stored entities', () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = memoryService.getStoredEntities();

      expect(result).toEqual(mockEntityAssociations);
      expect(mockAgent.memoryManager.getEntityAssociations).toHaveBeenCalledWith(undefined);
    });

    test('should get stored entities by type', () => {
      const accountEntities = mockEntityAssociations.filter(e => e.entityType === 'accountId');
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(accountEntities);

      const result = memoryService.getStoredEntities('accountId');

      expect(result).toEqual(accountEntities);
      expect(mockAgent.memoryManager.getEntityAssociations).toHaveBeenCalledWith('accountId');
    });

    test('should handle agent not set for entity retrieval', () => {
      const newService = new MemoryService(mockEntityService, NetworkType.TESTNET);

      const result = newService.getStoredEntities();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot get stored entities: Agent not set');
    });

    test('should handle memory manager not available for retrieval', () => {
      mockAgent.memoryManager = null;

      const result = memoryService.getStoredEntities();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to get stored entities:', expect.any(Error));
    });

    test('should handle memory manager errors gracefully', () => {
      mockAgent.memoryManager.getEntityAssociations.mockImplementation(() => {
        throw new Error('Memory manager error');
      });

      const result = memoryService.getStoredEntities();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to get stored entities:', expect.any(Error));
    });
  });

  describe('Entity Search', () => {
    test('should find entity by name', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = await memoryService.findEntityByName('TestAccount');

      expect(result).toEqual(mockEntityAssociations[0]);
    });

    test('should find entity by partial name match', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = await memoryService.findEntityByName('Test');

      expect(result).toEqual(mockEntityAssociations[1]); // Most recent TestToken
    });

    test('should find entity by name with type filter', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = await memoryService.findEntityByName('Test', 'tokenId');

      expect(result).toEqual(mockEntityAssociations[1]); // TestToken with tokenId type
    });

    test('should return null when entity not found', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = await memoryService.findEntityByName('NonExistent');

      expect(result).toBeNull();
    });

    test('should handle search errors gracefully', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockImplementation(() => {
        throw new Error('Search error');
      });

      const result = await memoryService.findEntityByName('Test');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to find entity by name:', expect.any(Error));
    });
  });

  describe('Most Recent Entity', () => {
    test('should get most recent entity of specific type', () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = memoryService.getMostRecentEntity('accountId');

      expect(result).toEqual(mockEntityAssociations[0]); // Most recent accountId entity
    });

    test('should return null when no entities of type exist', () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue([]);

      const result = memoryService.getMostRecentEntity('contractId');

      expect(result).toBeNull();
    });

    test('should handle errors gracefully', () => {
      mockAgent.memoryManager.getEntityAssociations.mockImplementation(() => {
        throw new Error('Get entities error');
      });

      const result = memoryService.getMostRecentEntity('accountId');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to get most recent entity:', expect.any(Error));
    });
  });

  describe('Entity Existence Check', () => {
    test('should return true when entity exists', () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = memoryService.entityExists('0.0.123456');

      expect(result).toBe(true);
    });

    test('should return false when entity does not exist', () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue(mockEntityAssociations);

      const result = memoryService.entityExists('0.0.999999');

      expect(result).toBe(false);
    });

    test('should handle errors gracefully', () => {
      mockAgent.memoryManager.getEntityAssociations.mockImplementation(() => {
        throw new Error('Entity check error');
      });

      const result = memoryService.entityExists('0.0.123456');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to check entity existence:', expect.any(Error));
    });
  });

  describe('Entity Handler Setup', () => {
    test('should setup entity handlers successfully', () => {
      const conversationalAgent = new SafeConversationalAgent();

      memoryService.setupEntityHandlers(conversationalAgent);

      expect(conversationalAgent.inscribePlugin.getTools).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity handlers setup complete for 1 inscription tools'
      );
    });

    test('should handle tools without entity creation handler', () => {
      const conversationalAgent = new SafeConversationalAgent();
      conversationalAgent.inscribePlugin.getTools.mockReturnValue([
        {
          name: 'ToolWithoutHandler'
        }
      ]);

      memoryService.setupEntityHandlers(conversationalAgent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity handlers setup complete for 1 inscription tools'
      );
    });

    test('should handle empty tools array', () => {
      const conversationalAgent = new SafeConversationalAgent();
      conversationalAgent.inscribePlugin.getTools.mockReturnValue([]);

      memoryService.setupEntityHandlers(conversationalAgent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity handlers setup complete for 0 inscription tools'
      );
    });

    test('should handle setup errors gracefully', () => {
      const conversationalAgent = new SafeConversationalAgent();
      conversationalAgent.inscribePlugin.getTools.mockImplementation(() => {
        throw new Error('Tools retrieval failed');
      });

      expect(() => memoryService.setupEntityHandlers(conversationalAgent)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to setup entity handlers:', expect.any(Error));
    });
  });

  describe('Stored Entity Loading', () => {
    test('should load stored entities successfully', async () => {
      const conversationalAgent = new SafeConversationalAgent();
      const storedEntities = mockEntityAssociations;

      mockEntityService.loadAllActiveEntities.mockResolvedValue({
        success: true,
        data: storedEntities
      });

      await memoryService.loadStoredEntities(conversationalAgent);

      expect(mockEntityService.loadAllActiveEntities).toHaveBeenCalled();
      expect(conversationalAgent.memoryManager.storeEntityAssociation).toHaveBeenCalledTimes(storedEntities.length);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Loaded ${storedEntities.length} stored entities into memory`
      );
    });

    test('should load entities for specific session', async () => {
      const conversationalAgent = new SafeConversationalAgent();
      const sessionId = 'test-session-123';
      const sessionEntities = mockEntityAssociations.slice(0, 2);

      mockEntityService.getEntitiesBySession.mockResolvedValue({
        success: true,
        data: sessionEntities
      });

      await memoryService.loadStoredEntities(conversationalAgent, sessionId);

      expect(mockEntityService.getEntitiesBySession).toHaveBeenCalledWith(sessionId);
      expect(conversationalAgent.memoryManager.storeEntityAssociation).toHaveBeenCalledTimes(sessionEntities.length);
    });

    test('should handle no stored entities', async () => {
      const conversationalAgent = new SafeConversationalAgent();

      mockEntityService.loadAllActiveEntities.mockResolvedValue({
        success: true,
        data: []
      });

      await memoryService.loadStoredEntities(conversationalAgent);

      expect(mockEntityService.loadAllActiveEntities).toHaveBeenCalled();
      expect(conversationalAgent.memoryManager.storeEntityAssociation).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No stored entities found or failed to load for session'
      );
    });

    test('should handle entity service failure', async () => {
      const conversationalAgent = new SafeConversationalAgent();

      mockEntityService.loadAllActiveEntities.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      await memoryService.loadStoredEntities(conversationalAgent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No stored entities found or failed to load for session'
      );
    });

    test('should handle agent without memory manager', async () => {
      const conversationalAgent = new SafeConversationalAgent();
      conversationalAgent.memoryManager = null;

      mockEntityService.loadAllActiveEntities.mockResolvedValue({
        success: true,
        data: mockEntityAssociations
      });

      await memoryService.loadStoredEntities(conversationalAgent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Agent memory manager not available for entity loading'
      );
    });

    test('should handle loading errors gracefully', async () => {
      const conversationalAgent = new SafeConversationalAgent();

      mockEntityService.loadAllActiveEntities.mockRejectedValue(new Error('Loading failed'));

      await expect(memoryService.loadStoredEntities(conversationalAgent)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load stored entities:', expect.any(Error));
    });
  });

  describe('Entity Creation Handling', () => {
    test('should handle entity creation event', async () => {
      const event = {
        entityId: '0.0.123456',
        entityName: 'NewAccount',
        transactionId: 'new-tx-123'
      };

      memoryService.setSessionIdProvider(() => 'test-session-123');

      await (memoryService as any).handleEntityCreation(event);

      expect(mockEntityService.storeEntity).toHaveBeenCalledWith(
        event.entityId,
        event.entityName,
        'accountId',
        event.transactionId,
        'test-session-123'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Entity stored successfully: ${event.entityName} (accountId) -> ${event.entityId}`
      );
    });

    test('should handle entity creation without session ID', async () => {
      const event = {
        entityId: '0.0.123456',
        entityName: 'NewAccount'
      };

      await (memoryService as any).handleEntityCreation(event);

      expect(mockEntityService.storeEntity).toHaveBeenCalledWith(
        event.entityId,
        event.entityName,
        'accountId',
        undefined,
        undefined
      );
    });

    test('should handle entity creation with null session ID', async () => {
      const event = {
        entityId: '0.0.123456',
        entityName: 'NewAccount'
      };

      memoryService.setSessionIdProvider(() => null);

      await (memoryService as any).handleEntityCreation(event);

      expect(mockEntityService.storeEntity).toHaveBeenCalledWith(
        event.entityId,
        event.entityName,
        'accountId',
        undefined,
        undefined
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete entity lifecycle', async () => {
      await memoryService.storeEntityAssociation('0.0.123456', 'TestAccount', 'tx-123');

      const exists = memoryService.entityExists('0.0.123456');
      expect(exists).toBe(true);

      const found = await memoryService.findEntityByName('TestAccount');
      expect(found?.entityName).toBe('TestAccount');

      const recent = memoryService.getMostRecentEntity('accountId');
      expect(recent?.entityName).toBe('TestAccount');

      const conversationalAgent = new SafeConversationalAgent();
      mockEntityService.loadAllActiveEntities.mockResolvedValue({
        success: true,
        data: [{
          entityId: '0.0.123456',
          entityName: 'TestAccount',
          entityType: 'accountId',
          transactionId: 'tx-123',
          createdAt: new Date(),
          networkId: '1'
        }]
      });

      await memoryService.loadStoredEntities(conversationalAgent);
      expect(conversationalAgent.memoryManager.storeEntityAssociation).toHaveBeenCalled();
    });

    test('should handle error scenarios gracefully', async () => {
      const newService = new MemoryService(mockEntityService, NetworkType.TESTNET);

      expect(await newService.storeEntityAssociation('0.0.123456', 'Test')).toBeUndefined();
      expect(newService.getStoredEntities()).toEqual([]);
      expect(await newService.findEntityByName('Test')).toBeNull();
      expect(newService.getMostRecentEntity('accountId')).toBeNull();
      expect(newService.entityExists('0.0.123456')).toBe(false);
    });
  });
});
