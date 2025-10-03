import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Typography from '../ui/Typography';
import { MediaModal } from './MediaModal';
import type { InscriptionJob } from '../../hooks/useInscriptionJobs';
import {
  normalizeTopic,
  mapToMediaItem,
  getMediaType,
  type MediaItem,
  type ViewMode,
  type SortField,
  type SortOrder,
  type FilterType,
} from './library-types';
import { MediaToolbar } from './media-library-toolbar';
import { MediaSidebar } from './media-library-sidebar';
import { MediaCard } from './media-icon-grid';
import { MediaListView } from './media-list-view';
import { MediaColumnView } from './media-column-view';
import { cn } from '../../lib/utils';
import { useConfigStore } from '../../stores/configStore';

interface MediaLibraryProps {
  jobs: InscriptionJob[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  network: 'mainnet' | 'testnet';
  onRefresh: () => void;
  onSelect?: (job: InscriptionJob) => void;
  emptyMessage?: string;
  className?: string;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({
  jobs,
  isLoading,
  error,
  hasLoaded,
  network,
  onRefresh,
  onSelect,
  emptyMessage = 'No media files yet — inscribe something magical.',
  className,
}) => {
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';
  const [viewMode, setViewMode] = useState<ViewMode>('icons');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [columnSelection, setColumnSelection] = useState<string | null>(null);
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);

  const mediaItems = useMemo(() => jobs.map((job) => mapToMediaItem(job, network)), [jobs, network]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return mediaItems
      .filter((item) => {
        const matchesFilter = filter === 'all' ? true : getMediaType(item.mimeType, item.name) === filter;
        if (!matchesFilter) {
          return false;
        }
        if (!term) {
          return true;
        }
        return item.name.toLowerCase().includes(term) || item.topic.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'name') {
          return a.name.localeCompare(b.name) * factor;
        }
        const typeA = a.mimeType ?? '';
        const typeB = b.mimeType ?? '';
        return typeA.localeCompare(typeB) * factor;
      });
  }, [filter, mediaItems, searchQuery, sortField, sortOrder]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField],
  );

  const handleCopyTopic = useCallback(async (topic: string) => {
    const normalized = `hcs://1/${normalizeTopic(topic)}`;
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalized).catch((): void => undefined);
      setCopiedTopic(normalized);
    }
  }, []);

  useEffect(() => {
    if (!copiedTopic) {
      return;
    }
    const timeout = window.setTimeout(() => setCopiedTopic(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [copiedTopic]);

  const handlePreview = useCallback((item: MediaItem) => {
    setSelectedItem(item);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const forwardSelection = useCallback(
    (media: MediaItem) => {
      if (!onSelect) {
        return;
      }
      const match = jobs.find((entry) => entry.id === media.id);
      if (match) {
        onSelect(match);
      }
    },
    [jobs, onSelect],
  );

  const loadingState = isLoading && filteredItems.length === 0;
  const showEmptyState = hasLoaded && !loadingState && filteredItems.length === 0 && !error;

  return (
    <div className={cn(className, isDark ? 'h-full w-full text-white' : 'h-full w-full text-gray-900')}>
      <div
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-desktop-lg border shadow-sm transition-colors duration-300',
          isDark ? 'border-white/10 bg-[#0f1b39]' : 'border-gray-200 bg-white'
        )}
      >
        <MediaToolbar
          isDark={isDark}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          itemCount={filteredItems.length}
          onRefresh={onRefresh}
          isRefreshing={isLoading}
        />

        <div className='flex flex-1 min-h-0'>
          <MediaSidebar isDark={isDark} items={filteredItems} filter={filter} onFilterChange={setFilter} />

          <div
            className={cn(
              'relative flex-1 min-h-0 overflow-hidden transition-colors duration-300',
              isDark ? 'bg-[#0a142d]' : 'bg-white'
            )}
          >
            {copiedTopic ? (
              <div
                className={cn(
                  'absolute right-6 top-6 z-10 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] shadow-sm',
                  isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                )}
              >
                Copied {copiedTopic}
              </div>
            ) : null}

            {loadingState ? (
              <div className='flex h-full items-center justify-center'>
                <Typography
                  variant='body2'
                  className={cn('text-sm font-medium', isDark ? 'text-white/75' : 'text-gray-600')}
                >
                  Loading your inscriptions…
                </Typography>
              </div>
            ) : null}

            {error ? (
              <div className='flex h-full items-center justify-center'>
                <Typography
                  variant='body2'
                  className={cn('text-sm font-medium', isDark ? 'text-red-300' : 'text-red-500')}
                >
                  {error}
                </Typography>
              </div>
            ) : null}

            {showEmptyState ? (
              <div className='flex h-full items-center justify-center'>
                <div
                  className={cn(
                    'rounded-desktop-lg border border-dashed px-10 py-12 text-center shadow-sm transition-colors duration-300',
                    isDark ? 'border-white/20 text-white/80' : 'border-gray-300 text-gray-700'
                  )}
                >
                  <Typography variant='body2' className='text-lg font-semibold'>
                    {emptyMessage}
                  </Typography>
                </div>
              </div>
            ) : null}

            {!loadingState && !error && filteredItems.length > 0 ? (
              <div className='h-full w-full'>
                {viewMode === 'icons' ? (
                  <div className='h-full overflow-y-auto px-6 py-6'>
                    <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
                      {filteredItems.map((item) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          onPreview={handlePreview}
                          onCopyTopic={handleCopyTopic}
                          onSelect={(media) => {
                            forwardSelection(media);
                          }}
                          isDark={isDark}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {viewMode === 'list' ? (
                  <MediaListView
                    isDark={isDark}
                    items={filteredItems}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onPreview={handlePreview}
                    onCopyTopic={handleCopyTopic}
                    onSelect={forwardSelection}
                  />
                ) : null}

                {viewMode === 'columns' ? (
                  <MediaColumnView
                    isDark={isDark}
                    items={filteredItems}
                    selection={columnSelection}
                    onSelectionChange={setColumnSelection}
                    onCopyTopic={handleCopyTopic}
                    onSelect={forwardSelection}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <MediaModal item={selectedItem} isOpen={Boolean(selectedItem)} onClose={handleModalClose} />
    </div>
  );
};

export { MediaLibrary };

export type { MediaLibraryProps };
