import { create } from 'zustand'
import {
  PluginConfig,
  NPMPluginConfig,
  LocalPluginConfig,
  CustomPluginConfig,
  PluginSearchResult,
  PluginInstallProgress,
  PluginUpdateInfo,
  PluginRuntimeContext,
  PluginStatus,
  PluginType,
  PluginInstallOptions,
  PluginPermissions
} from '../../shared/types/plugin'

/**
 * Helper to wait for electron bridge to be available
 */
const waitForElectronBridge = async (maxRetries = 30, retryDelay = 1000): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (window.electron && typeof window.electron.searchPlugins === 'function') {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  return false
}

export type PluginInitializationState = 'pending' | 'initializing' | 'ready' | 'partial' | 'failed'

export interface PluginStore {
  plugins: Record<string, PluginConfig>
  searchResults: PluginSearchResult[]
  installProgress: Record<string, PluginInstallProgress>
  updateInfo: Record<string, PluginUpdateInfo>
  runtimeContexts: Record<string, PluginRuntimeContext>
  
  isSearching: boolean
  isInstalling: boolean
  isLoading: boolean
  
  searchQuery?: string
  
  searchError?: string
  installError?: string
  error: string | null
  
  initializationState: PluginInitializationState
  pluginInitStates: Record<string, { state: 'pending' | 'loading' | 'loaded' | 'failed'; error?: string }>
  
  searchPlugins: (query: string) => Promise<void>
  clearSearchResults: () => void
  
  installPlugin: (name: string, options?: PluginInstallOptions) => Promise<void>
  uninstallPlugin: (pluginId: string) => Promise<void>
  updatePlugin: (pluginId: string) => Promise<void>
  
  enablePlugin: (pluginId: string) => Promise<void>
  disablePlugin: (pluginId: string) => Promise<void>
  configurePlugin: (pluginId: string, config: Record<string, any>) => Promise<void>
  
  grantPermissions: (pluginId: string, permissions: PluginPermissions) => Promise<void>
  revokePermissions: (pluginId: string, permissions: PluginPermissions) => Promise<void>
  
  loadLocalPlugin: (path: string) => Promise<void>
  reloadLocalPlugin: (pluginId: string) => Promise<void>
  
  setRegistry: (registry: string, auth?: { token?: string; username?: string; password?: string }) => Promise<void>
  
  loadInstalledPlugins: () => Promise<void>
  checkForUpdates: () => Promise<void>
  
  getPluginById: (pluginId: string) => PluginConfig | undefined
  getEnabledPlugins: () => PluginConfig[]
  getPluginsByType: (type: PluginType) => PluginConfig[]
  clearError: () => void
  getInitializationProgress: () => { total: number; loaded: number; failed: number; pending: number }
  isInitialized: () => boolean
}

export const usePluginStore = create<PluginStore>((set, get) => ({
  plugins: {},
  searchResults: [],
  installProgress: {},
  updateInfo: {},
  runtimeContexts: {},
  isSearching: false,
  isInstalling: false,
  isLoading: false,
  searchQuery: undefined,
  searchError: undefined,
  installError: undefined,
  error: null,
  initializationState: 'pending',
  pluginInitStates: {},
  
  searchPlugins: async (query: string) => {
    set({ isSearching: true, searchError: undefined, searchQuery: query })
    
    try {
      const result = await window.electron.searchPlugins(query)
      
      if (!result.success) {
        throw new Error(result.error || 'Search failed')
      }
      
      set({ 
        searchResults: result.data || [], 
        isSearching: false,
        searchError: undefined
      })
      
    } catch (error) {
      set({
        isSearching: false,
        searchError: error instanceof Error ? error.message : 'Failed to search plugins',
        searchResults: []
      })
      throw error
    }
  },
  
  clearSearchResults: () => {
    set({ searchResults: [], searchQuery: undefined, searchError: undefined })
  },
  
  installPlugin: async (name: string, options?: PluginInstallOptions) => {
    const pluginId = `plugin_${name}_${Date.now()}`
    set({ 
      isInstalling: true, 
      installError: undefined,
      installProgress: {
        ...get().installProgress,
        [pluginId]: {
          pluginId,
          phase: 'downloading',
          progress: 0
        }
      }
    })
    
    try {
      const result = await window.electron.installPlugin(name, options as unknown as Record<string, unknown> | undefined)
      
      if (!result.success) {
        throw new Error(result.error || 'Installation failed')
      }
      
      const newPlugin = result.data as NPMPluginConfig
      
      set(state => ({
        plugins: {
          ...state.plugins,
          [newPlugin.id]: newPlugin
        },
        isInstalling: false,
        installError: undefined,
        installProgress: {
          ...state.installProgress,
          [pluginId]: {
            pluginId,
            phase: 'completed',
            progress: 100
          }
        }
      }))
      
      setTimeout(() => {
        set(state => {
          const { [pluginId]: _, ...rest } = state.installProgress
          return { installProgress: rest }
        })
      }, 5000)
      
    } catch (error) {
      set(state => ({
        isInstalling: false,
        installError: error instanceof Error ? error.message : 'Failed to install plugin',
        installProgress: {
          ...state.installProgress,
          [pluginId]: {
            pluginId,
            phase: 'failed',
            error: error instanceof Error ? error.message : 'Installation failed'
          }
        }
      }))
      throw error
    }
  },
  
  uninstallPlugin: async (pluginId: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const plugin = get().plugins[pluginId]
      if (!plugin) {
        throw new Error('Plugin not found')
      }
      
      if (plugin.enabled) {
        await get().disablePlugin(pluginId)
      }
      
      const result = await window.electron.uninstallPlugin(pluginId)
      
      if (!result.success) {
        throw new Error(result.error || 'Uninstallation failed')
      }
      
      set(state => {
        const { [pluginId]: _, ...rest } = state.plugins
        const { [pluginId]: _2, ...restRuntime } = state.runtimeContexts
        const { [pluginId]: _3, ...restUpdate } = state.updateInfo
        
        return {
          plugins: rest,
          runtimeContexts: restRuntime,
          updateInfo: restUpdate,
          isLoading: false,
          error: null
        }
      })
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to uninstall plugin'
      })
      throw error
    }
  },
  
  updatePlugin: async (pluginId: string) => {
    set({ 
      isInstalling: true, 
      installError: undefined,
      installProgress: {
        ...get().installProgress,
        [pluginId]: {
          pluginId,
          phase: 'downloading',
          progress: 0,
          message: 'Updating plugin...'
        }
      }
    })
    
    try {
      const result = await window.electron.updatePlugin(pluginId)
      
      if (!result.success) {
        throw new Error(result.error || 'Update failed')
      }
      
      const updatedPlugin = result.data as PluginConfig
      
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: updatedPlugin
        },
        isInstalling: false,
        installError: undefined,
        installProgress: {
          ...state.installProgress,
          [pluginId]: {
            pluginId,
            phase: 'completed',
            progress: 100,
            message: 'Update completed'
          }
        },
        updateInfo: {
          ...state.updateInfo,
          [pluginId]: {
            ...state.updateInfo[pluginId],
            currentVersion: updatedPlugin.version
          }
        }
      }))
      
      setTimeout(() => {
        set(state => {
          const { [pluginId]: _, ...rest } = state.installProgress
          return { installProgress: rest }
        })
      }, 5000)
      
    } catch (error) {
      set(state => ({
        isInstalling: false,
        installError: error instanceof Error ? error.message : 'Failed to update plugin',
        installProgress: {
          ...state.installProgress,
          [pluginId]: {
            pluginId,
            phase: 'failed',
            error: error instanceof Error ? error.message : 'Update failed'
          }
        }
      }))
      throw error
    }
  },
  
  enablePlugin: async (pluginId: string) => {
    try {
      const plugin = get().plugins[pluginId]
      if (!plugin || plugin.enabled) {
        return
      }
      
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: { ...plugin, status: 'enabled' as PluginStatus, enabled: true }
        }
      }))
      
      const result = await window.electron.enablePlugin(pluginId)
      
      if (!result.success) {
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: { ...plugin, status: 'disabled' as PluginStatus, enabled: false }
          }
        }))
        throw new Error(result.error || 'Failed to enable plugin')
      }
      
      if (result.data) {
        set(state => ({
          runtimeContexts: {
            ...state.runtimeContexts,
            [pluginId]: result.data as PluginRuntimeContext
          }
        }))
      }
      
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to enable plugin'
      })
      throw error
    }
  },
  
  disablePlugin: async (pluginId: string) => {
    try {
      const plugin = get().plugins[pluginId]
      if (!plugin || !plugin.enabled) {
        return
      }
      
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: { ...plugin, status: 'disabled' as PluginStatus, enabled: false }
        }
      }))
      
      const result = await window.electron.disablePlugin(pluginId)
      
      if (!result.success) {
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: { ...plugin, status: 'enabled' as PluginStatus, enabled: true }
          }
        }))
        throw new Error(result.error || 'Failed to disable plugin')
      }
      
      set(state => ({
        runtimeContexts: {
          ...state.runtimeContexts,
          [pluginId]: {
            ...state.runtimeContexts[pluginId],
            isEnabled: false,
            isLoaded: false
          }
        }
      }))
      
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to disable plugin'
      })
      throw error
    }
  },
  
  configurePlugin: async (pluginId: string, config: Record<string, any>) => {
    set({ isLoading: true, error: null })
    
    try {
      const plugin = get().plugins[pluginId]
      if (!plugin) {
        throw new Error('Plugin not found')
      }
      
      const result = await window.electron.configurePlugin(pluginId, config as unknown as Record<string, unknown>)
      
      if (!result.success) {
        throw new Error(result.error || 'Configuration failed')
      }
      
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: {
            ...plugin,
            config,
            updatedAt: new Date()
          }
        },
        isLoading: false,
        error: null
      }))
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to configure plugin'
      })
      throw error
    }
  },
  
  grantPermissions: async (pluginId: string, permissions: PluginPermissions) => {
    set({ isLoading: true, error: null })
    
    try {
      const result = await window.electron.grantPluginPermissions(pluginId, permissions as unknown as Record<string, unknown>)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to grant permissions')
      }
      
      const plugin = get().plugins[pluginId]
      if (plugin) {
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: {
              ...plugin,
              grantedPermissions: permissions,
              updatedAt: new Date()
            }
          },
          isLoading: false,
          error: null
        }))
      }
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to grant permissions'
      })
      throw error
    }
  },
  
  revokePermissions: async (pluginId: string, permissions: PluginPermissions) => {
    set({ isLoading: true, error: null })
    
    try {
      const result = await window.electron.revokePluginPermissions(pluginId, permissions as unknown as Record<string, unknown>)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke permissions')
      }
      
      const plugin = get().plugins[pluginId]
      if (plugin) {
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: {
              ...plugin,
              grantedPermissions: result.data as PluginPermissions,
              updatedAt: new Date()
            }
          },
          isLoading: false,
          error: null
        }))
      }
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to revoke permissions'
      })
      throw error
    }
  },
  
  loadLocalPlugin: async (path: string) => {
    throw new Error('Local plugin loading is not yet implemented')
  },
  
  reloadLocalPlugin: async (pluginId: string) => {
    throw new Error('Local plugin reloading is not yet implemented')
  },
  
  setRegistry: async (registry: string, auth?: { token?: string; username?: string; password?: string }) => {
    throw new Error('Custom plugin registry is not yet implemented')
  },
  
  loadInstalledPlugins: async () => {
    set({ isLoading: true, error: null, initializationState: 'initializing' })
    
    try {
      const isAvailable = await waitForElectronBridge()
      
      if (!isAvailable) {
        set({ 
          plugins: {}, 
          isLoading: false,
          error: 'Plugin services not available - running in degraded mode',
          initializationState: 'failed'
        })
        return
      }
      
      
      const result = await window.electron.getInstalledPlugins()
      if (!result.success) {
        set({ 
          plugins: {}, 
          isLoading: false,
          error: `Failed to load plugins: ${result.error || 'Unknown error'}`,
          initializationState: 'failed'
        })
        return
      }
      
      const plugins = result.data || []
      const pluginsMap: Record<string, PluginConfig> = {}
      const pluginInitStates: Record<string, { state: 'pending' | 'loading' | 'loaded' | 'failed'; error?: string }> = {}
      
      plugins.forEach((plugin: PluginConfig) => {
        pluginsMap[plugin.id] = plugin
        pluginInitStates[plugin.id] = { state: 'pending' }
      })
      
      set({ plugins: pluginsMap, pluginInitStates, isLoading: false, error: null })
      
      const enabledPlugins = plugins.filter((p: PluginConfig) => p.enabled)
      let loadedCount = 0
      let failedCount = 0
      
      for (const plugin of enabledPlugins) {
        try {
          set(state => ({
            pluginInitStates: {
              ...state.pluginInitStates,
              [plugin.id]: { state: 'loading' }
            }
          }))
          
          await get().enablePlugin(plugin.id)
          loadedCount++
          
          set(state => ({
            pluginInitStates: {
              ...state.pluginInitStates,
              [plugin.id]: { state: 'loaded' }
            }
          }))
        } catch (loadError) {
          failedCount++
          
          set(state => ({
            pluginInitStates: {
              ...state.pluginInitStates,
              [plugin.id]: { 
                state: 'failed', 
                error: loadError instanceof Error ? loadError.message : 'Loading failed' 
              }
            }
          }))
        }
      }
      
      let finalState: PluginInitializationState = 'ready'
      if (enabledPlugins.length === 0) {
        finalState = 'ready'
      } else if (loadedCount === 0 && failedCount > 0) {
        finalState = 'failed'
      } else if (loadedCount > 0 && failedCount > 0) {
        finalState = 'partial'
      } else if (loadedCount > 0 && failedCount === 0) {
        finalState = 'ready'
      }
      
      set({ initializationState: finalState, error: null })
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load installed plugins',
        initializationState: 'failed'
      })
    }
  },
  
  checkForUpdates: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const result = await window.electron.checkPluginUpdates()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to check for updates')
      }
      
      const updates = result.data || []
      const updateInfoMap: Record<string, PluginUpdateInfo> = {}
      
      updates.forEach((update: PluginUpdateInfo) => {
        updateInfoMap[update.pluginId] = update
      })
      
      set({ updateInfo: updateInfoMap, isLoading: false, error: null })
      
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates'
      })
      throw error
    }
  },
  
  getPluginById: (pluginId: string) => {
    const { plugins } = get()
    return plugins[pluginId]
  },
  
  getEnabledPlugins: () => {
    const { plugins } = get()
    return Object.values(plugins).filter(plugin => plugin.enabled)
  },
  
  getPluginsByType: (type: PluginType) => {
    const { plugins } = get()
    return Object.values(plugins).filter(plugin => plugin.type === type)
  },
  
  clearError: () => set({ error: null, searchError: undefined, installError: undefined }),
  
  getInitializationProgress: () => {
    const { pluginInitStates, plugins } = get()
    const enabledPlugins = Object.values(plugins).filter(p => p.enabled)
    
    let loaded = 0
    let failed = 0
    let pending = 0
    
    enabledPlugins.forEach(plugin => {
      const state = pluginInitStates[plugin.id]
      if (!state) {
        pending++
      } else {
        switch (state.state) {
          case 'loaded':
            loaded++
            break
          case 'failed':
            failed++
            break
          case 'pending':
          case 'loading':
            pending++
            break
        }
      }
    })
    
    return {
      total: enabledPlugins.length,
      loaded,
      failed,
      pending
    }
  },
  
  isInitialized: () => {
    const { initializationState } = get()
    return initializationState === 'ready' || initializationState === 'partial' || initializationState === 'failed'
  }
}))