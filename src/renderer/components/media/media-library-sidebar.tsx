import React, { useMemo } from 'react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { getMediaType, type FilterType, type MediaItem } from './library-types';
import {
  Image as ImageIcon,
  Play,
  Volume2,
  FileText,
  FileJson,
} from 'lucide-react';

const FILTER_OPTIONS: Array<{ key: FilterType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'all', label: 'All Items', icon: ImageIcon },
  { key: 'image', label: 'Images', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: Play },
  { key: 'audio', label: 'Audio', icon: Volume2 },
  { key: 'text', label: 'Documents', icon: FileText },
  { key: 'code', label: 'Code', icon: FileText },
  { key: 'json', label: 'JSON', icon: FileJson },
];

interface SidebarButtonProps {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  isDark: boolean;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ label, count, icon: Icon, isActive, onClick, isDark }) => (
  <button
    type='button'
    onClick={onClick}
    className={cn(
      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : isDark
          ? 'text-white/80 hover:bg-white/10'
          : 'text-gray-700 hover:bg-blue-50'
    )}
  >
    <span className='flex items-center gap-2'>
      <Icon className='h-4 w-4' />
      {label}
    </span>
    <Badge
      variant='secondary'
      className={cn(
        'text-[0.65rem] uppercase tracking-widest',
        isActive
          ? isDark ? 'bg-white/25 text-blue-900' : 'bg-white text-blue-700'
          : isDark ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-600'
      )}
    >
      {count}
    </Badge>
  </button>
);

interface MediaSidebarProps {
  items: MediaItem[];
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  isDark: boolean;
}

const MediaSidebar: React.FC<MediaSidebarProps> = ({ items, filter, onFilterChange, isDark }) => {
  const counts = useMemo(() => {
    const base: Record<FilterType, number> = {
      all: items.length,
      image: 0,
      video: 0,
      audio: 0,
      text: 0,
      code: 0,
      json: 0,
    };
    items.forEach((item) => {
      const type = getMediaType(item.mimeType, item.name);
      if (type !== 'all') {
        base[type] += 1;
      }
    });
    return base;
  }, [items]);

  return (
    <aside
      className={cn(
        'w-56 border-r px-3 py-5 transition-colors duration-300',
        isDark ? 'border-white/20 bg-[#141f3d]' : 'border-gray-200 bg-white'
      )}
    >
      <div className='space-y-2'>
        {FILTER_OPTIONS.map((option) => (
          <SidebarButton
            key={option.key}
            label={option.label}
            icon={option.icon}
            count={option.key === 'all' ? counts.all : counts[option.key]}
            isActive={filter === option.key}
            onClick={() => onFilterChange(option.key)}
            isDark={isDark}
          />
        ))}
      </div>
    </aside>
  );
};

export { MediaSidebar };
