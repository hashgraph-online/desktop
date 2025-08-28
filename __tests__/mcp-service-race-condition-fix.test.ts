import { MCPService } from '../src/main/services/mcp-service';
import type { MCPServerConfig } from '../src/main/services/mcp-service';
import { jest } from '@jest/globals';

jest.mock('child_process');
jest.mock('fs');
jest.mock('os');
jest.mock('../src/main/utils/logger');
jest.mock('../src/main/validators/mcp-server-validator');
jest.mock('../src/main/services/mcp-connection-pool-manager');
jest.mock('../src/main/utils/ConcurrencyManager');

describe('MCPService Race Condition Fixes', () => {
  let mcpService: MCPService;
  let mockSpawn: jest.MockedFunction<typeof import('child_process').spawn>;
  let mockProcess: {
    stdout: { on: jest.MockedFunction<any>; once: jest.MockedFunction<any> };
    stderr: { on: jest.MockedFunction<any> };
    stdin: { write: jest.MockedFunction<any>; end: jest.MockedFunction<any> };
    on: jest.MockedFunction<any>;
    kill: jest.MockedFunction<any>;
    pid: number;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProcess = {
      stdout: { on: jest.fn(), once: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
      pid: 12345
    };

    mockSpawn = jest.fn().mockReturnValue(mockProcess);
    
    jest.doMock('child_process', () => ({
      spawn: mockSpawn
    }));

    jest.doMock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      promises: {
        readFile: jest.fn().mockResolvedValue('[]'),
        writeFile: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ isDirectory: () => true }),
        mkdir: jest.fn().mockResolvedValue(undefined),
      }
    }));

    jest.doMock('os', () => ({
      homedir: jest.fn().mockReturnValue('/mock/home')
    }));

    jest.doMock('../src/main/validators/mcp-server-validator', () => ({
      MCPServerValidator: jest.fn().mockImplementation(() => ({
        validate: jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: []
        }),
        getErrorMessages: jest.fn().mockReturnValue([]),
        getWarningMessages: jest.fn().mockReturnValue([]),
        clearCache: jest.fn()
      }))
    }));

    jest.doMock('../src/main/services/mcp-connection-pool-manager', () => ({
      MCPConnectionPoolManager: {
        getInstance: jest.fn().mockReturnValue({
          initializePool: jest.fn(),
          acquireConnection: jest.fn(),
          cleanup: jest.fn(),
          getPerformanceMetrics: jest.fn().mockReturnValue({})
        })
      }
    }));

    jest.doMock('../src/main/utils/ConcurrencyManager', () => ({
      ConcurrencyManager: {
        getInstance: jest.fn().mockReturnValue({
          createTask: jest.fn(),
          executeParallel: jest.fn(),
          getStats: jest.fn().mockReturnValue({}),
          getStatus: jest.fn().mockReturnValue({ config: { maxConcurrency: 5 } }),
          updateConcurrency: jest.fn(),
          shutdown: jest.fn()
        })
      }
    }));

    mcpService = MCPService.getInstance();
    await mcpService.loadServers();
  });

  describe('fetchAndSaveTools race condition', () => {
    it('should fail with 5000ms timeout when server disconnects before tools are fetched', async () => {
      const serverConfig: MCPServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mcpService.saveServers([serverConfig]);

      const slowTimeout = 5000;
      const fastDisconnection = 1000;

      const connectPromise = mcpService.connectServer(serverConfig.id);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'spawn') {
            handler();
          }
        });
      }, 100);

      setTimeout(() => {
        mockProcess.kill();
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'close') {
            handler(0);
          }
        });
      }, fastDisconnection);

      const result = await connectPromise;
      
      expect(result.success).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, slowTimeout + 500));
      
      const serverConfigs = mcpService.getServerConfigs();
      const serverConfig2 = serverConfigs.find(s => s.id === serverConfig.id);
      expect(serverConfig2?.tools).toEqual([]);
      expect(serverConfig2?.status).not.toBe('ready');
    });

    it('should succeed with 1000ms timeout when server stays connected', async () => {
      const serverConfig: MCPServerConfig = {
        id: 'test-server-fixed',
        name: 'Test Server Fixed',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mcpService.saveServers([serverConfig]);

      const toolsResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            {
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: {
                type: 'object',
                properties: {
                  param: { type: 'string' }
                }
              }
            }
          ]
        }
      };

      const connectPromise = mcpService.connectServer(serverConfig.id);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'spawn') {
            handler();
          }
        });
      }, 100);

      setTimeout(() => {
        const dataHandlers = mockProcess.stdout.on.mock.calls
          .filter(([event]) => event === 'data')
          .map(([, handler]) => handler);
        
        if (dataHandlers.length > 0) {
          const buffer = Buffer.from(JSON.stringify(toolsResponse) + '\n');
          dataHandlers.forEach(handler => handler(buffer));
        }
      }, 1200);

      const result = await connectPromise;
      expect(result.success).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const serverConfigs = mcpService.getServerConfigs();
      const updatedConfig = serverConfigs.find(s => s.id === serverConfig.id);
      expect(updatedConfig?.tools).toHaveLength(1);
      expect(updatedConfig?.tools?.[0].name).toBe('test-tool');
      expect(updatedConfig?.status).toBe('ready');
    });

    it('should check server connection before attempting tool fetch', async () => {
      const serverConfig: MCPServerConfig = {
        id: 'connection-check-server',
        name: 'Connection Check Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mcpService.saveServers([serverConfig]);

      const connectPromise = mcpService.connectServer(serverConfig.id);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'spawn') {
            handler();
          }
        });
      }, 100);

      setTimeout(() => {
        mockProcess.kill();
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'close') {
            handler(0);
          }
        });
      }, 500);

      const result = await connectPromise;
      expect(result.success).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const connectedIds = mcpService.getConnectedServerIds();
      expect(connectedIds).not.toContain(serverConfig.id);
    });
  });

  describe('connection health validation', () => {
    it('should properly track connection health metrics', async () => {
      const serverConfig: MCPServerConfig = {
        id: 'health-test-server',
        name: 'Health Test Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mcpService.saveServers([serverConfig]);

      const initialHealth = mcpService.getConnectionHealth(serverConfig.id);
      expect(initialHealth).toBeUndefined();

      const connectPromise = mcpService.connectServer(serverConfig.id);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'error') {
            handler(new Error('Connection failed'));
          }
        });
      }, 100);

      const result = await connectPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      
      const healthAfterError = mcpService.getConnectionHealth(serverConfig.id);
      expect(healthAfterError).toBeDefined();
      expect(healthAfterError?.connectionAttempts).toBeGreaterThan(0);
      expect(healthAfterError?.lastError).toBe('Connection failed');
      expect(healthAfterError?.errorRate).toBeGreaterThan(0);
    });
  });

  describe('server tool fetching with proper connection state', () => {
    it('should return empty array when server is not connected', async () => {
      const tools = await mcpService.getServerTools('non-existent-server');
      expect(tools).toEqual([]);
    });

    it('should handle timeout gracefully when fetching tools', async () => {
      const serverConfig: MCPServerConfig = {
        id: 'timeout-test-server',
        name: 'Timeout Test Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mcpService.saveServers([serverConfig]);

      const connectPromise = mcpService.connectServer(serverConfig.id);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach(([event, handler]) => {
          if (event === 'spawn') {
            handler();
          }
        });
      }, 100);

      const result = await connectPromise;
      expect(result.success).toBe(true);
      
      const toolsPromise = mcpService.getServerTools(serverConfig.id);
      
      const tools = await toolsPromise;
      expect(Array.isArray(tools)).toBe(true);
    });
  });
});
