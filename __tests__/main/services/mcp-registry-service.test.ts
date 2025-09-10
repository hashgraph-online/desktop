jest.mock('../../../src/main/utils/logger');
jest.mock('../../../src/main/services/mcp-cache-manager');
jest.mock('../../../src/main/services/mcp-service');
jest.mock('../../../src/main/services/mcp-metrics-enricher');
jest.mock('path');
jest.mock('fs');

import { MCPRegistryService, type MCPRegistryServer, type MCPRegistrySearchOptions } from '../../../src/main/services/mcp-registry-service';
import { MCPCacheManager } from '../../../src/main/services/mcp-cache-manager';
import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher';
import type { MCPServerConfig } from '../../../src/main/services/mcp-service';

describe('MCPRegistryService', () => {
  let registryService: MCPRegistryService;
  let mockFs: jest.Mocked<typeof fs>;

  const mockRegistryServer: MCPRegistryServer = {
    id: 'test-server',
    name: 'Test MCP Server',
    description: 'A test MCP server for testing purposes',
    author: 'Test Author',
    version: '1.0.0',
    url: 'https://github.com/test/test-server',
    packageRegistry: 'npm',
    packageName: 'test-mcp-server',
    repository: {
      type: 'git',
      url: 'https://github.com/test/test-server.git'
    },
    config: {
      command: 'node',
      args: ['server.js'],
      env: { NODE_ENV: 'production' }
    },
    tags: ['test', 'utility'],
    license: 'MIT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    installCount: 100,
    rating: 4.5,
    githubStars: 50,
    tools: [
      { name: 'test-tool', description: 'A test tool' },
      { name: 'utility-tool', description: 'A utility tool' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFs = require('fs') as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      servers: [{
        id: 'test-server',
        name: 'Test MCP Server',
        description: 'A test MCP server for testing purposes',
        author: 'Test Author',
        package_name: 'test-mcp-server',
        repository: {
          type: 'git',
          url: 'https://github.com/test/test-server.git'
        },
        config: {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' }
        },
        tags: ['test', 'utility'],
        license: 'MIT',
        install_count: 100,
        tools: [
          { name: 'test-tool', description: 'A test tool' },
          { name: 'utility-tool', description: 'A utility tool' }
        ]
      }]
    }));

    const mockCacheManager = require('../../../src/main/services/mcp-cache-manager').MCPCacheManager;
    mockCacheManager.getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: 0
      }),
    });

    registryService = new MCPRegistryService();
  });

  describe('Initialization', () => {
    test('should initialize with default registry data', () => {
      expect(registryService).toBeDefined();
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });

    test('should handle missing registry file gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => new MCPRegistryService()).not.toThrow();
    });
  });

  describe('Server Discovery - searchServers', () => {
    test('should search servers and return local registry data when cache fails', async () => {
      const result = await registryService.searchServers({ query: 'test' });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('Test MCP Server');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    test('should handle empty search options', async () => {
      const result = await registryService.searchServers({});

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    test('should handle search with limit', async () => {
      const result = await registryService.searchServers({ limit: 5 });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
    });

    test('should handle search with offset', async () => {
      const result = await registryService.searchServers({ offset: 0 });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
    });

    test('should handle search with tags', async () => {
      const result = await registryService.searchServers({ tags: ['test'] });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
    });

    test('should handle search with author', async () => {
      const result = await registryService.searchServers({ author: 'Test Author' });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed registry file gracefully', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => new MCPRegistryService()).not.toThrow();
    });

    test('should handle search with invalid parameters', async () => {
      const result = await registryService.searchServers({ limit: -1, offset: -1 });

      expect(result).toBeDefined();
      expect(Array.isArray(result.servers)).toBe(true);
    });
  });
});