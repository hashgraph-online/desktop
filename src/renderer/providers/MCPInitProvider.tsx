import React, { useEffect, useRef } from 'react'
import { useMCPStore } from '../stores/mcpStore'
import { createElectronRendererLogger } from '../utils/electron-logger-adapter'

interface MCPInitProviderProps {
  children: React.ReactNode
}

/**
 * Waits for the desktop bridge to be ready before proceeding
 */
const waitForDesktopBridge = async (maxRetries = 30, retryDelay = 1000): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  for (let i = 0; i < maxRetries; i++) {
    if (window.desktop && typeof window?.desktop?.loadMCPServers === 'function') {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  return false
}

const isLocalPermissionError = (message: string) =>
  message.includes('not allowed on window') && message.includes('URL: local')

const waitForRemoteOrigin = async (timeoutMs = 15000) => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.origin.startsWith('http')) {
    return
  }

  const metadata = (window as { __TAURI_METADATA__?: { config?: { build?: { devUrl?: string } } } }).__TAURI_METADATA__
  const devUrl = metadata?.config?.build?.devUrl ?? import.meta.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5175'
  if (typeof devUrl === 'string' && devUrl.length > 0) {
    window.location.replace(devUrl)
    return
  }

  const start = Date.now()

  await new Promise<void>((resolve, reject) => {
    const poll = () => {
      if (window.location.origin.startsWith('http')) {
        resolve()
        return
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error('waitForRemoteOrigin timeout'))
        return
      }

      requestAnimationFrame(poll)
    }

    poll()
  }).catch(() => undefined)
}

/**
 * Provider component that initializes MCP services on app startup
 */
export const MCPInitProvider: React.FC<MCPInitProviderProps> = ({ children }) => {
  const { loadServers, error } = useMCPStore()
  const hasInitialized = useRef(false)
  const logger = useRef(createElectronRendererLogger({ module: 'MCPInitProvider' }))

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    const initializeMCP = async () => {
      try {
        logger.current.info('Waiting for desktop bridge...')

        const bridgeReady = await waitForDesktopBridge()

        if (!bridgeReady) {
          logger.current.error('Desktop bridge not available after 30 seconds')
          return
        }

        logger.current.info('Desktop bridge ready, initializing MCP services...')

        await waitForRemoteOrigin()
        if (!window.location.origin.startsWith('http')) {
          logger.current.warn('MCP bridge still served from local origin; deferring init')
          hasInitialized.current = false
          return
        }

        await loadServers()
        if (window.desktop?.getMCPCacheStats) {
          try {
            const stats = await window.desktop.getMCPCacheStats()
            if (stats && typeof stats === 'object' && 'success' in stats) {
              if ((stats as { success: boolean }).success) {
                logger.current.debug('Loaded MCP cache stats on init', stats)
              }
            }
          } catch (statsError) {
            const message =
              statsError instanceof Error
                ? statsError.message
                : String(statsError)

            if (isLocalPermissionError(message)) {
              await waitForRemoteOrigin()
              return initializeMCP()
            }

            if (!message.includes('Command mcp_get_cache_stats not found')) {
              throw statsError
            }
          }
        }

        logger.current.info('MCP services initialized successfully')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (isLocalPermissionError(message)) {
          await waitForRemoteOrigin()
          return initializeMCP()
        }

        if (message.includes('Command mcp_get_cache_stats not found')) {
          logger.current.warn('MCP cache stats command unavailable; continuing without metrics')
          return
        }

        logger.current.error('Failed to initialize MCP services:', err)
      }
    }

    initializeMCP()
  }, [loadServers])

  useEffect(() => {
    if (error) {
      logger.current.error('MCP error:', error)
    }
  }, [error])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (window.desktop?.triggerMCPBackgroundSync) {
        try {
          await window.desktop.triggerMCPBackgroundSync()
        } catch (syncError) {
          logger.current.debug?.('Background MCP sync failed', syncError)
        }
      }
    }, 1000 * 60 * 30)

    return () => clearInterval(interval)
  }, [])

  return <>{children}</>
}
