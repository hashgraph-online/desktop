import { useCallback, useEffect, useRef } from 'react'
import { calculateBrowserBounds } from '../../../../shared/browser-layout'
import { useBrowserShellStore } from '../../../stores/browserShellStore'
import type { AssistantState, BrowserSurfaceRefs } from './types'
import type { BrowserBounds as DesktopBrowserBounds } from '@/types/desktop-bridge'
import type { BrowserLayoutInfo } from '../../../../shared/browser-layout'

interface UseViewportManagerParams {
  refs: BrowserSurfaceRefs
  assistant: AssistantState
  isBridgeAvailable: boolean
  isAttached: boolean
}

export const useViewportManager = ({ refs, assistant, isBridgeAvailable }: UseViewportManagerParams) => {
  const browserBoundsRef = useRef<DesktopBrowserBounds | null>(null)
  const layoutSignatureRef = useRef<string | null>(null)
  const { isReady, setIsReady } = useBrowserShellStore()
  const { shellRootRef, toolbarRef, bookmarkBarRef, browserContainerRef } = refs
  const rafIdRef = useRef<number | null>(null)

  const performLayoutUpdate = useCallback(() => {
    if (!isBridgeAvailable || !shellRootRef.current || !browserContainerRef.current) {
      return
    }

    const api = window.desktop?.browser

    if (!api || typeof api.setBounds !== 'function') {
      return
    }

    const rootRect = shellRootRef.current.getBoundingClientRect()
    const layoutInfo: BrowserLayoutInfo = {
      toolbarHeight: toolbarRef.current?.offsetHeight ?? 0,
      bookmarkHeight: bookmarkBarRef.current?.offsetHeight ?? 0,
      windowBounds: {
        x: rootRect.x,
        y: rootRect.y,
        width: rootRect.width,
        height: rootRect.height
      },
      devicePixelRatio: window.devicePixelRatio
    }

    if (assistant.isOpen) {
      layoutInfo.assistantPanel = {
        isOpen: true,
        dock: assistant.dock,
        width: assistant.width,
        height: assistant.height
      }
    }

    const rootClientWidth = shellRootRef.current.clientWidth || layoutInfo.windowBounds.width
    const shellRect = shellRootRef.current.getBoundingClientRect()
    const rawClientHeight = shellRootRef.current.clientHeight || layoutInfo.windowBounds.height
    const viewportAvailable = Math.max(window.innerHeight - Math.max(shellRect.top, 0), 0)
    const normalizedClientHeight = Math.max(Math.round(rawClientHeight), Math.round(viewportAvailable))

    if (shellRootRef.current.style.minHeight) {
      shellRootRef.current.style.minHeight = ''
    }

    layoutInfo.windowBounds.height = normalizedClientHeight
    const rootClientHeight = normalizedClientHeight

    const sanitizedLayout: BrowserLayoutInfo = {
      toolbarHeight: Math.max(Math.round(layoutInfo.toolbarHeight), 0),
      bookmarkHeight: Math.max(Math.round(layoutInfo.bookmarkHeight), 0),
      windowBounds: {
        x: Math.max(Math.round(layoutInfo.windowBounds.x), 0),
        y: Math.max(Math.round(layoutInfo.windowBounds.y), 0),
        width: Math.max(Math.round(rootClientWidth), 0),
        height: Math.max(Math.round(rootClientHeight), 0)
      },
      devicePixelRatio:
        typeof layoutInfo.devicePixelRatio === 'number'
          ? Number(layoutInfo.devicePixelRatio.toFixed(4))
          : undefined,
      assistantPanel: layoutInfo.assistantPanel
        ? {
            ...layoutInfo.assistantPanel,
            width: Math.max(Math.round(layoutInfo.assistantPanel.width), 0),
            height: Math.max(Math.round(layoutInfo.assistantPanel.height), 0)
          }
        : undefined
    }

    if (sanitizedLayout.assistantPanel && sanitizedLayout.assistantPanel.dock !== 'bottom') {
      sanitizedLayout.assistantPanel = {
        ...sanitizedLayout.assistantPanel,
        height: sanitizedLayout.windowBounds.height
      }
    }

    if (sanitizedLayout.assistantPanel) {
      sanitizedLayout.assistantPanel = {
        dock: sanitizedLayout.assistantPanel.dock,
        width: sanitizedLayout.assistantPanel.width,
        height: sanitizedLayout.assistantPanel.height,
        isOpen: true
      }
    }

    const signature = JSON.stringify(sanitizedLayout)
    const derivedBounds = calculateBrowserBounds(sanitizedLayout)
    const ratio = window.devicePixelRatio || 1
    const containerRect = browserContainerRef.current.getBoundingClientRect()

    const fallbackLogicalBounds = () => {
      let logicalX = 0
      let logicalY = sanitizedLayout.toolbarHeight + sanitizedLayout.bookmarkHeight
      let logicalWidth = rootClientWidth
      let logicalHeight = rootClientHeight - sanitizedLayout.toolbarHeight - sanitizedLayout.bookmarkHeight

      if (sanitizedLayout.assistantPanel) {
        if (sanitizedLayout.assistantPanel.dock === 'left') {
          logicalWidth = Math.max(logicalWidth - sanitizedLayout.assistantPanel.width, 0)
        } else if (sanitizedLayout.assistantPanel.dock === 'right') {
          logicalWidth = Math.max(logicalWidth - sanitizedLayout.assistantPanel.width, 0)
        }
      }

      if (logicalWidth <= 0) {
        const availableWidth = window.innerWidth - sanitizedLayout.windowBounds.x
        logicalWidth = Math.max(availableWidth, 0)
      }
      if (logicalHeight <= 0) {
        const topOffset = sanitizedLayout.windowBounds.y + logicalY
        const availableHeight = window.innerHeight - topOffset
        logicalHeight = Math.max(availableHeight, 0)
      }

      return {
        x: logicalX,
        y: Math.max(logicalY, 0),
        width: Math.max(logicalWidth, 0),
        height: Math.max(logicalHeight, 0)
      }
    }

    const preferOverlay = assistant.isOpen && assistant.dock === 'bottom'
    const useFallbackBounds =
      preferOverlay ||
      derivedBounds.width <= 0 ||
      derivedBounds.height <= 0 ||
      Number.isNaN(derivedBounds.width) ||
      Number.isNaN(derivedBounds.height) ||
      containerRect.height <= 0

    const logicalBounds = useFallbackBounds ? fallbackLogicalBounds() : derivedBounds

    const absoluteBounds: DesktopBrowserBounds = {
      x: Math.max(
        Math.round((sanitizedLayout.windowBounds.x + logicalBounds.x) * ratio),
        0
      ),
      y: Math.max(
        Math.round((sanitizedLayout.windowBounds.y + logicalBounds.y) * ratio),
        0
      ),
      width: Math.max(Math.round(logicalBounds.width * ratio), 1),
      height: Math.max(Math.round(logicalBounds.height * ratio), 1)
    }

    if (import.meta.env.DEV) {
      ;(window as unknown as { __MOONSCAPE_LAYOUT__?: unknown }).__MOONSCAPE_LAYOUT__ = {
        layoutInfo,
        derivedBounds,
        fallbackLogicalBounds: useFallbackBounds ? logicalBounds : undefined,
        containerRect,
        ratio,
        useFallbackBounds,
        absoluteBounds
      }
    }

    const supportsLayout = typeof api.setLayout === 'function'

    if (supportsLayout && !useFallbackBounds) {
      if (layoutSignatureRef.current !== signature) {
        layoutSignatureRef.current = signature
        void api.setLayout?.(sanitizedLayout).catch((error) => {
          console.warn('[browser] setLayout failed', error)
        })
      }
      browserBoundsRef.current = absoluteBounds
    } else {
      const previous = browserBoundsRef.current
      const changed =
        !previous ||
        Math.abs(previous.x - absoluteBounds.x) > 1 ||
        Math.abs(previous.y - absoluteBounds.y) > 1 ||
        Math.abs(previous.width - absoluteBounds.width) > 1 ||
        Math.abs(previous.height - absoluteBounds.height) > 1

      if (changed) {
        browserBoundsRef.current = absoluteBounds
        void api.setBounds(absoluteBounds).catch((error) => {
          console.warn('[browser] setBounds failed', error)
        })
      }
    }

    if (!isReady) {
      setIsReady(true)
    }
  }, [assistant.dock, assistant.height, assistant.isOpen, assistant.width, bookmarkBarRef, browserContainerRef, isBridgeAvailable, isReady, setIsReady, shellRootRef, toolbarRef])

  const scheduleUpdate = useCallback(() => {
    if (!isBridgeAvailable) {
      return
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      performLayoutUpdate()
    })
  }, [isBridgeAvailable, performLayoutUpdate])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const container = browserContainerRef.current
    if (!container) {
      return
    }
    scheduleUpdate()
    let timeout: NodeJS.Timeout
    const debounced = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => scheduleUpdate(), 16)
    }
    const observer = new ResizeObserver(debounced)
    observer.observe(container)
    window.addEventListener('resize', debounced)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', debounced)
      observer.disconnect()
    }
  }, [browserContainerRef, scheduleUpdate])

  useEffect(() => {
    const observers: ResizeObserver[] = []
    const register = (element: Element | null) => {
      if (!element || typeof ResizeObserver !== 'function') {
        return
      }
      const observer = new ResizeObserver(() => scheduleUpdate())
      observer.observe(element)
      observers.push(observer)
    }
    register(toolbarRef.current)
    register(bookmarkBarRef.current)
    register(shellRootRef.current)
    return () => observers.forEach((observer) => observer.disconnect())
  }, [bookmarkBarRef, scheduleUpdate, shellRootRef, toolbarRef])

  return scheduleUpdate
}
