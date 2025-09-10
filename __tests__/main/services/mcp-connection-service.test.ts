import { MCPConnectionService } from '../../../src/main/services/mcp-connection-service';
import { Logger } from '../../../src/main/utils/logger';

jest.mock('../../../src/main/utils/logger');

describe('MCPConnectionService', () => {
  let mcpConnectionService: MCPConnectionService;
  let mockLogger: jest.Mocked<Logger>;
  let mockAgent: {
    getMCPConnectionStatus?: jest.Mock;
  };

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any;

    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);

    mcpConnectionService = new MCPConnectionService();
    mockAgent = {
      getMCPConnectionStatus: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create MCPConnectionService with logger', () => {
      expect(mcpConnectionService).toBeDefined();
      expect(Logger).toHaveBeenCalledWith({ module: 'MCPConnectionService' });
    });
  });

  describe('setAgent', () => {
    test('should set the agent instance', () => {
      mcpConnectionService['setAgent'](mockAgent);
      expect(mcpConnectionService['agent']).toBe(mockAgent);
    });

    test('should handle null agent', () => {
      mcpConnectionService['setAgent'](null);
      expect(mcpConnectionService['agent']).toBeNull();
    });
  });

  describe('getMCPConnectionStatus', () => {
    test('should return null when agent is not set', async () => {
      mcpConnectionService['setAgent'](null);

      const result = await mcpConnectionService['getMCPConnectionStatus']();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot get MCP status: agent not set');
    });

    test('should return connection status when agent supports getMCPConnectionStatus', async () => {
      const expectedStatus = new Map([['server1', { connected: true }]]);
      mockAgent.getMCPConnectionStatus!.mockReturnValue(expectedStatus);

      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionStatus']();

      expect(result).toBe(expectedStatus);
      expect(mockAgent.getMCPConnectionStatus).toHaveBeenCalled();
    });

    test('should return empty Map when agent does not support getMCPConnectionStatus', async () => {
      const agentWithoutMCP = {};

      mcpConnectionService['setAgent'](agentWithoutMCP);

      const result = await mcpConnectionService['getMCPConnectionStatus']();

      expect(result).toEqual(new Map());
      expect(mockLogger.debug).toHaveBeenCalledWith('Agent does not support MCP connection status');
    });

    test('should handle errors and return null', async () => {
      const error = new Error('Test error');
      mockAgent.getMCPConnectionStatus!.mockImplementation(() => {
        throw error;
      });

      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionStatus']();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get MCP connection status:', error);
    });

    test('should handle non-Error exceptions', async () => {
      mockAgent.getMCPConnectionStatus!.mockImplementation(() => {
        throw 'String error';
      });

      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionStatus']();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get MCP connection status:', 'String error');
    });
  });

  describe('isMCPServerConnected', () => {
    test('should return true when server is connected', async () => {
      mockAgent.isMCPServerConnected = jest.fn().mockReturnValue(true);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['isMCPServerConnected']('server1');

      expect(result).toBe(true);
      expect(mockAgent.isMCPServerConnected).toHaveBeenCalledWith('server1');
    });

    test('should return false when server is not connected', async () => {
      mockAgent.isMCPServerConnected = jest.fn().mockReturnValue(false);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['isMCPServerConnected']('server1');

      expect(result).toBe(false);
      expect(mockAgent.isMCPServerConnected).toHaveBeenCalledWith('server1');
    });

    test('should return false when agent does not support isMCPServerConnected', async () => {
      const agentWithoutMethod = {};
      mcpConnectionService['setAgent'](agentWithoutMethod);

      const result = await mcpConnectionService['isMCPServerConnected']('server1');

      expect(result).toBe(false);
    });

    test('should return false when agent is not set', async () => {
      mcpConnectionService['setAgent'](null);

      const result = await mcpConnectionService['isMCPServerConnected']('server1');

      expect(result).toBe(false);
    });

    test('should handle errors and return false', async () => {
      mockAgent.isMCPServerConnected = jest.fn().mockImplementation(() => {
        throw new Error('Connection check failed');
      });
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['isMCPServerConnected']('server1');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check MCP server connection status for server1:',
        new Error('Connection check failed')
      );
    });
  });

  describe('getMCPConnectionSummary', () => {
    test('should return summary with all connected servers', async () => {
      const mockStatus = new Map([
        ['server1', { connected: true, status: 'active' }],
        ['server2', { connected: true, status: 'active' }],
        ['server3', { connected: true, status: 'active' }]
      ]);

      mockAgent.getMCPConnectionStatus!.mockReturnValue(mockStatus);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionSummary']();

      expect(result).toEqual({
        total: 3,
        connected: 3,
        pending: 0,
        failed: 0
      });
    });

    test('should return summary with mixed connection states', async () => {
      const mockStatus = new Map([
        ['server1', { connected: true, status: 'active' }],
        ['server2', { connected: false, status: 'pending', lastError: undefined }],
        ['server3', { connected: false, status: 'failed', lastError: 'Connection timeout' }]
      ]);

      mockAgent.getMCPConnectionStatus!.mockReturnValue(mockStatus);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionSummary']();

      expect(result).toEqual({
        total: 3,
        connected: 1,
        pending: 1,
        failed: 1
      });
    });

    test('should return zero counts when getMCPConnectionStatus returns null', async () => {
      mockAgent.getMCPConnectionStatus!.mockReturnValue(null);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionSummary']();

      expect(result).toEqual({
        total: 0,
        connected: 0,
        pending: 0,
        failed: 0
      });
    });

    test('should handle empty status map', async () => {
      const mockStatus = new Map();

      mockAgent.getMCPConnectionStatus!.mockReturnValue(mockStatus);
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionSummary']();

      expect(result).toEqual({
        total: 0,
        connected: 0,
        pending: 0,
        failed: 0
      });
    });

    test('should handle errors from getMCPConnectionStatus', async () => {
      mockAgent.getMCPConnectionStatus!.mockImplementation(() => {
        throw new Error('Status retrieval failed');
      });
      mcpConnectionService['setAgent'](mockAgent);

      const result = await mcpConnectionService['getMCPConnectionSummary']();

      expect(result).toEqual({
        total: 0,
        connected: 0,
        pending: 0,
        failed: 0
      });
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete connection monitoring workflow', async () => {
      mcpConnectionService['setAgent'](null);
      expect(await mcpConnectionService['getMCPConnectionStatus']()).toBeNull();

      const mockStatus = new Map([
        ['server1', { connected: true, status: 'active' }],
        ['server2', { connected: false, status: 'error', lastError: 'Connection timeout' }],
        ['server3', { connected: false, status: 'pending' }]
      ]);

      mockAgent.getMCPConnectionStatus!.mockReturnValue(mockStatus);
      mockAgent.isMCPServerConnected = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mcpConnectionService['setAgent'](mockAgent);

      const status = await mcpConnectionService['getMCPConnectionStatus']();
      expect(status).toBe(mockStatus);

      expect(await mcpConnectionService['isMCPServerConnected']('server1')).toBe(true);
      expect(await mcpConnectionService['isMCPServerConnected']('server2')).toBe(false);

      const summary = await mcpConnectionService['getMCPConnectionSummary']();
      expect(summary).toEqual({
        total: 3,
        connected: 1,
        pending: 1,
        failed: 1
      });
    });

    test('should handle agent method not available gracefully', async () => {
      const agentWithoutMethod = {};
      mcpConnectionService['setAgent'](agentWithoutMethod);

      expect(await mcpConnectionService['getMCPConnectionStatus']()).toEqual(new Map());
      expect(await mcpConnectionService['isMCPServerConnected']('any')).toBe(false);

      const summary = await mcpConnectionService['getMCPConnectionSummary']();
      expect(summary).toEqual({
        total: 0,
        connected: 0,
        pending: 0,
        failed: 0
      });
    });

    test('should handle error recovery', async () => {
      mockAgent.getMCPConnectionStatus!.mockImplementationOnce(() => {
        throw new Error('Temporary failure');
      });

      mcpConnectionService['setAgent'](mockAgent);

      const failedResult = await mcpConnectionService['getMCPConnectionStatus']();
      expect(failedResult).toBeNull();

      const successStatus = new Map([['server1', { connected: true }]]);
      mockAgent.getMCPConnectionStatus!.mockReturnValue(successStatus);

      const successResult = await mcpConnectionService['getMCPConnectionStatus']();
      expect(successResult).toBe(successStatus);

      const summary = await mcpConnectionService['getMCPConnectionSummary']();
      expect(summary).toEqual({
        total: 1,
        connected: 1,
        pending: 0,
        failed: 0
      });
    });

    test('should handle complex connection states correctly', async () => {
      const complexStatus = new Map([
        ['server1', { connected: true, status: 'active' }],
        ['server2', { connected: false, status: 'connecting', lastError: undefined }],
        ['server3', { connected: false, status: 'failed', lastError: 'Auth failed' }],
        ['server4', { connected: false, status: 'timeout', lastError: 'Timeout' }],
        ['server5', { connected: true, status: 'active' }]
      ]);

      mockAgent.getMCPConnectionStatus!.mockReturnValue(complexStatus);
      mockAgent.isMCPServerConnected = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mcpConnectionService['setAgent'](mockAgent);

      const summary = await mcpConnectionService['getMCPConnectionSummary']();

      expect(summary).toEqual({
        total: 5,
        connected: 2, // server1 and server5
        pending: 1,   // server2 (no lastError)
        failed: 2     // server3 and server4 (have lastError)
      });
    });
  });
});
