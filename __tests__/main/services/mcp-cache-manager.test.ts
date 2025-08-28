import { MCPCacheManager, type MCPServerInput, type CacheSearchOptions } from '../../../src/main/services/mcp-cache-manager';
import { getDatabase, schema } from '../../../src/main/db/connection';

jest.mock('../../../src/main/utils/logger');
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
      searchVector: 'search_vector'
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
      hitCount: 'hit_count'
    },
    registrySync: {
      id: 'id',
      registry: 'registry',
      lastSyncAt: 'last_sync_at',
      lastSuccessAt: 'last_success_at',
      serverCount: 'server_count',
      status: 'status',
      errorMessage: 'error_message',
      syncDurationMs: 'sync_duration_ms',
      nextSyncAt: 'next_sync_at'
    },
    serverCategories: {
      id: 'id',
      serverId: 'server_id',
      category: 'category',
      confidence: 'confidence',
      source: 'source',
      createdAt: 'created_at'
    }
  }
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockImplementation(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  }))
}));

describe('MCPCacheManager', () => {
  let cacheManager: MCPCacheManager;
  let mockDb: any;
  let mockLogger: any;

  const mockServerInput: MCPServerInput = {
    id: 'test-server-1',
    name: 'Test Server',
    description: 'A test server',
    author: 'Test Author',
    version: '1.0.0',
    url: 'https://test.com',
    packageName: 'test-package',
    packageRegistry: 'npm',
    repositoryType: 'git',
    repositoryUrl: 'https://github.com/test/repo',
    configCommand: 'npx',
    configArgs: '["-y", "test-package"]',
    configEnv: '{"NODE_ENV": "test"}',
    tags: '["test", "utility"]',
    license: 'MIT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    installCount: 100,
    rating: 4.5,
    githubStars: 500,
    registry: 'pulsemcp',
    isActive: true,
    searchVector: null
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      run: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
      $count: jest.fn().mockResolvedValue(0)
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    MCPCacheManager['instance'] = null;
    cacheManager = MCPCacheManager.getInstance();
  });

  afterEach(() => {
    MCPCacheManager['instance'] = null;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = MCPCacheManager.getInstance();
      const instance2 = MCPCacheManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should create new instance when singleton is reset', () => {
      const instance1 = MCPCacheManager.getInstance();
      MCPCacheManager['instance'] = null;
      const instance2 = MCPCacheManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Database Availability', () => {
    test('should handle database unavailability gracefully', () => {
      (getDatabase as jest.Mock).mockReturnValue(null);
      MCPCacheManager['instance'] = null;

      expect(() => MCPCacheManager.getInstance()).not.toThrow();
    });
  });

  describe('searchServers', () => {
    test('should handle database errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      const options: CacheSearchOptions = { limit: 10 };
      const result = await cacheManager.searchServers(options);

      expect(result.servers).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('cacheServer', () => {
    test('should handle caching errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('Cache error'));

      await expect(cacheManager.cacheServer(mockServerInput)).resolves.not.toThrow();
    });
  });

  describe('bulkCacheServers', () => {
    test('should handle bulk caching errors gracefully', async () => {
      const servers = [mockServerInput];
      mockDb.execute.mockRejectedValue(new Error('Bulk cache error'));

      await expect(cacheManager.bulkCacheServers(servers)).resolves.not.toThrow();
    });
  });

  describe('getServer', () => {
    test('should return null for non-existent server', async () => {
      mockDb.execute.mockResolvedValue([]);

      const result = await cacheManager.getServer('non-existent');

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      const result = await cacheManager.getServer('test-server');

      expect(result).toBeNull();
    });
  });

  describe('getServersByRegistry', () => {
    test('should handle custom max age', async () => {
      const registry = 'pulsemcp';
      const maxAgeMs = 1000 * 60 * 60; // 1 hour

      mockDb.execute.mockResolvedValue([]);

      await cacheManager.getServersByRegistry(registry, maxAgeMs);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('isRegistryFresh', () => {
    test('should return false for stale registry', async () => {
      const registry = 'pulsemcp';
      const oldTimestamp = Date.now() - (6 * 60 * 60 * 1000); // 6 hours ago

      mockDb.execute.mockResolvedValue([{ lastFetched: oldTimestamp }]);

      const result = await cacheManager.isRegistryFresh(registry);

      expect(result).toBe(false);
    });

    test('should handle custom max age', async () => {
      const registry = 'pulsemcp';
      const maxAgeMs = 1000 * 60; // 1 minute

      mockDb.execute.mockResolvedValue([{ lastFetched: Date.now() - (2 * 60 * 1000) }]);

      const result = await cacheManager.isRegistryFresh(registry, maxAgeMs);

      expect(result).toBe(false);
    });
  });

  describe('Cache Clearing', () => {
    test('should clear registry cache', async () => {
      const registry = 'pulsemcp';
      mockDb.execute.mockResolvedValue({});

      await expect(cacheManager.clearRegistryCache(registry)).resolves.not.toThrow();

      expect(mockDb.delete).toHaveBeenCalled();
    });

    test('should clear search cache', async () => {
      mockDb.execute.mockResolvedValue({});

      await expect(cacheManager.clearSearchCache()).resolves.not.toThrow();

      expect(mockDb.delete).toHaveBeenCalled();
    });

    test('should clear registry sync data', async () => {
      mockDb.execute.mockResolvedValue({});

      await expect(cacheManager.clearRegistrySync()).resolves.not.toThrow();

      expect(mockDb.delete).toHaveBeenCalled();
    });

    test('should handle cache clearing errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('Clear error'));

      await expect(cacheManager.clearRegistryCache('pulsemcp')).resolves.not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    test('should handle cache stats errors gracefully', async () => {
      mockDb.$count.mockRejectedValue(new Error('Stats error'));

      const result = await cacheManager.getCacheStats();

      expect(result).toEqual(expect.objectContaining({
        cacheEntries: 0,
        totalServers: 0,
        cacheHitRate: 0,
        oldestEntry: null,
        newestEntry: null
      }));
    });
  });

  describe('Error Handling', () => {
    test('should handle database unavailability in search', async () => {
      (getDatabase as jest.Mock).mockReturnValue(null);
      MCPCacheManager['instance'] = null;
      const freshInstance = MCPCacheManager.getInstance();

      const options: CacheSearchOptions = { limit: 10 };
      const result = await freshInstance.searchServers(options);

      expect(result.servers).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    test('should handle database unavailability in caching', async () => {
      (getDatabase as jest.Mock).mockReturnValue(null);
      MCPCacheManager['instance'] = null;
      const freshInstance = MCPCacheManager.getInstance();

      await expect(freshInstance.cacheServer(mockServerInput)).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle empty search results', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      const options: CacheSearchOptions = { query: 'nonexistent', limit: 10 };
      const result = await cacheManager.searchServers(options);

      expect(result.servers).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
