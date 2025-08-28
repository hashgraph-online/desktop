import { create } from 'zustand';
import {
  MCPServerConfig,
  MCPServerFormData,
  MCPConnectionTest,
  MCPServerType,
  MCPServerTool,
} from '../types/mcp';

/**
 * Helper to wait for electron bridge to be available
 */
const waitForElectronBridge = async (
  maxRetries = 30,
  retryDelay = 1000
): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (
      window.electron &&
      typeof window.electron.loadMCPServers === 'function'
    ) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  return false;
};

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

      const saveResult = await window.electron.saveMCPServers(
        updatedServers as unknown as Record<string, unknown>[]
      );
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save server');
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

      const diskResult = await window.electron.loadMCPServers();
      let diskTools: MCPServerTool[] | undefined = undefined;
      if (diskResult.success) {
        const diskServer = diskResult.data?.find((s: MCPServerConfig) => s.id === serverId);
        if (diskServer && diskServer.tools && diskServer.tools.length > 0) {
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
        const disconnectResult = await window.electron.disconnectMCPServer(
          serverId
        );
        if (!disconnectResult.success) {
        }
      }

      const updatedServers = servers.filter((server) => server.id !== serverId);
      set({ servers: updatedServers, isLoading: false });

      const saveResult = await window.electron.saveMCPServers(
        updatedServers as unknown as Record<string, unknown>[]
      );
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to delete server');
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
      const ipcResult = await window.electron.testMCPConnection(
        server as unknown as Record<string, unknown>
      );
      const latency = Date.now() - startTime;

      if (!ipcResult.success) {
        throw new Error(ipcResult.error || 'Connection test failed');
      }

      const result = ipcResult.data!;

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
      const ipcResult = await window.electron.connectMCPServer(serverId);

      if (!ipcResult.success) {
        throw new Error(ipcResult.error || 'Connection failed');
      }

      const result = ipcResult.data!;

      if (result.success) {
        await get().updateServer(serverId, {
          status: 'connected',
          tools: result.tools,
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
      const disconnectResult = await window.electron.disconnectMCPServer(
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
      const toolsResult = await window.electron.refreshMCPServerTools(serverId);
      if (!toolsResult.success) {
        throw new Error(toolsResult.error || 'Failed to refresh tools');
      }

      await get().updateServer(serverId, {
        tools: toolsResult.data,
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
      const isAvailable = await waitForElectronBridge();

      if (!isAvailable) {
        set({
          servers: [],
          isLoading: false,
          error: 'MCP services not available - running in degraded mode',
          initializationState: 'failed',
        });
        return;
      }

      const result = await window.electron.loadMCPServers();
      if (!result.success) {
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

      const loadedServers = result.data || [];

      const { servers: currentServers } = get();
      const mergedServers = loadedServers.map(
        (loadedServer: MCPServerConfig) => {
          const currentServer = currentServers.find(
            (s) => s.id === loadedServer.id
          );
          if (currentServer) {
            return {
              ...loadedServer,
              status: currentServer.status,
              tools: loadedServer.tools || [],
            };
          }
          return loadedServer;
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
      const result = await window.electron.loadMCPServers();
      if (!result.success) {
        set({
          error: `Failed to reload servers: ${result.error || 'Unknown error'}`,
        });
        return;
      }

      const loadedServers = result.data || [];

      const { servers: currentServers } = get();
      const mergedServers = loadedServers.map(
        (loadedServer: MCPServerConfig) => {
          const currentServer = currentServers.find(
            (s) => s.id === loadedServer.id
          );
          if (currentServer) {
            return {
              ...loadedServer,
              status: currentServer.status,
              tools: loadedServer.tools || [],
            };
          }
          return loadedServer;
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
      const currentResult = await window.electron.loadMCPServers();
      if (currentResult.success) {
        const currentServers = currentResult.data || [];

        const mergedServers = servers.map((frontendServer) => {
          const backendServer = currentServers.find(
            (s: MCPServerConfig) => s.id === frontendServer.id
          );
          if (
            backendServer &&
            backendServer.tools &&
            backendServer.tools.length > 0
          ) {
            const merged = {
              ...frontendServer,
              tools: backendServer.tools,
            };
            return merged;
          } else if (frontendServer.tools && frontendServer.tools.length > 0) {
            return frontendServer;
          } else {
            return frontendServer;
          }
        });


        const result = await window.electron.saveMCPServers(
          mergedServers as unknown as Record<string, unknown>[]
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to save servers');
        }
      } else {
        const result = await window.electron.saveMCPServers(
          servers as unknown as Record<string, unknown>[]
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to save servers');
        }
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
