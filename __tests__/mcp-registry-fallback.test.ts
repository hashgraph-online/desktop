import { MCPRegistryService } from "./mcp-registry-service";
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('MCPRegistryService API Fallback', () => {
  let service: MCPRegistryService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    service = MCPRegistryService.getInstance();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('PulseMCP API Failures', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fallback to static data when PulseMCP returns 404', async () => {
      const mockStaticData = {
        servers: [
          {
            id: 'filesystem-local',
            name: 'Local Filesystem',
            description: 'Access and manage files on your local computer',
            category: 'dev-tools',
            popularity: 95,
            difficulty: 'easy',
            tags: ['files', 'local', 'essential'],
            template: {
              type: 'filesystem',
              config: {
                rootPath: '$HOME',
                readOnly: false
              }
            },
            quickSetup: true
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockStaticData));
      mockFs.existsSync.mockReturnValue(true);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('PulseMCP API error: 404'));

      const result = await service.searchServers({ query: 'filesystem' });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('Local Filesystem');
      expect(result.servers[0].id).toBe('filesystem-local');
      expect(result.total).toBeGreaterThan(0);
    });

    it('should fallback to static data on network timeout', async () => {
      const mockStaticData = {
        servers: [
          {
            id: 'github-api',
            name: 'GitHub Integration',
            description: 'Interact with GitHub repositories',
            category: 'dev-tools',
            popularity: 88,
            difficulty: 'easy',
            tags: ['github', 'git', 'vcs'],
            template: {
              type: 'github',
              config: {
                branch: 'main'
              }
            },
            quickSetup: true
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockStaticData));
      mockFs.existsSync.mockReturnValue(true);

      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const result = await service.searchServers();

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('GitHub Integration');
      expect(result.total).toBe(1);
    });

    it('should return converted server configs from static data', async () => {
      const mockStaticData = {
        servers: [
          {
            id: 'postgres-db',
            name: 'PostgreSQL Database',
            description: 'Connect to PostgreSQL databases',
            category: 'data-sources',
            popularity: 82,
            difficulty: 'medium',
            tags: ['database', 'postgres', 'sql'],
            template: {
              type: 'postgres',
              config: {
                host: 'localhost',
                port: 5432
              }
            },
            installCommand: 'npm install -g @mcp/postgres',
            quickSetup: true
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockStaticData));
      mockFs.existsSync.mockReturnValue(true);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('API unavailable'));

      const result = await service.searchServers({ query: 'postgres' });

      expect(result.servers).toHaveLength(1);
      const server = result.servers[0];
      expect(server.name).toBe('PostgreSQL Database');
      expect(server.description).toBe('Connect to PostgreSQL databases');
      expect(server.tags).toEqual(['database', 'postgres', 'sql']);

      const mcpConfig = service.convertToMCPConfig(server);
      expect(mcpConfig.name).toBe('PostgreSQL Database');
      expect(mcpConfig.type).toBe('custom');
      expect(mcpConfig.enabled).toBe(true);
    });

    it('should handle invalid JSON in static data gracefully', async () => {
      mockFs.readFileSync.mockReturnValue('invalid json');
      mockFs.existsSync.mockReturnValue(true);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('API unavailable'));

      const result = await service.searchServers();

      expect(result.servers).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle missing static data file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('API unavailable'));

      const result = await service.searchServers();

      expect(result.servers).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should retry API calls with exponential backoff', async () => {
      const mockStaticData = { servers: [] };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockStaticData));
      mockFs.existsSync.mockReturnValue(true);

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ servers: [], total_count: 0 })
        });
      });

      const result = await service.searchServers();

      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(result.servers).toBeDefined();
    }, 15000);

    it('should eventually fallback to static data after max retries', async () => {
      const mockStaticData = {
        servers: [
          {
            id: 'fallback-server',
            name: 'Fallback Server',
            description: 'Fallback server from static data',
            category: 'dev-tools',
            popularity: 50,
            difficulty: 'easy',
            tags: ['fallback'],
            template: {
              type: 'filesystem',
              config: {}
            }
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockStaticData));
      mockFs.existsSync.mockReturnValue(true);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Persistent failure'));

      const result = await service.searchServers();

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('Fallback Server');
    }, 15000);
  });

  describe('Server Installability Validation', () => {
    it('should correctly identify installable servers from static data', () => {
      const serverWithCommand = {
        id: 'test-1',
        name: 'Test Server 1',
        description: 'Test server with command',
        config: {
          command: 'node',
          args: ['server.js']
        }
      };

      const serverWithPackageName = {
        id: 'test-2',
        name: 'Test Server 2',
        description: 'Test server with package name',
        packageName: '@mcp/test-server'
      };

      const serverWithGitHub = {
        id: 'test-3',
        name: 'Test Server 3',
        description: 'Test server with GitHub repo',
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo'
        }
      };

      const serverWithInvalidPackage = {
        id: 'test-4',
        name: 'Test Server 4',
        description: 'Test server with invalid package',
        packageName: 'bitcoin-mcp'
      };

      expect(service.isServerInstallable(serverWithCommand)).toBe(true);
      expect(service.isServerInstallable(serverWithPackageName)).toBe(true);
      expect(service.isServerInstallable(serverWithGitHub)).toBe(true);
      expect(service.isServerInstallable(serverWithInvalidPackage)).toBe(false);
    });
  });
});