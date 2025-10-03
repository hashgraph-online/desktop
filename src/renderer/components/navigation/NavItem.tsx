import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { FiChevronLeft } from 'react-icons/fi';
import { IconType } from 'react-icons';

interface NavSubItem {
  id: string;
  path: string;
  label: string;
  icon: IconType;
  description?: string;
  gradient?: string;
}

interface NavItemType {
  id: string;
  path: string;
  label: string;
  icon: IconType;
  description?: string;
  gradient?: string;
  iconBg?: string;
  subItems?: NavSubItem[];
}

interface NavigationState {
  [key: string]: boolean;
}

interface NavItemProps {
  item: NavItemType;
  isActive: (path: string) => boolean;
  isCollapsed: boolean;
  expandedSections?: NavigationState;
  onToggleSection?: (sectionId: string) => void;
}

/**
 * Navigation item component for the sidebar
 */
const NavItem = React.memo<NavItemProps>(
  ({ item, isActive, isCollapsed, expandedSections = {}, onToggleSection }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedSections[item.id];

    if (item.id === 'help' || item.id === 'telegram') {
      const href =
        item.id === 'help' ? 'https://docs.hashgraphonline.com' : item.path;
      return (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className={cn(
            'group relative flex items-center gap-4 rounded-2xl transition-all duration-300',
            isCollapsed ? 'px-4 py-4 justify-center' : 'px-4 py-3.5',
            !isCollapsed && 'hover:translate-x-1',
            'hover:scale-[1.02]',
            'hover:bg-gray-100/50 dark:hover:bg-white/5'
          )}
          title={isCollapsed ? item.label : undefined}
        >
          <div
            className={cn(
              'rounded-lg flex items-center justify-center transition-all duration-200',
              isCollapsed ? 'w-12 h-12' : 'w-10 h-10',
              `bg-gradient-to-br ${
                item.iconBg ||
                'from-gray-100/50 to-gray-200/50 dark:from-white/5 dark:to-white/10'
              }`,
              'group-hover:scale-110 group-hover:shadow-lg'
            )}
          >
            <Icon className='w-5 h-5 text-white transition-all duration-300' />
          </div>

          {!isCollapsed && (
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-semibold text-gray-900 dark:text-white leading-tight font-mono tracking-wide group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text transition-all duration-300'>
                {item.label}
              </div>
              {item.description && (
                <div className='text-xs text-gray-500 dark:text-gray-400 leading-tight font-mono opacity-75 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-300'>
                  {item.description}
                </div>
              )}
            </div>
          )}
        </a>
      );
    }

    if (hasSubItems) {
      const handleToggle = () => {
        onToggleSection?.(item.id);
      };

      return (
        <div>
          <button
            onClick={handleToggle}
            className={cn(
              'group relative flex items-center gap-4 rounded-2xl transition-all duration-300 w-full',
              isCollapsed ? 'px-4 py-4 justify-center' : 'px-4 py-3.5',
              !isCollapsed && 'hover:translate-x-1',
              'hover:scale-[1.02]',
              'hover:bg-gray-100/50 dark:hover:bg-white/5'
            )}
            title={isCollapsed ? item.label : undefined}
          >
            <div
              className={cn(
                'relative rounded-xl flex items-center justify-center transition-all duration-300',
                'before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-300',
                isCollapsed ? 'w-12 h-12' : 'w-10 h-10',
                'group-hover:before:opacity-100 group-hover:shadow-lg'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-xl transition-all duration-300',
                  `bg-gradient-to-br ${item.gradient || 'from-[#5599fe] to-[#a679f0]'} opacity-70`,
                  'group-hover:scale-110 group-hover:rotate-3 group-hover:opacity-100'
                )}
              />
              <Icon
                className={cn(
                  'relative z-10 w-5 h-5 transition-all duration-300 text-white',
                  'group-hover:scale-110'
                )}
              />
            </div>

            {!isCollapsed && (
              <div className='flex-1 min-w-0 flex items-center justify-between'>
                <div>
                  <div
                    className={cn(
                      'text-sm font-semibold leading-tight font-mono tracking-wide',
                      'text-gray-900 dark:text-white',
                      'group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text'
                    )}
                  >
                    {item.label}
                  </div>
                  {item.description && (
                    <div
                      className={cn(
                        'text-xs leading-tight font-mono opacity-75 transition-colors duration-300',
                        'text-gray-500 dark:text-gray-400',
                        'group-hover:text-gray-600 dark:group-hover:text-gray-300'
                      )}
                    >
                      {item.description}
                    </div>
                  )}
                </div>
                <FiChevronLeft
                  className={cn(
                    'w-4 h-4 transition-transform text-gray-400 dark:text-gray-500',
                    isExpanded ? 'rotate-90' : 'rotate-0'
                  )}
                />
              </div>
            )}
          </button>

          {isExpanded && !isCollapsed && item.subItems && (
            <div className='ml-6 mt-2 space-y-1'>
              {item.subItems.map((subItem) => (
                <Link
                  key={subItem.id}
                  to={subItem.path}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl transition-all duration-300 px-3 py-2',
                    'hover:translate-x-1 hover:scale-[1.02]',
                    isActive(subItem.path)
                      ? 'bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg'
                      : 'hover:bg-gray-100/50 dark:hover:bg-white/5'
                  )}
                >
                  {isActive(subItem.path) && (
                    <div className='absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#a679f0] via-[#5599fe] to-[#48df7b] rounded-r-full' />
                  )}

                  <div
                    className={cn(
                      'relative rounded-lg flex items-center justify-center transition-all duration-300 w-8 h-8',
                      isActive(subItem.path)
                        ? `bg-gradient-to-br ${subItem.gradient || 'from-[#5599fe] to-[#a679f0]'} text-white shadow-lg shadow-[#5599fe]/20`
                        : `bg-gradient-to-br ${subItem.gradient || 'from-[#5599fe] to-[#a679f0]'} opacity-60 text-white group-hover:opacity-90 group-hover:scale-110`
                    )}
                  >
                    <subItem.icon className='w-4 h-4' />
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div
                      className={cn(
                        'text-sm font-medium leading-tight font-mono',
                        isActive(subItem.path)
                          ? 'text-transparent bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text'
                          : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                      )}
                    >
                      {subItem.label}
                    </div>
                    {subItem.description && (
                      <div
                        className={cn(
                          'text-xs leading-tight font-mono opacity-75 transition-colors duration-300',
                          isActive(subItem.path)
                            ? 'text-gray-600 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                        )}
                      >
                        {subItem.description}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        to={item.path}
        className={cn(
          'group relative flex items-center gap-4 rounded-2xl transition-all duration-300',
          isCollapsed ? 'px-4 py-4 justify-center' : 'px-4 py-3.5',
          !isCollapsed && 'hover:translate-x-1',
          'hover:scale-[1.02]',
          active &&
            'bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg'
        )}
        title={isCollapsed ? item.label : undefined}
      >
        {active && (
          <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-[#a679f0] via-[#5599fe] to-[#48df7b] rounded-r-full shadow-[0_0_20px_rgba(85,153,254,0.8)]' />
        )}

        <div
          className={cn(
            'relative rounded-xl flex items-center justify-center transition-all duration-300',
            'before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-300',
            isCollapsed ? 'w-12 h-12' : 'w-10 h-10',
            active
              ? `before:opacity-100 before:bg-gradient-to-br ${
                  item.gradient || 'from-[#5599fe] to-[#a679f0]'
                } text-white shadow-2xl shadow-[#5599fe]/30`
              : '',
            !active && 'group-hover:before:opacity-100 group-hover:shadow-lg'
          )}
        >
          <div
            className={cn(
              'absolute inset-0 rounded-xl transition-all duration-300',
              active
                ? `bg-gradient-to-br ${
                    item.gradient || 'from-[#5599fe] to-[#a679f0]'
                  }`
                : `bg-gradient-to-br ${
                    item.gradient || 'from-[#5599fe] to-[#a679f0]'
                  } opacity-70`,
              !active &&
                'group-hover:scale-110 group-hover:rotate-3 group-hover:opacity-100'
            )}
          />
          <Icon
            className={cn(
              'relative z-10 w-5 h-5 transition-all duration-300 text-white',
              !active && 'group-hover:scale-110'
            )}
          />
        </div>

        {!isCollapsed && (
          <div className='flex-1 min-w-0'>
            <div
              className={cn(
                'text-sm font-semibold leading-tight font-mono tracking-wide',
                active
                  ? 'text-transparent bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text'
                  : 'text-gray-900 dark:text-white',
                !active &&
                  'group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text'
              )}
            >
              {item.label}
            </div>
            {item.description && (
              <div
                className={cn(
                  'text-xs leading-tight font-mono opacity-75 transition-colors duration-300',
                  active
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-500 dark:text-gray-400',
                  !active &&
                    'group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              >
                {item.description}
              </div>
            )}
          </div>
        )}
      </Link>
    );
  }
);

NavItem.displayName = 'NavItem';

export default NavItem;