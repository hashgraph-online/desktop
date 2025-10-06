import { useCallback, useMemo, useRef } from 'react'
import { useBrowserRefs } from './useBrowserRefs'
import { useAssistantDock } from './useAssistantDock'
import { useBrowserBridge } from './useBrowserBridge'
import type { BrowserSurfaceContext, BrowserSurfaceHandlers, BrowserSurfaceComputedState } from './types'

export const useBrowserSurface = (): BrowserSurfaceContext => {
  const refs = useBrowserRefs()
  const updateViewportBoundsRef = useRef<() => void>(() => undefined)

  const viewportCallback = useCallback(() => {
    updateViewportBoundsRef.current()
  }, [])

  const {
    assistant,
    toggleAssistant,
    closeAssistant,
    setDock,
    setSessionId,
    clearSession,
    handleResizeStart,
    handleResizeMouseStart
  } = useAssistantDock(viewportCallback)

  const bridge = useBrowserBridge({ refs, assistant })

  const normalizedPageContext = useMemo(() => {
    if (!bridge.pageContext) {
      return null
    }

    return {
      title: bridge.pageContext.title ?? '',
      description: bridge.pageContext.description ?? '',
      selection: bridge.pageContext.selection ?? '',
    }
  }, [bridge.pageContext])

  const fetchNormalizedPageContext = useCallback(async () => {
    const context = await bridge.fetchPageContext()
    if (!context) {
      return null
    }
    return {
      title: context.title ?? '',
      description: context.description ?? '',
      selection: context.selection ?? '',
    }
  }, [bridge])

  const composedState: BrowserSurfaceComputedState = {
    ...bridge.state,
    assistant,
    isBottomDock: assistant.dock === 'bottom'
  }

  const composedHandlers: BrowserSurfaceHandlers = {
    handleSubmit: bridge.handlers.handleSubmit,
    handleUrlInputChange: bridge.handlers.handleUrlInputChange,
    handleGoBack: bridge.handlers.handleGoBack,
    handleGoForward: bridge.handlers.handleGoForward,
    handleRefresh: bridge.handlers.handleRefresh,
    handleToggleAssistant: toggleAssistant,
    handleAssistantClose: closeAssistant,
    handleSessionCreated: setSessionId,
    handleAssistantSessionsCleared: clearSession,
    handleAssistantDockChange: setDock,
    handleAssistantResizeStart: handleResizeStart,
    handleAssistantResizeMouseStart: handleResizeMouseStart,
    handleBookmarkSelect: bridge.handlers.handleBookmarkSelect,
    handleShellMinimize: bridge.handlers.handleShellMinimize,
    handleShellClose: bridge.handlers.handleShellClose,
    handleShellToggleExpand: bridge.handlers.handleShellToggleExpand
  }

  return {
    refs,
    state: composedState,
    handlers: composedHandlers,
    fetchPageContext: fetchNormalizedPageContext,
    pageContext: normalizedPageContext
  }
}
