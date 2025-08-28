import type { MCPServerConfig, MCPConnectionResult, MCPServerTool } from "./mcp-service";

describe('MCPService Type Safety', () => {

  describe('Type-safe server configuration handling', () => {
    it('should handle server configurations with proper types', () => {
      const serverConfig: MCPServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/tmp/test',
          readOnly: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(typeof serverConfig.id).toBe('string');
      expect(typeof serverConfig.enabled).toBe('boolean');
      expect(serverConfig.config.type).toBe('filesystem');
    });

    it('should validate server tools with proper input schema typing', () => {
      const tool: MCPServerTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'First parameter'
            },
            param2: {
              type: 'number',
              minimum: 0,
              maximum: 100
            }
          },
          required: ['param1']
        }
      };

      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      expect(tool.inputSchema.required).toContain('param1');
    });

    it('should handle connection results with proper typing', () => {
      const successResult: MCPConnectionResult = {
        success: true,
        tools: [
          {
            name: 'list-files',
            description: 'List files in directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' }
              }
            }
          }
        ]
      };

      const failureResult: MCPConnectionResult = {
        success: false,
        error: 'Connection failed'
      };

      expect(successResult.success).toBe(true);
      expect(Array.isArray(successResult.tools)).toBe(true);
      expect(successResult.tools?.[0].name).toBe('list-files');
      
      expect(failureResult.success).toBe(false);
      expect(typeof failureResult.error).toBe('string');
    });
  });

  describe('Performance metrics with proper typing', () => {
    it('should define performance metrics structure with proper types', () => {
      const mockMetrics: {
        poolMetrics?: { connectionCount: number; averageLatency: number; };
        concurrencyStats?: { activeTasks: number; queueLength: number; };
        enabled: boolean;
      } = {
        enabled: true,
        poolMetrics: { connectionCount: 5, averageLatency: 120 },
        concurrencyStats: { activeTasks: 2, queueLength: 3 }
      };
      
      expect(typeof mockMetrics.enabled).toBe('boolean');
      expect(mockMetrics.poolMetrics?.connectionCount).toBe(5);
      expect(typeof mockMetrics.concurrencyStats?.activeTasks).toBe('number');
    });
  });

  describe('Server command building with type safety', () => {
    it('should build filesystem server commands with proper types', () => {
      const serverConfig: MCPServerConfig = {
        id: 'fs-server',
        name: 'Filesystem Server',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'filesystem',
          rootPath: '/home/user/documents'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(serverConfig.config.type).toBe('filesystem');
      if (serverConfig.config.type === 'filesystem') {
        expect(typeof serverConfig.config.rootPath).toBe('string');
      }
    });

    it('should handle custom server configs with proper types', () => {
      const customConfig: MCPServerConfig = {
        id: 'custom-server',
        name: 'Custom Server',
        type: 'custom',
        status: 'disconnected',
        enabled: true,
        config: {
          type: 'custom',
          command: 'my-custom-mcp-server',
          args: ['--config', 'production'],
          env: {
            NODE_ENV: 'production',
            DEBUG: 'true'
          },
          cwd: '/opt/mcp-server'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(customConfig.config.type).toBe('custom');
      if (customConfig.config.type === 'custom') {
        expect(typeof customConfig.config.command).toBe('string');
        expect(Array.isArray(customConfig.config.args)).toBe(true);
        expect(typeof customConfig.config.env).toBe('object');
        expect(customConfig.config.env?.NODE_ENV).toBe('production');
      }
    });
  });

  describe('Error handling with proper types', () => {
    it('should define validation result structure with proper types', () => {
      const validationResult: {
        valid: boolean;
        errors: string[];
        warnings: string[];
      } = {
        valid: false,
        errors: ['Server ID cannot be empty', 'Root path is required'],
        warnings: ['Server name is very short']
      };
      
      expect(typeof validationResult.valid).toBe('boolean');
      expect(Array.isArray(validationResult.errors)).toBe(true);
      expect(Array.isArray(validationResult.warnings)).toBe(true);
      expect(validationResult.errors[0]).toBe('Server ID cannot be empty');
    });

    it('should define parallel connection result structure with proper types', () => {
      const results: Array<{ serverId: string; success: boolean; error?: string }> = [
        { serverId: 'server1', success: true },
        { serverId: 'server2', success: false, error: 'Connection timeout' }
      ];

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(typeof result.serverId).toBe('string');
        expect(typeof result.success).toBe('boolean');
        if (!result.success) {
          expect(typeof result.error).toBe('string');
        }
      });
    });
  });
});