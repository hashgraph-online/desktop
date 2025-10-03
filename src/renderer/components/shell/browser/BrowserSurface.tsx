import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Logger } from '@hashgraphonline/standards-sdk';
import BrowserAssistantPanel from '../BrowserAssistantPanel';
import BookmarkBar from './BookmarkBar';
import BrowserToolbar from './BrowserToolbar';
import AssistantDock from './AssistantDock';
import { BOOKMARKS } from './constants';
import { useBrowserSurface } from './useBrowserSurface';
import type { BrowserSurfaceComputedState } from './types';
import { calculateOverlayLayout } from './layouts';

const logger = new Logger({ module: 'BrowserSurface' });

const BrowserSurface: React.FC = () => {
  return (
    <BrowserSurfaceBoundary>
      <BrowserSurfaceContent />
    </BrowserSurfaceBoundary>
  );
};

class BrowserSurfaceBoundary extends Component<
  { children: ReactNode },
  { error?: Error }
> {
  state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('browser.surface.crash', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className='flex h-full w-full items-center justify-center bg-black text-sm text-white'>
          <div className='max-w-md rounded-lg border border-white/20 bg-red-900/40 p-6 text-left shadow-2xl'>
            <p className='font-semibold text-white'>
              Moonscape crashed while loading.
            </p>
            <p className='mt-2 text-white/80'>
              {error.message || 'Unknown renderer error.'}
            </p>
            <p className='mt-4 text-xs text-white/60'>
              Check the terminal for “browser.surface.crash” details.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const BrowserSurfaceContent: React.FC = () => {
  const { refs, state, handlers, pageContext, fetchPageContext } = useBrowserSurface();

  const {
    bridgeState,
    inputValue,
    isBridgeAvailable,
    fallbackUrl,
    fallbackRevision,
    hostLabel,
    isDarkTheme,
    isExpanded,
    isAttached,
    assistant,
  } = state;

  if (import.meta.env.DEV) {
    console.info('[browser] render', {
      isBridgeAvailable,
      isAttached,
      currentUrl: bridgeState.currentUrl,
      requestedUrl: bridgeState.requestedUrl,
      isLoading: bridgeState.isLoading,
    });
  }

  const {
    shellRootRef,
    toolbarRef,
    bookmarkBarRef,
    browserContainerRef,
    urlInputRef,
  } = refs;
  const [shellSize, setShellSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = shellRootRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setShellSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shellRootRef]);

  const layoutMetrics = useMemo(
    () => calculateOverlayLayout(shellSize.width, shellSize.height, assistant),
    [assistant, shellSize.height, shellSize.width]
  );

  const assignUrlInput = useCallback(
    (element: HTMLInputElement | null) => {
      urlInputRef.current = element;
    },
    [urlInputRef]
  );

  const {
    handleSubmit,
    handleUrlInputChange,
    handleGoBack,
    handleGoForward,
    handleRefresh,
    handleToggleAssistant,
    handleAssistantClose,
    handleSessionCreated,
    handleAssistantSessionsCleared,
    handleAssistantDockChange,
    handleAssistantResizeStart,
    handleAssistantResizeMouseStart,
    handleBookmarkSelect,
    handleShellMinimize,
    handleShellClose,
    handleShellToggleExpand,
  } = handlers;

  return (
    <div
      ref={shellRootRef}
      className='relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-desktop-lg border border-white/5 bg-hol-glass-dark/80 text-white shadow-desktop-window backdrop-blur-desktop'
    >
      <div ref={toolbarRef}>
        <BrowserToolbar
          isExpanded={isExpanded}
          canGoBack={bridgeState.canGoBack}
          canGoForward={bridgeState.canGoForward}
          inputValue={inputValue}
          onInputChange={handleUrlInputChange}
          onSubmit={handleSubmit}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onRefresh={handleRefresh}
          onToggleAssistant={handleToggleAssistant}
          onMinimize={handleShellMinimize}
          onClose={handleShellClose}
          onToggleExpand={handleShellToggleExpand}
          inputRef={assignUrlInput}
        />
      </div>

      <div className='relative z-10 flex flex-1 overflow-hidden'>
        {assistant.dock === 'left' ? (
          <AssistantDock
            dock={assistant.dock}
            isOpen={assistant.isOpen}
            width={assistant.width}
            height={assistant.height}
            onPointerDown={handleAssistantResizeStart}
            onMouseDown={handleAssistantResizeMouseStart}
          >
            <BrowserAssistantPanel
              isOpen={assistant.isOpen}
              sessionId={assistant.sessionId}
              hostLabel={hostLabel}
              currentUrl={bridgeState.currentUrl}
              pageTitle={bridgeState.title}
              onSessionCreated={handleSessionCreated}
              onSessionsCleared={handleAssistantSessionsCleared}
              pageContext={pageContext}
              fetchPageContext={fetchPageContext}
              onClose={handleAssistantClose}
              dock={assistant.dock}
              onDockChange={handleAssistantDockChange}
            />
          </AssistantDock>
        ) : null}

        <div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
          <div ref={bookmarkBarRef}>
            <BookmarkBar
              bookmarks={BOOKMARKS}
              isDark={isDarkTheme}
              onSelect={handleBookmarkSelect}
            />
          </div>
          <div className='relative flex-1 min-h-0 overflow-hidden'>
            <div
              ref={browserContainerRef}
              className='absolute'
              data-testid='browser-surface'
              data-current-url={
                bridgeState.currentUrl || bridgeState.requestedUrl
              }
              style={{
                left: `${layoutMetrics.viewportLeft}px`,
                top: `${layoutMetrics.viewportTop}px`,
                width: `${layoutMetrics.viewportWidth}px`,
                height: `${layoutMetrics.viewportHeight}px`,
                minWidth: 0,
                minHeight: 0,
              }}
            />
            {!isBridgeAvailable ? (
              <iframe
                key={`${fallbackUrl}:${fallbackRevision}`}
                src={fallbackUrl}
                referrerPolicy='no-referrer-when-downgrade'
                allow='accelerometer; autoplay; clipboard-read; clipboard-write; camera; geolocation; microphone; payment'
                sandbox='allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts'
                className='absolute inset-0 h-full w-full border-0 bg-white'
                title='Moonscape Browser Preview'
              />
            ) : null}
            {bridgeState.isLoading ? (
              <div className='absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-sm font-medium text-white'>
                {`Loading ${hostLabel || 'page'}…`}
              </div>
            ) : null}
            {bridgeState.lastError ? (
              <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center text-sm text-white'>
                <div className='space-y-1'>
                  <p>{`We couldn't load ${hostLabel || 'this page'}.`}</p>
                  <p className='text-xs opacity-80'>{bridgeState.lastError}</p>
                </div>
                <button
                  type='button'
                  onClick={handleRefresh}
                  className='rounded border border-white/40 bg-white/10 px-3 py-1 text-white transition-colors hover:bg-white/20'
                >
                  Retry
                </button>
              </div>
            ) : null}
            {!isBridgeAvailable ? (
              <div className='absolute bottom-3 right-3 z-20 rounded bg-black/70 px-3 py-1 text-xs text-white shadow-lg'>
                Preview mode (desktop bridge unavailable)
              </div>
            ) : null}
            {assistant.dock === 'bottom' && assistant.isOpen ? (
              <div
                className='pointer-events-none absolute z-30'
                style={{
                  left: `${layoutMetrics.viewportLeft}px`,
                  width: `${layoutMetrics.viewportWidth}px`,
                  top: `${layoutMetrics.assistantOverlay.top}px`,
                  height: `${layoutMetrics.assistantOverlay.height}px`,
                }}
              >
                <AssistantDock
                  dock={assistant.dock}
                  isOpen={assistant.isOpen}
                  width={layoutMetrics.assistantOverlay.width}
                  height={layoutMetrics.assistantOverlay.height}
                  onPointerDown={handleAssistantResizeStart}
                  onMouseDown={handleAssistantResizeMouseStart}
                  className='pointer-events-auto h-full w-full'
                >
                  <BrowserAssistantPanel
                    isOpen={assistant.isOpen}
                    sessionId={assistant.sessionId}
                    hostLabel={hostLabel}
                    currentUrl={bridgeState.currentUrl}
                    pageTitle={bridgeState.title}
                    onSessionCreated={handleSessionCreated}
                    onSessionsCleared={handleAssistantSessionsCleared}
                    pageContext={pageContext}
                    fetchPageContext={fetchPageContext}
                    onClose={handleAssistantClose}
                    dock={assistant.dock}
                    onDockChange={handleAssistantDockChange}
                  />
                </AssistantDock>
              </div>
            ) : null}
          </div>
        </div>

        {assistant.dock === 'right' ? (
          <AssistantDock
            dock={assistant.dock}
            isOpen={assistant.isOpen}
            width={assistant.width}
            height={assistant.height}
            onPointerDown={handleAssistantResizeStart}
            onMouseDown={handleAssistantResizeMouseStart}
          >
            <BrowserAssistantPanel
              isOpen={assistant.isOpen}
              sessionId={assistant.sessionId}
              hostLabel={hostLabel}
              currentUrl={bridgeState.currentUrl}
              pageTitle={bridgeState.title}
              onSessionCreated={handleSessionCreated}
              onSessionsCleared={handleAssistantSessionsCleared}
              pageContext={pageContext}
              fetchPageContext={fetchPageContext}
              onClose={handleAssistantClose}
              dock={assistant.dock}
              onDockChange={handleAssistantDockChange}
            />
          </AssistantDock>
        ) : null}

      </div>
    </div>
  );
};

const BrowserDebugOverlay: React.FC<{
  state: BrowserSurfaceComputedState;
  isAttached: boolean;
  isReady: boolean;
}> = ({ state, isAttached, isReady }) => {
  if (!import.meta.env.DEV) {
    return null;
  }
  const { bridgeState, isBridgeAvailable, fallbackUrl, assistant } = state;
  return (
    <div className='pointer-events-none absolute bottom-4 left-4 z-[999] max-w-xs rounded bg-black/75 px-3 py-2 font-mono text-[11px] text-white/80 shadow-lg'>
      <div>bridgeAvailable: {String(isBridgeAvailable)}</div>
      <div>attached: {String(isAttached)}</div>
      <div>ready: {String(isReady)}</div>
      <div>loading: {String(bridgeState.isLoading)}</div>
      <div>currentUrl: {bridgeState.currentUrl || '—'}</div>
      <div>requestedUrl: {bridgeState.requestedUrl || '—'}</div>
      <div>fallbackUrl: {fallbackUrl}</div>
      <div>
        assistant:{' '}
        {assistant.isOpen
          ? `${assistant.dock} (${assistant.width}×${assistant.height})`
          : 'closed'}
      </div>
      {bridgeState.lastError ? (
        <div className='text-red-400'>error: {bridgeState.lastError}</div>
      ) : null}
    </div>
  );
};

export default BrowserSurface;
