import { create } from 'zustand'
import {
  PluginConfig,
  PluginSearchResult,
  PluginInstallProgress,
  PluginUpdateInfo,
  PluginRuntimeContext,
  PluginStatus,
  PluginType,
  PluginInstallOptions,
  PluginPermissions
} from '../../shared/types/plugin'
import { useConfigStore } from './configStore'

type BuiltinPluginDefinition = {
  id: string
  name: string
  version: string
  description: string
  keywords: string[]
  author: string
  homepage?: string
}

export const builtinPluginDefinitions: ReadonlyArray<BuiltinPluginDefinition> = [
  {
    id: 'web-browser',
    name: 'Web Browser Plugin',
    version: '0.1.0',
    description:
      'Allows the Moonscape assistant to capture active tab context and invoke a LangChain-powered web snapshot tool for richer answers.',
    keywords: ['browser', 'assistant', 'context'],
    author: 'Hashgraph Online',
    homepage: 'https://hashgraph.online/'
  },
  {
    id: 'swarm',
    name: 'Swarm Plugin',
    version: '0.1.0',
    description:
      'Swarm operations: tools for interacting with the Swarm decentralized storage.',
    keywords: ['Swarm', 'storage'],
    author: 'Solar Punk',
    homepage: 'https://solarpunk.buzz/',
  },
]

const buildBuiltinPluginConfig = (
  definition: BuiltinPluginDefinition,
  enabled: boolean
): PluginConfig => {
  const now = new Date()
  return {
    id: definition.id,
    name: definition.name,
    type: 'custom',
    status: enabled ? 'enabled' : 'disabled',
    enabled,
    version: definition.version,
    metadata: {
      name: definition.name,
      version: definition.version,
      description: definition.description,
      author: definition.author,
      homepage: definition.homepage,
      keywords: definition.keywords,
      lastPublished: now
    },
    createdAt: now,
    updatedAt: now
  }
}

const computeBuiltinPlugins = (enabledMap: Record<string, boolean>): Record<string, PluginConfig> => {
  return builtinPluginDefinitions.reduce<Record<string, PluginConfig>>((acc, definition) => {
    const enabled = enabledMap[definition.id] ?? true
    acc[definition.id] = buildBuiltinPluginConfig(definition, enabled)
    return acc
  }, {})
}

const getBuiltinEnabledState = () => {
  const { config } = useConfigStore.getState()
  return {
    'web-browser': config?.advanced?.webBrowserPluginEnabled ?? true,
    swarm: config?.advanced?.swarmPluginEnabled ?? true
  }
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
  configurePlugin: (pluginId: string, config: Record<string, unknown>) => Promise<void>

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

let configSubscriptionAttached = false

export const usePluginStore = create<PluginStore>((set, get) => {
  if (!configSubscriptionAttached) {
    configSubscriptionAttached = true
    useConfigStore.subscribe(
      state => state.config?.advanced?.webBrowserPluginEnabled ?? true,
      (enabled) => {
        set(current => {
          const definition = builtinPluginDefinitions.find(def => def.id === 'web-browser')!
          const existing = current.plugins['web-browser'] ?? buildBuiltinPluginConfig(definition, enabled)
          return {
            plugins: {
              ...current.plugins,
              'web-browser': {
                ...existing,
                status: enabled ? 'enabled' : 'disabled',
                enabled,
                updatedAt: new Date()
              }
            }
          }
        })
      }
    )
    
    useConfigStore.subscribe(
      state => state.config?.advanced?.swarmPluginEnabled ?? true,
      (enabled) => {
        set(current => {
          const definition = builtinPluginDefinitions.find(def => def.id === 'swarm')!
          const existing = current.plugins['swarm'] ?? buildBuiltinPluginConfig(definition, enabled)
          return {
            plugins: {
              ...current.plugins,
              'swarm': {
                ...existing,
                status: enabled ? 'enabled' : 'disabled',
                enabled,
                updatedAt: new Date()
              }
            }
          }
        })
      }
    )
  }

  const initialPlugins = computeBuiltinPlugins(getBuiltinEnabledState())
  const initialInitStates = Object.fromEntries(
    Object.keys(initialPlugins).map(id => [id, { state: 'loaded' as const }])
  )

  return {
    plugins: initialPlugins,
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
    initializationState: 'ready',
    pluginInitStates: initialInitStates,

    searchPlugins: async (query: string) => {
      const normalized = query.trim().toLowerCase()
      const results: PluginSearchResult[] = builtinPluginDefinitions
        .filter(def =>
          !normalized ||
          def.name.toLowerCase().includes(normalized) ||
          def.keywords.some(keyword => keyword.toLowerCase().includes(normalized)) ||
          def.description.toLowerCase().includes(normalized)
        )
        .map(def => ({
          name: def.name,
          version: def.version,
          description: def.description,
          keywords: def.keywords,
          date: new Date().toISOString(),
          links: def.homepage ? { homepage: def.homepage } : undefined,
          author: { name: def.author }
        }))

      set({
        searchQuery: query,
        searchResults: results,
        isSearching: false,
        searchError: undefined
      })
    },

    clearSearchResults: () => {
      set({ searchResults: [], searchQuery: undefined, searchError: undefined })
    },

    installPlugin: async () => {
      throw new Error('Plugin installation is not available in this build of desktop-tauri.')
    },

    uninstallPlugin: async () => {
      throw new Error('Plugin uninstallation is not available in this build of desktop-tauri.')
    },

    updatePlugin: async () => {
      throw new Error('Plugin updates are not available in this build of desktop-tauri.')
    },

    enablePlugin: async (pluginId: string) => {
      const plugin = get().plugins[pluginId]
      if (!plugin || plugin.enabled) {
        return
      }

      const original = plugin
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: {
            ...plugin,
            status: 'enabled' as PluginStatus,
            enabled: true,
            updatedAt: new Date()
          }
        }
      }))

      try {
        const result = await window?.desktop?.enablePlugin(pluginId)
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to enable plugin')
        }

        if (pluginId === 'web-browser') {
          const configStore = useConfigStore.getState()
          configStore.setWebBrowserPluginEnabled(true)
        } else if (pluginId === 'swarm') {
          const configStore = useConfigStore.getState()
          configStore.setSwarmPluginEnabled(true)
        }

        if (result?.data) {
          set(state => ({
            runtimeContexts: {
              ...state.runtimeContexts,
              [pluginId]: result.data as PluginRuntimeContext
            }
          }))
        }
      } catch (error) {
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: {
              ...original,
              status: 'disabled',
              enabled: false,
              updatedAt: new Date()
            }
          },
          error: error instanceof Error ? error.message : 'Failed to enable plugin'
        }))
        throw error
      }
    },

    disablePlugin: async (pluginId: string) => {
      const plugin = get().plugins[pluginId]

      if (!plugin || !plugin.enabled) {
        return
      }

      const original = plugin
      set(state => ({
        plugins: {
          ...state.plugins,
          [pluginId]: {
            ...plugin,
            status: 'disabled' as PluginStatus,
            enabled: false,
            updatedAt: new Date()
          }
        }
      }))

      try {
        const result = await window?.desktop?.disablePlugin(pluginId)
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to disable plugin')
        }

        if (pluginId === 'web-browser') {
          const configStore = useConfigStore.getState()
          configStore.setWebBrowserPluginEnabled(false)
        } else if (pluginId === 'swarm') {
          const configStore = useConfigStore.getState()
          configStore.setSwarmPluginEnabled(false)
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
        set(state => ({
          plugins: {
            ...state.plugins,
            [pluginId]: {
              ...original,
              status: 'enabled',
              enabled: true,
              updatedAt: new Date()
            }
          },
          error: error instanceof Error ? error.message : 'Failed to disable plugin'
        }))
        throw error
      }
    },

    configurePlugin: async () => {
      throw new Error('Plugin configuration is not available in this build of desktop-tauri.')
    },

    grantPermissions: async () => {
      throw new Error('Granting plugin permissions is not available in this build of desktop-tauri.')
    },

    revokePermissions: async () => {
      throw new Error('Revoking plugin permissions is not available in this build of desktop-tauri.')
    },

    loadLocalPlugin: async () => {
      throw new Error('Local plugins are not supported in this build of desktop-tauri.')
    },

    reloadLocalPlugin: async () => {
      throw new Error('Local plugins are not supported in this build of desktop-tauri.')
    },

    setRegistry: async () => {
      throw new Error('Custom plugin registries are not supported in this build of desktop-tauri.')
    },

    loadInstalledPlugins: async () => {
      set({ isLoading: true, error: null, initializationState: 'initializing' })
      const enabledState = getBuiltinEnabledState()
      const plugins = computeBuiltinPlugins(enabledState)
      const pluginInitStates = Object.fromEntries(
        Object.keys(plugins).map(id => [id, { state: 'loaded' as const }])
      )
      set({
        plugins,
        pluginInitStates,
        isLoading: false,
        initializationState: 'ready',
        error: null
      })
    },

    checkForUpdates: async () => {
      set({ updateInfo: {} })
    },

    getPluginById: (pluginId: string) => get().plugins[pluginId],

    getEnabledPlugins: () => {
      return Object.values(get().plugins).filter(plugin => plugin.enabled)
    },

    getPluginsByType: (type: PluginType) => {
      return Object.values(get().plugins).filter(plugin => plugin.type === type)
    },

    clearError: () => {
      set({ error: null, installError: undefined, searchError: undefined })
    },

    getInitializationProgress: () => {
      const total = Object.keys(get().plugins).length
      const loaded = total
      return {
        total,
        loaded,
        failed: 0,
        pending: 0
      }
    },

    isInitialized: () => get().initializationState === 'ready'
  }
})
