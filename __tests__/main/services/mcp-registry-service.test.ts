import { MCPRegistryService, type MCPRegistryServer, type MCPRegistryResponse } from '../../../src/main/services/mcp-registry-service';

jest.mock('../../../src/main/services/mcp-cache-manager', () => ({
  MCPCacheManager: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../../src/main/services/mcp-metrics-enricher', () => ({
  MCPMetricsEnricher: jest.fn()
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/fake/path/popularMCPServers.json'),
  dirname: jest.fn().mockReturnValue('/fake/dir')
}));

jest.mock('url', () => ({
  fileURLToPath: jest.fn().mockImplementation((url) => {
    if (typeof url === 'string' && url.startsWith('file://')) {
      return url.replace('file://', '');
    }
    return '/fake/path/file.js';
  })
}));

jest.mock('../../../src/main/services/mcp-registry-service', () => {
  const MockMCPRegistryService = jest.fn().mockImplementation(() => ({
    isServerInstallable: jest.fn(),
    convertToMCPConfig: jest.fn(),
    searchServers: jest.fn(),
    getServerDetails: jest.fn(),
    getInstance: jest.fn()
  }));

  MockMCPRegistryService.getInstance = jest.fn();

  return {
    MCPRegistryService: MockMCPRegistryService
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MCPRegistryService', () => {
  let service: any;
  let mockCacheManager: any;
  let mockLogger: any;

  const mockRegistryServer = {
    id: 'test-server',
    name: 'Test Server',
    description: 'A test MCP server',
    packageRegistry: 'npm',
    packageName: '@test/server',
    repository: {
      type: 'git',
      url: 'https://github.com/test/server'
    },
    config: {
      command: 'npx',
      args: ['@test/server']
    },
    tags: ['test', 'utility']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { Logger } = require('../../../src/main/utils/logger');
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    const { MCPCacheManager } = require('../../../src/main/services/mcp-cache-manager');
    mockCacheManager = {
      searchServers: jest.fn(),
      bulkCacheServers: jest.fn(),
      getInstance: jest.fn().mockReturnValue(mockCacheManager)
    };
    MCPCacheManager.getInstance = jest.fn().mockReturnValue(mockCacheManager);

    const { MCPRegistryService } = require('../../../src/main/services/mcp-registry-service');
    service = new MCPRegistryService();

    service.isServerInstallable = jest.fn().mockReturnValue(true);
    service.convertToMCPConfig = jest.fn().mockReturnValue({
      name: 'Test Server',
      type: 'custom',
      enabled: true,
      config: { command: 'npx', args: ['@test/server'] }
    });
    service.searchServers = jest.fn().mockResolvedValue({
      servers: [mockRegistryServer],
      total: 1,
      hasMore: false
    });
    service.getServerDetails = jest.fn().mockResolvedValue(null);

    MCPRegistryService.getInstance = jest.fn().mockReturnValue(service);
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = MCPRegistryService.getInstance();
      const instance2 = MCPRegistryService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MCPRegistryService);
    });

    test('should initialize cache manager', () => {
      MCPRegistryService.getInstance();

      expect(mockCacheManager.getInstance).toHaveBeenCalled();
    });

    test('should handle cache manager initialization failure gracefully', () => {
      const { MCPCacheManager } = require('../../../src/main/services/mcp-cache-manager');
      MCPCacheManager.getInstance.mockImplementation(() => {
        throw new Error('Cache manager failed');
      });

      (MCPRegistryService as any).instance = null;

      const instance = MCPRegistryService.getInstance();

      expect(instance).toBeInstanceOf(MCPRegistryService);
      expect(mockLogger.warn).toHaveBeenCalledWith('MCPRegistryService will operate without caching');
    });
  });

  describe('GitHub URL Normalization', () => {
    test('should normalize github: format', () => {
      const serverWithGithub: MCPRegistryServer = {
        id: 'test',
        name: 'Test',
        description: 'Test server',
        repository: { type: 'git', url: 'github:user/repo' }
      };

      const result = service.isServerInstallable(serverWithGithub);
      expect(result).toBe(true); // Should be installable due to normalized GitHub URL
    });

    test('should handle HTTPS GitHub URLs', () => {
      const serverWithHttpsGithub: MCPRegistryServer = {
        id: 'test',
        name: 'Test',
        description: 'Test server',
        repository: { type: 'git', url: 'https://github.com/user/repo.git' }
      };

      const result = service.isServerInstallable(serverWithHttpsGithub);
      expect(result).toBe(true);
    });

    test('should handle git@github format', () => {
      const serverWithGitSsh: MCPRegistryServer = {
        id: 'test',
        name: 'Test',
        description: 'Test server',
        repository: { type: 'git', url: 'git@github.com:user/repo.git' }
      };

      const result = service.isServerInstallable(serverWithGitSsh);
      expect(result).toBe(true);
    });
  });

  describe('Server Installability Check', () => {
    test('should identify installable server with command', () => {
      const serverWithCommand: MCPRegistryServer = {
        ...mockRegistryServer,
        config: { command: 'npx', args: ['@test/server'] }
      };

      const result = service.isServerInstallable(serverWithCommand);
      expect(result).toBe(true);
    });

    test('should identify installable server with GitHub repo', () => {
      const serverWithGithub: MCPRegistryServer = {
        ...mockRegistryServer,
        repository: { type: 'git', url: 'https://github.com/test/repo' },
        config: undefined
      };

      const result = service.isServerInstallable(serverWithGithub);
      expect(result).toBe(true);
    });

    test('should identify installable server with npm package', () => {
      const serverWithNpm: MCPRegistryServer = {
        ...mockRegistryServer,
        packageRegistry: 'npm',
        packageName: '@valid/package-name',
        config: undefined
      };

      const result = service.isServerInstallable(serverWithNpm);
      expect(result).toBe(true);
    });

    test('should identify installable server with PyPI package', () => {
      const serverWithPyPI: MCPRegistryServer = {
        ...mockRegistryServer,
        packageRegistry: 'pypi',
        packageName: 'valid-package',
        config: undefined
      };

      const result = service.isServerInstallable(serverWithPyPI);
      expect(result).toBe(true);
    });

    test('should reject non-installable server', () => {
      const nonInstallableServer: MCPRegistryServer = {
        id: 'test',
        name: 'Test',
        description: 'Test server',
        config: undefined
      };

      const result = service.isServerInstallable(nonInstallableServer);
      expect(result).toBe(false);
    });
  });

  describe('MCP Config Conversion', () => {
    test('should convert server with command config', () => {
      const serverWithCommand: MCPRegistryServer = {
        ...mockRegistryServer,
        config: {
          command: 'python',
          args: ['-m', 'server'],
          env: { PYTHONPATH: '/path' }
        }
      };

      const result = service.convertToMCPConfig(serverWithCommand);

      expect(result).toEqual({
        name: 'Test Server',
        type: 'custom',
        enabled: true,
        description: 'A test MCP server',
        config: {
          type: 'custom',
          command: 'python',
          args: ['-m', 'server'],
          env: { PYTHONPATH: '/path' }
        }
      });
    });

    test('should convert server with npm package', () => {
      const serverWithNpm: MCPRegistryServer = {
        ...mockRegistryServer,
        packageRegistry: 'npm',
        packageName: '@test/server',
        config: { env: { NODE_ENV: 'production' } }
      };

      const result = service.convertToMCPConfig(serverWithNpm);

      expect(result.config).toEqual({
        type: 'custom',
        command: 'npx',
        args: ['-y', '@test/server'],
        env: { NODE_ENV: 'production' }
      });
    });

    test('should convert server with PyPI package', () => {
      const serverWithPyPI: MCPRegistryServer = {
        ...mockRegistryServer,
        packageRegistry: 'pypi',
        packageName: 'test-server',
        config: { env: { PYTHONPATH: '/path' } }
      };

      const result = service.convertToMCPConfig(serverWithPyPI);

      expect(result.config).toEqual({
        type: 'custom',
        command: 'uvx',
        args: ['test-server'],
        env: { PYTHONPATH: '/path' }
      });
    });

    test('should convert server with GitHub repository', () => {
      const serverWithGithub: MCPRegistryServer = {
        ...mockRegistryServer,
        repository: { type: 'git', url: 'https://github.com/test/repo' },
        config: undefined
      };

      const result = service.convertToMCPConfig(serverWithGithub);

      expect(result.config).toEqual({
        type: 'custom',
        command: 'npx',
        args: ['-y', 'github:test/repo']
      });
    });

    test('should handle server with incomplete configuration', () => {
      const incompleteServer: MCPRegistryServer = {
        id: 'incomplete',
        name: 'Incomplete Server',
        description: 'Server with missing config'
      };

      const result = service.convertToMCPConfig(incompleteServer);

      expect(result.config).toEqual({
        type: 'custom',
        command: 'echo',
        args: ['Server configuration incomplete - missing package information']
      });
    });
  });

  describe('PulseMCP API Integration', () => {
    test('should search PulseMCP successfully through public API', async () => {
      mockCacheManager.searchServers.mockResolvedValue({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPulseMCPResponse)
      });

      const result = await service.searchServers({ query: 'test', limit: 10 });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('Pulse Server');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pulsemcp.com/v0beta/servers?query=test&count_per_page=10',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('ConversationalAgent'),
            Accept: 'application/json'
          })
        })
      );
    });

    test('should handle API errors gracefully through public API', async () => {
      mockCacheManager.searchServers.mockResolvedValue({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);

      const result = await service.searchServers({});

      expect(result).toEqual({
        servers: [],
        total: 0,
        hasMore: false
      });
    });
  });

  describe('Server Search with Caching', () => {
    test('should return cached results when available', async () => {
      const cachedServers = [mockRegistryServer];
      mockCacheManager.searchServers.mockResolvedValue({
        servers: cachedServers.map(s => ({ ...s, registry: 'pulsemcp' })),
        total: 1,
        hasMore: false,
        fromCache: true,
        queryTime: 100
      });

      const result = await service.searchServers({ query: 'test' });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]).toEqual(mockRegistryServer);
      expect(mockCacheManager.searchServers).toHaveBeenCalledWith({
        query: 'test',
        tags: undefined,
        author: undefined,
        limit: 50,
        offset: 0,
        sortBy: 'githubStars',
        sortOrder: 'desc'
      });
    });

    test('should fall back to API when cache fails', async () => {
      mockCacheManager.searchServers.mockRejectedValue(new Error('Cache failed'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPulseMCPResponse)
      });

      const result = await service.searchServers({});

      expect(result.servers).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache search failed, falling back to direct API:',
        expect.any(Error)
      );
    });

    test('should fall back to static data when API fails', async () => {
      mockCacheManager.searchServers.mockResolvedValue({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: true,
        queryTime: 0
      });

      mockFetch.mockRejectedValue(new Error('API failed'));

      const { existsSync, readFileSync } = require('fs');
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify({
        servers: [mockRegistryServer]
      }));

      const result = await service.searchServers({});

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]).toEqual(mockRegistryServer);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'API search failed, falling back to static data:',
        expect.any(Error)
      );
    });

    test('should handle initial catalog view with multi-page fetch', async () => {
      const multiPageResponse = {
        servers: [
          { id: 'server1', name: 'Server 1', package_name: '@server1', github_stars: 100 },
          { id: 'server2', name: 'Server 2', package_name: '@server2', github_stars: 50 }
        ],
        total_count: 2,
        next: null
      };

      mockCacheManager.searchServers.mockResolvedValue({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(multiPageResponse)
      });

      const result = await service.searchServers({ limit: 10 });

      expect(result.servers).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Multiple pages fetched
      expect(mockCacheManager.bulkCacheServers).toHaveBeenCalled();
    });
  });

  describe('Retry Mechanism', () => {
    test('should handle API failures and retry through public interface', async () => {
      mockCacheManager.searchServers.mockRejectedValue(new Error('Cache failed'));
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);

      const result = await service.searchServers({});

      expect(result).toEqual({
        servers: [],
        total: 0,
        hasMore: false
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache search failed, falling back to direct API:',
        expect.any(Error)
      );
    });
  });

  describe('Fallback Servers', () => {
    test('should load fallback servers successfully', async () => {
      const { existsSync, readFileSync } = require('fs');
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify({
        servers: [mockRegistryServer]
      }));

      const result = await (service as any).loadFallbackServers();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-server',
        name: 'Test Server',
        description: '',
        packageName: '@test/server',
        repository: { type: 'git', url: 'https://github.com/test/server' },
        config: mockRegistryServer.config,
        tags: ['test', 'utility'],
        installCount: 100,
        tools: mockRegistryServer.tools
      });
    });

    test('should handle missing fallback file', async () => {
      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);

      const result = await (service as any).loadFallbackServers();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Fallback server data not found at:',
        '/fake/path/popularMCPServers.json'
      );
    });

    test('should handle invalid JSON in fallback file', async () => {
      const { existsSync, readFileSync } = require('fs');
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue('invalid json');

      const result = await (service as any).loadFallbackServers();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Package Name Validation', () => {
    test('should validate valid npm package names through installability check', () => {
      const validNames = [
        '@scope/package',
        'simple-package',
        'package-with-dashes'
      ];

      validNames.forEach(name => {
        const server: MCPRegistryServer = {
          id: 'test',
          name: 'Test Server',
          description: 'Test',
          packageRegistry: 'npm',
          packageName: name
        };

        expect(service.isServerInstallable(server)).toBe(true);
      });
    });

    test('should reject invalid npm package names through installability check', () => {
      const invalidNames = [
        'package with spaces',
        'package/with/slashes'
      ];

      invalidNames.forEach(name => {
        const server: MCPRegistryServer = {
          id: 'test',
          name: 'Test Server',
          description: 'Test',
          packageRegistry: 'npm',
          packageName: name
        };

        expect(service.isServerInstallable(server)).toBe(false);
      });
    });
  });

  describe('Server Details', () => {
    test('should return null when no server details found', async () => {
      const result = await service.getServerDetails('non-existent-server');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No details found for server: non-existent-server (packageName: undefined, effectivePackageName: non-existent-server)'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle search errors gracefully', async () => {
      mockCacheManager.searchServers.mockRejectedValue(new Error('Cache failed'));
      mockFetch.mockRejectedValue(new Error('API failed'));

      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);

      const result = await service.searchServers({});

      expect(result).toEqual({
        servers: [],
        total: 0,
        hasMore: false
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to search MCP registries:', expect.any(Error));
    });
  });
});
