import React, { useCallback } from 'react';
import { Copy, Volume2, Play, FileText, FileJson } from 'lucide-react';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { getMediaType, type MediaItem } from './library-types';

const MediaPreviewCard: React.FC<{ item: MediaItem; isDark: boolean }> = ({ item, isDark }) => {
  const mediaType = getMediaType(item.mimeType, item.name);
  const baseClass = isDark ? 'border-white/25 bg-[#1c2a55]' : 'border-gray-200 bg-white';

  if (mediaType === 'image') {
    return (
      <div className={cn('relative h-40 w-full overflow-hidden rounded-xl shadow-sm', baseClass)}>
        <img src={item.url} alt={item.name} className='h-full w-full object-cover' />
      </div>
    );
  }

  const Icon = mediaType === 'video' ? Play : mediaType === 'audio' ? Volume2 : mediaType === 'json' ? FileJson : FileText;

  return (
    <div className={cn('flex h-40 w-full items-center justify-center rounded-xl shadow-inner', baseClass)}>
      <Icon className={cn('h-10 w-10', isDark ? 'text-white/70' : 'text-gray-600')} />
    </div>
  );
};

interface MediaCardProps {
  item: MediaItem;
  onPreview: (item: MediaItem) => void;
  onCopyTopic: (topic: string) => void;
  onSelect?: (item: MediaItem) => void;
  isDark: boolean;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onPreview, onCopyTopic, onSelect, isDark }) => {
  const handleSelect = useCallback(() => {
    onPreview(item);
  }, [item, onPreview]);

  const handleUse = useCallback(() => {
    onSelect?.(item);
    onCopyTopic(item.topic);
  }, [item, onCopyTopic, onSelect]);

  const handleCopy = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onCopyTopic(item.topic);
    },
    [item.topic, onCopyTopic],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelect();
      }
    },
    [handleSelect],
  );

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40',
        isDark ? 'border-white/20 bg-[#152046]' : 'border-gray-200 bg-white'
      )}
    >
      <MediaPreviewCard item={item} isDark={isDark} />
      <div className='flex flex-col gap-1'>
        <Typography
          variant='body1'
          className={cn('text-base font-semibold leading-snug break-words', isDark ? 'text-white' : 'text-gray-900')}
        >
          {item.name}
        </Typography>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide',
            isDark ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-600'
          )}
        >
          <span className='truncate'>Topic ID {item.topic}</span>
          <button
            type='button'
            onClick={handleCopy}
            className={cn('hover:text-blue-400', isDark ? 'text-blue-300' : 'text-blue-600')}
            aria-label='Copy topic id'
          >
            <Copy className='h-3.5 w-3.5' />
          </button>
        </div>
      </div>
      <div className='mt-1 flex items-center justify-between text-xs'>
        <span className={cn(isDark ? 'text-white/70' : 'text-gray-600')}>{item.mimeType || 'Unknown type'}</span>
        <Button
          size='sm'
          variant='ghost'
          className={cn(
            'px-2 py-1 text-xs font-semibold uppercase tracking-wide',
            isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'
          )}
          onClick={(event) => {
            event.stopPropagation();
            handleUse();
          }}
          aria-label='Use topic id'
        >
          Use
        </Button>
      </div>
    </div>
  );
};

export { MediaCard, MediaPreviewCard };
