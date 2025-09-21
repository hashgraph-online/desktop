import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRightCircle,
  FiRotateCw,
  FiMessageSquare,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import BrowserAssistantPanel from './BrowserAssistantPanel';
import moonscapeLogo from '../../../../assets/moonscape-logo.png';
import ShellWindow, { useShellWindowControls } from './ShellWindow';
import { SHELL_WINDOWS, useShell } from './ShellContext';
import { useConfigStore } from '../../stores/configStore';
import type { BrowserState } from '@/types/electron';

const DEFAULT_URL = 'https://hedera.kiloscribe.com';
const SAFE_PROTOCOL = /^(https?:|ipfs:|ipns:|file:)/i;

type AssistantDock = 'right' | 'left' | 'bottom';

const MIN_ASSISTANT_WIDTH = 320;
const MAX_ASSISTANT_WIDTH = 560;
const MIN_ASSISTANT_HEIGHT = 260;
const MAX_ASSISTANT_HEIGHT = 520;
const DEFAULT_ASSISTANT_WIDTH = 392;
const DEFAULT_ASSISTANT_HEIGHT = 320;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const normalizeUrl = (value: string): string => {
  if (!value) {
    return DEFAULT_URL;
  }
  const trimmed = value.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

interface Bookmark {
  label: string;
  url: string;
  description?: string;
}

const BOOKMARKS: Bookmark[] = [
  {
    label: 'KiloScribe',
    url: 'https://hedera.kiloscribe.com',
    description: 'On-chain file storage and NFT platform',
  },
  {
    label: 'SaucerSwap',
    url: 'https://saucerswap.finance',
    description: 'Decentralized exchange on Hedera',
  },
  {
    label: 'Bonzo Finance',
    url: 'https://bonzo.finance',
    description: 'DeFi lending and borrowing platform',
  },
  {
    label: 'hGraph.io',
    url: 'https://hgraph.com',
    description: 'Hedera network explorer and analytics',
  },
  {
    label: 'SentX',
    url: 'https://sentx.io',
    description: 'Hedera wallet and DeFi services',
  },
];

interface BookmarkButtonProps {
  bookmark: Bookmark;
  onSelect: (url: string) => void;
  isDark: boolean;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  bookmark,
  onSelect,
  isDark,
}) => {
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

type TrafficLightVariant = 'close' | 'minimize' | 'maximize';

const TRAFFIC_LIGHT_COLORS: Record<
  TrafficLightVariant,
  { background: string; iconColor: string }
> = {
  close: {
    background: 'bg-red-500 hover:bg-red-500/90',
    iconColor: 'text-white',
  },
  minimize: {
    background: 'bg-yellow-400 hover:bg-yellow-400/90',
    iconColor: 'text-brand-ink',
  },
  maximize: {
    background: 'bg-green-500 hover:bg-green-500/90',
    iconColor: 'text-white',
  },
};

interface TrafficLightProps {
  variant: TrafficLightVariant;
  onClick: () => void;
  isExpanded?: boolean;
}

const TrafficLightButton: React.FC<TrafficLightProps> = ({
  variant,
  onClick,
  isExpanded = false,
}) => {
  const { background, iconColor } = TRAFFIC_LIGHT_COLORS[variant];

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex h-[16px] w-[16px] items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        background
      )}
      aria-label={
        variant === 'close'
          ? 'Close browser'
          : variant === 'minimize'
            ? 'Minimize browser'
            : isExpanded
              ? 'Restore browser size'
              : 'Maximize browser'
      }
      title={
        variant === 'close'
          ? 'Close'
          : variant === 'minimize'
            ? 'Minimize'
            : isExpanded
              ? 'Restore'
              : 'Maximize'
      }
    >
      <svg
        className={cn('h-[12px] w-[12px] text-current', iconColor)}
        viewBox='0 0 16 16'
        aria-hidden='true'
      >
        {variant === 'close' ? (
          <>
            <line
              x1='4'
              y1='4'
              x2='12'
              y2='12'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
            <line
              x1='12'
              y1='4'
              x2='4'
              y2='12'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
          </>
        ) : null}
        {variant === 'minimize' ? (
          <line
            x1='4'
            y1='8'
            x2='12'
            y2='8'
            stroke='currentColor'
            strokeWidth='1.8'
            strokeLinecap='round'
          />
        ) : null}
        {variant === 'maximize' ? (
          isExpanded ? (
            <rect
              x='4.5'
              y='4.5'
              width='7'
              height='7'
              rx='1.6'
              stroke='currentColor'
              strokeWidth='1.4'
              fill='none'
            />
          ) : (
            <>
              <line
                x1='8'
                y1='4'
                x2='8'
                y2='12'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
              <line
                x1='4'
                y1='8'
                x2='12'
                y2='8'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </>
          )
        ) : null}
      </svg>
    </button>
  );
};

const initialBrowserState: BrowserState = {
  requestedUrl: DEFAULT_URL,
  currentUrl: DEFAULT_URL,
  title: '',
  isLoading: true,
  canGoBack: false,
  canGoForward: false,
  lastError: null,
};

type PageContext = {
  title: string;
  description: string;
  selection: string;
  text: string;
  favicons: string[];
};

const PAGE_CONTEXT_SCRIPT = String.raw`
(() => {
  const obtainSelection = () => {
    try {
      const raw = window.getSelection ? window.getSelection().toString() : '';
      return raw || '';
    } catch (error) {
      return '';
    }
  };

  const meta = document.querySelector('meta[name="description"]');
  const description = meta && typeof meta.content === 'string' ? meta.content : '';

  let textContent = '';
  try {
    textContent = document.body ? document.body.innerText || '' : '';
  } catch (error) {
    textContent = '';
  }

  let computedTitle = '';
  try {
    computedTitle = document.title || '';
  } catch (error) {
    computedTitle = '';
  }

  const iconLinks = Array.from(
    document.querySelectorAll(
      'link[rel~=\"icon\"], link[rel=\"shortcut icon\"], link[rel=\"apple-touch-icon\"], link[rel=\"apple-touch-icon-precomposed\"], link[rel=\"mask-icon\"]'
    )
  )
    .map((link) => link.href || link.getAttribute('href') || '')
    .filter(Boolean);

  return {
    title: computedTitle,
    description,
    selection: obtainSelection(),
    text: textContent,
    favicons: iconLinks,
  };
})();
`;

const FAVICON_SCRIPT = String.raw`
(() =>
  Array.from(
    document.querySelectorAll(
      'link[rel~=\"icon\"], link[rel=\"shortcut icon\"], link[rel=\"apple-touch-icon\"], link[rel=\"apple-touch-icon-precomposed\"], link[rel=\"mask-icon\"]'
    )
  )
    .map((link) => link.href || link.getAttribute('href') || '')
    .filter(Boolean)
)();
`;

const isBrowserState = (value: unknown): value is BrowserState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<BrowserState>;
  if (typeof candidate.requestedUrl !== 'string') {
    return false;
  }
  if (typeof candidate.currentUrl !== 'string') {
    return false;
  }
  if (typeof candidate.title !== 'string') {
    return false;
  }
  if (typeof candidate.isLoading !== 'boolean') {
    return false;
  }
  if (typeof candidate.canGoBack !== 'boolean') {
    return false;
  }
  if (typeof candidate.canGoForward !== 'boolean') {
    return false;
  }
  if (
    !(typeof candidate.lastError === 'string' || candidate.lastError === null)
  ) {
    return false;
  }
  return true;
};

const BrowserSurface: React.FC = () => {
  const [browserState, setBrowserState] =
    useState<BrowserState>(initialBrowserState);
  const [inputValue, setInputValue] = useState<string>(
    initialBrowserState.requestedUrl
  );
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantSessionId, setAssistantSessionId] = useState<string | null>(
    null
  );
  const [assistantDock, setAssistantDock] = useState<AssistantDock>('right');
  const [assistantWidth, setAssistantWidth] = useState<number>(
    DEFAULT_ASSISTANT_WIDTH
  );
  const [assistantHeight, setAssistantHeight] = useState<number>(
    DEFAULT_ASSISTANT_HEIGHT
  );
  const browserContainerRef = useRef<HTMLDivElement | null>(null);
  const isDarkTheme = useConfigStore((state) => state.config?.advanced?.theme === 'dark');
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const isMinimizedRef = useRef(false);
  const assistantResizeStateRef = useRef<{
    orientation: 'horizontal' | 'vertical';
    direction: 1 | -1;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
  } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { minimize, close, toggleExpand, isExpanded, isMinimized } =
    useShellWindowControls();
  const { setWindowMetadata, resetWindowMetadata, windowMetadata } = useShell();
  const browserMetadata = windowMetadata.browser;

  const applyBounds = useCallback(() => {
    const api = window.electron?.browser;
    const container = browserContainerRef.current;
    if (!api || !container) {
      return;
    }
    if (isMinimizedRef.current) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.max(Math.round(rect.width), 0),
      height: Math.max(Math.round(rect.height), 0),
    };
    void api.setBounds(bounds);
  }, []);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    const api = window.electron?.browser;
    if (!api) {
      return;
    }
    void api.attach().then(() => {
      applyBounds();
    });
    return () => {
      void api.detach();
    };
  }, [applyBounds]);

  useEffect(() => {
    const api = window.electron?.browser;
    if (!api) {
      return;
    }
    if (isMinimized) {
      void api.detach();
      return;
    }
    void api.attach().then(() => {
      applyBounds();
    });
  }, [isMinimized, applyBounds]);

  useEffect(() => {
    const container = browserContainerRef.current;
    const api = window.electron?.browser;
    if (!container || !api) {
      return;
    }
    applyBounds();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        applyBounds();
      });
      observer.observe(container);
    }
    window.addEventListener('resize', applyBounds);
    return () => {
      window.removeEventListener('resize', applyBounds);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [applyBounds]);

  useEffect(() => {
    if (!isAssistantOpen) {
      return;
    }
    applyBounds();
  }, [
    applyBounds,
    isAssistantOpen,
    assistantDock,
    assistantHeight,
    assistantWidth,
  ]);

  useEffect(() => {
    if (isAssistantOpen) {
      return;
    }
    assistantResizeStateRef.current = null;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
  }, [isAssistantOpen]);

  const handleBrowserStateUpdate = useCallback((state: BrowserState) => {
    setBrowserState(state);
    const nextValue = state.requestedUrl || state.currentUrl || DEFAULT_URL;
    const activeElement = document.activeElement;
    if (activeElement === urlInputRef.current) {
      return;
    }
    setInputValue(nextValue);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      const api = window.electron?.browser;
      if (!api) {
        return;
      }
      try {
        const initialState = await api.getState();
        if (active && isBrowserState(initialState)) {
          handleBrowserStateUpdate(initialState);
        }
      } catch {
        if (active) {
          setBrowserState(initialBrowserState);
        }
      }
      unsubscribe = api.onState((state) => {
        if (!active) {
          return;
        }
        if (isBrowserState(state)) {
          handleBrowserStateUpdate(state);
        }
      });
    };

    void subscribe();

    return () => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleBrowserStateUpdate]);

  useEffect(() => {
    let label = browserState.title.trim();
    let fallbackIconUrl: string | null = null;
    const icon = SHELL_WINDOWS.browser.icon;
    try {
      const url = new URL(browserState.currentUrl);
      fallbackIconUrl = `${url.origin}/favicon.ico`;
      if (!label) {
        label = url.hostname;
      }
    } catch {
      fallbackIconUrl = null;
    }
    if (!label) {
      label = SHELL_WINDOWS.browser.label;
    }
    setWindowMetadata('browser', { label, icon });
    if (!browserMetadata?.iconUrl && fallbackIconUrl) {
      setWindowMetadata('browser', { iconUrl: fallbackIconUrl });
    }
  }, [
    browserMetadata?.iconUrl,
    browserState.currentUrl,
    browserState.title,
    setWindowMetadata,
  ]);

  useEffect(() => {
    return () => {
      if (!isMinimizedRef.current) {
        resetWindowMetadata('browser');
      }
    };
  }, [resetWindowMetadata]);

  const collectFavicons = useCallback(async () => {
    const api = window.electron?.browser;
    if (!api) {
      return;
    }
    try {
      const favicons = await api.executeJavaScript<string[] | null>(
        FAVICON_SCRIPT
      );
      if (Array.isArray(favicons) && favicons.length > 0) {
        const resolvedIcon = favicons
          .map((entry) => {
            if (typeof entry !== 'string' || entry.trim().length === 0) {
              return null;
            }
            try {
              return new URL(entry, browserState.currentUrl).href;
            } catch {
              return entry;
            }
          })
          .find((value) => value && value.trim().length > 0);
        if (resolvedIcon) {
          setWindowMetadata('browser', { iconUrl: resolvedIcon });
        }
      }
    } catch {
      return;
    }
  }, [browserState.currentUrl, setWindowMetadata]);

  useEffect(() => {
    if (browserState.isLoading) {
      return;
    }
    void collectFavicons();
  }, [browserState.isLoading, collectFavicons]);

  const handleShellMinimize = useCallback(() => {
    const api = window.electron?.browser;
    if (api) {
      void api.detach();
    }
    minimize();
  }, [minimize]);

  const handleShellToggleExpand = useCallback(() => {
    toggleExpand();
  }, [toggleExpand]);

  const handleShellClose = useCallback(() => {
    const api = window.electron?.browser;
    if (api) {
      void api.detach();
    }
    close();
  }, [close]);

  const openExternal = useCallback((targetUrl: string) => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(targetUrl).catch((): void => undefined);
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const navigateTo = useCallback(
    (destination: string) => {
      const normalized = normalizeUrl(destination);
      if (!SAFE_PROTOCOL.test(normalized)) {
        openExternal(normalized);
        return;
      }
      setBrowserState((prev) => ({
        ...prev,
        requestedUrl: normalized,
        isLoading: true,
        lastError: null,
      }));
      setInputValue(normalized);
      const api = window.electron?.browser;
      if (api) {
        void api.navigate(normalized);
      }
    },
    [openExternal]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      navigateTo(inputValue.trim());
    },
    [inputValue, navigateTo]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
    },
    []
  );

  const handleRefresh = useCallback(() => {
    const api = window.electron?.browser;
    if (!api) {
      return;
    }
    void api.reload();
  }, []);

  const handleGoBack = useCallback(() => {
    const api = window.electron?.browser;
    if (!api || !browserState.canGoBack) {
      return;
    }
    void api.goBack();
  }, [browserState.canGoBack]);

  const handleGoForward = useCallback(() => {
    const api = window.electron?.browser;
    if (!api || !browserState.canGoForward) {
      return;
    }
    void api.goForward();
  }, [browserState.canGoForward]);

  const handleToggleAssistant = useCallback(() => {
    setIsAssistantOpen((previous) => !previous);
  }, []);

  const handleAssistantClose = useCallback(() => {
    setIsAssistantOpen(false);
  }, []);

  const handleSessionCreated = useCallback((sessionIdValue: string) => {
    setAssistantSessionId(sessionIdValue);
  }, []);

  const handleAssistantSessionsCleared = useCallback(() => {
    setAssistantSessionId(null);
  }, []);

  const handleAssistantDockChange = useCallback((nextDock: AssistantDock) => {
    setAssistantDock(nextDock);
  }, []);

  const handleAssistantPointerMove = useCallback((event: PointerEvent) => {
    const state = assistantResizeStateRef.current;
    if (!state) {
      return;
    }
    if (state.orientation === 'horizontal') {
      const delta = (event.clientX - state.startX) * state.direction;
      const nextWidth = clamp(
        state.startWidth + delta,
        MIN_ASSISTANT_WIDTH,
        MAX_ASSISTANT_WIDTH
      );
      setAssistantWidth(nextWidth);
      return;
    }
    const delta = (event.clientY - state.startY) * state.direction;
    const nextHeight = clamp(
      state.startHeight + delta,
      MIN_ASSISTANT_HEIGHT,
      MAX_ASSISTANT_HEIGHT
    );
    setAssistantHeight(nextHeight);
  }, []);

  const handleAssistantPointerUp = useCallback(() => {
    assistantResizeStateRef.current = null;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
    window.removeEventListener('pointermove', handleAssistantPointerMove);
    window.removeEventListener('pointerup', handleAssistantPointerUp);
  }, [handleAssistantPointerMove]);

  const handleAssistantResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isAssistantOpen) {
        return;
      }
      const orientation =
        assistantDock === 'bottom' ? 'vertical' : 'horizontal';
      const direction: 1 | -1 =
        assistantDock === 'left' ? 1 : assistantDock === 'right' ? -1 : -1;
      assistantResizeStateRef.current = {
        orientation,
        direction,
        startWidth: assistantWidth,
        startHeight: assistantHeight,
        startX: event.clientX,
        startY: event.clientY,
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor =
        orientation === 'horizontal' ? 'ew-resize' : 'ns-resize';
      window.addEventListener('pointermove', handleAssistantPointerMove);
      window.addEventListener('pointerup', handleAssistantPointerUp);
      event.preventDefault();
    },
    [
      assistantDock,
      assistantHeight,
      assistantWidth,
      handleAssistantPointerMove,
      handleAssistantPointerUp,
      isAssistantOpen,
    ]
  );

  const handleAssistantResizeMouseStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      handleAssistantResizeStart(
        event as unknown as React.PointerEvent<HTMLDivElement>
      );
    },
    [handleAssistantResizeStart]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleAssistantPointerMove);
      window.removeEventListener('pointerup', handleAssistantPointerUp);
    };
  }, [handleAssistantPointerMove, handleAssistantPointerUp]);

  const fetchPageContext =
    useCallback(async (): Promise<PageContext | null> => {
      if (browserState.isLoading) {
        return null;
      }
      const api = window.electron?.browser;
      if (!api) {
        return null;
      }
      try {
        const result = await api.executeJavaScript<PageContext | null>(
          PAGE_CONTEXT_SCRIPT
        );
        if (!result || typeof result !== 'object') {
          return null;
        }
        const context = result as Partial<PageContext>;
        const favicons = Array.isArray(context.favicons)
          ? context.favicons
          : [];
        const resolvedIcon = favicons
          .map((entry) => {
            if (typeof entry !== 'string' || entry.trim().length === 0) {
              return null;
            }
            try {
              return new URL(entry, browserState.currentUrl).href;
            } catch {
              return entry;
            }
          })
          .find((value) => value && value.trim().length > 0);
        if (resolvedIcon) {
          setWindowMetadata('browser', { iconUrl: resolvedIcon });
        }
        return {
          title: typeof context.title === 'string' ? context.title : '',
          description:
            typeof context.description === 'string' ? context.description : '',
          selection:
            typeof context.selection === 'string' ? context.selection : '',
          text: typeof context.text === 'string' ? context.text : '',
          favicons,
        };
      } catch {
        return null;
      }
    }, [browserState.currentUrl, browserState.isLoading, setWindowMetadata]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const target = params.get('target');
    if (target) {
      navigateTo(target);
      navigate('/browser', { replace: true });
    }
  }, [location.search, navigate, navigateTo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (!event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== 'i') {
        return;
      }
      const api = window.electron?.browser;
      if (!api) {
        return;
      }
      event.preventDefault();
      void api.openDevTools();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const actionButtonClass = useCallback(
    (enabled: boolean) =>
      cn(
        'p-1 rounded text-white transition-colors',
        enabled ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'
      ),
    []
  );

  const hostLabel = useMemo(() => {
    const target = browserState.currentUrl || browserState.requestedUrl;
    try {
      const parsed = new URL(target);
      if (parsed.hostname) {
        return parsed.hostname;
      }
      if (parsed.host) {
        return parsed.host;
      }
      return target;
    } catch (error) {
      if (target.includes('//')) {
        const afterScheme = target.split('//')[1];
        if (afterScheme) {
          const candidate = afterScheme.split('/')[0];
          if (candidate) {
            return candidate;
          }
        }
      }
      return target;
    }
  }, [browserState.currentUrl, browserState.requestedUrl]);

  const handleBookmarkSelect = useCallback(
    (url: string) => {
      navigateTo(url);
    },
    [navigateTo]
  );

  const isBottomDock = assistantDock === 'bottom';

  const assistantNode = !isAssistantOpen ? null : (
    <div
      data-testid='assistant-dock'
      data-dock={assistantDock}
      style={
        assistantDock === 'bottom'
          ? { height: `${assistantHeight}px` }
          : { width: `${assistantWidth}px` }
      }
      className={cn(
        'relative flex-shrink-0 overflow-hidden bg-[rgba(14,16,28,0.92)] text-white backdrop-blur-3xl transition-[width,height] duration-200 min-h-0',
        assistantDock === 'bottom'
          ? 'w-full border-t border-white/10'
          : 'h-full',
        assistantDock === 'left' ? 'border-r border-white/10' : assistantDock === 'right' ? 'border-l border-white/10' : ''
      )}
    >
      <div
        role='separator'
        aria-orientation={
          assistantDock === 'bottom' ? 'horizontal' : 'vertical'
        }
        data-testid='assistant-resizer'
        onPointerDown={handleAssistantResizeStart}
        onMouseDown={handleAssistantResizeMouseStart}
        className={cn(
          'absolute z-20',
          assistantDock === 'bottom'
            ? 'top-0 left-0 h-2 w-full cursor-ns-resize'
            : 'top-0 h-full w-2 cursor-ew-resize',
          assistantDock === 'left' ? 'right-0' : '',
          assistantDock === 'right' ? 'left-0' : ''
        )}
      >
        <span className='block h-full w-full rounded-full bg-white/10 opacity-0 transition-opacity duration-150 hover:opacity-80' />
      </div>
      <BrowserAssistantPanel
        isOpen={isAssistantOpen}
        sessionId={assistantSessionId}
        hostLabel={hostLabel}
        currentUrl={browserState.currentUrl}
        pageTitle={browserState.title}
        onSessionCreated={handleSessionCreated}
        onSessionsCleared={handleAssistantSessionsCleared}
        fetchPageContext={fetchPageContext}
        onClose={handleAssistantClose}
        dock={assistantDock}
        onDockChange={handleAssistantDockChange}
      />
    </div>
  );

  return (
    <div className='relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-desktop-lg border border-white/5 bg-hol-glass-dark/80 text-white shadow-desktop-window backdrop-blur-desktop'>
      <div className='relative z-10 bg-gradient-to-r from-purple-600 to-orange-400 p-2 flex items-center gap-2'>
        <div className='flex items-center gap-[6px] pl-1'>
          <TrafficLightButton variant='close' onClick={handleShellClose} />
          <TrafficLightButton
            variant='minimize'
            onClick={handleShellMinimize}
          />
          <TrafficLightButton
            variant='maximize'
            onClick={handleShellToggleExpand}
            isExpanded={isExpanded}
          />
        </div>

        <div className='flex items-center gap-2 ml-4'>
          <button
            type='button'
            onClick={handleGoBack}
            disabled={!browserState.canGoBack}
            className={actionButtonClass(browserState.canGoBack)}
            aria-label='Go Back'
          >
            <FiArrowRightCircle className='w-4 h-4 text-white rotate-180' />
          </button>
          <button
            type='button'
            onClick={handleGoForward}
            disabled={!browserState.canGoForward}
            className={actionButtonClass(browserState.canGoForward)}
            aria-label='Go Forward'
          >
            <FiArrowRightCircle className='w-4 h-4 text-white' />
          </button>
          <button
            type='button'
            onClick={handleRefresh}
            className='p-1 hover:bg-white/10 rounded'
            aria-label='Refresh'
          >
            <FiRotateCw className='w-4 h-4 text-white' />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className='flex-1 mx-4 flex items-center gap-2 bg-white/90 rounded-md px-3 py-1'
        >
          <img
            src={moonscapeLogo}
            alt='Moonscape'
            className='w-4 h-4 object-contain'
          />
          <input
            id='browser-url'
            ref={urlInputRef}
            value={inputValue}
            onChange={handleChange}
            className='flex-1 bg-transparent text-gray-700 text-sm focus:outline-none placeholder:text-gray-500'
            placeholder='Search or enter address'
            aria-label='Browser address'
            style={{ fontFamily: 'Roboto, sans-serif' }}
          />
        </form>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleToggleAssistant}
            className='p-1 hover:bg-white/10 rounded text-white'
            aria-label='Toggle Assistant'
          >
            <FiMessageSquare className='w-4 h-4' />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'relative z-10 flex flex-1 overflow-hidden',
          isBottomDock ? 'flex-col' : 'flex-row'
        )}
      >
        {assistantDock === 'left' ? assistantNode : null}
        <div className='flex-1 min-h-0 flex flex-col'>
          <div className={cn(
            'flex items-center gap-1 px-3 py-1 border-b text-xs transition-colors duration-300',
            isDarkTheme
              ? 'bg-gray-900 border-gray-700'
              : 'bg-gray-100 border-gray-200'
          )}>
            {BOOKMARKS.map((bookmark) => (
              <BookmarkButton
                key={bookmark.url}
                bookmark={bookmark}
                onSelect={handleBookmarkSelect}
                isDark={isDarkTheme}
              />
            ))}
          </div>
          <div className='flex-1 min-h-0 relative'>
            <div
              ref={browserContainerRef}
              className='absolute inset-0'
              data-testid='browser-surface'
              data-current-url={
                browserState.currentUrl || browserState.requestedUrl
              }
            />
          </div>
        </div>
        {assistantDock === 'right' ? assistantNode : null}
        {assistantDock === 'bottom' ? assistantNode : null}
      </div>
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent via-black/15 to-black/35' />
    </div>
  );
};

const ShellBrowserWindow: React.FC = () => {
  return (
    <ShellWindow windowKey='browser' hideChrome>
      <BrowserSurface />
    </ShellWindow>
  );
};

export default ShellBrowserWindow;

export { BrowserSurface as BrowserSurfaceForTesting };
