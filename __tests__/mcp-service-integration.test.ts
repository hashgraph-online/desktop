import { MCPService } from "./mcp-service";
import { MCPRegistryService } from "./mcp-registry-service";

describe('MCP Service Integration', () => {
  let mcpService: MCPService;
  let registryService: MCPRegistryService;

  beforeEach(() => {
    mcpService = MCPService.getInstance();
    registryService = MCPRegistryService.getInstance();
  });

  describe('MCPService Configuration Loading', () => {
    it('should load default server configurations when no config file exists', async () => {
      const servers = await mcpService.loadServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Local Filesystem');
      expect(servers[0].type).toBe('filesystem');
      expect(servers[0].enabled).toBe(true);
      expect(servers[0].status).toBe('disconnected');
    });

    it('should have proper default configuration structure', async () => {
      const servers = await mcpService.loadServers();
      const defaultServer = servers[0];

      expect(defaultServer).toHaveProperty('id');
      expect(defaultServer).toHaveProperty('name');
      expect(defaultServer).toHaveProperty('type');
      expect(defaultServer).toHaveProperty('status');
      expect(defaultServer).toHaveProperty('enabled');
      expect(defaultServer).toHaveProperty('config');
      expect(defaultServer).toHaveProperty('tools');
      expect(defaultServer).toHaveProperty('createdAt');
      expect(defaultServer).toHaveProperty('updatedAt');
    });
  });

  describe('Registry to MCP Config Conversion', () => {
    it('should convert filesystem server from registry to MCP config', () => {
      const registryServer = {
        id: 'filesystem-local',
        name: 'Local Filesystem',
        description: 'Access and manage files on your local computer',
        template: {
          type: 'filesystem',
          config: {
            rootPath: '$HOME',
            readOnly: false
          }
        },
        tags: ['files', 'local'],
        popularity: 95
      };

      const mcpConfig = registryService.convertToMCPConfig(registryServer);

      expect(mcpConfig.name).toBe('Local Filesystem');
      expect(mcpConfig.type).toBe('custom');
      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.config).toBeDefined();
    });

    it('should convert GitHub server from registry to MCP config', () => {
      const registryServer = {
        id: 'github-api',
        name: 'GitHub Integration',
        description: 'Interact with GitHub repositories',
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo'
        },
        tags: ['github', 'vcs'],
        popularity: 88
      };

      const mcpConfig = registryService.convertToMCPConfig(registryServer);

      expect(mcpConfig.name).toBe('GitHub Integration');
      expect(mcpConfig.type).toBe('custom');
      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.config).toBeDefined();
    });

    it('should convert npm package server from registry to MCP config', () => {
      const registryServer = {
        id: 'postgres-db',
        name: 'PostgreSQL Database',
        description: 'Connect to PostgreSQL databases',
        packageName: '@mcp/postgres',
        tags: ['database', 'postgres'],
        popularity: 82
      };

      const mcpConfig = registryService.convertToMCPConfig(registryServer);

      expect(mcpConfig.name).toBe('PostgreSQL Database');
      expect(mcpConfig.type).toBe('custom');
      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.config).toBeDefined();

      const customConfig = mcpConfig.config as Record<string, unknown>;
      expect(customConfig.command).toBe('npx');
      expect(customConfig.args).toEqual(['-y', '@mcp/postgres']);
    });
  });

  describe('Tool Registration Callback', () => {
    it('should allow setting tool registration callback', () => {
      let callbackInvoked = false;
      let receivedServerId = '';
      let receivedTools: unknown[] = [];

      mcpService.setToolRegistrationCallback((serverId, tools) => {
        callbackInvoked = true;
        receivedServerId = serverId;
        receivedTools = tools;
      });

      const mockCallback = (mcpService as { toolRegistrationCallback?: unknown }).toolRegistrationCallback;
      if (mockCallback) {
        mockCallback('test-server', [
          { name: 'test-tool', description: 'A test tool', inputSchema: {} }
        ]);
      }

      expect(callbackInvoked).toBe(true);
      expect(receivedServerId).toBe('test-server');
      expect(receivedTools).toHaveLength(1);
      expect(receivedTools[0].name).toBe('test-tool');
    });
  });

  describe('Service Singleton Behavior', () => {
    it('should return same instance across calls', () => {
      const mcpService1 = MCPService.getInstance();
      const mcpService2 = MCPService.getInstance();
      const registryService1 = MCPRegistryService.getInstance();
      const registryService2 = MCPRegistryService.getInstance();

      expect(mcpService1).toBe(mcpService2);
      expect(registryService1).toBe(registryService2);
    });
  });
});