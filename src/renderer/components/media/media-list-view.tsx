import React, { useCallback } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { MediaItem, SortField, SortOrder } from './library-types';

interface MediaListViewProps {
  items: MediaItem[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onPreview: (item: MediaItem) => void;
  onCopyTopic: (topic: string) => void;
  onSelect?: (item: MediaItem) => void;
  isDark: boolean;
}

const MediaListView: React.FC<MediaListViewProps> = ({ items, sortField, sortOrder, onSort, onPreview, onCopyTopic, onSelect, isDark }) => {
  const toggleSort = useCallback(
    (field: SortField) => {
      onSort(field);
    },
    [onSort],
  );

  return (
    <div className='flex h-full flex-col'>
      <div
        className={cn(
          'grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] items-center border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-300',
          isDark ? 'border-white/20 bg-[#141f3d] text-white/80' : 'border-gray-200 bg-gray-50 text-gray-600'
        )}
        role='rowgroup'
      >
        <button type='button' onClick={() => toggleSort('name')} className='text-left'>
          Name {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
        </button>
        <div data-testid='media-list-header-topic'>Topic ID</div>
        <button type='button' onClick={() => toggleSort('type')} className='justify-self-end text-right'>
          Type {sortField === 'type' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
        </button>
      </div>
      <div
        className={cn('flex-1 overflow-y-auto', isDark ? 'bg-[#0a152f]' : 'bg-white')}
        role='rowgroup'
      >
        {items.map((item) => {
          const handleRowClick = () => {
            onPreview(item);
          };
          const handleCopy = (event: React.MouseEvent) => {
            event.stopPropagation();
            onCopyTopic(item.topic);
          };
          const handleUse = (event: React.MouseEvent) => {
            event.stopPropagation();
            onSelect?.(item);
            onCopyTopic(item.topic);
          };
          return (
            <div
              key={item.id}
              data-testid={`media-list-item-${item.id}`}
              onClick={handleRowClick}
              className={cn(
                'grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] items-center border-b px-4 py-3 text-sm transition-colors duration-150',
                isDark
                  ? 'border-white/15 bg-[#141f3d] text-white hover:bg-blue-500/20'
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-blue-50'
              )}
            >
              <div className='font-medium break-words'>{item.name}</div>
              <div className='flex items-center gap-3 justify-self-start'>
                <span
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide',
                    isDark ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {item.topic}
                </span>
                <button
                  type='button'
                  onClick={handleCopy}
                  className={cn('hover:text-blue-400', isDark ? 'text-blue-300' : 'text-blue-600')}
                  aria-label='Copy topic id'
                >
                  <Copy className='h-3.5 w-3.5' />
                </button>
              </div>
              <div className='flex items-center gap-2 justify-self-end text-right'>
                <span className={cn('text-xs uppercase tracking-wide', isDark ? 'text-white/70' : 'text-gray-600')}>
                  {item.mimeType || 'Unknown'}
                </span>
                <Button
                  size='sm'
                  variant='ghost'
                  className={cn('px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide', isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500')}
                  onClick={handleUse}
                  aria-label='Use topic id'
                >
                  Use
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { MediaListView };
