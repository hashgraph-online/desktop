import React from 'react';
import { motion } from 'framer-motion';
import { 
  HiOutlineTrash,
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';
import Typography from '../ui/Typography';

/**
 * Props for BulkActions component
 */
export interface BulkActionsProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkExport: (format: 'json' | 'csv') => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

/**
 * Bulk actions component for selected entities
 */
export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onBulkDelete,
  onBulkExport,
  onSelectAll,
  onClearSelection,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleBulkDelete = React.useCallback(async () => {
    setIsDeleting(true);
    try {
      await onBulkDelete();
      setShowDeleteConfirm(false);
    } catch {
      setIsDeleting(false);
    }
  }, [onBulkDelete]);

  const handleExport = React.useCallback(async (format: 'json' | 'csv') => {
    await onBulkExport(format);
    setShowExportMenu(false);
  }, [onBulkExport]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu) {
        const target = event.target as Element;
        if (!target.closest('[data-export-menu]')) {
          setShowExportMenu(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[#5599fe]/10 border border-[#5599fe]/20 rounded-lg p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-6 h-6 bg-[#5599fe] rounded-full">
              <HiOutlineCheckCircle className="w-4 h-4 text-white" />
            </div>
            <Typography variant="body1" className="font-medium text-[#5599fe]">
              {selectedCount} entity{selectedCount > 1 ? 's' : ''} selected
            </Typography>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Select All */}
          <button
            onClick={onSelectAll}
            className="px-3 py-2 text-sm text-[#5599fe] hover:bg-[#5599fe]/10 rounded-lg transition-colors"
          >
            Select All
          </button>

          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Clear selection"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>

          {/* Export Dropdown */}
          <div className="relative" data-export-menu>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <HiOutlineArrowDownTray className="w-4 h-4" />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
              >
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Export as CSV
                </button>
              </motion.div>
            )}
          </div>

          {/* Delete Selected */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <HiOutlineTrash className="w-4 h-4" />
            <span>Delete Selected</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full">
                <HiOutlineTrash className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <Typography variant="h3" className="font-semibold text-gray-900 dark:text-white">
                  Delete Entities
                </Typography>
                <Typography variant="body2" className="text-gray-500 dark:text-gray-400">
                  This action cannot be undone
                </Typography>
              </div>
            </div>

            <Typography variant="body1" className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete {selectedCount} selected entit{selectedCount > 1 ? 'ies' : 'y'}? 
              This will permanently remove {selectedCount > 1 ? 'them' : 'it'} from your database.
            </Typography>

            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center space-x-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <HiOutlineTrash className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};