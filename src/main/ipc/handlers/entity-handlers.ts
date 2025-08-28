import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { EntityService } from '../../services/entity-service';
import { Logger } from '../../utils/logger';
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';

/**
 * Entity filter options for querying entities
 */
export interface EntityFilters {
  search?: string;
  entityType?: string;
  sessionId?: string;
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  limit?: number;
}

/**
 * Entity export options
 */
export interface EntityExportOptions {
  format: 'json' | 'csv';
  includeMetadata?: boolean;
}

/**
 * Sets up entity management IPC handlers
 */
export function setupEntityHandlers(): void {
  const entityService = new EntityService();
  const logger = new Logger({ module: 'EntityHandlers' });

  /**
   * Get all entities with optional filtering
   */
  ipcMain.handle(
    'entity:getAll',
    async (
      event: IpcMainInvokeEvent,
      filters?: EntityFilters
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity getAll requested', { filters });

        const result = await entityService.getEntityAssociations(
          filters?.entityType,
          filters?.sessionId,
          filters?.limit || 1000
        );

        if (!result.success) {
          logger.error('Failed to get entities', { error: result.error });
          return {
            success: false,
            error: result.error || 'Failed to retrieve entities',
          };
        }

        let entities = result.data || [];

        if (filters?.search) {
          const searchTerm = filters.search.toLowerCase();
          entities = entities.filter(entity =>
            entity.entityName.toLowerCase().includes(searchTerm) ||
            entity.entityId.toLowerCase().includes(searchTerm) ||
            (entity.transactionId && entity.transactionId.toLowerCase().includes(searchTerm))
          );
        }

        if (filters?.dateRange?.start || filters?.dateRange?.end) {
          entities = entities.filter(entity => {
            const createdAt = new Date(entity.createdAt);
            if (filters.dateRange?.start && createdAt < filters.dateRange.start) {
              return false;
            }
            if (filters.dateRange?.end && createdAt > filters.dateRange.end) {
              return false;
            }
            return true;
          });
        }

        logger.info('Entities retrieved successfully', { 
          totalCount: entities.length,
          filteredCount: entities.length 
        });

        return createSuccessResponse(entities);
      } catch (error) {
        logger.error('Error retrieving entities', error);
        return handleIPCError(error, 'Failed to retrieve entities');
      }
    }
  );

  /**
   * Delete a single entity by ID
   */
  ipcMain.handle(
    'entity:delete',
    async (
      event: IpcMainInvokeEvent,
      entityId: string
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity delete requested', { entityId });

        if (!entityId || typeof entityId !== 'string') {
          return {
            success: false,
            error: 'Invalid entity ID provided',
          };
        }

        const result = await entityService.deactivateEntity(entityId);

        if (!result.success) {
          logger.error('Failed to delete entity', { 
            entityId, 
            error: result.error 
          });
          return {
            success: false,
            error: result.error || 'Failed to delete entity',
          };
        }

        logger.info('Entity deleted successfully', { entityId });
        return createSuccessResponse();
      } catch (error) {
        logger.error('Error deleting entity', { entityId, error });
        return handleIPCError(error, 'Failed to delete entity');
      }
    }
  );

  /**
   * Delete multiple entities by IDs
   */
  ipcMain.handle(
    'entity:bulkDelete',
    async (
      event: IpcMainInvokeEvent,
      entityIds: string[]
    ): Promise<IPCResponse> => {
      try {
        logger.info('Bulk delete requested', { 
          entityIds, 
          count: entityIds.length 
        });

        if (!Array.isArray(entityIds) || entityIds.length === 0) {
          return {
            success: false,
            error: 'Invalid entity IDs provided',
          };
        }

        const results = await Promise.allSettled(
          entityIds.map(entityId => entityService.deactivateEntity(entityId))
        );

        const successful: string[] = [];
        const failed: { entityId: string; error: string }[] = [];

        results.forEach((result, index) => {
          const entityId = entityIds[index];
          if (result.status === 'fulfilled' && result.value.success) {
            successful.push(entityId);
          } else {
            const error = result.status === 'rejected' 
              ? result.reason 
              : (result.value as { error?: string }).error;
            failed.push({ entityId, error: error?.message || String(error) });
          }
        });

        logger.info('Bulk delete completed', { 
          successful: successful.length,
          failed: failed.length 
        });

        if (failed.length > 0) {
          logger.warn('Some entities failed to delete', { failed });
        }

        return createSuccessResponse({
          successful,
          failed,
          totalRequested: entityIds.length,
        });
      } catch (error) {
        logger.error('Error in bulk delete', { entityIds, error });
        return handleIPCError(error, 'Failed to delete entities');
      }
    }
  );

  /**
   * Rename an entity
   */
  ipcMain.handle(
    'entity:rename',
    async (
      event: IpcMainInvokeEvent,
      entityId: string,
      newName: string
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity rename requested', { entityId, newName });

        if (!entityId || typeof entityId !== 'string') {
          return {
            success: false,
            error: 'Invalid entity ID provided',
          };
        }

        if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
          return {
            success: false,
            error: 'Invalid entity name provided',
          };
        }

        const entity = await entityService.getEntityById(entityId);
        if (!entity.success || !entity.data) {
          return {
            success: false,
            error: 'Entity not found',
          };
        }

        const result = await entityService.storeEntity(
          entityId,
          newName.trim(),
          entity.data.entityType,
          entity.data.transactionId,
          entity.data.sessionId,
          entity.data.metadata ? JSON.parse(entity.data.metadata) : null
        );

        if (!result.success) {
          logger.error('Failed to rename entity', { 
            entityId, 
            newName, 
            error: result.error 
          });
          return {
            success: false,
            error: result.error || 'Failed to rename entity',
          };
        }

        logger.info('Entity renamed successfully', { entityId, newName });
        return createSuccessResponse(result.data);
      } catch (error) {
        logger.error('Error renaming entity', { entityId, newName, error });
        return handleIPCError(error, 'Failed to rename entity');
      }
    }
  );

  /**
   * Export entities to file
   */
  ipcMain.handle(
    'entity:export',
    async (
      event: IpcMainInvokeEvent,
      filters?: EntityFilters,
      format: 'json' | 'csv' = 'json'
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity export requested', { filters, format });

        const result = await entityService.getEntityAssociations(
          filters?.entityType,
          filters?.sessionId,
          filters?.limit || 10000
        );

        if (!result.success || !result.data) {
          logger.error('Failed to get entities for export', { error: result.error });
          return {
            success: false,
            error: result.error || 'Failed to retrieve entities for export',
          };
        }

        let entities = result.data;

        if (filters?.search) {
          const searchTerm = filters.search.toLowerCase();
          entities = entities.filter(entity =>
            entity.entityName.toLowerCase().includes(searchTerm) ||
            entity.entityId.toLowerCase().includes(searchTerm) ||
            (entity.transactionId && entity.transactionId.toLowerCase().includes(searchTerm))
          );
        }

        let exportData: string;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let filename: string;

        if (format === 'json') {
          exportData = JSON.stringify(entities, null, 2);
          filename = `entities-export-${timestamp}.json`;
        } else if (format === 'csv') {
          const headers = ['entityId', 'entityName', 'entityType', 'transactionId', 'sessionId', 'createdAt', 'updatedAt', 'isActive'];
          const rows = entities.map(entity => [
            entity.entityId,
            entity.entityName,
            entity.entityType,
            entity.transactionId || '',
            entity.sessionId || '',
            entity.createdAt.toISOString(),
            entity.updatedAt.toISOString(),
            entity.isActive.toString(),
          ]);
          
          exportData = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `entities-export-${timestamp}.csv`;
        } else {
          return {
            success: false,
            error: 'Invalid export format. Supported formats: json, csv',
          };
        }

        logger.info('Entity export completed', { 
          count: entities.length,
          format,
          filename 
        });

        return createSuccessResponse({
          data: exportData,
          filename,
          count: entities.length,
        });
      } catch (error) {
        logger.error('Error exporting entities', { filters, format, error });
        return handleIPCError(error, 'Failed to export entities');
      }
    }
  );

  /**
   * Get entity by ID
   */
  ipcMain.handle(
    'entity:getById',
    async (
      event: IpcMainInvokeEvent,
      entityId: string
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity getById requested', { entityId });

        if (!entityId || typeof entityId !== 'string') {
          return {
            success: false,
            error: 'Invalid entity ID provided',
          };
        }

        const result = await entityService.getEntityById(entityId);

        if (!result.success) {
          logger.error('Failed to get entity by ID', { 
            entityId, 
            error: result.error 
          });
          return {
            success: false,
            error: result.error || 'Failed to retrieve entity',
          };
        }

        if (!result.data) {
          return {
            success: false,
            error: 'Entity not found',
          };
        }

        logger.info('Entity retrieved successfully', { entityId });
        return createSuccessResponse(result.data);
      } catch (error) {
        logger.error('Error getting entity by ID', { entityId, error });
        return handleIPCError(error, 'Failed to retrieve entity');
      }
    }
  );

  /**
   * Search entities by query
   */
  ipcMain.handle(
    'entity:search',
    async (
      event: IpcMainInvokeEvent,
      query: string,
      entityType?: string
    ): Promise<IPCResponse> => {
      try {
        logger.info('Entity search requested', { query, entityType });

        if (!query || typeof query !== 'string') {
          return {
            success: false,
            error: 'Invalid search query provided',
          };
        }

        const result = await entityService.resolveEntityReference(
          query,
          entityType,
          50
        );

        if (!result.success) {
          logger.error('Failed to search entities', { 
            query, 
            entityType, 
            error: result.error 
          });
          return {
            success: false,
            error: result.error || 'Failed to search entities',
          };
        }

        logger.info('Entity search completed', { 
          query,
          entityType,
          resultCount: result.data?.length || 0 
        });

        return createSuccessResponse(result.data || []);
      } catch (error) {
        logger.error('Error searching entities', { query, entityType, error });
        return handleIPCError(error, 'Failed to search entities');
      }
    }
  );

  logger.info('Entity handlers initialized successfully');
}