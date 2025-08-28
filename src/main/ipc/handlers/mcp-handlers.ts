import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { MCPService } from "../../services/mcp-service";
import type { MCPServerConfig } from "../../services/mcp-service";
import { MCPRegistryService } from "../../services/mcp-registry-service";
import type { MCPRegistrySearchOptions, MCPRegistryServer } from "../../services/mcp-registry-service";
import { MCPMetricsEnricher } from "../../services/mcp-metrics-enricher";
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';

function uniqueKeyForRegistryServer(s: MCPRegistryServer): string {
  return (
    s?.packageName ||
    s?.repository?.url ||
    s?.id ||
    s?.name ||
    ''
  )
}

function dedupeRegistryServers(list: MCPRegistryServer[]): MCPRegistryServer[] {
  const map = new Map<string, MCPRegistryServer>()
  for (const srv of list || []) {
    const key = uniqueKeyForRegistryServer(srv)
    if (key && !map.has(key)) map.set(key, srv)
  }
  return Array.from(map.values())
}

function sortServersByStars(list: MCPRegistryServer[]): MCPRegistryServer[] {
  const items = [...(list || [])]
  items.sort((a, b) => {
    const aStars = Number(a.githubStars ?? 0)
    const bStars = Number(b.githubStars ?? 0)
    if (aStars !== bStars) return bStars - aStars
    const aInst = Number(a.installCount ?? 0)
    const bInst = Number(b.installCount ?? 0)
    if (aInst !== bInst) return bInst - aInst
    return a.name.localeCompare(b.name)
  })
  return items
}

/**
 * Sets up MCP-related IPC handlers
 */
export function setupMCPHandlers(): void {
  const mcpService = MCPService.getInstance();
  const registryService = MCPRegistryService.getInstance();

  ipcMain.handle(
    'mcp:loadServers',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const servers = await mcpService.loadServers();
        return createSuccessResponse(servers);
      } catch (error) {
        return handleIPCError(error, 'Failed to load MCP servers');
      }
    }
  );

  ipcMain.handle(
    'mcp:enrichMetrics',
    async (event: IpcMainInvokeEvent, opts?: { limit?: number; concurrency?: number }): Promise<IPCResponse> => {
      try {
        const enricher = MCPMetricsEnricher.getInstance();
        const res = await enricher.enrichMissing(opts?.limit || 100, opts?.concurrency || 4);
        return createSuccessResponse(res);
      } catch (error) {
        return handleIPCError(error, 'Failed to enrich registry metrics');
      }
    }
  );

  ipcMain.handle(
    'mcp:saveServers',
    async (
      event: IpcMainInvokeEvent,
      servers: MCPServerConfig[]
    ): Promise<IPCResponse> => {
      try {
        await mcpService.saveServers(servers);
        return createSuccessResponse();
      } catch (error) {
        return handleIPCError(error, 'Failed to save MCP servers');
      }
    }
  );

  ipcMain.handle(
    'mcp:testConnection',
    async (
      event: IpcMainInvokeEvent,
      server: MCPServerConfig
    ): Promise<IPCResponse> => {
      try {
        const result = await mcpService.testConnection(server);
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to test MCP connection');
      }
    }
  );

  ipcMain.handle(
    'mcp:connectServer',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await mcpService.connectServer(serverId);
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to connect to MCP server');
      }
    }
  );

  ipcMain.handle(
    'mcp:disconnectServer',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        await mcpService.disconnectServer(serverId);
        return createSuccessResponse();
      } catch (error) {
        return handleIPCError(error, 'Failed to disconnect from MCP server');
      }
    }
  );

  ipcMain.handle(
    'mcp:getServerTools',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const tools = await mcpService.getServerTools(serverId);
        return createSuccessResponse(tools);
      } catch (error) {
        return handleIPCError(error, 'Failed to get server tools');
      }
    }
  );

  ipcMain.handle(
    'mcp:refreshServerTools',
    async (
      event: IpcMainInvokeEvent,
      serverId: string
    ): Promise<IPCResponse> => {
      try {
        const tools = await mcpService.refreshServerTools(serverId);
        return createSuccessResponse(tools);
      } catch (error) {
        return handleIPCError(error, 'Failed to refresh server tools');
      }
    }
  );

  ipcMain.handle(
    'mcp:validateServerConfig',
    async (
      event: IpcMainInvokeEvent,
      server: MCPServerConfig
    ): Promise<IPCResponse> => {
      try {
        const validationResult = await mcpService.validateServerConfig(server);
        return createSuccessResponse(validationResult);
      } catch (error) {
        return handleIPCError(error, 'Failed to validate server configuration');
      }
    }
  );

  ipcMain.handle(
    'mcp:searchRegistry',
    async (
      event: IpcMainInvokeEvent,
      options: MCPRegistrySearchOptions
    ): Promise<IPCResponse> => {
      try {
        const result = await registryService.searchServers(options);
        const deduped = dedupeRegistryServers(result.servers || [])
        const sorted = sortServersByStars(deduped)
        return createSuccessResponse({
          ...result,
          servers: sorted,
        });
      } catch (error) {
        return handleIPCError(error, 'Failed to search MCP registry');
      }
    }
  );

  ipcMain.handle(
    'mcp:getRegistryServerDetails',
    async (
      event: IpcMainInvokeEvent,
      data: { serverId: string; packageName?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await registryService.getServerDetails(
          data.serverId,
          data.packageName
        );
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to get server details');
      }
    }
  );

  ipcMain.handle(
    'mcp:installFromRegistry',
    async (
      event: IpcMainInvokeEvent,
      data: { serverId: string; packageName?: string }
    ): Promise<IPCResponse> => {
      try {
        const searchResult = await registryService.searchServers({
          query: data.serverId,
        });
        const server = searchResult.servers.find(
          (s) => s.id === data.serverId || s.name === data.serverId
        );

        if (server && !registryService.isServerInstallable(server)) {
          return {
            success: false,
            error:
              'This server does not have an npm package or GitHub repository available for installation',
          };
        }

        const registryServer = await registryService.getServerDetails(
          data.serverId,
          data.packageName
        );
        if (!registryServer) {
          if (server) {
            const mcpConfig = registryService.convertToMCPConfig(server);
            if (mcpConfig.config && 'command' in mcpConfig.config) {
              const serverConfig: MCPServerConfig = {
                id: `registry-${Date.now()}`,
                name: server.name,
                type: 'custom',
                status: 'disconnected',
                enabled: true,
                config: mcpConfig.config,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const servers = await mcpService.loadServers();
              servers.push(serverConfig);
              await mcpService.saveServers(servers);

              return createSuccessResponse(serverConfig);
            }
          }
          return {
            success: false,
            error:
              'Unable to fetch server details from registry. The server package may not exist or may not be available for installation.',
          };
        }

        const mcpConfig = registryService.convertToMCPConfig(registryServer);
        if (!mcpConfig.config || !('command' in mcpConfig.config)) {
          return {
            success: false,
            error: 'Unable to determine installation command',
          };
        }

        const serverConfig: MCPServerConfig = {
          id: `registry-${Date.now()}`,
          name: mcpConfig.name!,
          type: 'custom',
          status: 'disconnected',
          enabled: true,
          config: mcpConfig.config,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const servers = await mcpService.loadServers();
        servers.push(serverConfig);
        await mcpService.saveServers(servers);

        return createSuccessResponse(serverConfig);
      } catch (error) {
        return handleIPCError(error, 'Failed to install server from registry');
      }
    }
  );

  ipcMain.handle(
    'mcp:clearRegistryCache',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        await registryService.clearCache();
        return createSuccessResponse();
      } catch (error) {
        return handleIPCError(error, 'Failed to clear registry cache');
      }
    }
  );

  ipcMain.handle(
    'mcp:getCacheStats',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const stats = await registryService.getCacheStats();
        return createSuccessResponse(stats);
      } catch (error) {
        return handleIPCError(error, 'Failed to get cache statistics');
      }
    }
  );

  ipcMain.handle(
    'mcp:triggerBackgroundSync',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        (registryService as any).triggerBackgroundSync();
        return createSuccessResponse({ message: 'Background sync triggered' });
      } catch (error) {
        return handleIPCError(error, 'Failed to trigger background sync');
      }
    }
  );
}
