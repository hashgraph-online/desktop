import React, { useCallback } from 'react';
import { cn } from '../../../lib/utils';
import type { Bookmark } from './constants';

interface BookmarkBarProps {
  bookmarks: Bookmark[];
  isDark: boolean;
  onSelect: (url: string) => void;
}

const BookmarkBar: React.FC<BookmarkBarProps> = ({ bookmarks, isDark, onSelect }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 py-1 border-b text-xs transition-colors duration-300 flex-shrink-0',
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200'
      )}
    >
      {bookmarks.map((bookmark) => (
        <BookmarkButton
          key={bookmark.url}
          bookmark={bookmark}
          onSelect={onSelect}
          isDark={isDark}
        />
      ))}
    </div>
  );
};

export default BookmarkBar;

interface BookmarkButtonProps {
  bookmark: Bookmark;
  onSelect: (url: string) => void;
  isDark: boolean;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({ bookmark, onSelect, isDark }) => {
  const handleClick = useCallback(() => {
    onSelect(bookmark.url);
  }, [bookmark.url, onSelect]);

  return (
    <button
      type='button'
      onClick={handleClick}
      className={cn(
        'px-2 py-1 rounded transition-colors truncate max-w-24',
        isDark
          ? 'text-gray-300 hover:bg-orange-900/30 hover:text-orange-200 hover:border hover:border-orange-500/50'
          : 'text-gray-700 hover:bg-orange-50 hover:text-orange-800 hover:border hover:border-orange-200'
      )}
      style={{ fontFamily: 'Roboto, sans-serif' }}
      aria-label={
        bookmark.description
          ? `${bookmark.label}: ${bookmark.description}`
          : bookmark.label
      }
    >
      {bookmark.label}
    </button>
  );
};
