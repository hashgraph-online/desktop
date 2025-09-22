import { act } from '@testing-library/react'
import { usePluginStore } from '../../../src/renderer/stores/pluginStore'
import { mockElectronBridge, factories } from '../../utils/testHelpers'

describe('pluginStore', () => {
  let mockElectron: ReturnType<typeof mockElectronBridge>

  const resetStoreState = () => {
    usePluginStore.setState({
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
    })
  }

  beforeEach(() => {
    mockElectron = mockElectronBridge()
    window.electron = mockElectron
    jest.clearAllMocks()
    resetStoreState()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const state = usePluginStore.getState()

      expect(state.plugins).toEqual({})
      expect(state.searchResults).toEqual([])
      expect(state.isSearching).toBe(false)
      expect(state.isInstalling).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.initializationState).toBe('pending')
    })
  })

  describe('searchPlugins', () => {
    it('should search plugins successfully', async () => {
      const mockResults = [
        { name: 'test-plugin', version: '1.0.0', description: 'Test plugin' },
      ]

      mockElectron.searchPlugins.mockResolvedValue({
        success: true,
        data: mockResults,
      })

      await act(async () => {
        await usePluginStore.getState().searchPlugins('test')
      })

      const state = usePluginStore.getState()
      expect(mockElectron.searchPlugins).toHaveBeenCalledWith('test')
      expect(state.searchResults).toEqual(mockResults)
      expect(state.isSearching).toBe(false)
      expect(state.searchError).toBeUndefined()
      expect(state.searchQuery).toBe('test')
    })

    it('should handle search errors', async () => {
      mockElectron.searchPlugins.mockResolvedValue({
        success: false,
        error: 'Search failed',
      })

      await act(async () => {
        try {
          await usePluginStore.getState().searchPlugins('test')
        } catch (_error) {
        }
      })

      const state = usePluginStore.getState()
      expect(state.isSearching).toBe(false)
      expect(state.searchError).toBe('Search failed')
      expect(state.searchResults).toEqual([])
    })

    it('should set loading state during search', async () => {
      let resolveSearch: ((value: { success: boolean; data: unknown[] }) => void) | undefined
      mockElectron.searchPlugins.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveSearch = resolve
          })
      )

      let searchPromise: Promise<void> | undefined
      await act(async () => {
        searchPromise = usePluginStore.getState().searchPlugins('test')
        expect(usePluginStore.getState().isSearching).toBe(true)
      })

      resolveSearch?.({ success: true, data: [] })

      await act(async () => {
        await searchPromise
      })

      expect(usePluginStore.getState().isSearching).toBe(false)
    })
  })

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const mockPlugin = factories.plugin({
        id: 'test-plugin',
        name: 'Test Plugin',
        type: 'npm',
      })

      mockElectron.installPlugin.mockResolvedValue({
        success: true,
        data: mockPlugin,
      })

      await act(async () => {
        await usePluginStore.getState().installPlugin('test-plugin')
      })

      const state = usePluginStore.getState()
      expect(mockElectron.installPlugin).toHaveBeenCalledWith('test-plugin', undefined)
      expect(state.plugins['test-plugin']).toEqual(mockPlugin)
      expect(state.isInstalling).toBe(false)
      expect(state.installError).toBeUndefined()
    })

    it('should handle installation errors', async () => {
      mockElectron.installPlugin.mockResolvedValue({
        success: false,
        error: 'Installation failed',
      })

      await act(async () => {
        try {
          await usePluginStore.getState().installPlugin('test-plugin')
        } catch (_error) {
        }
      })

      const state = usePluginStore.getState()
      expect(state.isInstalling).toBe(false)
      expect(state.installError).toBe('Installation failed')
    })

    it('should track installation progress', async () => {
      const mockPlugin = factories.plugin()

      let resolveInstall: ((value: { success: boolean; data: unknown }) => void) | undefined
      mockElectron.installPlugin.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveInstall = resolve
          })
      )

      let installPromise: Promise<void> | undefined

      await act(async () => {
        installPromise = usePluginStore.getState().installPlugin('test-plugin')
        expect(usePluginStore.getState().isInstalling).toBe(true)
        expect(Object.keys(usePluginStore.getState().installProgress)).toHaveLength(1)
      })

      resolveInstall?.({ success: true, data: mockPlugin })

      await act(async () => {
        await installPromise
      })

      expect(usePluginStore.getState().isInstalling).toBe(false)
    })
  })

  describe('uninstallPlugin', () => {
    it('should uninstall plugin successfully', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.uninstallPlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await usePluginStore.getState().uninstallPlugin('test-plugin')
      })

      expect(mockElectron.uninstallPlugin).toHaveBeenCalledWith('test-plugin')
      expect(usePluginStore.getState().plugins['test-plugin']).toBeUndefined()
      expect(usePluginStore.getState().isLoading).toBe(false)
      expect(usePluginStore.getState().error).toBeNull()
    })

    it('should disable plugin before uninstalling if enabled', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: true })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.disablePlugin.mockResolvedValue({ success: true })
      mockElectron.uninstallPlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await usePluginStore.getState().uninstallPlugin('test-plugin')
      })

      expect(mockElectron.disablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(mockElectron.uninstallPlugin).toHaveBeenCalledWith('test-plugin')
    })

    it('should handle uninstall errors', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin' })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.uninstallPlugin.mockResolvedValue({
        success: false,
        error: 'Uninstall failed',
      })

      await act(async () => {
        try {
          await usePluginStore.getState().uninstallPlugin('test-plugin')
        } catch (_error) {}
      })

      expect(usePluginStore.getState().isLoading).toBe(false)
      expect(usePluginStore.getState().error).toBe('Uninstall failed')
    })
  })

  describe('enablePlugin', () => {
    it('should enable plugin successfully', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.enablePlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await usePluginStore.getState().enablePlugin('test-plugin')
      })

      expect(mockElectron.enablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(usePluginStore.getState().plugins['test-plugin'].enabled).toBe(true)
      expect(usePluginStore.getState().plugins['test-plugin'].status).toBe('enabled')
    })

    it('should handle enable errors', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.enablePlugin.mockResolvedValue({
        success: false,
        error: 'Enable failed',
      })

      await act(async () => {
        try {
          await usePluginStore.getState().enablePlugin('test-plugin')
        } catch (_error) {}
      })

      expect(usePluginStore.getState().plugins['test-plugin'].enabled).toBe(false)
      expect(usePluginStore.getState().plugins['test-plugin'].status).toBe('disabled')
      expect(usePluginStore.getState().error).toBe('Enable failed')
    })
  })

  describe('disablePlugin', () => {
    it('should disable plugin successfully', async () => {
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: true })

      await act(async () => {
        usePluginStore.setState({ plugins: { 'test-plugin': mockPlugin } })
      })

      mockElectron.disablePlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await usePluginStore.getState().disablePlugin('test-plugin')
      })

      expect(mockElectron.disablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(usePluginStore.getState().plugins['test-plugin'].enabled).toBe(false)
      expect(usePluginStore.getState().plugins['test-plugin'].status).toBe('disabled')
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      const plugins = {
        'plugin-1': factories.plugin({ id: 'plugin-1', enabled: true, type: 'npm' }),
        'plugin-2': factories.plugin({ id: 'plugin-2', enabled: false, type: 'local' }),
        'plugin-3': factories.plugin({ id: 'plugin-3', enabled: true, type: 'npm' }),
      }

      act(() => {
        usePluginStore.setState({ plugins })
      })
    })

    it('should get plugin by id', () => {
      const plugin = usePluginStore.getState().getPluginById('plugin-1')

      expect(plugin).toBeDefined()
      expect(plugin?.id).toBe('plugin-1')
    })

    it('should get enabled plugins', () => {
      const enabledPlugins = usePluginStore.getState().getEnabledPlugins()

      expect(enabledPlugins).toHaveLength(2)
      expect(enabledPlugins.every(p => p.enabled)).toBe(true)
    })

    it('should get plugins by type', () => {
      const npmPlugins = usePluginStore.getState().getPluginsByType('npm')
      const localPlugins = usePluginStore.getState().getPluginsByType('local')

      expect(npmPlugins).toHaveLength(2)
      expect(localPlugins).toHaveLength(1)
    })

    it('should check initialization status', () => {
      expect(usePluginStore.getState().isInitialized()).toBe(false)

      act(() => {
        usePluginStore.setState({ initializationState: 'ready' })
      })

      expect(usePluginStore.getState().isInitialized()).toBe(true)
    })
  })

  describe('clearError', () => {
    it('should clear all error states', () => {
      act(() => {
        usePluginStore.setState({
          error: 'General error',
          searchError: 'Search error',
          installError: 'Install error',
        })
      })

      act(() => {
        usePluginStore.getState().clearError()
      })

      expect(usePluginStore.getState().error).toBeNull()
      expect(usePluginStore.getState().searchError).toBeUndefined()
      expect(usePluginStore.getState().installError).toBeUndefined()
    })
  })
})
