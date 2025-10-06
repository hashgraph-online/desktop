import React from 'react';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import { useEntityManagement } from '../hooks/use-entity-management';
import { EntityList } from '../components/entity/entity-list';
import { EntityFilters } from '../components/entity/entity-filters';
import { BulkActions } from '../components/entity/bulk-actions';
import { HiInformationCircle } from 'react-icons/hi2';
import { HiDatabase } from 'react-icons/hi';

/**
 * Main Entity Manager page component
 */
export const EntityManagerPage: React.FC = () => {
  const {
    entities,
    filteredEntities,
    selectedEntities,
    filters,
    loading,
    error,
    entityTypes,
    updateFilters,
    selectEntity,
    selectAllEntities,
    deleteEntity,
    bulkDeleteEntities,
    renameEntity,
    exportEntities,
    clearFilters,
    retryLoad,
  } = useEntityManagement();

  const handleEntitySelect = React.useCallback(
    (entityId: string, selected: boolean) => {
      selectEntity(entityId, selected);
    },
    [selectEntity]
  );

  const handleBulkSelect = React.useCallback(
    (entityIds: string[]) => {
      selectAllEntities(false);
      entityIds.forEach((entityId) => selectEntity(entityId, true));
    },
    [selectEntity, selectAllEntities]
  );

  const handleEntityDelete = React.useCallback(
    async (entityId: string) => {
      await deleteEntity(entityId);
    },
    [deleteEntity]
  );

  const handleEntityRename = React.useCallback(
    async (entityId: string, newName: string) => {
      await renameEntity(entityId, newName);
    },
    [renameEntity]
  );

  const handleBulkDelete = React.useCallback(async () => {
    await bulkDeleteEntities();
  }, [bulkDeleteEntities]);

  const handleExport = React.useCallback(
    async (format: 'json' | 'csv') => {
      const result = await exportEntities(format);
      if (result) {
        const blob = new Blob([result.data], {
          type: format === 'json' ? 'application/json' : 'text/csv',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [exportEntities]
  );

  if (error) {
    return (
      <div className='flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-black/50'>
        <div className='max-w-7xl mx-auto p-6'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='text-center space-y-6'
          >
            <div className='flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full'>
              <HiInformationCircle className='w-8 h-8 text-red-600 dark:text-red-400' />
            </div>
            <Typography variant='h2' className='text-red-600 dark:text-red-400'>
              Error Loading Entities
            </Typography>
            <Typography
              variant='body1'
              className='text-gray-600 dark:text-gray-300 max-w-md mx-auto'
            >
              Error loading entities: {error}
            </Typography>
            <button
              onClick={retryLoad}
              className='px-6 py-3 bg-gradient-to-r from-[#5599fe] to-[#a679f0] text-white rounded-lg hover:shadow-lg transition-all duration-200'
            >
              Try Again
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-black/50'>
      <div className='max-w-7xl mx-auto h-full flex flex-col'>
        <div className='flex flex-col gap-4 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-hgo-blue to-hgo-purple text-white shadow-lg'>
              <HiDatabase className='h-5 w-5' aria-hidden='true' />
            </div>
            <div>
              <Typography variant='body1' className='font-semibold text-gray-800 dark:text-gray-100' noMargin>
                Entity Manager
              </Typography>
              <Typography variant='body2' className='text-gray-500 dark:text-gray-400' noMargin>
                Manage on-chain entities created by tools
              </Typography>
            </div>
          </div>

          <div className='flex items-center gap-3 sm:flex-row'>
            <div className='rounded-lg bg-white/70 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm dark:bg-white/10 dark:text-gray-200'>
              Showing {filteredEntities.length} of {entities.length} entities
            </div>
            <button
              onClick={() => handleExport('json')}
              className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#5599fe] to-[#a679f0] px-4 py-2 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:shadow-xl'
            >
              Export
            </button>
          </div>
        </div>

        <div className='px-6'>
          <EntityFilters
            filters={filters}
            onFiltersChange={updateFilters}
            entityTypes={entityTypes}
            onClearFilters={clearFilters}
            totalEntities={entities.length}
            filteredEntities={filteredEntities.length}
          />

          {selectedEntities.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className='mt-4'
            >
              <BulkActions
                selectedCount={selectedEntities.size}
                onBulkDelete={handleBulkDelete}
                onBulkExport={handleExport}
                onSelectAll={() => selectAllEntities(true)}
                onClearSelection={() => selectAllEntities(false)}
              />
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className='flex-1 overflow-hidden px-6 pb-6'
        >
          {loading ? (
            <div className='flex items-center justify-center h-64'>
              <div className='flex items-center space-x-3'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-hgo-blue'></div>
                <Typography
                  variant='body1'
                  className='text-gray-600 dark:text-gray-300'
                >
                  Loading entities...
                </Typography>
              </div>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className='flex items-center justify-center h-64'>
              <div className='text-center space-y-4'>
                <div className='flex items-center justify-center w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full'>
                  <HiDatabase className='w-8 h-8 text-gray-400' />
                </div>
                <Typography
                  variant='h3'
                  className='text-gray-500 dark:text-gray-400'
                >
                  No entities found
                </Typography>
                <Typography
                  variant='body2'
                  className='text-gray-400 dark:text-gray-500 max-w-sm mx-auto'
                >
                  Create entities using the available tools to see them here.
                </Typography>
                {entities.length > 0 && filteredEntities.length === 0 && (
                  <button
                    onClick={clearFilters}
                    className='px-4 py-2 text-sm bg-gradient-to-r from-hgo-blue to-hgo-purple text-white rounded-lg hover:shadow-lg transition-all duration-200'
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <EntityList
              entities={filteredEntities}
              selectedEntities={selectedEntities}
              onEntitySelect={handleEntitySelect}
              onEntityDelete={handleEntityDelete}
              onEntityRename={handleEntityRename}
              onBulkSelect={handleBulkSelect}
              loading={loading}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default EntityManagerPage;
