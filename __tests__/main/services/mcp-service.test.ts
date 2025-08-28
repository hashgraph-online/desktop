import { MCPService, type MCPServerConfig } from '../../../src/main/services/mcp-service';

jest.mock('../../../src/main/utils/logger');
jest.mock('../../../src/main/validators/mcp-server-validator');
jest.mock('../../../src/main/services/mcp-connection-pool-manager');
jest.mock('../../../src/main/utils/ConcurrencyManager');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');

const mockFs = {
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
};

const mockPath = {
  join: jest.fn(),
  dirname: jest.fn()
};

const mockOs = {
  homedir: jest.fn()
};

jest.mock('fs', () => ({
  existsSync: () => true,
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('path', () => ({
  join: jest.fn(),
  dirname: jest.fn()
}));

jest.mock('os', () => ({
  homedir: jest.fn()
}));

describe('MCPService', () => {
  let mcpService: MCPService;
  let mockLogger: any;
  let mockValidator: any;
  let mockPoolManager: any;
  let mockConcurrencyManager: any;

  const mockServerConfig: MCPServerConfig = {
    id: 'test-server-1',
    name: 'Test Server',
    type: 'custom',
    status: 'disconnected',
    enabled: true,
    config: {
      type: 'custom',
      command: 'npx',
      args: ['-y', 'test-package'],
      env: { NODE_ENV: 'test' }
    },
    tools: [
      {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockValidator = {
      validate: jest.fn().mockResolvedValue({ isValid: true, errors: [] })
    };

    mockPoolManager = {
      getInstance: jest.fn().mockReturnThis(),
      acquireConnection: jest.fn(),
      releaseConnection: jest.fn()
    };

    mockConcurrencyManager = {
      getInstance: jest.fn().mockReturnThis(),
      execute: jest.fn()
    };

    require('../../../src/main/utils/logger').Logger = jest.fn().mockImplementation(() => mockLogger);
    require('../../../src/main/validators/mcp-server-validator').MCPServerValidator = jest.fn().mockImplementation(() => mockValidator);
    require('../../../src/main/services/mcp-connection-pool-manager').MCPConnectionPoolManager = jest.fn().mockImplementation(() => mockPoolManager);
    require('../../../src/main/utils/ConcurrencyManager').ConcurrencyManager = jest.fn().mockImplementation(() => mockConcurrencyManager);

    require('@modelcontextprotocol/sdk/client/index.js').Client = jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      request: jest.fn().mockResolvedValue({ tools: [] })
    }));

    require('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport = jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      close: jest.fn()
    }));

    require('fs').existsSync = jest.fn().mockReturnValue(true);
    require('fs').promises.readFile = jest.fn().mockResolvedValue(JSON.stringify([mockServerConfig]));
    require('fs').promises.writeFile = jest.fn().mockResolvedValue(undefined);
    require('fs').promises.mkdir = jest.fn().mockResolvedValue(undefined);

    require('path').join = jest.fn().mockReturnValue('/mock/config/path');
    require('path').dirname = jest.fn().mockReturnValue('/mock/config');
    require('os').homedir = jest.fn().mockReturnValue('/home/user');

    MCPService['instance'] = null;
    mcpService = MCPService.getInstance();
  });

  afterEach(() => {
    MCPService['instance'] = null;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = MCPService.getInstance();
      const instance2 = MCPService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should create new instance when singleton is reset', () => {
      const instance1 = MCPService.getInstance();
      MCPService['instance'] = null;
      const instance2 = MCPService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(mockPath.join).toHaveBeenCalledWith('/home/user', '.config', 'hashgraph-online');
      expect(mockPath.join).toHaveBeenCalledWith('/mock/config/path', 'mcp-servers.json');
    });

    test('should handle electron environment', () => {
      const originalGlobalThis = globalThis;
      (globalThis as any).require = jest.fn().mockReturnValue({
        app: {
          getPath: jest.fn().mockReturnValue('/electron/user/data')
        }
      });

      MCPService['instance'] = null;
      const freshInstance = MCPService.getInstance();

      expect(mockPath.join).toHaveBeenCalledWith('/electron/user/data', 'mcp-servers.json');

      delete (globalThis as any).require;
    });
  });

  describe('setToolRegistrationCallback', () => {
    test('should set tool registration callback', () => {
      const callback = jest.fn();

      mcpService['setToolRegistrationCallback'](callback);

      expect(mockLogger.debug).toHaveBeenCalledWith('Tool registration callback set in MCPService');
    });
  });

  describe('loadServers', () => {
    test('should load servers from file successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify([mockServerConfig]));

      const result = await mcpService['loadServers']();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-server-1');
      expect(result[0].status).toBe('disconnected');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should handle corrupted JSON with recovery', async () => {
      const corruptedJson = 'prefix [' + JSON.stringify(mockServerConfig) + '] suffix';
      mockFs.promises.readFile.mockResolvedValue(corruptedJson);

      const result = await mcpService['loadServers']();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-server-1');
    });

    test('should return empty array when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await mcpService['loadServers']();

      expect(result).toEqual([]);
    });

    test('should handle file read errors gracefully', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('File read error'));

      const result = await mcpService['loadServers']();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveServers', () => {
    test('should save servers to file successfully', async () => {
      mockFs.promises.writeFile.mockResolvedValue(undefined);

      await expect(mcpService['saveServers']([mockServerConfig])).resolves.not.toThrow();

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/mock/config/path',
        expect.stringContaining('"test-server-1"'),
        'utf8'
      );
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should create directory if it does not exist', async () => {
      mockFs.promises.writeFile.mockRejectedValueOnce({ code: 'ENOENT' });
      mockFs.promises.writeFile.mockResolvedValueOnce(undefined);
      mockPath.dirname.mockReturnValue('/mock/config');

      await expect(mcpService['saveServers']([mockServerConfig])).resolves.not.toThrow();

      expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/mock/config', { recursive: true });
    });

    test('should handle save errors gracefully', async () => {
      mockFs.promises.writeFile.mockRejectedValue(new Error('Save error'));

      await expect(mcpService['saveServers']([mockServerConfig])).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('connectServer', () => {
    beforeEach(() => {
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        errors: []
      });

      const MockMCPClient = require('@modelcontextprotocol/sdk/client/index.js').Client;
      const MockTransport = require('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport;
    });

    test('should connect to server successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      });

      const result = await mcpService['connectServer']('test-server-1');

      expect(result.success).toBe(true);
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully connected to server')
      );
    });

    test('should handle connection failure', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await mcpService['connectServer']('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should reject if server is already connecting', async () => {
      const promise1 = mcpService['connectServer']('test-server-1');

      const promise2 = mcpService['connectServer']('test-server-1');

      await expect(promise2).rejects.toThrow('Server is already connecting');
    });

    test('should handle validation failure', async () => {
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid configuration']
      });

      const result = await mcpService['connectServer']('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });
  });

  describe('disconnectServer', () => {
    beforeEach(() => {
      const clientEntry = { client: mockClient, transport: mockTransport };
      (mcpService as any).clientEntries.set('test-server-1', clientEntry);
    });

    test('should disconnect server successfully', async () => {
      mockClient.disconnect.mockResolvedValue(undefined);

      await expect(mcpService['disconnectServer']('test-server-1')).resolves.not.toThrow();

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected from server')
      );
    });

    test('should handle disconnection errors gracefully', async () => {
      mockClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await expect(mcpService['disconnectServer']('test-server-1')).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle non-existent server gracefully', async () => {
      await expect(mcpService['disconnectServer']('non-existent')).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No active connection found')
      );
    });
  });

  describe('getServerTools', () => {
    beforeEach(() => {
      const clientEntry = { client: mockClient, transport: mockTransport };
      (mcpService as any).clientEntries.set('test-server-1', clientEntry);

      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      });
    });

    test('should retrieve server tools successfully', async () => {
      const tools = await mcpService['getServerTools']('test-server-1');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(mockClient.request).toHaveBeenCalledWith(
        { method: 'tools/list' },
        expect.any(Object)
      );
    });

    test('should handle non-existent server', async () => {
      await expect(mcpService['getServerTools']('non-existent')).rejects.toThrow(
        'Server not connected'
      );
    });

    test('should handle tool retrieval errors', async () => {
      mockClient.request.mockRejectedValue(new Error('Tool retrieval failed'));

      await expect(mcpService['getServerTools']('test-server-1')).rejects.toThrow(
        'Tool retrieval failed'
      );
    });
  });

  describe('disconnectAll', () => {
    test('should disconnect all servers', async () => {
      const clientEntry1 = { client: { ...mockClient, disconnect: jest.fn().mockResolvedValue(undefined) }, transport: mockTransport };
      const clientEntry2 = { client: { ...mockClient, disconnect: jest.fn().mockResolvedValue(undefined) }, transport: mockTransport };

      (mcpService as any).clientEntries.set('server-1', clientEntry1);
      (mcpService as any).clientEntries.set('server-2', clientEntry2);

      await expect(mcpService['disconnectAll']()).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected all servers')
      );
    });

    test('should handle disconnection errors in batch', async () => {
      const failingClient = { ...mockClient, disconnect: jest.fn().mockRejectedValue(new Error('Failed')) };
      (mcpService as any).clientEntries.set('failing-server', { client: failingClient, transport: mockTransport });

      await expect(mcpService['disconnectAll']()).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to disconnect server')
      );
    });
  });

  describe('refreshServerTools', () => {
    beforeEach(() => {
      const clientEntry = { client: mockClient, transport: mockTransport };
      (mcpService as any).clientEntries.set('test-server-1', clientEntry);

      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'refreshed-tool',
            description: 'A refreshed tool',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      });
    });

    test('should refresh server tools successfully', async () => {
      const tools = await mcpService['refreshServerTools']('test-server-1');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('refreshed-tool');
      expect(mockClient.request).toHaveBeenCalledWith(
        { method: 'tools/list' },
        expect.any(Object)
      );
    });

    test('should handle non-existent server', async () => {
      await expect(mcpService['refreshServerTools']('non-existent')).rejects.toThrow(
        'Server not connected'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid server configurations', async () => {
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errors: ['Invalid command', 'Missing arguments']
      });

      const result = await mcpService['connectServer']('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid command');
    });

    test('should handle concurrent connection attempts', async () => {
      mockClient.connect.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      mockClient.request.mockResolvedValue({ tools: [] });

      const promise1 = mcpService['connectServer']('test-server-1');
      const promise2 = mcpService['connectServer']('test-server-1');

      await expect(promise2).rejects.toThrow('Server is already connecting');

      const result = await promise1;
      expect(result.success).toBe(true);
    });

    test('should handle file system errors during config operations', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await mcpService['loadServers']();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load MCP servers'),
        expect.any(Error)
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete server lifecycle', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify([mockServerConfig]));

      let servers = await mcpService['loadServers']();
      expect(servers).toHaveLength(1);
      expect(servers[0].status).toBe('disconnected');

      mockValidator.validate.mockResolvedValue({ isValid: true, errors: [] });
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.request.mockResolvedValue({ tools: [] });

      const connectResult = await mcpService['connectServer']('test-server-1');
      expect(connectResult.success).toBe(true);

      mockClient.request.mockResolvedValue({
        tools: [{ name: 'test-tool', description: 'Test', inputSchema: { type: 'object' } }]
      });

      const tools = await mcpService['getServerTools']('test-server-1');
      expect(tools).toHaveLength(1);

      mockClient.disconnect.mockResolvedValue(undefined);
      await expect(mcpService['disconnectServer']('test-server-1')).resolves.not.toThrow();

      mockFs.promises.writeFile.mockResolvedValue(undefined);
      await expect(mcpService['saveServers'](servers)).resolves.not.toThrow();
    });

    test('should handle multiple servers simultaneously', async () => {
      const serverConfigs = [
        { ...mockServerConfig, id: 'server-1', name: 'Server 1' },
        { ...mockServerConfig, id: 'server-2', name: 'Server 2' },
        { ...mockServerConfig, id: 'server-3', name: 'Server 3' }
      ];

      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(serverConfigs));
      mockValidator.validate.mockResolvedValue({ isValid: true, errors: [] });
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.request.mockResolvedValue({ tools: [] });

      const servers = await mcpService['loadServers']();
      expect(servers).toHaveLength(3);

      const connectPromises = servers.map(server =>
        mcpService['connectServer'](server.id)
      );

      const results = await Promise.all(connectPromises);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      await expect(mcpService['disconnectAll']()).resolves.not.toThrow();
    });
  });
});
