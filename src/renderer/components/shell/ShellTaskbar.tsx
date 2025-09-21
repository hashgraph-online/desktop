import React, { useCallback, KeyboardEvent, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IconType } from 'react-icons';
import {
  HiChatBubbleBottomCenterText,
  HiGlobeAlt,
  HiWrenchScrewdriver,
  HiMagnifyingGlass,
  HiLink,
  HiServerStack,
  HiPhoto,
} from 'react-icons/hi2';
import { cn } from '../../lib/utils';
import { SHELL_WINDOWS, useShell } from './ShellContext';
import type { ShellWindowKey, ShellWindowMetadata } from './ShellContext';
import { useConfigStore } from '../../stores/configStore';

interface ShellTaskbarProps {
  currentTimeLabel: string;
  currentDateLabel: string;
}

interface DockItem {
  label: string;
  route: string;
  icon: IconType;
  key: ShellWindowKey;
}

interface OpenWindowItem {
  key: ShellWindowKey;
  label: string;
  icon: IconType;
  iconUrl?: string | null;
  route: string;
  isMinimized: boolean;
}

const DOCK_ITEMS: DockItem[] = [
  {
    label: 'Chat Agent',
    route: SHELL_WINDOWS.chat.route,
    icon: HiChatBubbleBottomCenterText,
    key: 'chat',
  },
  {
    label: 'Moonscape',
    route: SHELL_WINDOWS.browser.route,
    icon: HiGlobeAlt,
    key: 'browser',
  },
  {
    label: 'Media Library',
    route: SHELL_WINDOWS.media.route,
    icon: HiPhoto,
    key: 'media',
  },
  {
    label: 'Agent Directory',
    route: SHELL_WINDOWS.discover.route,
    icon: HiMagnifyingGlass,
    key: 'discover',
  },
  {
    label: 'Connections',
    route: SHELL_WINDOWS.connections.route,
    icon: HiLink,
    key: 'connections',
  },
  {
    label: 'MCP Servers',
    route: SHELL_WINDOWS.mcp.route,
    icon: HiServerStack,
    key: 'mcp',
  },
];

const DOCK_KEY_SET = new Set<ShellWindowKey>(
  DOCK_ITEMS.map((item) => item.key)
);

const isActivationKey = (event: KeyboardEvent<HTMLButtonElement>): boolean => {
  return event.key === 'Enter' || event.key === ' ';
};

interface DockButtonProps {
  item: DockItem;
  isActive: boolean;
  isMinimized: boolean;
  onNavigate(route: string, key: ShellWindowKey): void;
  metadata?: ShellWindowMetadata;
  isDark: boolean;
}

interface DockButtonProps {
  item: DockItem;
  isActive: boolean;
  isMinimized: boolean;
  onNavigate(route: string, key: ShellWindowKey): void;
  metadata?: ShellWindowMetadata;
  isDark: boolean;
}

const DockButton: React.FC<DockButtonProps> = ({
  item,
  isActive,
  isMinimized,
  onNavigate,
  metadata,
  isDark,
}) => {
  const handleNavigate = useCallback(() => {
    onNavigate(item.route, item.key);
  }, [item.route, item.key, onNavigate]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (isActivationKey(event)) {
        event.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate]
  );

  const Icon = metadata?.icon ?? item.icon;
  const iconUrl = metadata?.iconUrl ?? null;
  const displayLabel = metadata?.label ?? item.label;

  return (
    <button
      type='button'
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      aria-label={displayLabel}
      className={cn(
        'group relative flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
        isActive
          ? 'scale-105 bg-blue-500 shadow-lg focus-visible:ring-white/70'
          : isDark
            ? 'bg-white/10 hover:bg-white/20 hover:scale-105 focus-visible:ring-white/60'
            : 'bg-white/70 border border-gray-200 hover:bg-white hover:scale-105 shadow-sm focus-visible:ring-blue-500/40',
        isMinimized ? 'opacity-70' : 'opacity-100'
      )}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={displayLabel}
          className='h-6 w-6 rounded object-cover transition-all duration-200'
        />
      ) : (
        <Icon
          className={cn(
            'h-6 w-6 transition-all duration-200',
            isDark
              ? isActive
                ? 'text-white'
                : 'text-white/80'
              : isActive
                ? 'text-brand-ink'
                : 'text-brand-ink/70'
          )}
          aria-hidden='true'
        />
      )}
      <div
        className={cn(
          'absolute -bottom-2 h-1 w-6 rounded-full transition-all duration-300',
          isDark
            ? isActive
              ? 'bg-white/80'
              : 'bg-white/40'
            : isActive
              ? 'bg-brand-blue/70'
              : 'bg-brand-blue/40'
        )}
      />
    </button>
  );
};

export const ShellTaskbar: React.FC<ShellTaskbarProps> = ({
  currentTimeLabel,
  currentDateLabel,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeWindow,
    minimizedWindows,
    restoreWindow,
    setActiveWindow,
    openWindows,
    windowMetadata,
  } = useShell();
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';

  const activeRoute = useMemo(() => location.pathname, [location.pathname]);

  const handleNavigate = useCallback(
    (route: string, key: ShellWindowKey) => {
      const wasMinimized = minimizedWindows.includes(key);
      if (wasMinimized) {
        restoreWindow(key);
      }
      setActiveWindow(key);
      navigate(route);
    },
    [minimizedWindows, navigate, restoreWindow, setActiveWindow]
  );

  const openWindowItems = useMemo<OpenWindowItem[]>(() => {
    return openWindows
      .map((key) => {
        const isMinimized = minimizedWindows.includes(key);
        if (DOCK_KEY_SET.has(key) && !isMinimized) {
          return null;
        }
        const definition = SHELL_WINDOWS[key];
        const metadata = windowMetadata[key];
        if (!definition || !metadata) {
          return null;
        }
        return {
          key,
          label: metadata.label,
          icon: metadata.icon,
          iconUrl: metadata.iconUrl ?? null,
          route: definition.route,
          isMinimized,
        } as OpenWindowItem;
      })
      .filter((value): value is OpenWindowItem => Boolean(value));
  }, [minimizedWindows, openWindows, windowMetadata]);

  const handleOpenWindowClick = useCallback(
    (key: ShellWindowKey, route: string) => {
      handleNavigate(route, key);
    },
    [handleNavigate]
  );

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-4'>
      <div className='mx-auto w-fit'>
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2.5 backdrop-blur-md transition-all duration-300',
            isDark
              ? 'border border-white/30 bg-white/15 shadow-lg shadow-black/30'
              : 'border border-gray-200 bg-white/90 shadow-lg shadow-gray-300/50'
          )}
        >
          <div className='flex items-center gap-2'>
            {DOCK_ITEMS.map((item) => (
              <DockButton
                key={item.key}
                item={item}
                isActive={
                  activeWindow === item.key ||
                  activeRoute.startsWith(item.route)
                }
                isMinimized={minimizedWindows.includes(item.key)}
                onNavigate={handleNavigate}
                metadata={windowMetadata[item.key]}
                isDark={isDark}
              />
            ))}
          </div>
          {openWindowItems.length > 0 ? (
            <>
              <div
                className={cn(
                  'h-8 w-px mx-1',
                  isDark ? 'bg-white/20' : 'bg-gray-300'
                )}
              />
              <div className='flex items-center gap-2'>
                {openWindowItems.map((item) => {
                  const {
                    key,
                    label,
                    icon: ItemIcon,
                    iconUrl,
                    route,
                    isMinimized,
                  } = item;
                  return (
                    <button
                      key={key}
                      type='button'
                      onClick={() => handleOpenWindowClick(key, route)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-200',
                        isDark
                          ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                          : 'border border-brand-blue/20 bg-white/90 text-brand-ink hover:bg-white',
                        activeWindow === key &&
                          (isDark ? 'bg-white/25' : 'bg-brand-blue/10'),
                        isMinimized && 'opacity-70'
                      )}
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={label}
                          className='h-4 w-4 rounded-sm object-cover'
                        />
                      ) : (
                        <ItemIcon
                          className={cn(
                            'h-4 w-4',
                            isDark ? 'text-white' : 'text-brand-ink'
                          )}
                          aria-hidden='true'
                        />
                      )}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ShellTaskbar;
