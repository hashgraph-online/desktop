import { EntityService } from '../../../src/main/services/entity-service';

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn()
}));

jest.mock('../../../src/main/db/schema', () => ({
  entityAssociations: {
    entityId: 'entityId',
    entityName: 'entityName',
    entityType: 'entityType',
    transactionId: 'transactionId',
    sessionId: 'sessionId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    isActive: 'isActive',
    metadata: 'metadata'
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

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, value, operator: 'eq' })),
  desc: jest.fn((column) => ({ column, direction: 'desc' })),
  and: jest.fn((...conditions) => ({ conditions, operator: 'and' })),
  or: jest.fn((...conditions) => ({ conditions, operator: 'or' })),
  like: jest.fn((column, pattern) => ({ column, pattern, operator: 'like' }))
}));

describe('EntityService', () => {
  let entityService: EntityService;
  let mockDb: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      all: jest.fn(),
      get: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      run: jest.fn(),
      delete: jest.fn().mockReturnThis()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    const { getDatabase } = require('../../../src/main/db/connection');
    getDatabase.mockReturnValue(mockDb);

    const { Logger } = require('../../../src/main/utils/logger');
    Logger.mockImplementation(() => mockLogger);

    entityService = new EntityService();
  });

  describe('Constructor', () => {
    test('should create EntityService with logger', () => {
      expect(entityService).toBeDefined();
      expect(mockLogger).toBeDefined();
    });
  });

  describe('storeEntity', () => {
    const entityData = {
      entityId: '0.0.123456',
      entityName: 'test-entity',
      entityType: 'ACCOUNT_ID',
      transactionId: 'tx-123',
      sessionId: 'session-456',
      metadata: { test: 'data' }
    };

    test('should store new entity successfully', async () => {
      const expectedEntity = {
        ...entityData,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        isActive: true,
        metadata: JSON.stringify(entityData.metadata)
      };

      mockDb.get
        .mockReturnValueOnce(null) // No existing entity
        .mockReturnValueOnce(expectedEntity); // Returned after insert

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType,
        entityData.transactionId,
        entityData.sessionId,
        entityData.metadata
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedEntity);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Stored entity association: test-entity (ACCOUNT_ID) -> 0.0.123456`
      );
      expect(mockDb.insert).toHaveBeenCalled();
    });

    test('should return existing entity if already exists', async () => {
      const existingEntity = {
        ...entityData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.get.mockReturnValue(existingEntity);

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(existingEntity);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity already exists: 0.0.123456 (test-entity)'
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Database connection failed';
      mockDb.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store entity association:',
        expect.any(Error)
      );
    });

    test('should handle non-Error database errors', async () => {
      mockDb.get.mockImplementation(() => {
        throw 'String error';
      });

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    test('should store entity without optional parameters', async () => {
      const expectedEntityWithoutOptional = {
        entityId: entityData.entityId,
        entityName: entityData.entityName,
        entityType: entityData.entityType,
        transactionId: null,
        sessionId: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        isActive: true,
        metadata: null
      };

      mockDb.get
        .mockReturnValueOnce(null) // No existing entity
        .mockReturnValueOnce(expectedEntityWithoutOptional); // Returned after insert

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType
      );

      expect(result.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Stored entity association: test-entity (ACCOUNT_ID) -> 0.0.123456`
      );
    });

    test('should store entity with null metadata', async () => {
      const expectedEntityWithNullMetadata = {
        ...entityData,
        metadata: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        isActive: true
      };

      mockDb.get
        .mockReturnValueOnce(null) // No existing entity
        .mockReturnValueOnce(expectedEntityWithNullMetadata); // Returned after insert

      const result = await entityService.storeEntity(
        entityData.entityId,
        entityData.entityName,
        entityData.entityType,
        entityData.transactionId,
        entityData.sessionId,
        null
      );

      expect(result.success).toBe(true);
      expect(result.data?.metadata).toBeNull();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('resolveEntityReference', () => {
    const searchQuery = 'test';
    const entityType = 'ACCOUNT_ID';
    const mockEntities = [
      {
        entityId: '0.0.123456',
        entityName: 'test-account',
        entityType: 'ACCOUNT_ID',
        isActive: true
      },
      {
        entityId: '0.0.789012',
        entityName: 'another-test',
        entityType: 'ACCOUNT_ID',
        isActive: true
      }
    ];

    test('should resolve entity reference successfully', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.resolveEntityReference(searchQuery, entityType, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });

    test('should resolve entity reference without entity type filter', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.resolveEntityReference(searchQuery);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.resolveEntityReference(searchQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.all.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.resolveEntityReference(searchQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to resolve entity reference:',
        expect.any(Error)
      );
    });

    test('should use default limit when not specified', async () => {
      mockDb.all.mockReturnValue([]);

      await entityService.resolveEntityReference(searchQuery);

      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });

    test('should apply entity type filter when provided', async () => {
      mockDb.all.mockReturnValue(mockEntities.filter(e => e.entityType === entityType));

      const result = await entityService.resolveEntityReference(searchQuery, entityType, 5);

      expect(result.success).toBe(true);
      expect(mockDb.limit).toHaveBeenCalledWith(5);
    });

    test('should search both entity name and ID', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      await entityService.resolveEntityReference('search-term');

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('getEntityAssociations', () => {
    const mockEntities = [
      { entityId: '0.0.123456', entityType: 'ACCOUNT_ID', sessionId: 'session-1' },
      { entityId: '0.0.789012', entityType: 'TOKEN_ID', sessionId: 'session-2' }
    ];

    test('should get all entity associations', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.getEntityAssociations();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(100);
    });

    test('should filter by entity type', async () => {
      mockDb.all.mockReturnValue([mockEntities[0]]);

      const result = await entityService.getEntityAssociations('ACCOUNT_ID');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockEntities[0]]);
    });

    test('should filter by session ID', async () => {
      mockDb.all.mockReturnValue([mockEntities[0]]);

      const result = await entityService.getEntityAssociations(undefined, 'session-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockEntities[0]]);
    });

    test('should filter by both entity type and session ID', async () => {
      mockDb.all.mockReturnValue([mockEntities[0]]);

      const result = await entityService.getEntityAssociations('ACCOUNT_ID', 'session-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockEntities[0]]);
    });

    test('should use custom limit', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.getEntityAssociations(undefined, undefined, 50);

      expect(result.success).toBe(true);
      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.getEntityAssociations();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.all.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.getEntityAssociations();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('getEntityById', () => {
    const entityId = '0.0.123456';
    const mockEntity = {
      entityId,
      entityName: 'test-entity',
      entityType: 'ACCOUNT_ID',
      isActive: true
    };

    test('should get entity by ID successfully', async () => {
      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.getEntityById(entityId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
    });

    test('should return undefined for non-existent entity', async () => {
      mockDb.get.mockReturnValue(null);

      const result = await entityService.getEntityById(entityId);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.getEntityById(entityId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.getEntityById(entityId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('deactivateEntity', () => {
    const entityId = '0.0.123456';

    test('should deactivate entity successfully', async () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      const result = await entityService.deactivateEntity(entityId);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(`Deactivated entity: ${entityId}`);
    });

    test('should return false when entity not found', async () => {
      mockDb.run.mockReturnValue({ changes: 0 });

      const result = await entityService.deactivateEntity(entityId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Entity not found');
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.deactivateEntity(entityId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Update failed';
      mockDb.run.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.deactivateEntity(entityId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('loadAllActiveEntities', () => {
    const mockEntities = [
      { entityId: '0.0.123456', isActive: true },
      { entityId: '0.0.789012', isActive: true }
    ];

    test('should load all active entities successfully', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.loadAllActiveEntities();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded 2 active entity associations');
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.loadAllActiveEntities();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.all.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.loadAllActiveEntities();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('getEntitiesBySession', () => {
    const sessionId = 'session-123';
    const mockEntities = [
      { entityId: '0.0.123456', sessionId, isActive: true },
      { entityId: '0.0.789012', sessionId, isActive: true }
    ];

    test('should get entities by session successfully', async () => {
      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded 2 active entity associations for session session-123'
      );
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.all.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('findEntityInSession', () => {
    const entityName = 'test-entity';
    const sessionId = 'session-123';
    const entityType = 'ACCOUNT_ID';
    const mockEntity = {
      entityId: '0.0.123456',
      entityName,
      entityType,
      sessionId,
      isActive: true
    };

    test('should find entity in session successfully', async () => {
      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.findEntityInSession(entityName, sessionId, entityType);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
    });

    test('should return null when entity not found', async () => {
      mockDb.get.mockReturnValue(null);

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    test('should find entity without type filter', async () => {
      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('getMostRecentEntityInSession', () => {
    const entityType = 'ACCOUNT_ID';
    const sessionId = 'session-123';
    const mockEntity = {
      entityId: '0.0.123456',
      entityType,
      sessionId,
      isActive: true,
      createdAt: new Date()
    };

    test('should get most recent entity in session successfully', async () => {
      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
    });

    test('should return null when no entity found', async () => {
      mockDb.get.mockReturnValue(null);

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Query failed';
      mockDb.get.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('cleanupInactiveEntities', () => {
    test('should cleanup inactive entities successfully', async () => {
      mockDb.run.mockReturnValue({ changes: 5 });

      const result = await entityService.cleanupInactiveEntities(30);

      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up 5 inactive entity associations');
    });

    test('should use default olderThanDays when not specified', async () => {
      mockDb.run.mockReturnValue({ changes: 0 });

      const result = await entityService.cleanupInactiveEntities();

      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(0);
    });

    test('should handle database not available', async () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      getDatabase.mockReturnValue(null);

      const result = await entityService.cleanupInactiveEntities(7);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not available');
    });

    test('should handle database errors', async () => {
      const errorMessage = 'Cleanup failed';
      mockDb.run.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await entityService.cleanupInactiveEntities(15);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });
});
