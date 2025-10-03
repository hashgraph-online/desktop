import type { AssistantState } from '../types'

export interface BrowserLayoutMetrics {
  viewportLeft: number
  viewportTop: number
  viewportWidth: number
  viewportHeight: number
  assistantOverlay: {
    left: number
    width: number
    height: number
    top: number
    right: number
  }
}

const TOOLBAR_HEIGHT = 44
const BOOKMARK_HEIGHT = 33

const clamp = (value: number, min = 0): number =>
  Number.isFinite(value) ? Math.max(Math.round(value), min) : min

export const calculateOverlayLayout = (
  shellWidth: number,
  shellHeight: number,
  assistant: AssistantState
): BrowserLayoutMetrics => {
  const viewportTop = TOOLBAR_HEIGHT + BOOKMARK_HEIGHT
  const baseViewportWidth = clamp(shellWidth)
  const baseViewportHeight = clamp(shellHeight - viewportTop)

  let viewportHeight = baseViewportHeight

  let viewportLeft = 0
  let viewportWidth = baseViewportWidth

  let assistantWidth = 0
  let assistantHeight = 0
  let assistantTop = viewportTop + viewportHeight
  let assistantLeft = 0
  let assistantRight = 0

  if (assistant.isOpen) {
    if (assistant.dock === 'left') {
      const dockWidth = clamp(Math.min(assistant.width, viewportWidth))
      const remainingWidth = Math.max(viewportWidth - dockWidth, 0)
      assistantWidth = dockWidth
      assistantHeight = viewportHeight
      assistantLeft = viewportLeft
      assistantRight = Math.max(baseViewportWidth - (assistantLeft + dockWidth), 0)
      viewportLeft += dockWidth
      viewportWidth = remainingWidth
      assistantTop = viewportTop
    } else if (assistant.dock === 'right') {
      const dockWidth = clamp(Math.min(assistant.width, viewportWidth))
      const remainingWidth = Math.max(viewportWidth - dockWidth, 0)
      assistantWidth = dockWidth
      assistantHeight = viewportHeight
      assistantLeft = viewportLeft + remainingWidth
      assistantRight = 0
      viewportWidth = remainingWidth
      assistantTop = viewportTop
    } else if (assistant.dock === 'bottom') {
      const dockHeight = clamp(Math.min(assistant.height, viewportHeight))
      assistantWidth = viewportWidth
      assistantHeight = dockHeight
      assistantTop = viewportTop + Math.max(viewportHeight - dockHeight, 0)
      assistantLeft = viewportLeft
      assistantRight = Math.max(baseViewportWidth - (viewportLeft + viewportWidth), 0)
    }
  }

  return {
    viewportLeft,
    viewportTop,
    viewportWidth,
    viewportHeight,
    assistantOverlay: {
      left: assistantLeft,
      width: assistantWidth,
      height: assistantHeight,
      top: assistantTop,
      right: assistantRight
    }
  }
}
