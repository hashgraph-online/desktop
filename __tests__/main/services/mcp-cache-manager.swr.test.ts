jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: {
      id: 'id',
      name: 'name',
      description: 'description',
      author: 'author',
      version: 'version',
      url: 'url',
      packageName: 'package_name',
      packageRegistry: 'package_registry',
      repositoryType: 'repository_type',
      repositoryUrl: 'repository_url',
      configCommand: 'config_command',
      configArgs: 'config_args',
      configEnv: 'config_env',
      tags: 'tags',
      license: 'license',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      installCount: 'install_count',
      rating: 'rating',
      githubStars: 'github_stars',
      registry: 'registry',
      isActive: 'is_active',
      lastFetched: 'last_fetched',
      searchVector: 'search_vector',
    },
    searchCache: {
      id: 'id',
      queryHash: 'query_hash',
      queryText: 'query_text',
      tags: 'tags',
      category: 'category',
      searchOffset: 'search_offset',
      pageLimit: 'page_limit',
      resultIds: 'result_ids',
      totalCount: 'total_count',
      hasMore: 'has_more',
      createdAt: 'created_at',
      expiresAt: 'expires_at',
      hitCount: 'hit_count',
    },
    registrySync: {
      registry: 'registry',
      lastSuccessAt: 'last_success_at',
    },
    performanceMetrics: {
      operation: 'operation',
      durationMs: 'duration_ms',
      cacheHit: 'cache_hit',
      resultCount: 'result_count',
      errorCount: 'error_count',
    },
  },
}))

import { MCPCacheManager, type CacheSearchOptions } from '../../../src/main/services/mcp-cache-manager'
import { getDatabase } from '../../../src/main/db/connection'

describe('MCPCacheManager SWR', () => {
  let cache: MCPCacheManager
  let mockDb: any
  const baseNow = new Date('2025-01-01T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(baseNow)
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
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      run: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPCacheManager as any).instance = null
    cache = MCPCacheManager.getInstance()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function setupCachedSearch(createdAt: Date, expiresAt: Date) {
    mockDb.get.mockReset()
    mockDb.get.mockReturnValueOnce({
      id: 1,
      queryHash: 'h',
      resultIds: JSON.stringify(['s1']),
      totalCount: 1,
      hasMore: false,
      hitCount: 1,
      createdAt: createdAt,
      expiresAt: expiresAt,
    })
    mockDb.all.mockReset()
    mockDb.all.mockReturnValueOnce([
      { id: 's1', name: 'A', description: '', registry: 'pulsemcp', isActive: true },
    ])
  }

  it('returns fresh cache without revalidation when < fresh threshold', async () => {
    const created = new Date(baseNow.getTime() - 60_000)
    const expires = new Date(baseNow.getTime() + 20 * 60_000)
    setupCachedSearch(created, expires)
    const spy = jest.spyOn(cache, 'backgroundRevalidateSearch')
    const res = await cache.searchServers({ query: 'x', limit: 10, offset: 0 } as CacheSearchOptions)
    expect(res.fromCache).toBe(true)
    expect(res.staleness).toBe('fresh')
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns stale cache and triggers background revalidation', async () => {
    const created = new Date(baseNow.getTime() - 10 * 60_000)
    const expires = new Date(baseNow.getTime() + 10 * 60_000)
    setupCachedSearch(created, expires)
    const spy = jest.spyOn(cache, 'backgroundRevalidateSearch')
    const res = await cache.searchServers({ query: 'x', limit: 10, offset: 0 } as CacheSearchOptions)
    expect(res.fromCache).toBe(true)
    expect(res.staleness).toBe('stale')
    expect(spy).toHaveBeenCalled()
  })

  it('treats expired cache as miss and does a DB search', async () => {
    const created = new Date(baseNow.getTime() - 40 * 60_000)
    const expires = new Date(baseNow.getTime() - 1 * 60_000)
    mockDb.get.mockReturnValueOnce({
      id: 1,
      queryHash: 'h',
      resultIds: JSON.stringify(['s1']),
      totalCount: 1,
      hasMore: false,
      hitCount: 1,
      createdAt: created,
      expiresAt: expires,
    })
    mockDb.all.mockReturnValueOnce([])
    mockDb.get.mockReturnValueOnce({ count: 0 })
    const res = await cache.searchServers({ query: 'x', limit: 10, offset: 0 } as CacheSearchOptions)
    expect(res.fromCache).toBe(false)
    expect(res.servers.length).toBe(0)
  })
})
