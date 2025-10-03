import { useCallback, useEffect, useRef } from 'react'

interface UseAttachManagerParams {
  isBridgeAvailable: boolean
  isAttached: boolean
  isMinimized: boolean
  markAttached: () => void
  markDetached: () => void
  updateViewportBounds: () => void
  handleBridgeFailure: (reason: unknown) => void
  onDetachError: (reason: unknown) => void
  onAttached?: () => void
  onDetached?: () => void
}

export const useAttachManager = ({
  isBridgeAvailable,
  isAttached,
  isMinimized,
  markAttached,
  markDetached,
  updateViewportBounds,
  handleBridgeFailure,
  onDetachError,
  onAttached,
  onDetached
}: UseAttachManagerParams) => {
  const isMinimizedRef = useRef(isMinimized)
  const attachInFlightRef = useRef(false)
  const detachInFlightRef = useRef(false)
  const detachOnUnmountRef = useRef<() => void>(() => undefined)
  const lastIntentRef = useRef<boolean | null>(null)

  useEffect(() => {
    isMinimizedRef.current = isMinimized
  }, [isMinimized])

  const attachBrowserView = useCallback(async () => {
    if (!isBridgeAvailable || isMinimizedRef.current) {
      if (import.meta.env.DEV) {
        console.info('[browser] attach:skip', {
          reason: 'bridge-unavailable-or-minimized',
          isBridgeAvailable,
          isMinimized: isMinimizedRef.current
        })
      }
      return
    }
    if (isAttached) {
      if (import.meta.env.DEV) {
        console.info('[browser] attach:skip', { reason: 'already-attached' })
      }
      updateViewportBounds()
      return
    }
    if (attachInFlightRef.current || detachInFlightRef.current) {
      if (import.meta.env.DEV) {
        console.info('[browser] attach:skip', {
          reason: 'in-flight',
          attachInFlight: attachInFlightRef.current,
          detachInFlight: detachInFlightRef.current
        })
      }
      return
    }
    const api = window.desktop?.browser
    if (!api) {
      if (import.meta.env.DEV) {
        console.info('[browser] attach:skip', { reason: 'no-browser-api' })
      }
      return
    }
    attachInFlightRef.current = true
    try {
      await api.attach()
      markAttached()
      updateViewportBounds()
      requestAnimationFrame(() => {
        updateViewportBounds()
        onAttached?.()
      })
      if (import.meta.env.DEV) {
        console.info('[browser] attach:success')
      }
    } catch (error) {
      markDetached()
      handleBridgeFailure(error)
    } finally {
      attachInFlightRef.current = false
    }
  }, [handleBridgeFailure, isAttached, isBridgeAvailable, markAttached, markDetached, onAttached, updateViewportBounds])

  const detachBrowserView = useCallback(async () => {
    if (!isAttached && !attachInFlightRef.current) {
      if (import.meta.env.DEV) {
        console.info('[browser] detach:skip', { reason: 'already-detached' })
      }
      return
    }
    if (detachInFlightRef.current) {
      if (import.meta.env.DEV) {
        console.info('[browser] detach:skip', { reason: 'detach-in-flight' })
      }
      return
    }
    detachInFlightRef.current = true
    attachInFlightRef.current = false
    markDetached()
    const api = window.desktop?.browser
    if (!api) {
      detachInFlightRef.current = false
      return
    }
    try {
      await api.detach()
      if (import.meta.env.DEV) {
        console.info('[browser] detach:success')
      }
      onDetached?.()
    } catch (error) {
      onDetachError(error)
    } finally {
      detachInFlightRef.current = false
    }
  }, [isAttached, markDetached, onDetachError])

  useEffect(() => {
    const shouldAttach = isBridgeAvailable && !isMinimized
    if (lastIntentRef.current === shouldAttach) {
      return
    }
    lastIntentRef.current = shouldAttach
    if (shouldAttach) {
      void attachBrowserView()
    } else {
      void detachBrowserView()
    }
  }, [attachBrowserView, detachBrowserView, isBridgeAvailable, isMinimized])

  useEffect(() => {
    detachOnUnmountRef.current = () => {
      void detachBrowserView()
    }
  }, [detachBrowserView])

  useEffect(() => {
    return () => {
      detachOnUnmountRef.current()
      lastIntentRef.current = null
    }
  }, [])
}
