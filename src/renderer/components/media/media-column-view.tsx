import React, { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { getMediaType, type MediaItem } from './library-types';
import { MediaPreviewCard } from './media-icon-grid';

interface MediaColumnViewProps {
  items: MediaItem[];
  selection: string | null;
  onSelectionChange: (id: string) => void;
  onCopyTopic: (topic: string) => void;
  onSelect?: (item: MediaItem) => void;
  isDark: boolean;
}

const MediaColumnView: React.FC<MediaColumnViewProps> = ({ items, selection, onSelectionChange, onCopyTopic, onSelect, isDark }) => {
  const activeItem = useMemo(() => items.find((item) => item.id === selection) ?? items[0] ?? null, [items, selection]);
  const activeMediaType = activeItem ? getMediaType(activeItem.mimeType, activeItem.name) : null;
  const [previewText, setPreviewText] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!selection && items.length > 0) {
      onSelectionChange(items[0].id);
    }
  }, [items, onSelectionChange, selection]);

  useEffect(() => {
    if (!activeItem) {
      setPreviewText('');
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const type = getMediaType(activeItem.mimeType, activeItem.name);
    if (type !== 'text' && type !== 'code' && type !== 'json') {
      setPreviewText('');
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);

    fetch(activeItem.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Preview failed (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setPreviewText(text.slice(0, 4000));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : 'Unable to load preview');
          setPreviewText('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeItem]);

  return (
    <div className={cn('flex h-full transition-colors duration-300', isDark ? 'bg-[#0a152f]' : 'bg-white')}>
      <div className={cn('w-64 border-r px-3 py-4 transition-colors duration-300', isDark ? 'border-white/20 bg-[#141f3d]' : 'border-gray-200 bg-white')}>
        <div className='flex flex-col gap-2'>
          {items.map((item) => {
            const isActive = activeItem?.id === item.id;
            return (
              <button
                key={item.id}
                type='button'
                data-testid='media-column-item'
                onClick={() => onSelectionChange(item.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark
                      ? 'text-white/80 hover:bg-white/10'
                      : 'text-gray-700 hover:bg-blue-50'
                )}
              >
                <span className='truncate'>{item.name}</span>
                <span className='text-[0.65rem] uppercase tracking-wide text-white/70'>
                  {isActive ? 'Active' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={cn('flex flex-1 flex-col gap-4 p-6 transition-colors duration-300', isDark ? 'bg-[#0a152f]' : 'bg-white')} data-testid='media-column-preview'>
        {activeItem ? (
          <>
            <MediaPreviewCard item={activeItem} isDark={isDark} />
            <div className={cn('rounded-2xl border p-4 shadow-sm transition-colors duration-300', isDark ? 'border-white/20 bg-[#141f3d]' : 'border-gray-200 bg-white')}>
              <Typography variant='h5' className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {activeItem.name}
              </Typography>
              <div className='mt-3 flex flex-wrap items-center gap-3 text-sm'>
                <span className={cn('rounded-md px-2 py-1 font-semibold uppercase tracking-wide', isDark ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-700')}>
                  Topic ID {activeItem.topic}
                </span>
                <Button
                  size='sm'
                  variant='ghost'
                  className={cn('flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide', isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500')}
                  onClick={() => onCopyTopic(activeItem.topic)}
                  aria-label='Copy topic id'
                >
                  <Copy className='h-3.5 w-3.5' />
                  Copy Topic ID
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  className={cn('flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide', isDark ? 'border-white/20 text-white/80 hover:border-white/40' : 'border-gray-300 text-gray-700 hover:border-blue-600')}
                  onClick={() => {
                    onSelect?.(activeItem);
                    onCopyTopic(activeItem.topic);
                  }}
                  aria-label='Use topic id'
                >
                  Use in Doc
                </Button>
              </div>
              <div className={cn('mt-4 text-xs uppercase tracking-[0.25em]', isDark ? 'text-white/70' : 'text-gray-600')}>
                {activeMediaType}
              </div>
              {activeMediaType && ['text', 'code', 'json'].includes(activeMediaType) ? (
                <div className={cn('mt-4 rounded-lg border p-3 text-xs', isDark ? 'border-white/25 bg-[#1e2b54] text-white/80' : 'border-gray-200 bg-gray-50 text-gray-800')}>
                  {isPreviewLoading ? (
                    <Typography variant='body2' className={cn('text-sm', isDark ? 'text-white/70' : 'text-gray-500')}>
                      Loading preview…
                    </Typography>
                  ) : previewError ? (
                    <Typography
                      variant='body2'
                      className={cn('text-sm', isDark ? 'text-red-300' : 'text-red-500')}
                    >
                      {previewError}
                    </Typography>
                  ) : (
                    <pre className='max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5'>{previewText || 'No preview available.'}</pre>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className={cn('flex h-full items-center justify-center rounded-2xl border border-dashed text-sm transition-colors duration-300', isDark ? 'border-white/20 bg-[#141f3d] text-white/70' : 'border-gray-300 bg-white text-gray-600')}>
            <div className='text-center'>
              <Typography variant='body2' className='text-sm font-medium'>
                Select an inscription to preview
              </Typography>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { MediaColumnView };
