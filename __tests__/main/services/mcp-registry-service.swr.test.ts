jest.mock('../../../src/main/utils/logger')
jest.mock('../../../src/main/services/mcp-cache-manager')
jest.mock('path')
jest.mock('fs')

import { MCPRegistryService } from '../../../src/main/services/mcp-registry-service'
import { MCPCacheManager } from '../../../src/main/services/mcp-cache-manager'

describe('MCPRegistryService SWR integration', () => {
  let service: MCPRegistryService

  beforeEach(() => {
    const mockCacheManager = require('../../../src/main/services/mcp-cache-manager').MCPCacheManager
    mockCacheManager.getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [
          {
            id: 's1',
            name: 'A',
            description: '',
            registry: 'pulsemcp',
            isActive: true,
            githubStars: 1,
            installCount: 10,
            repositoryUrl: 'https://github.com/a/b',
          },
        ],
        total: 1,
        hasMore: false,
        fromCache: true,
        queryTime: 1,
        staleness: 'stale',
      }),
      clearSearchCache: jest.fn(),
      clearRegistrySync: jest.fn(),
      clearRegistryCache: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({
        cacheEntries: 1,
        totalServers: 1,
        cacheHitRate: 100,
        oldestEntry: new Date(),
        newestEntry: new Date(),
        serversByRegistry: {},
        averageResponseTime: 0,
      }),
      bulkCacheServers: jest.fn(),
      isRegistryFresh: jest.fn().mockResolvedValue(true),
      updateRegistrySync: jest.fn(),
    })
    ;(MCPRegistryService as any).instance = null
    service = new MCPRegistryService()
  })

  it('triggers background sync when cached results are stale', async () => {
    const spy = jest.spyOn(service as any, 'triggerBackgroundSync')
    const res = await service.searchServers({ query: 'x' })
    expect(res.servers.length).toBeGreaterThan(0)
    expect(spy).toHaveBeenCalled()
  })

  it('does not trigger background sync when cached results are fresh', async () => {
    const mockCacheManager = require('../../../src/main/services/mcp-cache-manager').MCPCacheManager
    mockCacheManager.getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [{
          id: 's1', name: 'A', description: '', registry: 'pulsemcp', isActive: true,
          githubStars: 1, installCount: 10, repositoryUrl: 'https://github.com/a/b',
        }],
        total: 1, hasMore: false, fromCache: true, queryTime: 1, staleness: 'fresh',
      }),
      bulkCacheServers: jest.fn(),
      isRegistryFresh: jest.fn().mockResolvedValue(true),
      updateRegistrySync: jest.fn(),
      clearSearchCache: jest.fn(),
      clearRegistrySync: jest.fn(),
      clearRegistryCache: jest.fn(),
      getCacheStats: jest.fn().mockResolvedValue({ cacheEntries: 1, totalServers: 1, cacheHitRate: 100,
        oldestEntry: new Date(), newestEntry: new Date(), serversByRegistry: {}, averageResponseTime: 0 }),
    })
    ;(MCPRegistryService as any).instance = null
    const svc = new MCPRegistryService()
    const spy = jest.spyOn(svc as any, 'triggerBackgroundSync')
    const res = await svc.searchServers({ query: 'x' })
    expect(res.servers.length).toBeGreaterThan(0)
    expect(spy).not.toHaveBeenCalled()
  })
  it('does not throw when cache empty', async () => {
    const mockCacheManager = require('../../../src/main/services/mcp-cache-manager').MCPCacheManager
    mockCacheManager.getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({ servers: [], total: 0, hasMore: false, fromCache: true, queryTime: 1 }),
    })
    ;(MCPRegistryService as any).instance = null
    service = new MCPRegistryService()
    const res = await service.searchServers({})
    expect(Array.isArray(res.servers)).toBe(true)
  })
})
