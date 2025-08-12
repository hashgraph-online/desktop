import { MCPCacheManager } from '../../src/main/services/MCPCacheManager'
import { getDatabase } from '../../src/main/db/connection'
import type { NewMCPServer } from '../../src/main/db/schema'

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: {
      id: 'id',
      name: 'name',
      description: 'description',
      registry: 'registry',
      isActive: 'isActive',
      lastFetched: 'lastFetched'
    },
    searchCache: {
      queryHash: 'queryHash',
      expiresAt: 'expiresAt',
      resultIds: 'resultIds',
      totalCount: 'totalCount',
      hasMore: 'hasMore',
      hitCount: 'hitCount'
    },
    registrySync: {
      registry: 'registry',
      status: 'status',
      lastSuccessAt: 'lastSuccessAt'
    },
    performanceMetrics: {}
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

describe('MCPCacheManager', () => {
  let cacheManager: MCPCacheManager
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      all: jest.fn(),
      get: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      run: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      transaction: jest.fn()
    }

    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    cacheManager = MCPCacheManager.getInstance()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('searchServers', () => {
    it('should return cached results when available', async () => {
      const mockCachedResult = {
        queryHash: 'test-hash',
        resultIds: '["server1", "server2"]',
        totalCount: 2,
        hasMore: false,
        hitCount: 1,
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      }

      const mockServers = [
        {
          id: 'server1',
          name: 'Test Server 1',
          description: 'Test description',
          registry: 'pulsemcp',
          isActive: true
        },
        {
          id: 'server2',
          name: 'Test Server 2',
          description: 'Test description',
          registry: 'pulsemcp',
          isActive: true
        }
      ]

      mockDb.get.mockReturnValueOnce(mockCachedResult)
      mockDb.all.mockReturnValueOnce(mockServers)

      const result = await cacheManager.searchServers({
        query: 'test',
        limit: 10,
        offset: 0
      })

      expect(result.fromCache).toBe(true)
      expect(result.servers).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.hasMore).toBe(false)
    })

    it('should perform database search when cache miss', async () => {
      const mockServers = [
        {
          id: 'server1',
          name: 'Test Server 1',
          description: 'Test description',
          registry: 'pulsemcp',
          isActive: true
        }
      ]

      mockDb.get.mockReturnValueOnce(null)
      mockDb.all.mockReturnValueOnce(mockServers)
      mockDb.get.mockReturnValueOnce({ count: 1 })

      const result = await cacheManager.searchServers({
        query: 'test',
        limit: 10,
        offset: 0
      })

      expect(result.fromCache).toBe(false)
      expect(result.servers).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should filter servers by query', async () => {
      const mockServers = [
        {
          id: 'server1',
          name: 'Database Server',
          description: 'PostgreSQL connector',
          registry: 'pulsemcp',
          isActive: true,
          searchVector: 'database server postgresql connector'
        },
        {
          id: 'server2',
          name: 'API Server',
          description: 'REST API connector',
          registry: 'pulsemcp',
          isActive: true,
          searchVector: 'api server rest connector'
        }
      ]

      mockDb.get.mockReturnValueOnce(null)
      mockDb.all.mockReturnValueOnce(mockServers)
      mockDb.get.mockReturnValueOnce({ count: 2 })

      const result = await cacheManager.searchServers({
        query: 'database',
        limit: 10,
        offset: 0
      })

      expect(result.fromCache).toBe(false)
      expect(mockDb.where).toHaveBeenCalled()
    })
  })

  describe('cacheServer', () => {
    it('should cache a server successfully', async () => {
      const serverData: Omit<NewMCPServer, 'lastFetched'> = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        registry: 'pulsemcp',
        isActive: true,
        author: 'Test Author',
        version: '1.0.0',
        tags: '["test", "example"]'
      }

      await cacheManager.cacheServer(serverData)

      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ...serverData,
          lastFetched: expect.any(Date),
          searchVector: expect.any(String)
        })
      )
    })

    it('should update existing server on conflict', async () => {
      const serverData: Omit<NewMCPServer, 'lastFetched'> = {
        id: 'existing-server',
        name: 'Updated Server',
        description: 'Updated description',
        registry: 'pulsemcp',
        isActive: true
      }

      await cacheManager.cacheServer(serverData)

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled()
    })
  })

  describe('bulkCacheServers', () => {
    it('should cache multiple servers in a transaction', async () => {
      const servers: Array<Omit<NewMCPServer, 'lastFetched'>> = [
        {
          id: 'server1',
          name: 'Server 1',
          description: 'Description 1',
          registry: 'pulsemcp',
          isActive: true
        },
        {
          id: 'server2',
          name: 'Server 2',
          description: 'Description 2',
          registry: 'official',
          isActive: true
        }
      ]

      const mockTransaction = jest.fn().mockImplementation(callback => callback())
      mockDb.transaction.mockReturnValue(mockTransaction)

      await cacheManager.bulkCacheServers(servers)

      expect(mockDb.transaction).toHaveBeenCalled()
    })
  })

  describe('getServer', () => {
    it('should return a server by ID', async () => {
      const mockServer = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description'
      }

      mockDb.get.mockReturnValueOnce(mockServer)

      const result = await cacheManager.getServer('test-server')

      expect(result).toEqual(mockServer)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.where).toHaveBeenCalled()
    })

    it('should return null if server not found', async () => {
      mockDb.get.mockReturnValueOnce(undefined)

      const result = await cacheManager.getServer('nonexistent-server')

      expect(result).toBeNull()
    })
  })

  describe('isRegistryFresh', () => {
    it('should return true for fresh registry data', async () => {
      const mockSyncInfo = {
        registry: 'pulsemcp',
        lastSuccessAt: new Date(Date.now() - 30 * 60 * 1000)      }

      mockDb.get.mockReturnValueOnce(mockSyncInfo)

      const result = await cacheManager.isRegistryFresh('pulsemcp', 60 * 60 * 1000)
      expect(result).toBe(true)
    })

    it('should return false for stale registry data', async () => {
      const mockSyncInfo = {
        registry: 'pulsemcp',
        lastSuccessAt: new Date(Date.now() - 2 * 60 * 60 * 1000)      }

      mockDb.get.mockReturnValueOnce(mockSyncInfo)

      const result = await cacheManager.isRegistryFresh('pulsemcp', 60 * 60 * 1000)
      expect(result).toBe(false)
    })

    it('should return false if no sync info exists', async () => {
      mockDb.get.mockReturnValueOnce(null)

      const result = await cacheManager.isRegistryFresh('pulsemcp')

      expect(result).toBe(false)
    })
  })

  describe('updateRegistrySync', () => {
    it('should update registry sync status to success', async () => {
      await cacheManager.updateRegistrySync('pulsemcp', 'success', {
        serverCount: 100,
        syncDurationMs: 5000
      })

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          lastSyncAt: expect.any(Date),
          lastSuccessAt: expect.any(Date),
          serverCount: 100,
          syncDurationMs: 5000,
          nextSyncAt: expect.any(Date)
        })
      )
    })

    it('should update registry sync status to error', async () => {
      await cacheManager.updateRegistrySync('pulsemcp', 'error', {
        errorMessage: 'Network timeout'
      })

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          errorMessage: 'Network timeout',
          nextSyncAt: expect.any(Date)
        })
      )
    })
  })

  describe('getCacheStats', () => {
    it('should return comprehensive cache statistics', async () => {
      mockDb.get
        .mockReturnValueOnce({ count: 100 })        .mockReturnValueOnce({ count: 50 })        .mockReturnValueOnce({
          avgDuration: 150,
          cacheHits: 30,
          totalQueries: 100
        })
        .mockReturnValueOnce({ lastFetched: new Date('2023-01-01') })        .mockReturnValueOnce({ lastFetched: new Date('2023-12-31') })
      mockDb.all.mockReturnValueOnce([        { registry: 'pulsemcp', count: 60 },
        { registry: 'official', count: 40 }
      ])

      const stats = await cacheManager.getCacheStats()

      expect(stats.totalServers).toBe(100)
      expect(stats.cacheEntries).toBe(50)
      expect(stats.averageResponseTime).toBe(150)
      expect(stats.cacheHitRate).toBe(30)
      expect(stats.serversByRegistry).toEqual({
        pulsemcp: 60,
        official: 40
      })
    })
  })

  describe('clearRegistryCache', () => {
    it('should clear cache for specific registry', async () => {
      mockDb.run
        .mockReturnValueOnce({ changes: 50 })        .mockReturnValueOnce({ changes: 10 })
      await cacheManager.clearRegistryCache('pulsemcp')

      expect(mockDb.delete).toHaveBeenCalledTimes(2)    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully in searchServers', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'))

      const result = await cacheManager.searchServers({ query: 'test' })

      expect(result.servers).toEqual([])
      expect(result.total).toBe(0)
      expect(result.fromCache).toBe(false)
    })

    it('should handle cache server errors', async () => {
      const serverData: Omit<NewMCPServer, 'lastFetched'> = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test description',
        registry: 'pulsemcp',
        isActive: true
      }

      mockDb.insert.mockRejectedValueOnce(new Error('Insert failed'))

      await expect(cacheManager.cacheServer(serverData)).rejects.toThrow('Insert failed')
    })
  })

  describe('performance metrics', () => {
    it('should record performance metrics for search operations', async () => {
      mockDb.get.mockReturnValueOnce(null)
      mockDb.all.mockReturnValueOnce([])
      mockDb.get.mockReturnValueOnce({ count: 0 })

      await cacheManager.searchServers({ query: 'test' })

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('search hash generation', () => {
    it('should generate consistent hashes for same search options', async () => {
      const options1 = { query: 'test', tags: ['api'], limit: 10, offset: 0 }
      const options2 = { query: 'test', tags: ['api'], limit: 10, offset: 0 }

      mockDb.get.mockReturnValue(null)
      mockDb.all.mockReturnValue([])
      mockDb.get.mockReturnValue({ count: 0 })

      await cacheManager.searchServers(options1)
      await cacheManager.searchServers(options2)

      expect(mockDb.get).toHaveBeenCalledTimes(4)    })

    it('should generate different hashes for different search options', async () => {
      const options1 = { query: 'test1', limit: 10, offset: 0 }
      const options2 = { query: 'test2', limit: 10, offset: 0 }

      mockDb.get.mockReturnValue(null)
      mockDb.all.mockReturnValue([])
      mockDb.get.mockReturnValue({ count: 0 })

      await cacheManager.searchServers(options1)
      await cacheManager.searchServers(options2)

      expect(mockDb.get).toHaveBeenCalledTimes(4)
    })
  })
})