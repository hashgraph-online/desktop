import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Logger } from '@hashgraphonline/standards-sdk';
import { SHELL_WINDOWS, useShell } from '../ShellContext';
import { useShellWindowControls } from '../ShellWindow';
import { useConfigStore } from '../../../stores/configStore';
import {
  useBrowserShellStore,
  DEFAULT_BROWSER_URL,
} from '../../../stores/browserShellStore';
import type { BrowserState } from '@/types/desktop-bridge';
import { SAFE_PROTOCOL, normalizeUrl } from './constants';
import {
  PAGE_CONTEXT_SCRIPT,
  FAVICON_SCRIPT,
  type PageContext,
} from './scripts';
import { isBrowserState } from './guards';
import { useViewportManager } from './useViewportManager';
import { useAttachManager } from './useAttachManager';
import type {
  AssistantState,
  BrowserSurfaceRefs,
  BrowserSurfaceComputedState,
  BrowserSurfaceHandlers,
} from './types';

const logger = new Logger({ module: 'BrowserSurface' });

const PAGE_CONTEXT_TIMEOUT_MS = 1500;
const PAGE_CONTEXT_COOLDOWN_MS = 5000;

type PageContextCacheEntry = {
  key: string;
  context: PageContext | null;
};

interface UseBrowserBridgeParams {
  refs: BrowserSurfaceRefs;
  assistant: AssistantState;
}

interface UseBrowserBridgeResult {
  state: Omit<BrowserSurfaceComputedState, 'assistant' | 'isBottomDock'>;
  handlers: Pick<
    BrowserSurfaceHandlers,
    | 'handleSubmit'
    | 'handleUrlInputChange'
    | 'handleGoBack'
    | 'handleGoForward'
    | 'handleRefresh'
    | 'handleBookmarkSelect'
    | 'handleShellMinimize'
    | 'handleShellClose'
    | 'handleShellToggleExpand'
  > & { navigateTo: (destination: string) => void };
  updateViewportBounds: () => void;
  fetchPageContext: () => Promise<PageContext | null>;
  pageContext: PageContext | null;
}

export const useBrowserBridge = ({
  refs,
  assistant,
}: UseBrowserBridgeParams): UseBrowserBridgeResult => {
  console.log('[DEBUG] useBrowserBridge hook called');
  logger.info('useBrowserBridge.init');
  const browserStore = useBrowserShellStore();
  const {
    bridgeState,
    inputValue,
    fallbackUrl,
    isAttached,
    isReady,
    setInputValue,
    setBridgeState,
    replaceBridgeState,
    setFallbackUrl,
    markAttached,
    markDetached,
    reset: resetBrowserStore,
  } = browserStore;

  const { minimize, close, toggleExpand, isExpanded, isMinimized } =
    useShellWindowControls();
  const { setWindowMetadata, windowMetadata } = useShell();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkTheme = useConfigStore(
    (state) => state.config?.advanced?.theme === 'dark'
  );

  const [isBridgeAvailable, setIsBridgeAvailable] = useState(
    () => typeof window !== 'undefined' && Boolean(window.desktop?.browser)
  );
  const [fallbackRevision, setFallbackRevision] = useState(0);
  const [bridgeProbeEnabled, setBridgeProbeEnabled] = useState(true);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);

  const inputValueRef = useRef(inputValue);
  const initialNavigationRequestedRef = useRef(false);
  const pageContextCacheRef = useRef<PageContextCacheEntry | null>(null);
  const contextFetchPromiseRef = useRef<Promise<PageContext | null> | null>(null);
  const contextCooldownRef = useRef<number>(0);
  const lastContextCacheKeyRef = useRef<string>('');

  useEffect(() => resetBrowserStore, [resetBrowserStore]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  const handleBridgeFailure = useCallback(
    (reason: unknown) => {
      logger.error('browser.bridge.failure', { reason });
      if (import.meta.env.DEV) {
        console.error('[browser] bridge failure', reason);
      }
      setIsBridgeAvailable(false);
      setBridgeProbeEnabled(false);
      markDetached();
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
          ? reason
          : 'Browser bridge unavailable';
      setBridgeState((previous) => ({
        ...previous,
        isLoading: false,
        lastError: message,
      }));
    },
    [markDetached, setBridgeState]
  );

  const openExternal = useCallback((targetUrl: string) => {
    if (window?.moonscape?.openExternal) {
      window.moonscape.openExternal(targetUrl);
      return;
    }
    if (window?.desktop?.openExternal) {
      window.desktop.openExternal(targetUrl).catch(() => undefined);
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const navigateTo = useCallback(
    (destination: string) => {
      const normalized = normalizeUrl(destination, DEFAULT_BROWSER_URL);
      if (!SAFE_PROTOCOL.test(normalized)) {
        openExternal(normalized);
        return;
      }
      if (!isBridgeAvailable) {
        setBridgeState((previous) => ({
          ...previous,
          requestedUrl: normalized,
          currentUrl: normalized,
          isLoading: false,
          lastError: null,
        }));
        inputValueRef.current = normalized;
        setInputValue(normalized);
        setFallbackUrl(normalized);
        setFallbackRevision((value) => value + 1);
        return;
      }
      setBridgeState((previous) => ({
        ...previous,
        requestedUrl: normalized,
        isLoading: true,
        lastError: null,
      }));
      inputValueRef.current = normalized;
      setInputValue(normalized);
      const api = window.desktop?.browser;
      if (api) {
        void api.navigate(normalized).catch((error) => {
          handleBridgeFailure(error);
        });
      }
    },
    [
      handleBridgeFailure,
      isBridgeAvailable,
      openExternal,
      setBridgeState,
      setFallbackRevision,
      setFallbackUrl,
      setInputValue,
    ]
  );

  const requestInitialNavigation = useCallback(() => {
    if (initialNavigationRequestedRef.current) {
      return;
    }
    initialNavigationRequestedRef.current = true;
    navigateTo(DEFAULT_BROWSER_URL);
  }, [navigateTo]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      isBridgeAvailable ||
      !bridgeProbeEnabled
    ) {
      return;
    }
    const id = window.setInterval(() => {
      if (window.desktop?.browser) {
        setIsBridgeAvailable(true);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [bridgeProbeEnabled, isBridgeAvailable]);

  useEffect(() => {
    if (isBridgeAvailable) {
      return;
    }
    setBridgeState((previous) => ({
      ...previous,
      currentUrl: fallbackUrl,
      requestedUrl: fallbackUrl,
      isLoading: false,
      lastError: null,
    }));
    if (inputValueRef.current !== fallbackUrl) {
      inputValueRef.current = fallbackUrl;
      setInputValue(fallbackUrl);
    }
  }, [
    fallbackUrl,
    fallbackRevision,
    isBridgeAvailable,
    setBridgeState,
    setInputValue,
  ]);

  const updateViewportBounds = useViewportManager({
    refs,
    assistant,
    isBridgeAvailable,
    isAttached,
  });

  useAttachManager({
    isBridgeAvailable,
    isAttached,
    isMinimized,
    markAttached,
    markDetached,
    updateViewportBounds,
    handleBridgeFailure,
    onDetached: () => {
      initialNavigationRequestedRef.current = false;
    },
    onAttached: () => {
      requestInitialNavigation();
    },
    onDetachError: (reason) =>
      logger.warn('browser.detach.failure', { reason }),
  });

  useEffect(() => {
    if (!isAttached) {
      initialNavigationRequestedRef.current = false;
    }
  }, [isAttached]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    requestInitialNavigation();
  }, [isReady, requestInitialNavigation]);

  const handleBrowserStateUpdate = useCallback(
    (state: BrowserState) => {
      replaceBridgeState(state);
      const nextValue =
        state.requestedUrl || state.currentUrl || DEFAULT_BROWSER_URL;
      if (
        document.activeElement !== refs.urlInputRef.current &&
        inputValueRef.current !== nextValue
      ) {
        inputValueRef.current = nextValue;
        setInputValue(nextValue);
      }
      if (!state.isLoading) {
        updateViewportBounds();
      }
      if (import.meta.env.DEV) {
        console.info('[browser] state update', {
          currentUrl: state.currentUrl,
          requestedUrl: state.requestedUrl,
          isLoading: state.isLoading,
          title: state.title,
        });
      }
    },
    [refs.urlInputRef, replaceBridgeState, setInputValue, updateViewportBounds]
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      if (!isBridgeAvailable) {
        return;
      }
      const api = window.desktop?.browser;
      if (!api) {
        return;
      }
      try {
        const initialState = await api.getState();
        if (active && isBrowserState(initialState)) {
          handleBrowserStateUpdate(initialState);
        }
      } catch (error) {
        if (active) {
          handleBridgeFailure(error);
        }
        return;
      }

      try {
        unsubscribe = api.onState((state) => {
          if (!active) {
            return;
          }
          if (isBrowserState(state)) {
            handleBrowserStateUpdate(state);
          }
        });
      } catch (error) {
        logger.warn('browser.state.subscribe.failure', { error });
        if (error instanceof Error && error.message.includes('not allowed')) {
          setBridgeState((previous) => ({
            ...previous,
            lastError: error.message,
            isLoading: false,
          }));
        } else if (active) {
          handleBridgeFailure(error);
        }
      }
    };

    void subscribe();
    return () => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    handleBridgeFailure,
    handleBrowserStateUpdate,
    isBridgeAvailable,
    setBridgeState,
  ]);

  useEffect(() => {
    const metadata = windowMetadata.browser;
    let label = bridgeState.title.trim();
    let iconUrl: string | null = null;
    const icon = SHELL_WINDOWS.browser.icon;
    const defaultLabel = SHELL_WINDOWS.browser.label;
    try {
      const url = new URL(bridgeState.currentUrl);
      iconUrl = `${url.origin}/favicon.ico`;
      if (!label) {
        label = url.hostname;
      }
    } catch {
      iconUrl = null;
    }
    if (!label) {
      label = defaultLabel;
    }
    if (metadata?.label !== label || metadata?.icon !== icon) {
      setWindowMetadata('browser', { label, icon });
    }
    if (!metadata?.iconUrl && iconUrl) {
      setWindowMetadata('browser', { iconUrl });
    }
  }, [
    bridgeState.currentUrl,
    bridgeState.title,
    setWindowMetadata,
    windowMetadata.browser,
  ]);

  const collectFavicons = useCallback(async () => {
    if (!isBridgeAvailable) {
      return;
    }
    const api = window.desktop?.browser;
    if (!api) {
      return;
    }
    try {
      const result = await api.executeJavaScript(FAVICON_SCRIPT);
      const favicons = result as string[] | null;
      if (Array.isArray(favicons) && favicons.length > 0) {
        const resolvedIcon = favicons
          .map((entry) => {
            if (typeof entry !== 'string' || entry.trim().length === 0) {
              return null;
            }
            try {
              return new URL(entry, bridgeState.currentUrl).href;
            } catch {
              return entry;
            }
          })
          .find((value) => value && value.trim().length > 0);
        if (resolvedIcon && windowMetadata.browser?.iconUrl !== resolvedIcon) {
          setWindowMetadata('browser', { iconUrl: resolvedIcon });
        }
      }
    } catch (error) {
      logger.warn('browser.favicon.failure', { error });
    }
  }, [
    bridgeState.currentUrl,
    isBridgeAvailable,
    setWindowMetadata,
    windowMetadata.browser?.iconUrl,
  ]);


  const handleShellMinimize = useCallback(() => {
    const api = window.desktop?.browser;
    if (api) {
      void api.detach();
    }
    markDetached();
    minimize();
  }, [markDetached, minimize]);

  const handleShellToggleExpand = useCallback(() => {
    toggleExpand();
  }, [toggleExpand]);

  const handleShellClose = useCallback(() => {
    const api = window.desktop?.browser;
    if (api) {
      void api.detach();
    }
    markDetached();
    close();
  }, [close, markDetached]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      navigateTo(inputValue.trim());
    },
    [inputValue, navigateTo]
  );

  const handleUrlInputChange = useCallback(
    (value: string) => {
      inputValueRef.current = value;
      setInputValue(value);
    },
    [setInputValue]
  );

  const handleRefresh = useCallback(() => {
    if (!isBridgeAvailable) {
      setBridgeState((previous) => ({
        ...previous,
        lastError: null,
        isLoading: false,
      }));
      setFallbackRevision((value) => value + 1);
      setBridgeProbeEnabled(true);
      return;
    }
    const api = window.desktop?.browser;
    if (!api) {
      return;
    }
    void api.reload().catch((error) => {
      handleBridgeFailure(error);
    });
  }, [handleBridgeFailure, isBridgeAvailable, setBridgeState]);

  const handleGoBack = useCallback(() => {
    if (!isBridgeAvailable) {
      return;
    }
    const api = window.desktop?.browser;
    if (!api || !bridgeState.canGoBack) {
      return;
    }
    void api.goBack().catch((error) => {
      handleBridgeFailure(error);
    });
  }, [bridgeState.canGoBack, handleBridgeFailure, isBridgeAvailable]);

  const handleGoForward = useCallback(() => {
    if (!isBridgeAvailable) {
      return;
    }
    const api = window.desktop?.browser;
    if (!api || !bridgeState.canGoForward) {
      return;
    }
    void api.goForward().catch((error) => {
      handleBridgeFailure(error);
    });
  }, [bridgeState.canGoForward, handleBridgeFailure, isBridgeAvailable]);

  const handleBookmarkSelect = useCallback(
    (url: string) => {
      navigateTo(url);
    },
    [navigateTo]
  );

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
      if (
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey ||
        event.key.toLowerCase() !== 'i'
      ) {
        return;
      }
      const api = window.desktop?.browser;
      if (!api) {
        return;
      }
      event.preventDefault();
      void api.openDevTools();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    updateViewportBounds();
  }, [location.pathname, location.search, updateViewportBounds]);

  const fetchPageContextRef = useRef<() => Promise<PageContext | null>>(async () => null);

  fetchPageContextRef.current = async () => {
    if (bridgeState.isLoading || !isBridgeAvailable || !isAttached) {
      logger.info('browser.pageContext.skipped', {
        isLoading: bridgeState.isLoading,
        isBridgeAvailable,
        isAttached,
      });
      return null;
    }

    const cacheKey = `${bridgeState.currentUrl || fallbackUrl || ''}::${fallbackRevision}`;
    const cached = pageContextCacheRef.current;
    if (cached && cached.key === cacheKey) {
      logger.info('browser.pageContext.cached', { context: cached.context });
      return cached.context;
    }

    const api = window.desktop?.browser;
    if (!api?.captureContext) {
      logger.warn('browser.pageContext.apiUnavailable');
      return null;
    }

    const now = Date.now();
    if (
      cacheKey === lastContextCacheKeyRef.current &&
      contextCooldownRef.current > now
    ) {
      logger.info('browser.pageContext.cooldown', { cached: cached?.context });
      return cached?.context ?? null;
    }

    if (contextFetchPromiseRef.current) {
      logger.info('browser.pageContext.fetchInProgress');
      return contextFetchPromiseRef.current;
    }

    const fetchPromise = (async () => {
      try {
        console.log('[DEBUG] Calling captureContext API');
        logger.info('browser.pageContext.fetching', { url: bridgeState.currentUrl });
        const result = await api.captureContext();
        console.log('[DEBUG] captureContext result:', result);
        logger.info('browser.pageContext.result', { result });

        if (!result) {
          console.log('[DEBUG] Result is null/undefined');
          return null;
        }

        const context: PageContext = {
          description: result?.description?.trim() || null,
          selection: result?.selection?.trim() || null,
        };
        pageContextCacheRef.current = { key: cacheKey, context };
        lastContextCacheKeyRef.current = cacheKey;
        contextCooldownRef.current = now + PAGE_CONTEXT_COOLDOWN_MS;
        console.log('[DEBUG] Context saved:', context);
        logger.info('browser.pageContext.success', { context });
        return context;
      } catch (error) {
        console.error('[DEBUG] captureContext error:', error);
        logger.warn('browser.pageContext.captureFailed', { error });
        return null;
      }
    })();

    contextFetchPromiseRef.current = fetchPromise.finally(() => {
      contextFetchPromiseRef.current = null;
    });

    return contextFetchPromiseRef.current;
  };

  const fetchPageContext = useCallback(async () => {
    const context = await (fetchPageContextRef.current?.() ?? Promise.resolve(null));
    setPageContext(context ?? null);
    return context;
  }, []);

  useEffect(() => {
    if (bridgeState.isLoading) {
      pageContextCacheRef.current = null;
      lastContextCacheKeyRef.current = '';
      contextCooldownRef.current = 0;
      contextFetchPromiseRef.current = null;
    }
  }, [bridgeState.isLoading, bridgeState.currentUrl, fallbackRevision]);

  useEffect(() => {
    if (!isBridgeAvailable) {
      pageContextCacheRef.current = null;
      lastContextCacheKeyRef.current = '';
      contextCooldownRef.current = 0;
      contextFetchPromiseRef.current = null;
      setPageContext(null);
    }
  }, [isBridgeAvailable]);

  useEffect(() => {
    let cancelled = false;

    logger.info('browser.pageContext.autoFetchEffect', {
      isBridgeAvailable,
      isLoading: bridgeState.isLoading,
      isAttached,
      currentUrl: bridgeState.currentUrl,
    });

    if (!isBridgeAvailable || bridgeState.isLoading || !isAttached) {
      setPageContext(null);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      logger.info('browser.pageContext.autoFetchRun');
      const context = await fetchPageContextRef.current?.();
      if (!cancelled) {
        setPageContext(context ?? null);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    bridgeState.currentUrl,
    fallbackUrl,
    fallbackRevision,
    bridgeState.isLoading,
    isBridgeAvailable,
    isAttached,
  ]);

  const hostLabel = useMemo(() => {
    const target = bridgeState.currentUrl || bridgeState.requestedUrl;
    try {
      const parsed = new URL(target);
      return parsed.hostname || parsed.host || target;
    } catch {
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
  }, [bridgeState.currentUrl, bridgeState.requestedUrl]);

  const bridgeComputedState: Omit<
    BrowserSurfaceComputedState,
    'assistant' | 'isBottomDock'
  > = {
    bridgeState,
    inputValue,
    isBridgeAvailable,
    fallbackUrl,
    fallbackRevision,
    hostLabel,
    isDarkTheme,
    isExpanded,
    isAttached,
    isReady,
  };

  const handlers: UseBrowserBridgeResult['handlers'] = {
    handleSubmit,
    handleUrlInputChange,
    handleGoBack,
    handleGoForward,
    handleRefresh,
    handleBookmarkSelect,
    handleShellMinimize,
    handleShellClose,
    handleShellToggleExpand,
    navigateTo,
  };

  return {
    state: bridgeComputedState,
    handlers,
    updateViewportBounds,
    fetchPageContext,
    pageContext,
  };
};
