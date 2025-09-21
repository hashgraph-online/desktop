import React from 'react';
import { Columns3, Grid3X3, List, RefreshCw, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ViewMode } from './library-types';

const VIEW_OPTIONS: Array<{ key: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'icons', label: 'Icons', icon: Grid3X3 },
  { key: 'list', label: 'List', icon: List },
  { key: 'columns', label: 'Columns', icon: Columns3 },
];

interface ToolbarButtonProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  isDark: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, icon: Icon, isActive, onClick, isDark }) => (
  <button
    type='button'
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-150',
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : isDark
        ? 'text-white/70 hover:bg-white/10'
        : 'text-gray-600 hover:bg-blue-100'
    )}
    aria-label={`${label} view`}
  >
    <Icon className='h-3.5 w-3.5' />
    {label}
  </button>
);

interface MediaToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (view: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  isDark: boolean;
}

const MediaToolbar: React.FC<MediaToolbarProps> = ({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  itemCount,
  onRefresh,
  isRefreshing,
  isDark,
}) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-4 border-b px-5 py-4 text-sm transition-colors duration-300',
      isDark ? 'border-white/15 bg-[#101d3f] text-white' : 'border-gray-200 bg-white text-gray-700'
    )}
  >
    <div data-testid='media-toolbar-search' className='flex min-w-[240px] flex-1 items-center md:max-w-sm' role='search'>
      <label htmlFor='media-library-search' className='sr-only'>Search library</label>
      <div className='relative w-full'>
        <Search
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
            isDark ? 'text-white/50' : 'text-gray-400'
          )}
          aria-hidden
        />
        <input
          id='media-library-search'
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder='Search by name or topic'
          className={cn(
            'w-full rounded-full border px-9 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30',
            isDark
              ? 'border-white/25 bg-[#1a2750] text-white placeholder:text-white/50'
              : 'border-gray-300 bg-white text-gray-800 placeholder:text-gray-400'
          )}
          aria-label='Search library'
        />
      </div>
    </div>

    <div
      data-testid='media-toolbar-view-toggle'
      className={cn(
        'flex items-center gap-2 rounded-full px-2 py-1 shadow-sm transition-colors duration-300',
        isDark ? 'bg-[#1a2750]' : 'bg-gray-100'
      )}
    >
      {VIEW_OPTIONS.map((option) => (
        <ToolbarButton
          key={option.key}
          isDark={isDark}
          label={option.label}
          icon={option.icon}
          isActive={viewMode === option.key}
          onClick={() => onViewModeChange(option.key)}
        />
      ))}
    </div>

    <div
      className={cn(
        'flex items-center gap-3 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-sm transition-colors duration-300',
        isDark ? 'bg-[#1a2750] text-white/80' : 'bg-gray-100 text-gray-600'
      )}
    >
      <span aria-live='polite'>{itemCount} items</span>
      <button
        type='button'
        onClick={onRefresh}
        disabled={isRefreshing}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
          isDark
            ? 'border-white/25 text-white/75 hover:border-white/50 hover:text-white'
            : 'border-gray-300 text-gray-600 hover:border-blue-600 hover:text-blue-600'
        )}
        aria-label='Refresh inscriptions'
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
      </button>
    </div>
  </div>
);

export { MediaToolbar, VIEW_OPTIONS };
