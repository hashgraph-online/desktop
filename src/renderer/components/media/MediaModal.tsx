import React, { useCallback, useState, useEffect } from 'react';
import { X, Download, Copy, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import { useConfigStore } from '../../stores/configStore';

interface MediaItem {
  id: string;
  topic: string;
  name: string;
  mimeType: string | null;
  type: string | null;
  network: 'mainnet' | 'testnet';
  createdAt: Date | null;
  url: string;
}

interface MediaModalProps {
  item: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
}

type MediaType = 'image' | 'video' | 'audio' | 'text' | 'code' | 'json' | 'unknown';

const getMediaType = (mimeType: string | null, filename: string): MediaType => {
  const mime = mimeType?.toLowerCase() || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/json' || ext === 'json') {
    return 'json';
  }
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt'];
  if (mime.startsWith('text/') && codeExtensions.includes(ext) || codeExtensions.includes(ext)) {
    return 'code';
  }
  if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'log'].includes(ext)) {
    return 'text';
  }
  return 'unknown';
};

/**
 * Content renderer for different media types in the modal
 */
const MediaContent: React.FC<{ item: MediaItem; isDark: boolean }> = ({ item, isDark }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mediaType = getMediaType(item.mimeType, item.name);

  useEffect(() => {
    const loadContent = async () => {
      if (mediaType === 'text' || mediaType === 'code' || mediaType === 'json') {
        try {
          setIsLoading(true);
          setError(null);
          const response = await fetch(item.url);
          if (!response.ok) {
            throw new Error(`Failed to load content: ${response.statusText}`);
          }
          const text = await response.text();
          setContent(text);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load content');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [item.url, mediaType]);

  const handleImageLoad = useCallback(() => setIsLoading(false), []);
  const handleImageError = useCallback(() => {
    setError('Failed to load image');
    setIsLoading(false);
  }, []);

  if (error) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <Typography variant='h6' className={cn('mb-2 text-red-500', isDark && 'text-red-300')}>
            Error Loading Content
          </Typography>
          <Typography variant='body2' className={cn(isDark ? 'text-white/70' : 'text-gray-500')}>
            {error}
          </Typography>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='mx-auto mb-2 h-8 w-8 animate-spin text-orange-500' />
          <Typography variant='body2' className={cn(isDark ? 'text-white/70' : 'text-gray-500')}>
            Loading content...
          </Typography>
        </div>
      </div>
    );
  }

  switch (mediaType) {
    case 'image':
      return (
        <div className='flex h-full items-center justify-center p-4'>
          <img
            src={item.url}
            alt={item.name}
            className='max-w-full max-h-full object-contain rounded-lg shadow-lg'
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>
      );

    case 'video':
      return (
        <div className='flex h-full items-center justify-center p-4'>
          <video
            src={item.url}
            controls
            className='max-w-full max-h-full rounded-lg shadow-lg'
            onLoadedData={() => setIsLoading(false)}
            onError={() => setError('Failed to load video')}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );

    case 'audio':
      return (
        <div className='flex h-full items-center justify-center p-8'>
          <div className='w-full max-w-md text-center'>
            <Typography variant='h5' className='mb-6'>
              {item.name}
            </Typography>
            <audio
              src={item.url}
              controls
              className='w-full'
              onLoadedData={() => setIsLoading(false)}
              onError={() => setError('Failed to load audio')}
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      );

    case 'text':
    case 'code':
      return (
        <div className='h-full overflow-auto p-6'>
          <pre
            className={cn(
              'whitespace-pre-wrap rounded-lg border p-4 font-mono text-sm leading-relaxed',
              isDark ? 'border-white/20 bg-[#1e2b54] text-white/80' : 'border-gray-200 bg-gray-50 text-gray-900'
            )}
          >
            {content}
          </pre>
        </div>
      );

    case 'json':
      return (
        <div className='h-full overflow-auto p-6'>
          <pre
            className={cn(
              'whitespace-pre rounded-lg border p-4 font-mono text-sm leading-relaxed',
              isDark ? 'border-white/20 bg-[#1e2b54] text-white/80' : 'border-gray-200 bg-gray-50 text-gray-900'
            )}
          >
            {JSON.stringify(JSON.parse(content), null, 2)}
          </pre>
        </div>
      );

    default:
      return (
        <div className='flex items-center justify-center h-full'>
          <div className='text-center'>
            <Typography variant='h6' className='text-gray-500 mb-2'>
              Preview not available
            </Typography>
            <Typography variant='body2' className='text-gray-400 mb-4'>
              This file type cannot be previewed
            </Typography>
            <Button
              onClick={() => window.open(item.url, '_blank')}
              variant='outline'
            >
              Open Externally
            </Button>
          </div>
        </div>
      );
  }
};

/**
 * Full-screen modal for viewing media content
 */
export const MediaModal: React.FC<MediaModalProps> = ({ item, isOpen, onClose }) => {
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';
  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item) return;

    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.name;
    link.click();
  }, [item]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item) return;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(item.url);
      } catch {
        // Failed to copy - ignore
      }
    }
  }, [item]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-300',
        isDark ? 'bg-[#020617]/95' : 'bg-black/90'
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'relative h-full w-full max-w-7xl max-h-full overflow-hidden rounded-lg shadow-2xl transition-colors duration-300',
          isDark ? 'border border-white/15 bg-[#0b182f]' : 'border border-gray-200 bg-white'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between border-b px-4 py-3 transition-colors duration-300',
            isDark ? 'border-white/15 bg-[#111f3d]' : 'border-gray-200 bg-white'
          )}
        >
          <div className='flex-1 min-w-0'>
            <Typography variant='h6' className={cn('font-medium truncate', isDark ? 'text-white' : 'text-gray-900')}>
              {item.name}
            </Typography>
            <Typography
              variant='body2'
              className={cn('mt-1 text-sm', isDark ? 'text-white/70' : 'text-gray-500')}
            >
              {item.mimeType || 'Unknown type'}{item.createdAt ? ` • ${item.createdAt.toLocaleDateString()}` : ''}
            </Typography>
          </div>

          <div className='ml-4 flex items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={handleDownload}
              className={cn('flex items-center gap-2', isDark ? 'border-white/30 text-white hover:border-white/50' : '')}
            >
              <Download className='w-4 h-4' />
              Download
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={handleCopy}
              className={cn('flex items-center gap-2', isDark ? 'border-white/30 text-white hover:border-white/50' : '')}
            >
              <Copy className='w-4 h-4' />
              Copy URL
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={onClose}
              className={cn('flex items-center gap-2', isDark ? 'border-white/30 text-white hover:border-white/50' : '')}
            >
              <X className='w-4 h-4' />
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className={cn('flex-1 h-full overflow-hidden transition-colors duration-300', isDark ? 'bg-[#0b182f]' : 'bg-white')} style={{ height: 'calc(100% - 80px)' }}>
          <MediaContent item={item} isDark={isDark} />
        </div>
      </div>
    </div>
  );
};

export default MediaModal;
