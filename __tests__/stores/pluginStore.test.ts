import { act, renderHook } from '@testing-library/react'
import { usePluginStore } from '../../src/renderer/stores/pluginStore'
import { mockElectronBridge, factories, delay } from '../utils/testHelpers'

describe('pluginStore', () => {
  let mockElectron: ReturnType<typeof mockElectronBridge>

  beforeEach(() => {
    mockElectron = mockElectronBridge()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => usePluginStore())

      expect(result.current.plugins).toEqual({})
      expect(result.current.searchResults).toEqual([])
      expect(result.current.isSearching).toBe(false)
      expect(result.current.isInstalling).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.initializationState).toBe('pending')
    })
  })

  describe('searchPlugins', () => {
    it('should search plugins successfully', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockResults = [
        { name: 'test-plugin', version: '1.0.0', description: 'Test plugin' },
      ]

      mockElectron.searchPlugins.mockResolvedValue({
        success: true,
        data: mockResults,
      })

      await act(async () => {
        await result.current.searchPlugins('test')
      })

      expect(mockElectron.searchPlugins).toHaveBeenCalledWith('test')
      expect(result.current.searchResults).toEqual(mockResults)
      expect(result.current.isSearching).toBe(false)
      expect(result.current.searchError).toBeNull()
      expect(result.current.searchQuery).toBe('test')
    })

    it('should handle search errors', async () => {
      const { result } = renderHook(() => usePluginStore())

      mockElectron.searchPlugins.mockResolvedValue({
        success: false,
        error: 'Search failed',
      })

      await act(async () => {
        try {
          await result.current.searchPlugins('test')
        } catch (error) {
        }
      })

      expect(result.current.isSearching).toBe(false)
      expect(result.current.searchError).toBe('Search failed')
      expect(result.current.searchResults).toEqual([])
    })

    it('should set loading state during search', async () => {
      const { result } = renderHook(() => usePluginStore())

      mockElectron.searchPlugins.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] }), 100))
      )

      const searchPromise = act(async () => {
        return result.current.searchPlugins('test')
      })

      expect(result.current.isSearching).toBe(true)

      await searchPromise
      expect(result.current.isSearching).toBe(false)
    })
  })

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const { result } = renderHook(() => usePluginStore())
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
        await result.current.installPlugin('test-plugin')
      })

      expect(mockElectron.installPlugin).toHaveBeenCalledWith('test-plugin', undefined)
      expect(result.current.plugins['test-plugin']).toEqual(mockPlugin)
      expect(result.current.isInstalling).toBe(false)
      expect(result.current.installError).toBeNull()
    })

    it('should handle installation errors', async () => {
      const { result } = renderHook(() => usePluginStore())

      mockElectron.installPlugin.mockResolvedValue({
        success: false,
        error: 'Installation failed',
      })

      await act(async () => {
        try {
          await result.current.installPlugin('test-plugin')
        } catch (error) {
        }
      })

      expect(result.current.isInstalling).toBe(false)
      expect(result.current.installError).toBe('Installation failed')
    })

    it('should track installation progress', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin()

      mockElectron.installPlugin.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({ success: true, data: mockPlugin }), 100)
        })
      )

      const installPromise = act(async () => {
        return result.current.installPlugin('test-plugin')
      })

      expect(result.current.isInstalling).toBe(true)
      expect(Object.keys(result.current.installProgress)).toHaveLength(1)

      await installPromise
      expect(result.current.isInstalling).toBe(false)
    })
  })

  describe('uninstallPlugin', () => {
    it('should uninstall plugin successfully', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.uninstallPlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await result.current.uninstallPlugin('test-plugin')
      })

      expect(mockElectron.uninstallPlugin).toHaveBeenCalledWith('test-plugin')
      expect(result.current.plugins['test-plugin']).toBeUndefined()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should disable plugin before uninstalling if enabled', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: true })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.disablePlugin.mockResolvedValue({ success: true })
      mockElectron.uninstallPlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await result.current.uninstallPlugin('test-plugin')
      })

      expect(mockElectron.disablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(mockElectron.uninstallPlugin).toHaveBeenCalledWith('test-plugin')
    })

    it('should handle uninstall errors', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin' })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.uninstallPlugin.mockResolvedValue({
        success: false,
        error: 'Uninstall failed',
      })

      await act(async () => {
        try {
          await result.current.uninstallPlugin('test-plugin')
        } catch (error) {
        }
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Uninstall failed')
    })
  })

  describe('enablePlugin', () => {
    it('should enable plugin successfully', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.enablePlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await result.current.enablePlugin('test-plugin')
      })

      expect(mockElectron.enablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(result.current.plugins['test-plugin'].enabled).toBe(true)
      expect(result.current.plugins['test-plugin'].status).toBe('enabled')
    })

    it('should handle enable errors', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: false })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.enablePlugin.mockResolvedValue({
        success: false,
        error: 'Enable failed',
      })

      await act(async () => {
        try {
          await result.current.enablePlugin('test-plugin')
        } catch (error) {
        }
      })

      expect(result.current.plugins['test-plugin'].enabled).toBe(false)
      expect(result.current.plugins['test-plugin'].status).toBe('disabled')
      expect(result.current.error).toBe('Enable failed')
    })
  })

  describe('disablePlugin', () => {
    it('should disable plugin successfully', async () => {
      const { result } = renderHook(() => usePluginStore())
      const mockPlugin = factories.plugin({ id: 'test-plugin', enabled: true })

      act(() => {
        result.current.plugins = { 'test-plugin': mockPlugin }
      })

      mockElectron.disablePlugin.mockResolvedValue({ success: true })

      await act(async () => {
        await result.current.disablePlugin('test-plugin')
      })

      expect(mockElectron.disablePlugin).toHaveBeenCalledWith('test-plugin')
      expect(result.current.plugins['test-plugin'].enabled).toBe(false)
      expect(result.current.plugins['test-plugin'].status).toBe('disabled')
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      const { result } = renderHook(() => usePluginStore())
      const plugins = {
        'plugin-1': factories.plugin({ id: 'plugin-1', enabled: true, type: 'npm' }),
        'plugin-2': factories.plugin({ id: 'plugin-2', enabled: false, type: 'local' }),
        'plugin-3': factories.plugin({ id: 'plugin-3', enabled: true, type: 'npm' }),
      }

      act(() => {
        result.current.plugins = plugins
      })
    })

    it('should get plugin by id', () => {
      const { result } = renderHook(() => usePluginStore())
      const plugin = result.current.getPluginById('plugin-1')

      expect(plugin).toBeDefined()
      expect(plugin?.id).toBe('plugin-1')
    })

    it('should get enabled plugins', () => {
      const { result } = renderHook(() => usePluginStore())
      const enabledPlugins = result.current.getEnabledPlugins()

      expect(enabledPlugins).toHaveLength(2)
      expect(enabledPlugins.every(p => p.enabled)).toBe(true)
    })

    it('should get plugins by type', () => {
      const { result } = renderHook(() => usePluginStore())
      const npmPlugins = result.current.getPluginsByType('npm')
      const localPlugins = result.current.getPluginsByType('local')

      expect(npmPlugins).toHaveLength(2)
      expect(localPlugins).toHaveLength(1)
    })

    it('should check initialization status', () => {
      const { result } = renderHook(() => usePluginStore())

      expect(result.current.isInitialized()).toBe(false)

      act(() => {
        result.current.initializationState = 'ready'
      })

      expect(result.current.isInitialized()).toBe(true)
    })
  })

  describe('clearError', () => {
    it('should clear all error states', () => {
      const { result } = renderHook(() => usePluginStore())

      act(() => {
        result.current.error = 'General error'
        result.current.searchError = 'Search error'
        result.current.installError = 'Install error'
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.searchError).toBeNull()
      expect(result.current.installError).toBeNull()
    })
  })
})