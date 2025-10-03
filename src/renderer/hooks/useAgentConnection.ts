import { useEffect, useRef, useState, useCallback } from 'react'
import { useAgentStore } from '../stores/agentStore'
import { useConfigStore } from '../stores/configStore'
const performanceMonitor = {
  mark: (_: string) => {},
  measure: (_: string, __: string, ___: string) => {}
}

interface AgentConnectionState {
  isPreloading: boolean
  preloadError: string | null
  connectionProgress: number
  connectionStatus: string
}

/**
 * Optimized agent connection hook with preloading and caching
 */
export const useAgentConnection = () => {
  const [connectionState, setConnectionState] = useState<AgentConnectionState>({
    isPreloading: false,
    preloadError: null,
    connectionProgress: 0,
    connectionStatus: 'idle'
  })

  const { 
    status, 
    isConnected, 
    connectionError, 
    connect 
  } = useAgentStore()
  
  const { config, isConfigured } = useConfigStore()
  const preloadAttempted = useRef(false)
  const preloadPromise = useRef<Promise<void> | null>(null)

  const isConfigComplete = isConfigured()

  /**
   * Preload agent initialization in background
   */
  const preloadAgent = useCallback(async () => {
    if (!config || !isConfigComplete || preloadAttempted.current || isConnected) {
      return
    }

    preloadAttempted.current = true
    performanceMonitor.mark('agent-preload-start')
    
    setConnectionState(prev => ({
      ...prev,
      isPreloading: true,
      connectionProgress: 10,
      connectionStatus: 'Preparing agent configuration...'
    }))

    try {
      const progressUpdates = [
        { progress: 20, status: 'Loading MCP servers...' },
        { progress: 40, status: 'Initializing Hedera connection...' },
        { progress: 60, status: 'Setting up AI models...' },
        { progress: 80, status: 'Establishing secure connection...' },
        { progress: 95, status: 'Finalizing setup...' }
      ]

      for (const update of progressUpdates) {
        setConnectionState(prev => ({
          ...prev,
          connectionProgress: update.progress,
          connectionStatus: update.status
        }))
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      await connect()

      performanceMonitor.mark('agent-preload-end')
      performanceMonitor.measure('agent-connection', 'agent-preload-start', 'agent-preload-end')

      setConnectionState(prev => ({
        ...prev,
        isPreloading: false,
        connectionProgress: 100,
        connectionStatus: 'Connected successfully'
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preload agent'
      setConnectionState(prev => ({
        ...prev,
        isPreloading: false,
        preloadError: errorMessage,
        connectionStatus: 'Connection failed'
      }))
    }
  }, [config, isConfigComplete, isConnected, connect])

  /**
   * Get or create preload promise to avoid duplicate initialization
   */
  const getPreloadPromise = useCallback(() => {
    if (!preloadPromise.current) {
      preloadPromise.current = preloadAgent()
    }
    return preloadPromise.current
  }, [preloadAgent])

  /**
   * Fast connect using preloaded initialization
   */
  const fastConnect = useCallback(async () => {
    if (isConnected) {
      return
    }

    if (connectionState.isPreloading) {
      await getPreloadPromise()
    } else if (!preloadAttempted.current) {
      await connect()
    }
  }, [isConnected, connectionState.isPreloading, getPreloadPromise, connect])

  useEffect(() => {
    if (config && isConfigComplete && !preloadAttempted.current && !isConnected) {
      setTimeout(() => {
        getPreloadPromise()
      }, 100)
    }
  }, [config, isConfigComplete, isConnected, getPreloadPromise])

  useEffect(() => {
    preloadAttempted.current = false
    preloadPromise.current = null
    setConnectionState({
      isPreloading: false,
      preloadError: null,
      connectionProgress: 0,
      connectionStatus: 'idle'
    })
  }, [config?.hedera?.accountId, config?.hedera?.privateKey, config?.openai?.apiKey, config?.anthropic?.apiKey])

  return {
    status,
    isConnected,
    connectionError: connectionError || connectionState.preloadError,
    
    connect: fastConnect,
    
    isPreloading: connectionState.isPreloading,
    connectionProgress: connectionState.connectionProgress,
    connectionStatus: connectionState.connectionStatus,
    
    isConfigComplete
  }
}