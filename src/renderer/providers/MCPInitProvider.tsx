import React, { useEffect, useRef } from 'react'
import { useMCPStore } from '../stores/mcpStore'
import { createElectronRendererLogger } from '../utils/electron-logger-adapter'

interface MCPInitProviderProps {
  children: React.ReactNode
}

/**
 * Waits for the electron bridge to be ready before proceeding
 */
const waitForElectronBridge = async (maxRetries = 30, retryDelay = 1000): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  for (let i = 0; i < maxRetries; i++) {
    if (window.electron && typeof window.electron.loadMCPServers === 'function') {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  return false
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
        logger.current.info('Waiting for electron bridge...')
        
        const bridgeReady = await waitForElectronBridge()
        
        if (!bridgeReady) {
          logger.current.error('Electron bridge not available after 30 seconds')
          return
        }
        
        logger.current.info('Electron bridge ready, initializing MCP services...')
        
        await loadServers()
        
        logger.current.info('MCP services initialized successfully')
      } catch (err) {
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

  return <>{children}</>
}