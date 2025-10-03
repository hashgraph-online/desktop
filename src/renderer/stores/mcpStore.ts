import { create } from 'zustand';
import {
  MCPServerConfig,
  MCPServerFormData,
  MCPConnectionTest,
  MCPServerType,
  MCPServerTool,
  MCPRegistryMetricsEntry,
} from '../types/mcp';
import { toCommandResponse } from '../tauri/ipc';

/**
 * Helper to wait for desktop bridge to be available
*/
const waitForDesktopBridge = async (
  maxRetries = 30,
  retryDelay = 1000
): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (
      window.desktop &&
      typeof window?.desktop?.loadMCPServers === 'function'
    ) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  return false;
};

const isLocalPermissionError = (message: string) =>
  message.includes('not allowed on window') && message.includes('URL: local');

const waitForRemoteOrigin = async (timeoutMs = 15000) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.origin.startsWith('http')) {
    return;
  }

  const metadata = (window as { __TAURI_METADATA__?: { config?: { build?: { devUrl?: string } } } }).__TAURI_METADATA__;
  const devUrl = metadata?.config?.build?.devUrl ?? import.meta.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5175';
  if (typeof devUrl === 'string' && devUrl.length > 0) {
    window.location.replace(devUrl);
    return;
  }

  const start = Date.now();

  await new Promise<void>((resolve, reject) => {
    const poll = () => {
      if (window.location.origin.startsWith('http')) {
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error('waitForRemoteOrigin timeout'));
        return;
      }

      requestAnimationFrame(poll);
    };

    poll();
  }).catch(() => undefined);
};

type MCPMetricsMap = Record<string, MCPRegistryMetricsEntry>;

const normalizeMetricsMap = (value: unknown): MCPMetricsMap | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const entries = value as Record<string, unknown>;
  const normalized: MCPMetricsMap = {};
  let hasData = false;

  for (const [key, entry] of Object.entries(entries)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const metric: MCPRegistryMetricsEntry = {};
    if (typeof record.status === 'string') {
      metric.status = record.status;
    }
    if (typeof record.value === 'number' && Number.isFinite(record.value)) {
      metric.value = record.value;
    }
    if (typeof record.lastUpdated === 'string') {
      metric.lastUpdated = record.lastUpdated;
    }
    if (typeof record.errorCode === 'string') {
      metric.errorCode = record.errorCode;
    }
    if (typeof record.errorMessage === 'string') {
      metric.errorMessage = record.errorMessage;
    }
    if (Object.keys(metric).length > 0) {
      normalized[key] = metric;
      hasData = true;
    }
  }

  return hasData ? normalized : undefined;
};

const normalizeFreshnessMap = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const entries = value as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  let hasData = false;

  for (const [key, entry] of Object.entries(entries)) {
    if (typeof entry === 'string' && entry.length > 0) {
      normalized[key] = entry;
      hasData = true;
    }
  }

  return hasData ? normalized : undefined;
};

const mergeMetrics = (
  current: MCPMetricsMap | undefined,
  incoming: MCPMetricsMap | undefined
): MCPMetricsMap | undefined => {
  if (!incoming) {
    return current;
  }
  const base: MCPMetricsMap = current ? { ...current } : {};
  let mutated = false;

  for (const [key, entry] of Object.entries(incoming)) {
    const previous = base[key];
    if (
      !previous ||
      previous.status !== entry.status ||
      previous.value !== entry.value ||
      previous.lastUpdated !== entry.lastUpdated
    ) {
      base[key] = entry;
      mutated = true;
    }
  }

  if (!mutated && current) {
    return current;
  }

  return base;
};

const mergeFreshness = (
  current: Record<string, string> | undefined,
  incoming: Record<string, string> | undefined
): Record<string, string> | undefined => {
  if (!incoming) {
    return current;
  }
  const base = current ? { ...current } : {};
  let mutated = false;

  for (const [key, entry] of Object.entries(incoming)) {
    if (base[key] !== entry) {
      base[key] = entry;
      mutated = true;
    }
  }

  if (!mutated && current) {
    return current;
  }

  return base;
};

interface MetricsUpdatePayload {
  serverId: string;
  metrics?: MCPMetricsMap;
  metricFreshness?: Record<string, string>;
}

const normalizeMetricsUpdates = (payload: unknown): MetricsUpdatePayload[] => {
  if (!payload) {
    return [];
  }

  const candidates: unknown[] = [];
  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.updates)) {
      candidates.push(...record.updates);
    } else {
      candidates.push(record);
    }
  }

  const updates: MetricsUpdatePayload[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const serverId = record.serverId;
    if (typeof serverId !== 'string' || serverId.length === 0) {
      continue;
    }
    const metrics = normalizeMetricsMap(record.metrics);
    const metricFreshness = normalizeFreshnessMap(record.metricFreshness);
    if (!metrics && !metricFreshness) {
      continue;
    }
    updates.push({
      serverId,
      metrics,
      metricFreshness,
    });
  }

  return updates;
};

let metricsListenerCleanup: (() => void) | undefined;

export type MCPInitializationState =
  | 'pending'
  | 'initializing'
  | 'ready'
  | 'partial'
  | 'failed';

export interface MCPStore {
  servers: MCPServerConfig[];
  isLoading: boolean;
  error: string | null;
  connectionTests: Record<string, MCPConnectionTest>;
  initializationState: MCPInitializationState;
  serverInitStates: Record<
    string,
    { state: 'pending' | 'connecting' | 'connected' | 'failed'; error?: string }
  >;

  addServer: (data: MCPServerFormData) => Promise<void>;
  updateServer: (
    serverId: string,
    data: Partial<MCPServerConfig>
  ) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  toggleServer: (serverId: string, enabled: boolean) => Promise<void>;

  testConnection: (serverId: string) => Promise<MCPConnectionTest>;
  connectServer: (serverId: string) => Promise<void>;
  disconnectServer: (serverId: string) => Promise<void>;
  refreshServerTools: (serverId: string) => Promise<void>;

  loadServers: () => Promise<void>;
  reloadServers: () => Promise<void>;
  saveServers: () => Promise<void>;

  getServerById: (serverId: string) => MCPServerConfig | undefined;
  getConnectedServers: () => MCPServerConfig[];
  getServersByType: (type: MCPServerType) => MCPServerConfig[];
  clearError: () => void;
  getInitializationProgress: () => {
    total: number;
    connected: number;
    failed: number;
    pending: number;
  };
  isInitialized: () => boolean;
}

export const useMCPStore = create<MCPStore>((set, get) => ({
  servers: [],
  isLoading: false,
  error: null,
  connectionTests: {},
  initializationState: 'pending',
  serverInitStates: {},

  addServer: async (data: MCPServerFormData) => {
    set({ isLoading: true, error: null });

    try {
      const newServer: MCPServerConfig = {
        id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        type: data.type,
        status: 'disconnected',
        enabled: false,
        config: data.config,
        tools: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { servers } = get();
      const updatedServers = [...servers, newServer];

      set({ servers: updatedServers, isLoading: false });

      if (window?.desktop?.saveMCPServers) {
        const saveResult = toCommandResponse(
          await window.desktop.saveMCPServers(updatedServers)
        );
        if (!saveResult.success) {
          throw new Error(saveResult.error || 'Failed to save server');
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Failed to add MCP server',
      });
      throw error;
    }
  },

  updateServer: async (serverId: string, updates: Partial<MCPServerConfig>) => {
    set({ isLoading: true, error: null });

    try {
      const { servers } = get();

      const diskResult = window?.desktop?.loadMCPServers
        ? toCommandResponse(await window.desktop.loadMCPServers())
        : { success: true, data: undefined };
      let diskTools: MCPServerTool[] | undefined;
      if (diskResult.success && Array.isArray(diskResult.data)) {
        const diskServer = diskResult.data.find((s) => s.id === serverId);
        if (diskServer?.tools?.length) {
          diskTools = diskServer.tools;
        }
      }

      const updatedServers = servers.map((server) => {
        if (server.id === serverId) {
          const updatedServer = {
            ...server,
            ...updates,
            updatedAt: new Date(),
          };
          if (!Object.prototype.hasOwnProperty.call(updates, 'tools')) {
            updatedServer.tools = diskTools || server.tools || [];
            if (diskTools) {
            }
          }
          return updatedServer;
        }
        return server;
      });

      set({ servers: updatedServers, isLoading: false });

      await get().saveServers();
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update MCP server',
      });
      throw error;
    }
  },

  deleteServer: async (serverId: string) => {
    set({ isLoading: true, error: null });

    try {
      const { servers } = get();

      const server = servers.find((s) => s.id === serverId);
      if (server && server.status === 'connected') {
        const disconnectResult = await window?.desktop?.disconnectMCPServer(
          serverId
        );
        if (!disconnectResult.success) {
        }
      }

      const updatedServers = servers.filter((server) => server.id !== serverId);
      set({ servers: updatedServers, isLoading: false });

      if (window?.desktop?.saveMCPServers) {
        const saveResult = toCommandResponse(
          await window.desktop.saveMCPServers(updatedServers)
        );
        if (!saveResult.success) {
          throw new Error(saveResult.error || 'Failed to delete server');
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete MCP server',
      });
      throw error;
    }
  },

  toggleServer: async (serverId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await get().connectServer(serverId);
      } else {
        await get().disconnectServer(serverId);
      }

      await get().updateServer(serverId, { enabled });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle MCP server',
      });
      throw error;
    }
  },

  testConnection: async (serverId: string): Promise<MCPConnectionTest> => {
    const { servers } = get();
    const server = servers.find((s) => s.id === serverId);

    if (!server) {
      throw new Error('Server not found');
    }

    const startTime = Date.now();
    try {
      const bridge = window?.desktop;
      if (!bridge?.testMCPConnection) {
        throw new Error('MCP connection testing is unavailable');
      }

      const ipcResult = toCommandResponse<
        { success: boolean; tools?: MCPServerTool[]; error?: string }
      >(await bridge.testMCPConnection(server));
      const latency = Date.now() - startTime;

      if (!ipcResult.success || !ipcResult.data) {
        throw new Error(ipcResult.error || 'Connection test failed');
      }

      const result = ipcResult.data;

      const testResult: MCPConnectionTest = {
        id: `test-${serverId}-${Date.now()}`,
        serverId,
        status: result.success ? 'success' : 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        result: {
          success: result.success,
          tools: result.tools,
          error: result.error,
          latency,
        },
      };

      set((state) => ({
        connectionTests: {
          ...state.connectionTests,
          [serverId]: testResult,
        },
      }));

      return testResult;
    } catch (error) {
      const testResult: MCPConnectionTest = {
        id: `test-${serverId}-${Date.now()}`,
        serverId,
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        result: {
          success: false,
          error:
            error instanceof Error ? error.message : 'Connection test failed',
        },
      };

      set((state) => ({
        connectionTests: {
          ...state.connectionTests,
          [serverId]: testResult,
        },
      }));

      return testResult;
    }
  },

  connectServer: async (serverId: string) => {
    await get().updateServer(serverId, { status: 'connecting' });

    try {
      const ipcResult = await window?.desktop?.connectMCPServer(serverId);

      if (!ipcResult.success) {
        throw new Error(ipcResult.error || 'Connection failed');
      }

      const result = ipcResult.data!;

      if (result.success) {
        await get().updateServer(serverId, {
          status: 'connected',
          tools: result.tools ?? [],
          lastConnected: new Date(),
          errorMessage: undefined,
        });
      } else {
        await get().updateServer(serverId, {
          status: 'error',
          errorMessage: result.error,
        });
        throw new Error(result.error);
      }
    } catch (error) {
      await get().updateServer(serverId, {
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  },

  disconnectServer: async (serverId: string) => {
    try {
      const disconnectResult = await window?.desktop?.disconnectMCPServer(
        serverId
      );
      if (!disconnectResult.success) {
        throw new Error(disconnectResult.error || 'Disconnect failed');
      }

      await get().updateServer(serverId, {
        status: 'disconnected',
        errorMessage: undefined,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to disconnect MCP server',
      });
      throw error;
    }
  },

  refreshServerTools: async (serverId: string) => {
    const { servers } = get();
    const server = servers.find((s) => s.id === serverId);

    if (
      !server ||
      (server.status !== 'connected' && server.status !== 'ready')
    ) {
      return;
    }

    try {
      const bridge = window?.desktop;
      if (!bridge?.refreshMCPServerTools) {
        return;
      }

      const toolsResult = toCommandResponse<
        { success?: boolean; tools?: MCPServerTool[]; error?: string }
      >(await bridge.refreshMCPServerTools(serverId));
      if (!toolsResult.success) {
        throw new Error(toolsResult.error || 'Failed to refresh tools');
      }

      const toolPayload = toolsResult.data?.tools;
      const tools: MCPServerTool[] = Array.isArray(toolPayload)
        ? toolPayload
        : [];

      await get().updateServer(serverId, {
        tools,
        status: 'ready',
      });

      setTimeout(async () => {
        await get().reloadServers();
      }, 1000);
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to refresh server tools',
      });
    }
  },

  loadServers: async () => {
    set({ isLoading: true, error: null, initializationState: 'initializing' });

    try {
      const isAvailable = await waitForDesktopBridge();

      if (!isAvailable) {
        set({
          servers: [],
          isLoading: false,
          error: 'MCP services not available - running in degraded mode',
          initializationState: 'failed',
        });
        return;
      }

      const bridge = window?.desktop;
      await waitForRemoteOrigin();
      if (typeof window !== 'undefined' && !window.location.origin.startsWith('http')) {
        set({
          servers: [],
          isLoading: false,
          error: 'MCP services not available while running from local origin',
          initializationState: 'partial',
        });
        return;
      }
      
      if (bridge?.on) {
        metricsListenerCleanup?.();
        metricsListenerCleanup = bridge.on(
          'mcp_metrics_updated',
          (rawPayload: unknown) => {
            const updates = normalizeMetricsUpdates(rawPayload);
            if (updates.length === 0) {
              return;
            }

            const updateMap = new Map<string, MetricsUpdatePayload>();
            for (const update of updates) {
              updateMap.set(update.serverId, update);
            }

            set((state) => {
              let mutated = false;
              const nextServers = state.servers.map((server) => {
                const update = updateMap.get(server.id);
                if (!update) {
                  return server;
                }

                const nextMetrics = mergeMetrics(
                  server.metrics as MCPMetricsMap | undefined,
                  update.metrics
                );
                const nextFreshness = mergeFreshness(
                  server.metricFreshness,
                  update.metricFreshness
                );

                if (
                  nextMetrics === server.metrics &&
                  nextFreshness === server.metricFreshness
                ) {
                  return server;
                }

                mutated = true;
                return {
                  ...server,
                  metrics: nextMetrics,
                  metricFreshness: nextFreshness,
                };
              });

              if (!mutated) {
                return state;
              }

              return { ...state, servers: nextServers };
            });
          }
        );
      }

      let result;
      try {
        result = window?.desktop?.loadMCPServers
          ? toCommandResponse(await window.desktop.loadMCPServers())
          : { success: false, error: 'MCP services not available' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('Command mcp_load_servers not found')) {
          set({
            servers: [],
            isLoading: false,
            error: null,
            initializationState: 'partial',
          });
          return;
        }

        if (isLocalPermissionError(message)) {
          await waitForRemoteOrigin();
          try {
            result = window?.desktop?.loadMCPServers
              ? toCommandResponse(await window.desktop.loadMCPServers())
              : { success: false, error: 'MCP services not available' };
          } catch (retryError) {
            const retryMessage =
              retryError instanceof Error
                ? retryError.message
                : String(retryError);

            if (retryMessage.includes('Command mcp_load_servers not found')) {
              set({
                servers: [],
                isLoading: false,
                error: null,
                initializationState: 'partial',
              });
              return;
            }

            set({
              servers: [],
              isLoading: false,
              error: `Failed to load MCP servers: ${retryMessage}`,
              initializationState: 'failed',
            });
            return;
          }
        } else {
          set({
            servers: [],
            isLoading: false,
            error: `Failed to load MCP servers: ${message}`,
            initializationState: 'failed',
          });
          return;
        }
      }
      if (!result.success) {
        const fallbackError = result.error ?? '';
        if (fallbackError.includes('Command mcp_get_cache_stats not found')) {
          set({
            servers: [],
            isLoading: false,
            error: null,
            initializationState: 'partial',
          });
          return;
        }

        set({
          servers: [],
          isLoading: false,
          error: `Failed to load MCP servers: ${
            result.error || 'Unknown error'
          }`,
          initializationState: 'failed',
        });
        return;
      }

      const loadedServers = Array.isArray(result.data) ? result.data : [];

      const { servers: currentServers } = get();
      const mergedServers = loadedServers.map(
        (loadedServer: MCPServerConfig) => {
          const currentServer = currentServers.find(
            (s) => s.id === loadedServer.id
          );
          const metrics = normalizeMetricsMap(
            (loadedServer as { metrics?: unknown }).metrics
          );
          const metricFreshness = normalizeFreshnessMap(
            (loadedServer as { metricFreshness?: unknown }).metricFreshness
          );
          if (currentServer) {
            return {
              ...loadedServer,
              status: currentServer.status,
              tools: loadedServer.tools || [],
              metrics: mergeMetrics(
                currentServer.metrics as MCPMetricsMap | undefined,
                metrics
              ),
              metricFreshness: mergeFreshness(
                currentServer.metricFreshness,
                metricFreshness
              ),
            };
          }
          return {
            ...loadedServer,
            metrics,
            metricFreshness,
          };
        }
      );

      set({ servers: mergedServers, isLoading: false, error: null });

      const serverInitStates: Record<
        string,
        {
          state: 'pending' | 'connecting' | 'connected' | 'failed';
          error?: string;
        }
      > = {};
      mergedServers.forEach((server: MCPServerConfig) => {
        serverInitStates[server.id] = { state: 'pending' };
      });
      set({ serverInitStates });

      const enabledServers = mergedServers.filter(
        (s: MCPServerConfig) => s.enabled
      );

      if (enabledServers.length === 0) {
        set({ initializationState: 'ready', error: null });
        return;
      }

      let connectedCount = 0;
      let failedCount = 0;

      for (const server of enabledServers) {
        try {
          set((state) => ({
            serverInitStates: {
              ...state.serverInitStates,
              [server.id]: { state: 'connecting' },
            },
          }));

          await get().connectServer(server.id);
          connectedCount++;

          set((state) => ({
            serverInitStates: {
              ...state.serverInitStates,
              [server.id]: { state: 'connected' },
            },
          }));

          setTimeout(async () => {
            await get().reloadServers();
          }, 3000);
        } catch (connectError) {
          failedCount++;

          set((state) => ({
            serverInitStates: {
              ...state.serverInitStates,
              [server.id]: {
                state: 'failed',
                error:
                  connectError instanceof Error
                    ? connectError.message
                    : 'Connection failed',
              },
            },
          }));
        }
      }

      let finalState: MCPInitializationState = 'ready';
      if (connectedCount === 0 && failedCount > 0) {
        finalState = 'failed';
      } else if (connectedCount > 0 && failedCount > 0) {
        finalState = 'partial';
      } else if (connectedCount > 0 && failedCount === 0) {
        finalState = 'ready';
      }

      set({ initializationState: finalState, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Failed to load MCP servers',
        initializationState: 'failed',
      });
    }
  },

  reloadServers: async () => {
    try {
      const result = window?.desktop?.loadMCPServers
        ? toCommandResponse(await window.desktop.loadMCPServers())
        : { success: false, error: 'MCP services not available' };
      if (!result.success) {
        set({
          error: `Failed to reload servers: ${result.error || 'Unknown error'}`,
        });
        return;
      }

      const loadedServers = Array.isArray(result.data) ? result.data : [];

      const { servers: currentServers } = get();
      const mergedServers = loadedServers.map(
        (loadedServer: MCPServerConfig) => {
          const currentServer = currentServers.find(
            (s) => s.id === loadedServer.id
          );
          const metrics = normalizeMetricsMap(
            (loadedServer as { metrics?: unknown }).metrics
          );
          const metricFreshness = normalizeFreshnessMap(
            (loadedServer as { metricFreshness?: unknown }).metricFreshness
          );
          if (currentServer) {
            return {
              ...loadedServer,
              status: currentServer.status,
              tools: loadedServer.tools || [],
              metrics: mergeMetrics(
                currentServer.metrics as MCPMetricsMap | undefined,
                metrics
              ),
              metricFreshness: mergeFreshness(
                currentServer.metricFreshness,
                metricFreshness
              ),
            };
          }
          return {
            ...loadedServer,
            metrics,
            metricFreshness,
          };
        }
      );

      set({ servers: mergedServers });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to reload servers',
      });
    }
  },

  saveServers: async () => {
    const { servers } = get();


    try {
      const bridge = window?.desktop;
      if (!bridge?.saveMCPServers) {
        return;
      }

      const currentResult = bridge.loadMCPServers
        ? toCommandResponse(await bridge.loadMCPServers())
        : { success: true, data: undefined };
      const currentServers = Array.isArray(currentResult.data)
        ? currentResult.data
        : [];

      const mergedServers = servers.map((frontendServer) => {
        const backendServer = currentServers.find(
          (s) => s.id === frontendServer.id
        );
        if (backendServer?.tools && backendServer.tools.length > 0) {
          return {
            ...frontendServer,
            tools: backendServer.tools,
          };
        }
        return frontendServer;
      });

      const result = toCommandResponse(await bridge.saveMCPServers(mergedServers));
      if (!result.success) {
        throw new Error(result.error || 'Failed to save servers');
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to save MCP servers',
      });
      throw error;
    }
  },

  getServerById: (serverId: string) => {
    const { servers } = get();
    return servers.find((server) => server.id === serverId);
  },

  getConnectedServers: () => {
    const { servers } = get();
    return servers.filter(
      (server) => server.status === 'connected' && server.enabled
    );
  },

  getServersByType: (type: MCPServerType) => {
    const { servers } = get();
    return servers.filter((server) => server.type === type);
  },

  clearError: () => set({ error: null }),

  getInitializationProgress: () => {
    const { serverInitStates, servers } = get();
    const enabledServers = servers.filter((s) => s.enabled);

    let connected = 0;
    let failed = 0;
    let pending = 0;

    enabledServers.forEach((server) => {
      const state = serverInitStates[server.id];
      if (!state) {
        pending++;
      } else {
        switch (state.state) {
          case 'connected':
            connected++;
            break;
          case 'failed':
            failed++;
            break;
          case 'pending':
          case 'connecting':
            pending++;
            break;
        }
      }
    });

    return {
      total: enabledServers.length,
      connected,
      failed,
      pending,
    };
  },

  isInitialized: () => {
    const { initializationState } = get();
    return (
      initializationState === 'ready' ||
      initializationState === 'partial' ||
      initializationState === 'failed'
    );
  },
}));
