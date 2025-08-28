/**
 * Unit tests for session-aware entity loading in EntityService
 * These tests define expected behavior for session filtering bug fixes
 */
import { EntityService } from '../../src/main/services/EntityService';
import { getDatabase } from '../../src/main/db/connection';
import * as _schema from '../../src/main/db/schema';
import { eq as _eq, and as _and } from 'drizzle-orm';

jest.mock('../../src/main/db/connection');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('EntityService Session Awareness', () => {
  let entityService: EntityService;
  let mockDb: { select: jest.Mock };

  beforeEach(() => {
    entityService = new EntityService();
    
    const mockAll = jest.fn();
    const mockGet = jest.fn();

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      all: mockAll,
      get: mockGet,
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn()
    };

    mockGetDatabase.mockReturnValue(mockDb);
    
    mockAll.mockReset();
    mockGet.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntitiesBySession', () => {
    it('should filter entities by session ID', async () => {
      const sessionId = 'test-session-123';
      const mockEntities = [
        {
          id: 1,
          entityId: '0.0.6624832',
          entityName: 'Forever #1',
          entityType: 'token',
          sessionId: sessionId,
          isActive: true,
          createdAt: new Date()
        }
      ];

      mockDb.all.mockReturnValue(mockEntities);

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntities);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty array for session with no entities', async () => {
      const sessionId = 'empty-session';
      mockDb.all.mockReturnValue([]);

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error gracefully', async () => {
      const sessionId = 'test-session';
      mockDb.all.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle null database gracefully', async () => {
      mockGetDatabase.mockReturnValue(null);
      const sessionId = 'test-session';

      const result = await entityService.getEntitiesBySession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database not available');
    });
  });

  describe('findEntityInSession', () => {
    it('should find entity by name within session scope', async () => {
      const sessionId = 'test-session-123';
      const entityName = 'Forever #1';
      const mockEntity = {
        id: 1,
        entityId: '0.0.6624832',
        entityName: entityName,
        entityType: 'token',
        sessionId: sessionId,
        isActive: true,
        createdAt: new Date()
      };

      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null when entity not found in session', async () => {
      const sessionId = 'test-session';
      const entityName = 'NonExistent';
      mockDb.get.mockReturnValue(null);

      const result = await entityService.findEntityInSession(entityName, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should not find entity from different session', async () => {
      const currentSession = 'session-1';
      const entityName = 'Forever #1';
      
      mockDb.get.mockReturnValue(null);

      const result = await entityService.findEntityInSession(entityName, currentSession);

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe('getMostRecentEntityInSession', () => {
    it('should get most recent entity of type within session', async () => {
      const sessionId = 'test-session';
      const entityType = 'token';
      const mockEntity = {
        id: 1,
        entityId: '0.0.6624832',
        entityName: 'Forever #1',
        entityType: entityType,
        sessionId: sessionId,
        isActive: true,
        createdAt: new Date()
      };

      mockDb.get.mockReturnValue(mockEntity);

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntity);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null when no entities of type exist in session', async () => {
      const sessionId = 'test-session';
      const entityType = 'nonexistent';
      mockDb.get.mockReturnValue(null);

      const result = await entityService.getMostRecentEntityInSession(entityType, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });
});