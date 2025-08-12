import { MCPRegistryService } from '../../src/main/services/MCPRegistryService'
import { MCPCacheManager } from '../../src/main/services/MCPCacheManager'

jest.mock('../../../src/main/services/MCPCacheManager', () => ({
  MCPCacheManager: {
    getInstance: jest.fn()
  }
}))

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}))

global.fetch = jest.fn()

describe('MCPRegistryService Enhanced', () => {
  let registryService: MCPRegistryService
  let mockCacheManager: any

  beforeEach(() => {
    mockCacheManager = {
      searchServers: jest.fn(),
      isRegistryFresh: jest.fn(),
      updateRegistrySync: jest.fn(),
      bulkCacheServers: jest.fn(),
      clearSearchCache: jest.fn(),
      getCacheStats: jest.fn()
    }

    ;(MCPCacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager)
    
    registryService = MCPRegistryService.getInstance()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('searchServers with caching', () => {
    it('should return cached results when available', async () => {
      const mockCacheResult = {
        servers: [
          {
            id: 'cached-server',
            name: 'Cached Server',
            description: 'From cache',
            registry: 'pulsemcp',
            isActive: true
          }
        ],
        total: 1,
        hasMore: false,
        fromCache: true,
        queryTime: 50
      }

      mockCacheManager.searchServers.mockResolvedValueOnce(mockCacheResult)

      const result = await registryService.searchServers({
        query: 'test',
        limit: 10
      })

      expect(result.servers).toHaveLength(1)
      expect(result.servers[0].name).toBe('Cached Server')
      expect(result.total).toBe(1)
      expect(mockCacheManager.searchServers).toHaveBeenCalledWith({
        query: 'test',
        tags: undefined,
        author: undefined,
        limit: 10,
        offset: 0,
        sortBy: 'installCount',
        sortOrder: 'desc'
      })
    })

    it('should fallback to API when cache is empty', async () => {
      const mockCacheResult = {
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 200
      }

      const mockApiResponse = {
        servers: [
          {
            id: 'api-server',
            name: 'API Server',
            description: 'From API',
            package_name: 'test-package'
          }
        ],
        total_count: 1,
        next: null
      }

      mockCacheManager.searchServers.mockResolvedValueOnce(mockCacheResult)
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await registryService.searchServers({
        query: 'test',
        limit: 10
      })

      expect(result.servers).toHaveLength(1)
      expect(result.servers[0].name).toBe('API Server')
    })
  })

  describe('background sync system', () => {
    it('should skip sync when registry is fresh', async () => {
      mockCacheManager.isRegistryFresh.mockResolvedValueOnce(true)

      const service = registryService as any
      await service.syncRegistry('pulsemcp')

      expect(mockCacheManager.isRegistryFresh).toHaveBeenCalledWith('pulsemcp')
      expect(mockCacheManager.updateRegistrySync).not.toHaveBeenCalledWith('pulsemcp', 'syncing')
    })

    it('should perform sync when registry is stale', async () => {
      const mockApiResponse1 = {
        servers: [
          {
            id: 'server1',
            name: 'Server 1',
            package_name: 'package1'
          }
        ],
        total_count: 2,
        next: 'cursor123'
      }

      const mockApiResponse2 = {
        servers: [
          {
            id: 'server2',
            name: 'Server 2',
            package_name: 'package2'
          }
        ],
        total_count: 2,
        next: null
      }

      mockCacheManager.isRegistryFresh.mockResolvedValueOnce(false)
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse2)
        })

      const service = registryService as any
      await service.syncRegistry('pulsemcp')

      expect(mockCacheManager.updateRegistrySync).toHaveBeenCalledWith('pulsemcp', 'syncing')
      expect(mockCacheManager.bulkCacheServers).toHaveBeenCalledTimes(2)
      expect(mockCacheManager.updateRegistrySync).toHaveBeenCalledWith('pulsemcp', 'success', {
        serverCount: 2,
        syncDurationMs: expect.any(Number)
      })
    })

    it('should handle sync errors gracefully', async () => {
      mockCacheManager.isRegistryFresh.mockResolvedValueOnce(false)
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const service = registryService as any
      
      await expect(service.syncRegistry('pulsemcp')).rejects.toThrow('Network error')
      
      expect(mockCacheManager.updateRegistrySync).toHaveBeenCalledWith('pulsemcp', 'error', {
        errorMessage: 'Network error',
        syncDurationMs: expect.any(Number)
      })
    })
  })

  describe('timeout handling', () => {
    it('should handle timeout in registry search', async () => {
      mockCacheManager.searchServers.mockResolvedValueOnce({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 3000))
      )

      const service = registryService as any
      const result = await service.searchRegistriesWithTimeout({
        query: 'test',
        limit: 10
      }, 1000)
      expect(result.servers).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('server conversion', () => {
    it('should convert registry server to cached format', async () => {
      const registryServer = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        author: 'Test Author',
        version: '1.0.0',
        package_name: 'test-package',
        repository: {
          type: 'git',
          url: 'https://github.com/test/repo'
        },
        config: {
          command: 'node',
          args: ['index.js'],
          env: { NODE_ENV: 'production' }
        },
        tags: ['test', 'example'],
        license: 'MIT',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-12-31T23:59:59Z',
        downloads: 1000,
        rating: 4.5
      }

      const service = registryService as any
      const result = service.convertToCachedServer(registryServer, 'pulsemcp')

      expect(result).toEqual({
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        author: 'Test Author',
        version: '1.0.0',
        url: null,
        packageName: 'test-package',
        repositoryType: 'git',
        repositoryUrl: 'https://github.com/test/repo',
        configCommand: 'node',
        configArgs: '["index.js"]',
        configEnv: '{"NODE_ENV":"production"}',
        tags: '["test","example"]',
        license: 'MIT',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-12-31T23:59:59Z',
        installCount: 1000,
        rating: 4.5,
        registry: 'pulsemcp',
        isActive: true
      })
    })

    it('should convert cached server to registry format', async () => {
      const cachedServer = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        author: 'Test Author',
        version: '1.0.0',
        url: null,
        packageName: 'test-package',
        repositoryType: 'git',
        repositoryUrl: 'https://github.com/test/repo',
        configCommand: 'node',
        configArgs: '["index.js"]',
        configEnv: '{"NODE_ENV":"production"}',
        tags: '["test","example"]',
        license: 'MIT',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-12-31T23:59:59Z',
        installCount: 1000,
        rating: 4.5,
        registry: 'pulsemcp',
        isActive: true
      }

      const service = registryService as any
      const result = service.convertFromCachedServer(cachedServer)

      expect(result).toEqual({
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        author: 'Test Author',
        version: '1.0.0',
        url: null,
        packageName: 'test-package',
        repository: {
          type: 'git',
          url: 'https://github.com/test/repo'
        },
        config: {
          command: 'node',
          args: ['index.js'],
          env: { NODE_ENV: 'production' }
        },
        tags: ['test', 'example'],
        license: 'MIT',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-12-31T23:59:59Z',
        installCount: 1000,
        rating: 4.5
      })
    })
  })

  describe('cache management', () => {
    it('should clear cache successfully', async () => {
      mockCacheManager.clearSearchCache.mockResolvedValueOnce(undefined)

      await registryService.clearCache()

      expect(mockCacheManager.clearSearchCache).toHaveBeenCalled()
    })

    it('should get cache statistics', async () => {
      const mockStats = {
        totalServers: 1000,
        serversByRegistry: { pulsemcp: 600, official: 400 },
        cacheEntries: 50,
        averageResponseTime: 150,
        cacheHitRate: 75,
        oldestEntry: new Date('2023-01-01'),
        newestEntry: new Date('2023-12-31')
      }

      mockCacheManager.getCacheStats.mockResolvedValueOnce(mockStats)

      const result = await registryService.getCacheStats()

      expect(result).toEqual(mockStats)
      expect(mockCacheManager.getCacheStats).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle cache manager errors gracefully', async () => {
      mockCacheManager.searchServers.mockRejectedValueOnce(new Error('Cache error'))

      const result = await registryService.searchServers({
        query: 'test'
      })

      expect(result.servers).toEqual([])
      expect(result.total).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should handle API errors during fallback', async () => {
      mockCacheManager.searchServers.mockResolvedValueOnce({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await registryService.searchServers({
        query: 'test'
      })

      expect(result.servers).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('performance tracking', () => {
    it('should track search performance', async () => {
      const mockCacheResult = {
        servers: [{ id: 'test', name: 'Test', description: 'Test' }],
        total: 1,
        hasMore: false,
        fromCache: true,
        queryTime: 25
      }

      mockCacheManager.searchServers.mockResolvedValueOnce(mockCacheResult)

      const startTime = Date.now()
      await registryService.searchServers({ query: 'test' })
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000)    })
  })

  describe('registry-specific behavior', () => {
    it('should handle PulseMCP registry format', async () => {
      const mockApiResponse = {
        servers: [
          {
            id: 'pulse-server',
            name: 'Pulse Server',
            description: 'PulseMCP server',
            package_name: 'pulse-package',
            downloads: 500
          }
        ],
        total_count: 1,
        next: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const service = registryService as any
      const result = await service.searchPulseMCP({ limit: 10 })

      expect(result.servers).toHaveLength(1)
      expect(result.servers[0].installCount).toBe(500)
    })

    it('should handle Official Registry timeout gracefully', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((_, reject) => 
          setTimeout(() => reject({ name: 'AbortError' }), 100)
        )
      )

      const service = registryService as any
      const result = await service.searchOfficialRegistry({ limit: 10 })

      expect(result.servers).toEqual([])
      expect(result.total).toBe(0)
      expect(result.hasMore).toBe(false)
    })
  })
})