import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { VirtualItem } from '@tanstack/virtual-core';
import { EntityCard } from './entity-card';
import type { EntityAssociation } from '../../../main/db/schema';

/**
 * Props for EntityList component
 */
export interface EntityListProps {
  entities: EntityAssociation[];
  selectedEntities: Set<string>;
  onEntitySelect: (entityId: string, selected: boolean) => void;
  onEntityDelete: (entityId: string) => void;
  onEntityRename: (entityId: string, newName: string) => void;
  onBulkSelect: (entityIds: string[]) => void;
  loading?: boolean;
}

/**
 * Virtualized list component for displaying entities
 */
export const EntityList: React.FC<EntityListProps> = ({
  entities,
  selectedEntities,
  onEntitySelect,
  onEntityDelete,
  onEntityRename,
  onBulkSelect,
  loading = false,
}) => {
  const scrollElementRef = React.useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = React.useState<'name' | 'date' | 'type'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const sortedEntities = React.useMemo(() => {
    const sorted = [...entities].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.entityName.localeCompare(b.entityName);
          break;
        case 'date':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'type':
          comparison = a.entityType.localeCompare(b.entityType);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [entities, sortBy, sortOrder]);

  const virtualizer = useVirtualizer({
    count: sortedEntities.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const handleSelectAll = React.useCallback(
    (selected: boolean) => {
      if (selected) {
        onBulkSelect(sortedEntities.map((entity) => entity.entityId));
      } else {
        onBulkSelect([]);
      }
    },
    [sortedEntities, onBulkSelect]
  );

  const handleSort = React.useCallback(
    (newSortBy: 'name' | 'date' | 'type') => {
      if (sortBy === newSortBy) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(newSortBy);
        setSortOrder('asc');
      }
    },
    [sortBy, sortOrder]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const entity = sortedEntities[index];

      switch (event.key) {
        case ' ':
          event.preventDefault();
          onEntitySelect(
            entity.entityId,
            !selectedEntities.has(entity.entityId)
          );
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (index < sortedEntities.length - 1) {
            const nextElement = document.getElementById(
              `entity-card-${index + 1}`
            );
            nextElement?.focus();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (index > 0) {
            const prevElement = document.getElementById(
              `entity-card-${index - 1}`
            );
            prevElement?.focus();
          }
          break;
        case 'Delete':
          event.preventDefault();
          onEntityDelete(entity.entityId);
          break;
      }
    },
    [sortedEntities, selectedEntities, onEntitySelect, onEntityDelete]
  );

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='flex items-center space-x-3'>
          <div
            className='animate-spin rounded-full h-8 w-8 border-b-2 border-hgo-blue'
            aria-label='Loading'
          ></div>
          <span className='text-gray-600 dark:text-gray-300'>
            Loading entities...
          </span>
        </div>
      </div>
    );
  }

  if (sortedEntities.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center space-y-4'>
          <div className='text-gray-400 dark:text-gray-500'>
            No entities found
          </div>
          <div className='text-sm text-gray-400 dark:text-gray-500'>
            Create entities using the available tools to see them here.
          </div>
        </div>
      </div>
    );
  }

  const allSelected =
    sortedEntities.length > 0 &&
    sortedEntities.every((entity) => selectedEntities.has(entity.entityId));
  const someSelected = sortedEntities.some((entity) =>
    selectedEntities.has(entity.entityId)
  );

  return (
    <div className='h-full flex flex-col'>
      {/* Header with sorting and select all */}
      <div className='flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg mb-4'>
        <div className='flex items-center space-x-4'>
          <label className='flex items-center space-x-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected && !allSelected;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className='w-4 h-4 text-hgo-blue bg-gray-100 border-gray-300 rounded focus:ring-hgo-blue focus:ring-2'
              aria-label='Select all entities'
            />
            <span className='text-sm text-gray-600 dark:text-gray-300'>
              Select All
            </span>
          </label>

          {selectedEntities.size > 0 && (
            <span className='text-sm text-hgo-blue font-medium'>
              {selectedEntities.size} entities selected
            </span>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          <span className='text-sm text-gray-500 dark:text-gray-400'>
            Sort by:
          </span>
          <button
            onClick={() => handleSort('name')}
            className={`text-sm px-2 py-1 rounded ${
              sortBy === 'name'
                ? 'bg-hgo-blue text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('date')}
            className={`text-sm px-2 py-1 rounded ${
              sortBy === 'date'
                ? 'bg-hgo-blue text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('type')}
            className={`text-sm px-2 py-1 rounded ${
              sortBy === 'type'
                ? 'bg-hgo-blue text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Virtualized list */}
      <div
        ref={scrollElementRef}
        className='flex-1 overflow-auto'
        style={{ height: '100%' }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
            const entity = sortedEntities[virtualRow.index];

            return (
              <div
                key={String(virtualRow.key)}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EntityCard
                  id={`entity-card-${virtualRow.index}`}
                  entity={entity}
                  isSelected={selectedEntities.has(entity.entityId)}
                  onSelect={(selected) =>
                    onEntitySelect(entity.entityId, selected)
                  }
                  onDelete={() => onEntityDelete(entity.entityId)}
                  onRename={(newName) =>
                    onEntityRename(entity.entityId, newName)
                  }
                  onCopyToClipboard={() => {
                    navigator.clipboard.writeText(entity.entityId);
                  }}
                  onKeyDown={(event) => handleKeyDown(event, virtualRow.index)}
                  tabIndex={0}
                  style={{ marginBottom: '8px' }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
