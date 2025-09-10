import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { MCPService } from "../../services/mcp-service";
import type { MCPServerConfig } from "../../services/mcp-service";
import { MCPRegistryService } from "../../services/mcp-registry-service";
import type { MCPRegistrySearchOptions, MCPRegistryServer } from "../../services/mcp-registry-service";
import { MCPMetricsEnricher } from "../../services/mcp-metrics-enricher";
import { MCPMetricsService } from "../../services/mcp-metrics-service";
import { BrowserWindow } from 'electron'
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

function computeFreshness(
  lastSuccessAt: Date | null | undefined,
  metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads'
): 'fresh' | 'stale' | 'expired' {
  const ttl = MCPMetricsEnricher.METRIC_TTLS_MS[metric]
  const half = Math.floor(ttl / 2)
  const now = Date.now()
  const last = lastSuccessAt ? (lastSuccessAt instanceof Date ? lastSuccessAt.getTime() : new Date(String(lastSuccessAt)).getTime()) : 0
  if (!last) return 'expired'
  const age = now - last
  if (age < half) return 'fresh'
  if (age < ttl) return 'stale'
  return 'expired'
}

/**
 * Sets up MCP-related IPC handlers
 */
export function setupMCPHandlers(): void {
  const mcpService = MCPService.getInstance();
  const registryService = MCPRegistryService.getInstance();
  const metricsService = MCPMetricsService.getInstance();
  metricsService.start();
  metricsService.on('updated', (updates: any) => {
    try {
      const wins = (BrowserWindow.getAllWindows && BrowserWindow.getAllWindows()) || []
      for (const win of wins) {
        try {
          win.webContents.send('mcp:metrics-updated', updates)
        } catch {}
      }
    } catch {}
  })

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
    'mcp:refreshMetrics',
    async (_evt: IpcMainInvokeEvent, data: { serverId: string; metric?: 'githubStars'|'npmDownloads'|'pypiDownloads' }): Promise<IPCResponse> => {
      try {
        metricsService.scheduleImmediateFetch(data.serverId, data.metric)
        return createSuccessResponse({ scheduled: true })
      } catch (error) {
        return handleIPCError(error, 'Failed to schedule metrics refresh');
      }
    }
  )

  ipcMain.handle(
    'mcp:set-active-servers',
    async (_evt: IpcMainInvokeEvent, data: { serverIds: string[]; ttlMs?: number }): Promise<IPCResponse> => {
      try {
        metricsService.setActive(data.serverIds || [], data.ttlMs || 15000)
        return createSuccessResponse({ ok: true })
      } catch (error) {
        return handleIPCError(error, 'Failed to set active servers');
      }
    }
  )

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
        type MetricStatusEntry = { metricType: string; status: string; value: number | null; lastSuccessAt: string | null; nextUpdateAt: string | null }
        type MetricStatusMap = Record<string, MetricStatusEntry[]>
        type Freshness = 'fresh'|'stale'|'expired'
        type MetricFreshnessMap = Record<string, { githubStars?: Freshness; downloads?: Freshness }>
        let metricStatuses: MetricStatusMap = {}
        let metricFreshness: MetricFreshnessMap = {}
        try {
          const db = require('../../db/connection').getDatabase()
          const sch = require('../../db/connection').schema
          if (db && sorted.length) {
            const ids = sorted.map(s => s.id)
            const rows: Array<{ serverId: string; metricType: string; status: string; value: number | null; lastSuccessAt: Date | null; nextUpdateAt: Date | null }>
              = await db.select().from(sch.mcpMetricStatus).where((require('drizzle-orm').inArray)(sch.mcpMetricStatus.serverId, ids)).all()
            const map: MetricStatusMap = {}
            const freshMap: MetricFreshnessMap = {}
            for (const r of rows) {
              const sid: string = r.serverId
              if (!map[sid]) map[sid] = []
              map[sid].push({
                metricType: r.metricType,
                status: r.status,
                value: typeof r.value === 'number' ? r.value : null,
                lastSuccessAt: r.lastSuccessAt ? new Date(r.lastSuccessAt).toISOString() : null,
                nextUpdateAt: r.nextUpdateAt ? new Date(r.nextUpdateAt).toISOString() : null,
              })
              if (!freshMap[sid]) freshMap[sid] = {}
              if (r.metricType === 'githubStars') freshMap[sid].githubStars = computeFreshness(r.lastSuccessAt, 'githubStars')
              if (r.metricType === 'npmDownloads' || r.metricType === 'pypiDownloads') freshMap[sid].downloads = computeFreshness(r.lastSuccessAt, r.metricType)
            }
            metricStatuses = map
            metricFreshness = freshMap
          }
        } catch {}
        try {
          const ids = sorted.map(s => s.id)
          metricsService.setActive(ids, 30000)
          const missing: string[] = []
          for (const id of ids) {
            const entries: MetricStatusEntry[] | undefined = metricStatuses[id]
            const hasStars = entries?.some(e => e.metricType === 'githubStars' && typeof e.value === 'number' && e.value > 0)
            const hasInstalls = entries?.some(e => (e.metricType === 'npmDownloads' || e.metricType === 'pypiDownloads') && typeof e.value === 'number' && e.value > 0)
            if (!hasStars || !hasInstalls) missing.push(id)
          }
          const topMissing = missing.slice(0, 20)
          for (const id of topMissing) metricsService.scheduleImmediateFetch(id)
          metricsService.markSurfaced(ids, 60000)
        } catch {}
        return createSuccessResponse({ ...result, servers: sorted, metricStatuses, metricFreshness });
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
