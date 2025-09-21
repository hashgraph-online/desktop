import React from 'react';
import { getLogoForUrl } from '../../utils/logoMapper';

interface Bookmark {
  label: string;
  url: string;
  description?: string;
}

interface BookmarkBarProps {
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
}

const BookmarkItem: React.FC<{
  bookmark: Bookmark;
  onNavigate: (url: string) => void;
}> = ({ bookmark, onNavigate }) => {
  const logo = getLogoForUrl(bookmark.url);

  return (
    <button
      type='button'
      onClick={() => onNavigate(bookmark.url)}
      className='group flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all duration-200'
    >
      <div className='flex-shrink-0'>
        {logo && logo.light ? (
          <div className='w-8 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center p-1'>
            <img
              src={logo.light}
              alt={`${bookmark.label} logo`}
              className='w-full h-full object-contain'
              draggable={false}
            />
          </div>
        ) : (
          <div className='w-8 h-8 rounded-md bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center'>
            <span className='text-brand-blue font-semibold text-xs'>
              {bookmark.label.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className='flex-1 text-left min-w-0'>
        <div className='text-gray-900 font-medium text-sm truncate' style={{ fontFamily: 'Roboto, sans-serif' }}>
          {bookmark.label}
        </div>
        <div className='text-gray-500 text-xs truncate mt-0.5' style={{ fontFamily: 'Roboto, sans-serif' }}>
          {new URL(bookmark.url).hostname}
        </div>
      </div>
    </button>
  );
};

const BookmarkBar: React.FC<BookmarkBarProps> = ({ bookmarks, onNavigate }) => {
  return (
    <div>
      <div className='mb-4'>
        <h3 className='text-gray-900 text-sm font-semibold mb-1' style={{ fontFamily: 'Roboto, sans-serif' }}>
          Quick Access
        </h3>
        <p className='text-gray-500 text-xs' style={{ fontFamily: 'Roboto, sans-serif' }}>
          Hedera ecosystem apps
        </p>
      </div>
      <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'>
        {bookmarks.map((bookmark) => (
          <BookmarkItem
            key={bookmark.url}
            bookmark={bookmark}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};

export default BookmarkBar;