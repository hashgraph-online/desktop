import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EntityAssociation } from '../../main/db/schema';

/**
 * Entity filter configuration
 */
export interface EntityFilters extends Record<string, unknown> {
  search: string;
  entityType: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sessionId: string;
}

/**
 * Export result from entity export operation
 */
export interface EntityExportResult {
  data: string;
  filename: string;
  count: number;
}

/**
 * Custom hook for managing entity state and operations
 */
export function useEntityManagement() {
  const [entities, setEntities] = useState<EntityAssociation[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EntityFilters>({
    search: '',
    entityType: '',
    dateRange: { start: null, end: null },
    sessionId: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredEntities = useMemo(() => {
    return entities.filter(entity => {
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch = (
          entity.entityName.toLowerCase().includes(searchTerm) ||
          entity.entityId.toLowerCase().includes(searchTerm) ||
          (entity.transactionId && entity.transactionId.toLowerCase().includes(searchTerm))
        );
        if (!matchesSearch) return false;
      }

      if (filters.entityType && entity.entityType !== filters.entityType) {
        return false;
      }

      if (filters.sessionId && entity.sessionId !== filters.sessionId) {
        return false;
      }

      if (filters.dateRange.start || filters.dateRange.end) {
        const createdAt = new Date(entity.createdAt);
        if (filters.dateRange.start && createdAt < filters.dateRange.start) {
          return false;
        }
        if (filters.dateRange.end && createdAt > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }, [entities, filters]);

  const entityTypes = useMemo(() => {
    const types = [...new Set(entities.map(entity => entity.entityType))];
    return types.sort();
  }, [entities]);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window?.desktop?.entity.getAll();
      
      if (result.success && result.data) {
        setEntities(result.data);
      } else {
        setError(result.error || 'Failed to load entities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFilters = useCallback((newFilters: Partial<EntityFilters>) => {
    if (newFilters.dateRange) {
      const { start, end } = newFilters.dateRange;
      if (start && end && start > end) {
        setError('End date must be after start date');
        return;
      }
      setError(null);
    }

    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      entityType: '',
      dateRange: { start: null, end: null },
      sessionId: '',
    });
    setError(null);
  }, []);

  const selectEntity = useCallback((entityId: string, selected: boolean) => {
    setSelectedEntities(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(entityId);
      } else {
        newSet.delete(entityId);
      }
      return newSet;
    });
  }, []);

  const selectAllEntities = useCallback((selected: boolean) => {
    if (selected) {
      const allEntityIds = filteredEntities.map(entity => entity.entityId);
      setSelectedEntities(new Set(allEntityIds));
    } else {
      setSelectedEntities(new Set());
    }
  }, [filteredEntities]);

  const deleteEntity = useCallback(async (entityId: string) => {
    setEntities(prev => prev.filter(entity => entity.entityId !== entityId));
    setSelectedEntities(prev => {
      const newSet = new Set(prev);
      newSet.delete(entityId);
      return newSet;
    });

    try {
      const result = await window?.desktop?.entity.delete(entityId);
      
      if (!result.success) {
        setEntities(prev => [...prev, entities.find(e => e.entityId === entityId)!]);
        setError(result.error || 'Failed to delete entity');
        throw new Error(result.error || 'Failed to delete entity');
      }
    } catch (err) {
      const entityToRestore = entities.find(e => e.entityId === entityId);
      if (entityToRestore) {
        setEntities(prev => [...prev, entityToRestore]);
      }
      throw err;
    }
  }, [entities]);

  const bulkDeleteEntities = useCallback(async () => {
    const entityIds = Array.from(selectedEntities);
    
    setEntities(prev => prev.filter(entity => !selectedEntities.has(entity.entityId)));
    setSelectedEntities(new Set());

    try {
      const result = await window?.desktop?.entity.bulkDelete(entityIds);
      
      if (!result.success) {
        const entitiesToRestore = entities.filter(e => entityIds.includes(e.entityId));
        setEntities(prev => [...prev, ...entitiesToRestore]);
        setError(result.error || 'Failed to delete entities');
        throw new Error(result.error || 'Failed to delete entities');
      }

      if (result.data?.failed && result.data.failed.length > 0) {
        const failedIds = result.data.failed.map((f: { entityId: string }) => f.entityId);
        const entitiesToRestore = entities.filter(e => failedIds.includes(e.entityId));
        setEntities(prev => [...prev, ...entitiesToRestore]);
        
        const failedCount = result.data.failed.length;
        const successCount = result.data.successful.length;
        setError(`${failedCount} entities failed to delete. ${successCount} deleted successfully.`);
      }
    } catch (err) {
      const entitiesToRestore = entities.filter(e => entityIds.includes(e.entityId));
      setEntities(prev => [...prev, ...entitiesToRestore]);
      throw err;
    }
  }, [selectedEntities, entities]);

  const renameEntity = useCallback(async (entityId: string, newName: string) => {
    const originalEntity = entities.find(e => e.entityId === entityId);
    if (!originalEntity) return;

    setEntities(prev => prev.map(entity => 
      entity.entityId === entityId 
        ? { ...entity, entityName: newName }
        : entity
    ));

    try {
      const result = await window?.desktop?.entity.rename(entityId, newName);
      
      if (!result.success) {
        setEntities(prev => prev.map(entity => 
          entity.entityId === entityId 
            ? originalEntity
            : entity
        ));
        setError(result.error || 'Failed to rename entity');
        throw new Error(result.error || 'Failed to rename entity');
      }

      if (result.data) {
        setEntities(prev => prev.map(entity => 
          entity.entityId === entityId 
            ? result.data
            : entity
        ));
      }
    } catch (err) {
      setEntities(prev => prev.map(entity => 
        entity.entityId === entityId 
          ? originalEntity
          : entity
      ));
      throw err;
    }
  }, [entities]);

  const exportEntities = useCallback(async (format: 'json' | 'csv'): Promise<EntityExportResult | null> => {
    try {
      const result = await window?.desktop?.entity.export(filters, format);
      
      if (!result.success) {
        setError(result.error || 'Failed to export entities');
        return null;
      }

      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export entities');
      return null;
    }
  }, [filters]);

  const retryLoad = useCallback(() => {
    setError(null);
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    const handleEntityCreated = (entity: EntityAssociation) => {
      setEntities(prev => {
        const exists = prev.find(e => e.entityId === entity.entityId);
        if (exists) return prev;
        return [entity, ...prev];
      });
    };

    const handleEntityDeleted = (entityId: string) => {
      setEntities(prev => prev.filter(entity => entity.entityId !== entityId));
      setSelectedEntities(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityId);
        return newSet;
      });
    };

    const handleEntityUpdated = (entity: EntityAssociation) => {
      setEntities(prev => prev.map(e => 
        e.entityId === entity.entityId ? entity : e
      ));
    };

    const removeCreatedListener = window?.desktop?.on('entity_created', handleEntityCreated);
    const removeDeletedListener = window?.desktop?.on('entity_deleted', handleEntityDeleted);
    const removeUpdatedListener = window?.desktop?.on('entity_updated', handleEntityUpdated);

    return () => {
      removeCreatedListener();
      removeDeletedListener();
      removeUpdatedListener();
    };
  }, []);

  return {
    entities,
    filteredEntities,
    selectedEntities,
    filters,
    loading,
    error,
    entityTypes,
    updateFilters,
    clearFilters,
    selectEntity,
    selectAllEntities,
    deleteEntity,
    bulkDeleteEntities,
    renameEntity,
    exportEntities,
    retryLoad,
  };
}
