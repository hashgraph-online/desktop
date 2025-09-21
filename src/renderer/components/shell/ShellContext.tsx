import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { HiChatBubbleLeftRight, HiGlobeAlt, HiWrenchScrewdriver, HiMagnifyingGlass, HiLink, HiServerStack, HiPuzzlePiece, HiCog6Tooth, HiUserCircle, HiPhoto, HiHeart } from 'react-icons/hi2';
import { FiTool } from 'react-icons/fi';
import type { IconType } from 'react-icons';

export type ShellWindowKey =
  | 'chat'
  | 'browser'
  | 'builder'
  | 'discover'
  | 'connections'
  | 'mcp'
  | 'plugins'
  | 'tools'
  | 'settings'
  | 'profile'
  | 'media'
  | 'acknowledgements';

export interface ShellWindowDefinition {
  key: ShellWindowKey;
  title: string;
  route: string;
  icon: IconType;
  label: string;
}

export interface ShellWindowMetadata {
  label: string;
  icon: IconType;
  iconUrl?: string | null;
}

interface ShellContextValue {
  activeWindow: ShellWindowKey | null;
  openWindows: ShellWindowKey[];
  registerWindow(key: ShellWindowKey, metadata?: Partial<ShellWindowMetadata>): void;
  unregisterWindow(key: ShellWindowKey): void;
  setActiveWindow(key: ShellWindowKey | null): void;
  windowStates: Partial<Record<ShellWindowKey, unknown>>;
  setWindowState(key: ShellWindowKey, value: unknown): void;
  clearWindowState(key: ShellWindowKey): void;
  minimizedWindows: ShellWindowKey[];
  minimizeWindow(key: ShellWindowKey): void;
  restoreWindow(key: ShellWindowKey): void;
  getWindowState<T = unknown>(key: ShellWindowKey): T | undefined;
  isWindowMinimized(key: ShellWindowKey): boolean;
  windowMetadata: Record<ShellWindowKey, ShellWindowMetadata>;
  setWindowMetadata(key: ShellWindowKey, metadata: Partial<ShellWindowMetadata>): void;
  resetWindowMetadata(key: ShellWindowKey): void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export const SHELL_WINDOWS: Record<ShellWindowKey, ShellWindowDefinition> = {
  chat: {
    key: 'chat',
    title: 'Chat Agent',
    route: '/chat',
    icon: HiChatBubbleLeftRight,
    label: 'Chat Agent',
  },
  browser: {
    key: 'browser',
    title: 'Moonscape',
    route: '/browser',
    icon: HiGlobeAlt,
    label: 'Moonscape',
  },
  media: {
    key: 'media',
    title: 'Media Library',
    route: '/media',
    icon: HiPhoto,
    label: 'Media Library',
  },
  builder: {
    key: 'builder',
    title: 'Builder Studio',
    route: '/builder',
    icon: HiWrenchScrewdriver,
    label: 'Builder Studio',
  },
  discover: {
    key: 'discover',
    title: 'Discover',
    route: '/discover',
    icon: HiMagnifyingGlass,
    label: 'Discover',
  },
  connections: {
    key: 'connections',
    title: 'Connections',
    route: '/connections',
    icon: HiLink,
    label: 'Connections',
  },
  mcp: {
    key: 'mcp',
    title: 'MCP Servers',
    route: '/mcp',
    icon: HiServerStack,
    label: 'MCP Servers',
  },
  plugins: {
    key: 'plugins',
    title: 'Plugins',
    route: '/plugins',
    icon: HiPuzzlePiece,
    label: 'Plugins',
  },
  tools: {
    key: 'tools',
    title: 'Tools',
    route: '/tools',
    icon: FiTool,
    label: 'Tools',
  },
  settings: {
    key: 'settings',
    title: 'Settings',
    route: '/settings',
    icon: HiCog6Tooth,
    label: 'Settings',
  },
  profile: {
    key: 'profile',
    title: 'My Profile',
    route: '/hcs10-profile',
    icon: HiUserCircle,
    label: 'My Profile',
  },
  acknowledgements: {
    key: 'acknowledgements',
    title: 'Acknowledgements',
    route: '/acknowledgements',
    icon: HiHeart,
    label: 'Acknowledgements',
  },
};

const BASE_WINDOW_METADATA: Record<ShellWindowKey, ShellWindowMetadata> = Object.keys(
  SHELL_WINDOWS
).reduce((acc, rawKey) => {
  const key = rawKey as ShellWindowKey;
  const definition = SHELL_WINDOWS[key];
  acc[key] = {
    label: definition.label,
    icon: definition.icon,
    iconUrl: null,
  };
  return acc;
}, {} as Record<ShellWindowKey, ShellWindowMetadata>);

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWindow, setActiveWindow] = useState<ShellWindowKey | null>(null);
  const [openWindows, setOpenWindows] = useState<ShellWindowKey[]>([]);
  const [windowStates, setWindowStates] = useState<Partial<Record<ShellWindowKey, unknown>>>(
    {}
  );
  const [minimizedWindows, setMinimizedWindows] = useState<ShellWindowKey[]>([]);
  const [windowMetadata, setWindowMetadataState] = useState<Record<ShellWindowKey, ShellWindowMetadata>>(
    BASE_WINDOW_METADATA
  );

  const registerWindow = useCallback((key: ShellWindowKey, metadata?: Partial<ShellWindowMetadata>) => {
    setOpenWindows((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setMinimizedWindows((prev) => prev.filter((value) => value !== key));
    setActiveWindow(key);
    if (metadata && Object.keys(metadata).length > 0) {
      setWindowMetadataState((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? BASE_WINDOW_METADATA[key]),
          ...metadata,
        },
      }));
    }
  }, []);

  const unregisterWindow = useCallback((key: ShellWindowKey) => {
    setOpenWindows((prev) => prev.filter((value) => value !== key));
    setMinimizedWindows((prev) => prev.filter((value) => value !== key));
    setActiveWindow((current) => {
      if (current === key) {
        return null;
      }
      return current;
    });
  }, []);

  const setWindowState = useCallback((key: ShellWindowKey, value: unknown) => {
    setWindowStates((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearWindowState = useCallback((key: ShellWindowKey) => {
    setWindowStates((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((key: ShellWindowKey) => {
    setMinimizedWindows((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setActiveWindow((current) => {
      if (current === key) {
        return null;
      }
      return current;
    });
  }, []);

  const restoreWindow = useCallback((key: ShellWindowKey) => {
    setMinimizedWindows((prev) => prev.filter((value) => value !== key));
    setActiveWindow(key);
  }, []);

  const getWindowState = useCallback(
    <T,>(key: ShellWindowKey): T | undefined => {
      return windowStates[key] as T | undefined;
    },
    [windowStates]
  );

  const isWindowMinimized = useCallback(
    (key: ShellWindowKey) => minimizedWindows.includes(key),
    [minimizedWindows]
  );

  const setWindowMetadata = useCallback(
    (key: ShellWindowKey, metadata: Partial<ShellWindowMetadata>) => {
      setWindowMetadataState((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? BASE_WINDOW_METADATA[key]),
          ...metadata,
        },
      }));
    },
    []
  );

  const resetWindowMetadata = useCallback((key: ShellWindowKey) => {
    setWindowMetadataState((prev) => ({
      ...prev,
      [key]: BASE_WINDOW_METADATA[key],
    }));
  }, []);

  const value = useMemo(
    () => ({
      activeWindow,
      openWindows,
      registerWindow,
      unregisterWindow,
      setActiveWindow,
      windowStates,
      setWindowState,
      clearWindowState,
      minimizedWindows,
      minimizeWindow,
      restoreWindow,
      getWindowState,
      isWindowMinimized,
      windowMetadata,
      setWindowMetadata,
      resetWindowMetadata,
    }),
    [
      activeWindow,
      openWindows,
      registerWindow,
      unregisterWindow,
      windowStates,
      setWindowState,
      clearWindowState,
      minimizedWindows,
      minimizeWindow,
      restoreWindow,
      getWindowState,
      isWindowMinimized,
      windowMetadata,
      setWindowMetadata,
      resetWindowMetadata,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};

export const useShell = (): ShellContextValue => {
  const context = useContext(ShellContext);
  if (context === null) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
};
