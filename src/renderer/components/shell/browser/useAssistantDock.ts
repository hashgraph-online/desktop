import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ASSISTANT_HEIGHT,
  DEFAULT_ASSISTANT_WIDTH,
  MIN_ASSISTANT_HEIGHT,
  MAX_ASSISTANT_HEIGHT,
  MIN_ASSISTANT_WIDTH,
  MAX_ASSISTANT_WIDTH,
  clamp
} from './constants'
import type { AssistantDock } from '../../../../shared/browser-layout'
import type { AssistantState } from './types'

interface UseAssistantDockResult {
  assistant: AssistantState
  toggleAssistant: () => void
  closeAssistant: () => void
  setDock: (dock: AssistantDock) => void
  setSessionId: (sessionId: string) => void
  clearSession: () => void
  handleResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
  handleResizeMouseStart: (event: React.MouseEvent<HTMLDivElement>) => void
}

const createInitialState = (): AssistantState => ({
  isOpen: false,
  dock: 'right',
  width: DEFAULT_ASSISTANT_WIDTH,
  height: DEFAULT_ASSISTANT_HEIGHT,
  sessionId: null
})

export const useAssistantDock = (updateViewportBounds: () => void): UseAssistantDockResult => {
  const [assistant, setAssistant] = useState<AssistantState>(createInitialState)
  const resizeStateRef = useRef<{
    orientation: 'horizontal' | 'vertical'
    direction: 1 | -1
    startWidth: number
    startHeight: number
    startX: number
    startY: number
  } | null>(null)

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) {
        return
      }
      event.preventDefault()
      if (state.orientation === 'horizontal') {
        const delta = (event.clientX - state.startX) * state.direction
        const nextWidth = clamp(state.startWidth + delta, MIN_ASSISTANT_WIDTH, MAX_ASSISTANT_WIDTH)
        if (Math.abs(nextWidth - assistant.width) > 2) {
          setAssistant((previous) => ({
            ...previous,
            width: nextWidth
          }))
          const fn = handlePointerMove as typeof handlePointerMove & { timeoutId?: NodeJS.Timeout }
          clearTimeout(fn.timeoutId)
          fn.timeoutId = setTimeout(() => {
            updateViewportBounds()
          }, 16)
        }
        return
      }
      const delta = (event.clientY - state.startY) * state.direction
      const nextHeight = clamp(state.startHeight + delta, MIN_ASSISTANT_HEIGHT, MAX_ASSISTANT_HEIGHT)
      if (Math.abs(nextHeight - assistant.height) > 2) {
        setAssistant((previous) => ({
          ...previous,
          height: nextHeight
        }))
        const fn = handlePointerMove as typeof handlePointerMove & { timeoutId?: NodeJS.Timeout }
        clearTimeout(fn.timeoutId)
        fn.timeoutId = setTimeout(() => {
          updateViewportBounds()
        }, 16)
      }
    },
    [assistant.height, assistant.width, updateViewportBounds]
  )

  const handlePointerUp = useCallback(() => {
    const fn = handlePointerMove as typeof handlePointerMove & { timeoutId?: NodeJS.Timeout }
    clearTimeout(fn.timeoutId)
    resizeStateRef.current = null
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    updateViewportBounds()
  }, [handlePointerMove, updateViewportBounds])

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!assistant.isOpen) {
        return
      }
      const orientation = assistant.dock === 'bottom' ? 'vertical' : 'horizontal'
      const direction: 1 | -1 = assistant.dock === 'left' ? 1 : assistant.dock === 'right' ? -1 : -1
      resizeStateRef.current = {
        orientation,
        direction,
        startWidth: assistant.width,
        startHeight: assistant.height,
        startX: event.clientX,
        startY: event.clientY
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = orientation === 'horizontal' ? 'ew-resize' : 'ns-resize'
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      event.preventDefault()
    },
    [assistant.dock, assistant.height, assistant.isOpen, assistant.width, handlePointerMove, handlePointerUp]
  )

  const handleResizeMouseStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      handleResizeStart(event as unknown as React.PointerEvent<HTMLDivElement>)
    },
    [handleResizeStart]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    if (assistant.isOpen) {
      return
    }
    resizeStateRef.current = null
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }, [assistant.isOpen])

  const toggleAssistant = useCallback(() => {
    setAssistant((previous) => {
      const nextIsOpen = !previous.isOpen
      return {
        ...previous,
        isOpen: nextIsOpen,
        sessionId: nextIsOpen ? null : previous.sessionId
      }
    })
    updateViewportBounds()
  }, [updateViewportBounds])

  const closeAssistant = useCallback(() => {
    setAssistant((previous) => ({
      ...previous,
      isOpen: false,
      sessionId: null
    }))
    updateViewportBounds()
  }, [updateViewportBounds])

  const setDock = useCallback((dock: AssistantDock) => {
    setAssistant((previous) => ({
      ...previous,
      dock
    }))
  }, [])

  const setSessionId = useCallback((sessionId: string) => {
    setAssistant((previous) => ({
      ...previous,
      sessionId
    }))
  }, [])

  const clearSession = useCallback(() => {
    setAssistant((previous) => ({
      ...previous,
      sessionId: null
    }))
  }, [])

  return {
    assistant,
    toggleAssistant,
    closeAssistant,
    setDock,
    setSessionId,
    clearSession,
    handleResizeStart,
    handleResizeMouseStart
  }
}
