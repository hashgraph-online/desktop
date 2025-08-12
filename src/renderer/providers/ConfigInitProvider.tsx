import React, { useEffect, useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { configService } from '../services/configService'

interface ConfigInitProviderProps {
  children: React.ReactNode
}

/**
 * Provider that loads configuration on app startup.
 * Ensures configuration is loaded before children render.
 * 
 * @param children - Child components to render after config initialization
 * @returns React component that manages configuration loading lifecycle
 */
export const ConfigInitProvider: React.FC<ConfigInitProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const loadConfig = useConfigStore((state) => state.loadConfig)
  const config = useConfigStore((state) => state.config)

  useEffect(() => {
    let mounted = true
    
    const loadConfiguration = async () => {
      try {
        if (mounted) {
          await loadConfig()
          setIsInitialized(true)
        }
      } catch (error) {
        if (mounted) {
          setIsInitialized(true)
        }
      }
    }
    
    loadConfiguration()
    
    return () => {
      mounted = false
    }
  }, [loadConfig])

  useEffect(() => {
    if (config?.advanced?.theme) {
      configService.applyTheme(config.advanced.theme).catch(error => {
      })
    }
  }, [config?.advanced?.theme])

  return <>{children}</>
}