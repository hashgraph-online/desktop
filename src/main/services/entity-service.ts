import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import type { EntityAssociation, NewEntityAssociation } from '../db/schema';
import { eq, desc, and, or, like } from 'drizzle-orm';
import { Logger } from '../utils/logger';

/**
 * Service for managing entity associations in the database
 */
export class EntityService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ module: 'EntityService' });
  }

  /**
   * Store a new entity association
   */
  async storeEntity(
    entityId: string,
    entityName: string,
    entityType: string,
    transactionId?: string,
    sessionId?: string,
    metadata?: any
  ): Promise<{ success: boolean; data?: EntityAssociation; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const existing = db
        .select()
        .from(schema.entityAssociations)
        .where(
          and(
            eq(schema.entityAssociations.entityId, entityId),
            eq(schema.entityAssociations.isActive, true)
          )
        )
        .get();

      if (existing) {
        this.logger.info(`Entity already exists: ${entityId} (${entityName})`);
        return { success: true, data: existing };
      }

      const now = new Date();
      const newEntity = {
        entityId,
        entityName,
        entityType,
        transactionId: transactionId || null,
        sessionId: sessionId || null,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        metadata: metadata ? JSON.stringify(metadata) : null,
      } as NewEntityAssociation;

      const result = db
        .insert(schema.entityAssociations)
        .values(newEntity)
        .returning()
        .get();

      this.logger.info(
        `Stored entity association: ${entityName} (${entityType}) -> ${entityId}`
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to store entity association:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve entity reference by name or partial match
   */
  async resolveEntityReference(
    query: string,
    entityType?: string,
    limit: number = 10
  ): Promise<{ success: boolean; data?: EntityAssociation[]; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const searchTerm = `%${query.toLowerCase()}%`;
      let whereCondition = and(
        eq(schema.entityAssociations.isActive, true),
        or(
          like(schema.entityAssociations.entityName, searchTerm),
          like(schema.entityAssociations.entityId, searchTerm)
        )
      );

      if (entityType) {
        whereCondition = and(
          eq(schema.entityAssociations.isActive, true),
          eq(schema.entityAssociations.entityType, entityType),
          or(
            like(schema.entityAssociations.entityName, searchTerm),
            like(schema.entityAssociations.entityId, searchTerm)
          )
        );
      }

      const queryBuilder = db
        .select()
        .from(schema.entityAssociations)
        .where(whereCondition);

      const results = queryBuilder
        .orderBy(desc(schema.entityAssociations.createdAt))
        .limit(limit)
        .all();

      return { success: true, data: results };
    } catch (error) {
      this.logger.error('Failed to resolve entity reference:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all entity associations, optionally filtered by type
   */
  async getEntityAssociations(
    entityType?: string,
    sessionId?: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: EntityAssociation[]; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      let whereCondition = eq(schema.entityAssociations.isActive, true);

      if (entityType && sessionId) {
        whereCondition = and(
          eq(schema.entityAssociations.isActive, true),
          eq(schema.entityAssociations.entityType, entityType),
          eq(schema.entityAssociations.sessionId, sessionId)
        );
      } else if (entityType) {
        whereCondition = and(
          eq(schema.entityAssociations.isActive, true),
          eq(schema.entityAssociations.entityType, entityType)
        );
      } else if (sessionId) {
        whereCondition = and(
          eq(schema.entityAssociations.isActive, true),
          eq(schema.entityAssociations.sessionId, sessionId)
        );
      }

      const queryBuilder = db
        .select()
        .from(schema.entityAssociations)
        .where(whereCondition);

      const results = queryBuilder
        .orderBy(desc(schema.entityAssociations.createdAt))
        .limit(limit)
        .all();

      return { success: true, data: results };
    } catch (error) {
      this.logger.error('Failed to get entity associations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get entity association by ID
   */
  async getEntityById(
    entityId: string
  ): Promise<{ success: boolean; data?: EntityAssociation; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const entity = db
        .select()
        .from(schema.entityAssociations)
        .where(
          and(
            eq(schema.entityAssociations.entityId, entityId),
            eq(schema.entityAssociations.isActive, true)
          )
        )
        .get();

      return { success: true, data: entity || undefined };
    } catch (error) {
      this.logger.error('Failed to get entity by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deactivate an entity association
   */
  async deactivateEntity(
    entityId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const result = db
        .update(schema.entityAssociations)
        .set({
          isActive: false,
          updatedAt: new Date(),
        } as Partial<NewEntityAssociation>)
        .where(eq(schema.entityAssociations.entityId, entityId))
        .run();

      if (result.changes > 0) {
        this.logger.info(`Deactivated entity: ${entityId}`);
        return { success: true };
      } else {
        return { success: false, error: 'Entity not found' };
      }
    } catch (error) {
      this.logger.error('Failed to deactivate entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load all active entities for session initialization
   */
  async loadAllActiveEntities(): Promise<{
    success: boolean;
    data?: EntityAssociation[];
    error?: string;
  }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const entities = db
        .select()
        .from(schema.entityAssociations)
        .where(eq(schema.entityAssociations.isActive, true))
        .orderBy(desc(schema.entityAssociations.createdAt))
        .all();

      this.logger.info(`Loaded ${entities.length} active entity associations`);
      return { success: true, data: entities };
    } catch (error) {
      this.logger.error('Failed to load active entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get entities filtered by session ID
   */
  async getEntitiesBySession(
    sessionId: string
  ): Promise<{ success: boolean; data?: EntityAssociation[]; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const entities = db
        .select()
        .from(schema.entityAssociations)
        .where(
          and(
            eq(schema.entityAssociations.sessionId, sessionId),
            eq(schema.entityAssociations.isActive, true)
          )
        )
        .orderBy(desc(schema.entityAssociations.createdAt))
        .all();

      this.logger.info(
        `Loaded ${entities.length} active entity associations for session ${sessionId}`
      );
      return { success: true, data: entities };
    } catch (error) {
      this.logger.error('Failed to load entities by session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find entity by name within session scope
   */
  async findEntityInSession(
    entityName: string,
    sessionId: string,
    entityType?: string
  ): Promise<{
    success: boolean;
    data?: EntityAssociation | null;
    error?: string;
  }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const whereConditions = [
        eq(schema.entityAssociations.entityName, entityName),
        eq(schema.entityAssociations.sessionId, sessionId),
        eq(schema.entityAssociations.isActive, true),
      ];

      if (entityType) {
        whereConditions.push(
          eq(schema.entityAssociations.entityType, entityType)
        );
      }

      const entity = db
        .select()
        .from(schema.entityAssociations)
        .where(and(...whereConditions))
        .orderBy(desc(schema.entityAssociations.createdAt))
        .get();

      return { success: true, data: entity || null };
    } catch (error) {
      this.logger.error('Failed to find entity in session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get most recent entity of given type within session
   */
  async getMostRecentEntityInSession(
    entityType: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    data?: EntityAssociation | null;
    error?: string;
  }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const entity = db
        .select()
        .from(schema.entityAssociations)
        .where(
          and(
            eq(schema.entityAssociations.entityType, entityType),
            eq(schema.entityAssociations.sessionId, sessionId),
            eq(schema.entityAssociations.isActive, true)
          )
        )
        .orderBy(desc(schema.entityAssociations.createdAt))
        .get();

      return { success: true, data: entity || null };
    } catch (error) {
      this.logger.error('Failed to get most recent entity in session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old inactive entities
   */
  async cleanupInactiveEntities(
    olderThanDays: number = 30
  ): Promise<{ success: boolean; cleaned?: number; error?: string }> {
    try {
      const db = getDatabase();
      if (!db) {
        throw new Error('Database not available');
      }

      const cutoffDate = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      );

      const result = db
        .delete(schema.entityAssociations)
        .where(
          and(
            eq(schema.entityAssociations.isActive, false),
            schema.entityAssociations.updatedAt < cutoffDate
          )
        )
        .run();

      this.logger.info(
        `Cleaned up ${result.changes} inactive entity associations`
      );
      return { success: true, cleaned: result.changes };
    } catch (error) {
      this.logger.error('Failed to cleanup inactive entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
