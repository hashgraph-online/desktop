import { MCPServiceWrapper } from '../../../src/main/services/mcp-service-wrapper';
import { Logger } from '../../../src/main/utils/logger';

jest.mock('../../../src/main/utils/logger');
jest.mock('../../../src/main/services/mcp-service', () => ({
  MCPService: {
    getInstance: jest.fn(() => ({
      loadServers: jest.fn(),
      getServerById: jest.fn(),
      saveServer: jest.fn(),
      deleteServer: jest.fn(),
    })),
  },
}));

describe('MCPServiceWrapper', () => {
  let mcpServiceWrapper: MCPServiceWrapper;
  let mockLogger: jest.Mocked<Logger>;
  let mockMCPService: {
    loadServers: jest.Mock;
    getServerById: jest.Mock;
    saveServer: jest.Mock;
    deleteServer: jest.Mock;
  };
  let mockProvider: {
    loadServers: jest.Mock;
    getServerById: jest.Mock;
    saveServer: jest.Mock;
    deleteServer: jest.Mock;
  };

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockMCPService = {
      loadServers: jest.fn(),
      getServerById: jest.fn(),
      saveServer: jest.fn(),
      deleteServer: jest.fn(),
    };

    mockProvider = {
      loadServers: jest.fn(),
      getServerById: jest.fn(),
      saveServer: jest.fn(),
      deleteServer: jest.fn(),
    };

    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create MCPServiceWrapper without dependencies', () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      expect(mcpServiceWrapper).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'MCPServiceWrapper' });
    });

    test('should create MCPServiceWrapper with mock provider', () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });
      expect(mcpServiceWrapper).toBeDefined();
    });
  });

  describe('initializeActualService', () => {
    test('should skip initialization if already initialized', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      wrapper.actualMCPService = mockMCPService;

      await wrapper.initializeActualService();

      expect(wrapper.actualMCPService).toBe(mockMCPService);
    });

    test('should skip initialization if mock provider is set', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });
      const wrapper = mcpServiceWrapper as any;

      await wrapper.initializeActualService();

      expect(wrapper.actualMCPService).toBeUndefined();
    });

    test('should initialize actual MCP service successfully', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      await wrapper.initializeActualService();

      expect(wrapper.actualMCPService).toBe(mockMCPService);
      expect(mockLogger.info).toHaveBeenCalledWith('Initialized actual MCPService for Electron environment');
    });

    test('should handle MCP service initialization failure', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockImplementation(() => {
        throw new Error('Import failed');
      });

      await wrapper.initializeActualService();

      expect(wrapper.actualMCPService).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith('MCPService not available, using mock implementation for testing');
    });
  });

  describe('loadServers', () => {
    test('should use mock provider when available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      const expectedServers = [{ id: 'server1', name: 'Test Server' }];
      mockProvider.loadServers.mockResolvedValue(expectedServers);

      const result = await mcpServiceWrapper.loadServers();

      expect(result).toEqual(expectedServers);
      expect(mockProvider.loadServers).toHaveBeenCalled();
    });

    test('should use actual MCP service when initialized', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      const expectedServers = [{ id: 'server1', name: 'Test Server' }];
      mockMCPService.loadServers.mockResolvedValue(expectedServers);

      const result = await mcpServiceWrapper.loadServers();

      expect(result).toEqual(expectedServers);
      expect(mockMCPService.loadServers).toHaveBeenCalled();
    });

    test('should return empty array when no service available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const originalImport = wrapper.import;
      wrapper.import = jest.fn().mockRejectedValue(new Error('Import failed'));

      const result = await mcpServiceWrapper.loadServers();

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('No MCP service available, returning empty server list');
    });
  });

  describe('getServerById', () => {
    test('should use mock provider when available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      const expectedServer = { id: 'server1', name: 'Test Server' };
      mockProvider.getServerById.mockResolvedValue(expectedServer);

      const result = await mcpServiceWrapper.getServerById('server1');

      expect(result).toEqual(expectedServer);
      expect(mockProvider.getServerById).toHaveBeenCalledWith('server1');
    });

    test('should use actual MCP service when initialized', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      const expectedServer = { id: 'server1', name: 'Test Server' };
      mockMCPService.getServerById.mockResolvedValue(expectedServer);

      const result = await mcpServiceWrapper.getServerById('server1');

      expect(result).toEqual(expectedServer);
      expect(mockMCPService.getServerById).toHaveBeenCalledWith('server1');
    });

    test('should return null when no service available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const originalImport = wrapper.import;
      wrapper.import = jest.fn().mockRejectedValue(new Error('Import failed'));

      const result = await mcpServiceWrapper.getServerById('server1');

      expect(result).toBeNull();
    });
  });

  describe('saveServer', () => {
    const serverConfig = { id: 'server1', name: 'Test Server' };

    test('should use mock provider when available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      mockProvider.saveServer.mockResolvedValue(undefined);

      await mcpServiceWrapper.saveServer(serverConfig);

      expect(mockProvider.saveServer).toHaveBeenCalledWith(serverConfig);
    });

    test('should use actual MCP service when initialized', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      mockMCPService.saveServer.mockResolvedValue(undefined);

      await mcpServiceWrapper.saveServer(serverConfig);

      expect(mockMCPService.saveServer).toHaveBeenCalledWith(serverConfig);
    });

    test('should log warning when no service available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const originalImport = wrapper.import;
      wrapper.import = jest.fn().mockRejectedValue(new Error('Import failed'));

      await mcpServiceWrapper.saveServer(serverConfig);

      expect(mockLogger.warn).toHaveBeenCalledWith('No MCP service available, cannot save server');
    });
  });

  describe('deleteServer', () => {
    test('should use mock provider when available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      mockProvider.deleteServer.mockResolvedValue(undefined);

      await mcpServiceWrapper.deleteServer('server1');

      expect(mockProvider.deleteServer).toHaveBeenCalledWith('server1');
    });

    test('should use actual MCP service when initialized', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      mockMCPService.deleteServer.mockResolvedValue(undefined);

      await mcpServiceWrapper.deleteServer('server1');

      expect(mockMCPService.deleteServer).toHaveBeenCalledWith('server1');
    });

    test('should log warning when no service available', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const originalImport = wrapper.import;
      wrapper.import = jest.fn().mockRejectedValue(new Error('Import failed'));

      await mcpServiceWrapper.deleteServer('server1');

      expect(mockLogger.warn).toHaveBeenCalledWith('No MCP service available, cannot delete server');
    });
  });

  describe('isTestEnvironment', () => {
    test('should return true when mock provider is set', () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      expect(mcpServiceWrapper.isTestEnvironment()).toBe(true);
    });

    test('should return true when actual service is not initialized', () => {
      mcpServiceWrapper = new MCPServiceWrapper();

      expect(mcpServiceWrapper.isTestEnvironment()).toBe(true);
    });

    test('should return false when actual service is initialized', () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      wrapper.actualMCPService = mockMCPService;

      expect(mcpServiceWrapper.isTestEnvironment()).toBe(false);
    });
  });

  describe('getUnderlyingService', () => {
    test('should return mock provider when available', () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      expect(mcpServiceWrapper.getUnderlyingService()).toBe(mockProvider);
    });

    test('should return actual MCP service when available', () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      wrapper.actualMCPService = mockMCPService;

      expect(mcpServiceWrapper.getUnderlyingService()).toBe(mockMCPService);
    });

    test('should return undefined when no service available', () => {
      mcpServiceWrapper = new MCPServiceWrapper();

      expect(mcpServiceWrapper.getUnderlyingService()).toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete MCP server lifecycle with mock provider', async () => {
      mcpServiceWrapper = new MCPServiceWrapper({
        mcpServerProvider: mockProvider,
      });

      const serverConfig = { id: 'server1', name: 'Test Server' };
      const servers = [serverConfig];

      mockProvider.loadServers.mockResolvedValue(servers);
      mockProvider.getServerById.mockResolvedValue(serverConfig);
      mockProvider.saveServer.mockResolvedValue(undefined);
      mockProvider.deleteServer.mockResolvedValue(undefined);

      expect(await mcpServiceWrapper.loadServers()).toEqual(servers);
      expect(await mcpServiceWrapper.getServerById('server1')).toEqual(serverConfig);
      await mcpServiceWrapper.saveServer(serverConfig);
      await mcpServiceWrapper.deleteServer('server1');

      expect(mockProvider.loadServers).toHaveBeenCalled();
      expect(mockProvider.getServerById).toHaveBeenCalledWith('server1');
      expect(mockProvider.saveServer).toHaveBeenCalledWith(serverConfig);
      expect(mockProvider.deleteServer).toHaveBeenCalledWith('server1');
    });

    test('should handle service initialization and fallbacks', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      const wrapper = mcpServiceWrapper as any;

      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      mockMCPService.loadServers.mockResolvedValue([]);

      const result1 = await mcpServiceWrapper.loadServers();
      expect(result1).toEqual([]);
      expect(wrapper.actualMCPService).toBe(mockMCPService);

      mockMCPService.loadServers.mockResolvedValue([{ id: 'server1' }]);
      const result2 = await mcpServiceWrapper.loadServers();
      expect(result2).toEqual([{ id: 'server1' }]);
    });

    test('should handle environment switching correctly', async () => {
      mcpServiceWrapper = new MCPServiceWrapper();
      expect(mcpServiceWrapper.isTestEnvironment()).toBe(true);

      const wrapper = mcpServiceWrapper as any;
      const { MCPService } = require('../../../src/main/services/mcp-service');
      MCPService.getInstance.mockReturnValue(mockMCPService);

      await wrapper.initializeActualService();
      expect(mcpServiceWrapper.isTestEnvironment()).toBe(false);
    });
  });
});

