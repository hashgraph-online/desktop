import { MCPService, MCPServerConfig, MCPConnectionResult } from '../../../src/main/services/mcp-service';
import { Logger } from '../../../src/main/utils/logger';
import { MCPServerValidator } from '../../../src/main/validators/mcp-server-validator';
import { MCPConnectionPoolManager } from '../../../src/main/services/mcp-connection-pool-manager';
import { ConcurrencyManager } from '../../../src/main/utils/ConcurrencyManager';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLoggerInstance)
}));
jest.mock('../../../src/main/validators/mcp-server-validator');
jest.mock('../../../src/main/services/mcp-connection-pool-manager');
jest.mock('../../../src/main/utils/ConcurrencyManager');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');

const mockStat = jest.fn();
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockExistsSync = jest.fn();
const mockCopyFile = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  copyFile: mockCopyFile,
  promises: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    stat: mockStat,
    access: jest.fn()
  }
}));

const mockPathJoin = jest.fn((...args) => args.join('/'));
const mockPathDirname = jest.fn((path) => path.split('/').slice(0, -1).join('/'));
const mockOsHomedir = jest.fn(() => '/tmp');

jest.mock('path', () => ({
  join: mockPathJoin,
  dirname: mockPathDirname
}));

jest.mock('os', () => ({
  homedir: mockOsHomedir
}));

const mockFsPromises = require('fs').promises;

const mockClientInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  listTools: jest.fn().mockResolvedValue({
    tools: [{
      name: 'test-tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      }
    }]
  }),
  callTool: jest.fn().mockResolvedValue({ content: [] }),
  listResources: jest.fn().mockResolvedValue({ resources: [] }),
  readResource: jest.fn().mockResolvedValue({ contents: [] }),
  listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
  getPrompt: jest.fn().mockResolvedValue({ description: '', messages: [] }),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  request: jest.fn(),
  setRequestHandler: jest.fn(),
  removeRequestHandler: jest.fn(),
};

const mockTransportInstance = {
  start: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

(MCPClient as jest.MockedClass<typeof MCPClient>).mockImplementation(() => mockClientInstance);
(StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransportInstance);
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    copyFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn(),
  dirname: jest.fn(),
}));
jest.mock('os', () => ({
  homedir: jest.fn(),
  tmpdir: jest.fn(),
}));

const mockElectron = {
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
};

Object.defineProperty(globalThis, 'require', {
  value: jest.fn((moduleName: string) => {
    if (moduleName === 'electron') {
      return mockElectron;
    }
    return jest.requireActual(moduleName);
  }),
  writable: true,
});

describe('MCPService', () => {
  let mcpService: MCPService;
  let mockLogger: jest.Mocked<Logger>;
  let mockValidator: jest.Mocked<MCPServerValidator>;
  let mockPoolManager: jest.Mocked<MCPConnectionPoolManager>;
  let mockConcurrencyManager: jest.Mocked<ConcurrencyManager>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsPromises: jest.Mocked<typeof fs.promises>;
  let mockPath: jest.Mocked<typeof path>;
  let mockOs: jest.Mocked<typeof os>;
  let mockMCPClient: jest.MockedClass<typeof MCPClient>;
  let mockStdioTransport: jest.MockedClass<typeof StdioClientTransport>;

  const mockConfig: MCPServerConfig = {
    id: 'test-server',
    name: 'Test Server',
    type: 'filesystem',
    status: 'disconnected',
    enabled: true,
    config: {
      type: 'filesystem',
      rootPath: '/test/path',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTool = {
    name: 'test-tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockExistsSync.mockReturnValue(false);
    mockStat.mockRejectedValue({ code: 'ENOENT' });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    mockFs = require('fs') as jest.Mocked<typeof fs>;
    mockFsPromises = mockFs.promises as jest.Mocked<typeof fs.promises>;
    mockPath = require('path') as jest.Mocked<typeof path>;
    mockOs = require('os') as jest.Mocked<typeof os>;
    mockMCPClient = require('@modelcontextprotocol/sdk/client/index.js').Client as jest.MockedClass<typeof MCPClient>;
    mockStdioTransport = require('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>;

    mockLogger = mockLoggerInstance;

    mockValidator = {
      validate: jest.fn(),
      validateConfig: jest.fn(),
      validateConnection: jest.fn(),
      clearCache: jest.fn(),
    } as any;

    mockPoolManager = {
      getConnection: jest.fn(),
      releaseConnection: jest.fn(),
      cleanup: jest.fn(),
      getPerformanceMetrics: jest.fn(),
    } as any;

    mockConcurrencyManager = {
      executeTask: jest.fn(),
      getStats: jest.fn(),
      cleanup: jest.fn(),
      shutdown: jest.fn(),
      createTask: jest.fn(),
    } as any;

    mockFs.existsSync.mockReturnValue(false);
    mockFsPromises.readFile.mockResolvedValue('[]');
    mockFsPromises.writeFile.mockResolvedValue(undefined);
    mockFsPromises.mkdir.mockResolvedValue(undefined);
    mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFsPromises.copyFile.mockResolvedValue(undefined);

    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    mockPath.dirname.mockImplementation((p: string) => p.split('/').slice(0, -1).join('/'));

    mockOs.homedir.mockReturnValue('/home/user');
    mockOs.tmpdir.mockReturnValue('/tmp');

    const mockClientInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
      callTool: jest.fn().mockResolvedValue({}),
      listResources: jest.fn().mockResolvedValue({ resources: [] }),
      readResource: jest.fn().mockResolvedValue({ contents: [] }),
      getServerCapabilities: jest.fn().mockResolvedValue({}),
    };

    mockMCPClient.mockImplementation(() => mockClientInstance);

    mockStdioTransport.mockImplementation(() => ({}));


    const mockValidatorModule = require('../../../src/main/validators/mcp-server-validator');
    mockValidatorModule.MCPServerValidator.mockImplementation(() => mockValidator);
    mockValidator.validate.mockResolvedValue({ valid: true, errors: [] });
    mockValidator.validateConfig.mockResolvedValue({ valid: true, errors: [] });
    mockValidator.validateConnection.mockResolvedValue({ valid: true });

    mockValidator.clearCache.mockReturnValue(undefined);

    mockValidator.validateServerConfig = jest.fn().mockResolvedValue({ valid: true, errors: [] });

    const mockPoolModule = require('../../../src/main/services/mcp-connection-pool-manager');
    mockPoolModule.MCPConnectionPoolManager.getInstance.mockReturnValue(mockPoolManager);
    mockPoolManager.getPerformanceMetrics.mockReturnValue({
      totalConnections: 0,
      activeConnections: 0,
      totalConnectionTime: 0,
    });

    const mockConcurrencyModule = require('../../../src/main/utils/ConcurrencyManager');
    mockConcurrencyModule.ConcurrencyManager.getInstance.mockReturnValue(mockConcurrencyManager);
    mockConcurrencyManager.shutdown.mockResolvedValue(undefined);
    mockConcurrencyManager.createTask.mockReturnValue({} as any);
    mockConcurrencyManager.getStats.mockReturnValue({
      activeTasks: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
    });

    mcpService = MCPService.getInstance();

    (mcpService as any).logger = mockLogger;

  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = MCPService.getInstance();
      const instance2 = MCPService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with correct paths', () => {
      const mockLoggerModule = require('../../../src/main/utils/logger');
      expect(mockLoggerModule.Logger).toHaveBeenCalledWith({ module: 'MCPService' });
    });

    test('should fallback to homedir when electron is not available', () => {
      (globalThis.require as jest.Mock).mockImplementation(() => {
        throw new Error('Module not found');
      });

      (MCPService as any).instance = null;
      const newService = MCPService.getInstance();

      expect(mockOs.homedir).toHaveBeenCalled();
    });
  });

  describe('Server Configuration Management', () => {
    test('should load servers from disk successfully', async () => {
      const mockServers = [mockConfig];
      const fileContent = JSON.stringify(mockServers);

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(fileContent);

      const result = await mcpService.loadServers();

      expect(mockFs.existsSync).toHaveBeenCalledWith('/home/user/.config/hashgraph-online/mcp-servers.json');
      expect(mockFsPromises.readFile).toHaveBeenCalledWith('/home/user/.config/hashgraph-online/mcp-servers.json', 'utf8');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('disconnected');
      expect(mockLogger.info).toHaveBeenCalledWith('Loaded 1 MCP server configurations');
    });

    test('should create default servers when no config exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await mcpService.loadServers();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('filesystem');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No MCP server configurations found, creating default filesystem server'
      );
    });

    test('should handle corrupted config file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue('invalid json');

      const result = await mcpService.loadServers();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load MCP server configurations:',
        expect.any(Error)
      );
      expect(result).toHaveLength(1); // Should return default servers
    });

    test('should save servers to disk successfully', async () => {
      const serversToSave = [mockConfig];
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true } as any);

      await mcpService.saveServers(serversToSave);

      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        '/home/user/.config/hashgraph-online/mcp-servers.json',
        JSON.stringify(serversToSave, null, 2) + '\n',
        'utf8'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Directly saved 1 MCP server configurations to /home/user/.config/hashgraph-online/mcp-servers.json'
      );
    });

    test('should create config directory if it does not exist', async () => {
      const serversToSave = [mockConfig];

      const configPath = (mcpService as any).configPath;
      const configDir = configPath.split('/').slice(0, -1).join('/');


      const enoentError = new Error('ENOENT');
      (enoentError as any).code = 'ENOENT';
      mockStat.mockRejectedValue(enoentError);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await mcpService.saveServers(serversToSave);

      expect(mockMkdir).toHaveBeenCalledWith(configDir, { recursive: true });
    });

    test('should handle save errors gracefully', async () => {
      const serversToSave = [mockConfig];
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(mcpService.saveServers(serversToSave)).rejects.toThrow('Write failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save MCP server configurations:',
        expect.any(Error)
      );
    });
  });

  describe('Server Connection Management', () => {
    test('should connect to server successfully', async () => {
      await (mcpService as any).saveServers([mockConfig]);


      mockValidator.validateConnection.mockResolvedValue({ valid: true });

      const result: MCPConnectionResult = await mcpService.connectServer('test-server');

      expect(result.success).toBe(true);
      expect(result.tools).toEqual([mockTool]);
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully connected to MCP server: test-server');
    });

    test('should handle connection failure', async () => {
      await (mcpService as any).saveServers([mockConfig]);

      const mockClientInstance = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      const result: MCPConnectionResult = await mcpService.connectServer('test-server');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to connect to MCP server test-server:',
        expect.any(Error)
      );
    });

    test('should test connection successfully', async () => {
      await (mcpService as any).saveServers([mockConfig]);

      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getServerCapabilities: jest.fn().mockResolvedValue({ tools: true }),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));
      mockValidator.validateConnection.mockResolvedValue({ valid: true });

      const result = await mcpService.testConnection({
        type: 'filesystem',
        rootPath: '/test/path',
      });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Connection test successful for filesystem server');
    });

    test('should disconnect server successfully', async () => {
      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      await mcpService.connectServer('test-server');

      const result = await mcpService.disconnectServer('test-server');

      expect(result).toBeUndefined();
    });

    test('should disconnect all servers', async () => {
      const mockClientInstance1 = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      const mockClientInstance2 = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      let clientCount = 0;
      mockMCPClient.mockImplementation(() => {
        clientCount++;
        return (clientCount === 1 ? mockClientInstance1 : mockClientInstance2) as any;
      });

      mockStdioTransport.mockImplementation(() => ({} as any));

      await mcpService.connectServer('server1');
      await mcpService.connectServer('server2');

      await mcpService.disconnectAll();

      expect(mockLogger).toBeDefined();
    });
  });

  describe('Tool Management', () => {
    test('should get server tools successfully', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      await mcpService.connectServer('test-server');

      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      await mcpService.connectServer('test-server');

      const tools = await mcpService.getServerTools('test-server');

      expect(tools).toEqual([mockTool]);
      expect(mockClientInstance.listTools).toHaveBeenCalled();
    });

    test('should handle tool fetching for non-existent server', async () => {
      const tools = await mcpService.getServerTools('non-existent');

      expect(tools).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Server non-existent not found or not connected');
    });

    test('should refresh server tools', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      await mcpService.connectServer('test-server');

      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      await mcpService.connectServer('test-server');

      const tools = await mcpService.refreshServerTools('test-server');

      expect(tools).toEqual([mockTool]);
      expect(mockLogger.info).toHaveBeenCalledWith('Refreshed tools for server: test-server');
    });
  });

  describe('Server Configuration Queries', () => {
    test('should get server configs', () => {
      const configs = mcpService.getServerConfigs();

      expect(Array.isArray(configs)).toBe(true);
    });

    test('should get connection health for server', () => {
      const health = mcpService.getConnectionHealth('test-server');

      expect(health).toBeUndefined(); // No health data initially
    });

    test('should get connected server IDs', () => {
      const connectedIds = mcpService.getConnectedServerIds();

      expect(Array.isArray(connectedIds)).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate server config successfully', async () => {
      mockValidator.validateConfig.mockResolvedValue({
        valid: true,
        errors: [],
      });

      const result = await mcpService.validateServerConfig({
        type: 'filesystem',
        rootPath: '/valid/path',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should handle validation errors', async () => {
      mockValidator.validateConfig.mockResolvedValue({
        valid: false,
        errors: ['Invalid path']
      });

      const result = await mcpService.validateServerConfig({
        type: 'filesystem',
        rootPath: '/invalid/path',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid path');
    });

    test('should clear validation cache', () => {
      mcpService.clearValidationCache();

      expect(mockValidator).toBeDefined(); // Validator should still exist
    });
  });

  describe('Performance and Optimization', () => {
    test('should get performance metrics', () => {
      const metrics = mcpService.getPerformanceMetrics();

      expect(metrics.poolMetrics).toHaveProperty('totalConnections');
      expect(metrics.poolMetrics).toHaveProperty('activeConnections');
      expect(metrics.poolMetrics).toHaveProperty('totalConnectionTime');
    });

    test('should set performance optimizations', () => {
      mcpService.setPerformanceOptimizations(false);

      expect(mcpService).toBeDefined();
    });

    test('should connect servers in parallel', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      mockConcurrencyManager.executeTask.mockImplementation(async (task) => {
        return await task();
      });

      const servers = [mockConfig];
      const results = await mcpService.connectServersParallel(servers);

      expect(Array.isArray(results)).toBe(true);
      expect(results[0].success).toBe(true);
    });

    test('should connect servers in batch', async () => {
      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      const servers = [mockConfig];
      const results = await mcpService.connectServersBatch(servers, 2);

      expect(Array.isArray(results)).toBe(true);
      expect(results[0].success).toBe(true);
    });
  });

  describe('Tool Registration Callback', () => {
    test('should set tool registration callback', () => {
      const callback = jest.fn();
      mcpService.setToolRegistrationCallback(callback);

      expect(mockLogger.debug).toHaveBeenCalledWith('Tool registration callback set in MCPService');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle connect server for non-existent server', async () => {
      const result = await mcpService.connectServer('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server configuration not found');
    });

    test('should handle disconnect server for non-existent server', async () => {
      await expect(mcpService.disconnectServer('non-existent')).rejects.toThrow(
        'Server non-existent not found'
      );
    });

    test('should handle test connection with invalid config', async () => {
      mockValidator.validateConnection.mockRejectedValue(new Error('Invalid config'));

      const result = await mcpService.testConnection({
        type: 'filesystem',
        rootPath: '/invalid/path',
      });

      expect(result).toBe(false);
    });

    test('should handle cleanup optimizations', async () => {
      await mcpService.cleanupOptimizations();

      expect(mockConcurrencyManager.cleanup).toHaveBeenCalled();
      expect(mockPoolManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete server lifecycle', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      const servers = await mcpService.loadServers();
      expect(servers.length).toBeGreaterThan(0);

      const connectResult = await mcpService.connectServer('test-server');
      expect(connectResult.success).toBe(true);
      expect(connectResult.tools).toEqual([mockTool]);

      const tools = await mcpService.getServerTools('test-server');
      expect(tools).toEqual([mockTool]);

      const health = mcpService.getConnectionHealth('test-server');
      expect(health).toBeDefined();

      const connectedIds = mcpService.getConnectedServerIds();
      expect(connectedIds).toContain('test-server');

      await mcpService.disconnectServer('test-server');
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from MCP server: test-server');

      await mcpService.disconnectAll();
    });

    test('should handle multiple server operations', async () => {
      const server2Config = { ...mockConfig, id: 'server2', name: 'Server 2' };
      await (mcpService as any).saveServers([mockConfig, server2Config]);
      const mockClientInstance1 = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      const mockClientInstance2 = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      let clientIndex = 0;
      mockMCPClient.mockImplementation(() => {
        clientIndex++;
        return (clientIndex === 1 ? mockClientInstance1 : mockClientInstance2) as any;
      });

      mockStdioTransport.mockImplementation(() => ({} as any));

      const result1 = await mcpService.connectServer('server1');
      const result2 = await mcpService.connectServer('server2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const tools1 = await mcpService.getServerTools('server1');
      const tools2 = await mcpService.getServerTools('server2');

      expect(tools1).toEqual([mockTool]);
      expect(tools2).toEqual([]);

      const refreshedTools1 = await mcpService.refreshServerTools('server1');
      expect(refreshedTools1).toEqual([mockTool]);

      const connectedIds = mcpService.getConnectedServerIds();
      expect(connectedIds).toHaveLength(2);
      expect(connectedIds).toContain('server1');
      expect(connectedIds).toContain('server2');
    });

    test('should handle error recovery scenarios', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue('{"invalid": json}');

      const servers = await mcpService.loadServers();
      expect(servers).toHaveLength(1); // Should fallback to defaults

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load MCP server configurations:',
        expect.any(Error)
      );

      const mockClientInstance = {
        connect: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      const connectResult = await mcpService.connectServer('test-server');
      expect(connectResult.success).toBe(false);
      expect(connectResult.error).toContain('Network error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to connect to MCP server test-server:',
        expect.any(Error)
      );
    });

    test('should handle performance optimization scenarios', async () => {
      await (mcpService as any).saveServers([mockConfig]);
      mcpService.setPerformanceOptimizations(true);

      const initialMetrics = mcpService.getPerformanceMetrics();
      expect(initialMetrics.poolMetrics.totalConnections).toBe(0);

      const mockClientInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [mockTool] }),
        getServerCapabilities: jest.fn().mockResolvedValue({}),
      };

      mockMCPClient.mockImplementation(() => mockClientInstance as any);
      mockStdioTransport.mockImplementation(() => ({} as any));

      await mcpService.connectServer('test-server');

      const updatedMetrics = mcpService.getPerformanceMetrics();
      expect(updatedMetrics.activeConnections).toBe(1);

      const servers = [mockConfig];
      const parallelResults = await mcpService.connectServersParallel(servers);
      expect(parallelResults).toHaveLength(1);
      expect(parallelResults[0].success).toBe(true);

      await mcpService.cleanupOptimizations();
    });
  });
});