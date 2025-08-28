import React, {
  CSSProperties,
  FC,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import {
  HiOutlineHashtag,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineClipboard,
  HiOutlineCheck,
} from 'react-icons/hi2';
import { HiOutlineExternalLink, HiOutlineX } from 'react-icons/hi';
import type { EntityAssociation } from '../../../main/db/schema';
import { EntityFormat } from '@hashgraphonline/conversational-agent';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import { useConfigStore } from '../../stores/configStore';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Props for EntityCard component
 */
export interface EntityCardProps {
  id?: string;
  entity: EntityAssociation;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onCopyToClipboard: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  tabIndex?: number;
  style?: CSSProperties;
}

interface EntityIconProps {
  entityType: string;
}

const EntityIcon: FC<EntityIconProps> = ({ entityType }) => {
  switch (entityType) {
    case 'topicId':
      return (
        <HiOutlineHashtag
          className='w-5 h-5 text-white'
          aria-label='Topic icon'
        />
      );
    case 'tokenId':
      return (
        <HiOutlineCurrencyDollar
          className='w-5 h-5 text-white'
          aria-label='Token icon'
        />
      );
    case 'accountId':
      return (
        <HiOutlineUser
          className='w-5 h-5 text-white'
          aria-label='Account icon'
        />
      );
    case 'scheduleId':
      return (
        <HiOutlineClock
          className='w-5 h-5 text-white'
          aria-label='Schedule icon'
        />
      );
    case 'contractId':
      return (
        <HiOutlineDocumentText
          className='w-5 h-5 text-white'
          aria-label='Contract icon'
        />
      );
    default:
      return (
        <HiOutlineDocumentText
          className='w-5 h-5 text-white'
          aria-label='Entity icon'
        />
      );
  }
};

/**
 * Individual entity card component with actions
 */
export const EntityCard: FC<EntityCardProps> = ({
  id,
  entity,
  isSelected,
  onSelect,
  onDelete,
  onRename,
  onCopyToClipboard,
  onKeyDown,
  tabIndex,
  style,
}) => {
  const { config } = useConfigStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(entity.entityName);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleRename = useCallback(async () => {
    if (editName.trim() === '') {
      setNameError('Name cannot be empty');
      return;
    }

    if (editName.trim() === entity.entityName) {
      setIsEditing(false);
      setNameError(null);
      return;
    }

    try {
      await onRename(editName.trim());
      setIsEditing(false);
      setNameError(null);
    } catch {
      setNameError('Failed to rename entity');
    }
  }, [editName, entity.entityName, onRename]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } catch {
      setIsDeleting(false);
    }
  }, [onDelete]);

  const handleCopy = useCallback(() => {
    onCopyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopyToClipboard]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditName(entity.entityName);
    setNameError(null);
  }, [entity.entityName]);

  const hashScanUrl = useMemo(() => {
    const network = config?.hedera?.network || 'testnet';
    const baseUrl = `https://hashscan.io/${network}`;

    switch (entity.entityType) {
      case 'topicId':
        return `${baseUrl}/topic/${entity.entityId}`;
      case 'tokenId':
        return `${baseUrl}/token/${entity.entityId}`;
      case 'accountId':
        return `${baseUrl}/account/${entity.entityId}`;
      case 'scheduleId':
        return `${baseUrl}/schedule/${entity.entityId}`;
      case 'contract':
        return `${baseUrl}/contract/${entity.entityId}`;
      default:
        return `${baseUrl}/entity/${entity.entityId}`;
    }
  }, [entity.entityId, entity.entityType, config?.hedera?.network]);

  const formatDate = useCallback((date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 7) {
      return formatDistanceToNow(d, { addSuffix: true });
    }

    return format(d, 'MMM d, yyyy');
  }, []);

  const parseMetadata = useCallback(() => {
    if (!entity.metadata) return null;

    try {
      return JSON.parse(entity.metadata);
    } catch {
      return null;
    }
  }, [entity.metadata]);

  const metadata = parseMetadata();

  return (
    <motion.article
      id={id}
      role='article'
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className={cn(
        'group relative bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50',
        'backdrop-blur-xl shadow-sm hover:shadow-lg transition-all duration-300',
        'focus:ring-2 focus:ring-hgo-blue focus:outline-none',
        isSelected && 'ring-2 ring-hgo-blue bg-hgo-blue/5',
        !entity.isActive && 'opacity-60'
      )}
    >
      {/* Selection overlay */}
      {isSelected && (
        <div className='absolute inset-0 bg-gradient-to-r from-hgo-blue/10 to-hgo-purple/10 rounded-xl' />
      )}

      <div className='relative p-4'>
        {/* Header */}
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-start space-x-3 flex-1 min-w-0'>
            <div className='flex items-center justify-center pt-1'>
              <input
                type='checkbox'
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
                className='w-4 h-4 text-hgo-blue bg-gray-100 border-gray-300 rounded focus:ring-hgo-blue focus:ring-2'
                aria-label={`Select ${entity.entityName}`}
              />
            </div>

            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                'bg-gradient-to-br shadow-sm text-white',
                entity.entityType === 'topicId' && 'from-blue-500 to-blue-600',
                entity.entityType === 'tokenId' &&
                  'from-green-500 to-green-600',
                entity.entityType === 'accountId' &&
                  'from-purple-500 to-purple-600',
                entity.entityType === 'scheduleId' &&
                  'from-hgo-purple to-purple-600',
                entity.entityType === 'contractId' &&
                  'from-hgo-dark to-purple-600',
                entity.entityType === 'other' && 'from-gray-500 to-gray-600'
              )}
            >
              <EntityIcon entityType={entity.entityType} />
            </div>

            <div className='flex-1 min-w-0 space-y-2'>
              {isEditing ? (
                <div className='space-y-2'>
                  <input
                    type='text'
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className='w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-2 focus:ring-hgo-blue focus:outline-none'
                    autoFocus
                  />
                  {nameError && (
                    <Typography
                      variant='body2'
                      className='text-red-600 dark:text-red-400'
                    >
                      {nameError}
                    </Typography>
                  )}
                  <div className='flex space-x-2'>
                    <button
                      onClick={handleRename}
                      className='p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded'
                      aria-label='Save name'
                    >
                      <HiOutlineCheck className='w-4 h-4' />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className='p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'
                      aria-label='Cancel rename'
                    >
                      <HiOutlineX className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <Typography
                    variant='h3'
                    className='font-semibold text-gray-900 dark:text-white truncate'
                  >
                    {entity.entityName}
                  </Typography>
                  <div className='flex items-center space-x-2 mt-1'>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        entity.entityType === 'topicId' &&
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
                        entity.entityType === 'tokenId' &&
                          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                        entity.entityType === 'accountId' &&
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
                        entity.entityType === 'scheduleId' &&
                          'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
                        entity.entityType === 'contractId' &&
                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
                        ![
                          'topicId',
                          'tokenId',
                          'accountId',
                          'scheduleId',
                          'contractId',
                        ].includes(entity.entityType) &&
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      )}
                    >
                      {entity.entityType}
                    </span>
                    {!entity.isActive && (
                      <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'>
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className='flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity'>
              <button
                onClick={() => setIsEditing(true)}
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors'
                aria-label='Rename entity'
              >
                <HiOutlinePencil className='w-4 h-4' />
              </button>
              <button
                onClick={handleCopy}
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors'
                aria-label='Copy entity ID'
              >
                {copied ? (
                  <HiOutlineCheck className='w-4 h-4 text-green-500' />
                ) : (
                  <HiOutlineClipboard className='w-4 h-4' />
                )}
              </button>
              <a
                href={hashScanUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors'
                aria-label='View on HashScan'
              >
                <HiOutlineExternalLink className='w-4 h-4' />
              </a>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className='p-2 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                aria-label='Delete entity'
              >
                <HiOutlineTrash className='w-4 h-4' />
              </button>
            </div>
          )}
        </div>

        {/* Entity details */}
        <div className='space-y-2'>
          <div className='flex items-center space-x-2'>
            <Typography
              variant='body2'
              className='text-gray-500 dark:text-gray-400 font-mono text-sm'
            >
              {entity.entityId}
            </Typography>
          </div>

          {entity.transactionId && (
            <div className='flex items-center space-x-2'>
              <Typography
                variant='body2'
                className='text-gray-400 dark:text-gray-500 text-xs'
              >
                Transaction: {entity.transactionId}
              </Typography>
            </div>
          )}

          {metadata && entity.entityType === 'tokenId' && (
            <div className='flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400'>
              {metadata.symbol && (
                <span className='font-medium text-gray-700 dark:text-gray-300'>
                  {metadata.symbol}
                </span>
              )}
              {metadata.decimals && <span>{metadata.decimals} decimals</span>}
              {metadata.totalSupply && (
                <span>
                  {parseInt(metadata.totalSupply).toLocaleString()} total supply
                </span>
              )}
            </div>
          )}

          <div className='flex items-center justify-between text-xs text-gray-400 dark:text-gray-500'>
            <div className='flex items-center space-x-4'>
              <span>{formatDate(entity.createdAt)}</span>
              {entity.sessionId && (
                <span>{entity.sessionId || 'No session'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className='absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm'>
          <div className='bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm mx-4 shadow-xl'>
            <Typography variant='h4' className='font-semibold mb-2'>
              Delete Entity
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-600 dark:text-gray-300 mb-4'
            >
              Are you sure you want to delete this entity? This action cannot be
              undone.
            </Typography>
            <div className='flex space-x-2 justify-end'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className='px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className='px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 flex items-center space-x-2'
              >
                {isDeleting ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isDeleting && !showDeleteConfirm && (
        <div className='absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center backdrop-blur-sm'>
          <div
            className='w-8 h-8 border-2 border-[#5599fe] border-t-transparent rounded-full animate-spin'
            aria-label='Loading'
          />
        </div>
      )}
    </motion.article>
  );
};
