import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { useMCPStore } from '../renderer/stores/mcpStore';

const loadMCPServersMock = vi.fn();
const searchMCPRegistryMock = vi.fn();
const testMCPConnectionMock = vi.fn();
const connectMCPServerMock = vi.fn();
const refreshMCPServerToolsMock = vi.fn();
const getMCPServerToolsMock = vi.fn();
const disconnectMCPServerMock = vi.fn();
const saveMCPServersMock = vi.fn();

let metricUpdateListener: ((payload: unknown) => void) | undefined;

const desktopMock = {
  versions: { node: 'tauri', chrome: 'tauri', electron: 'tauri' },
  send: vi.fn(),
  on: vi.fn(),
  invoke: vi.fn(),
  removeListener: vi.fn(),
  credentials: {
    store: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
  loadMCPServers: loadMCPServersMock,
  saveMCPServers: saveMCPServersMock,
  connectMCPServer: connectMCPServerMock,
  connectMCPServerNew: vi.fn(),
  disconnectMCPServer: disconnectMCPServerMock,
  testMCPConnection: testMCPConnectionMock,
  refreshMCPServerTools: refreshMCPServerToolsMock,
  getMCPServerTools: getMCPServerToolsMock,
  searchMCPRegistry: searchMCPRegistryMock,
  installMCPFromRegistry: vi.fn(),
  getMCPRegistryServerDetails: vi.fn(),
  clearMCPRegistryCache: vi.fn(),
  getMCPCacheStats: vi.fn(),
  triggerMCPBackgroundSync: vi.fn(),
  enrichMCPMetrics: vi.fn(),
  searchPlugins: vi.fn(),
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
  updatePlugin: vi.fn(),
  enablePlugin: vi.fn(),
  disablePlugin: vi.fn(),
  configurePlugin: vi.fn(),
  grantPluginPermissions: vi.fn(),
  revokePluginPermissions: vi.fn(),
  getInstalledPlugins: vi.fn(),
  checkPluginUpdates: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getEnvironmentConfig: vi.fn(),
  setTheme: vi.fn(),
  setAutoStart: vi.fn(),
  setLogLevel: vi.fn(),
  disconnectAgent: vi.fn(),
  disconnectAgentNew: vi.fn(),
  sendAgentMessage: vi.fn(),
  initializeAgent: vi.fn(),
  preloadAgent: vi.fn(),
  sendMessage: vi.fn(),
  connectAgent: vi.fn(),
  getAgentStatus: vi.fn(),
  testHederaConnection: vi.fn(),
  testOpenAIConnection: vi.fn(),
  testAnthropicConnection: vi.fn(),
  chat_create_session: vi.fn(),
  chat_load_session: vi.fn(),
  chat_save_session: vi.fn(),
  chat_delete_session: vi.fn(),
  chat_load_all_sessions: vi.fn(),
  chat_save_message: vi.fn(),
  chat_load_session_messages: vi.fn(),
  chat_update_session_context: vi.fn(),
  chat_update_form_state: vi.fn(),
  chat_update_message_metadata: vi.fn(),
  mirrorNode: {
    getScheduleInfo: vi.fn(),
    getTransactionByTimestamp: vi.fn(),
    getScheduledTransactionStatus: vi.fn(),
    getTransaction: vi.fn(),
  },
  browser: {
    navigate: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    setBounds: vi.fn(),
    setLayout: vi.fn(),
    getState: vi.fn(),
    executeJavaScript: vi.fn(),
    openDevTools: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    onState: vi.fn(),
  },
  openExternal: vi.fn(),
  setThemeManual: vi.fn(),
  getPaths: vi.fn(),
  getPluginPermissions: vi.fn(),
  validatePluginConfig: vi.fn(),
  validatePluginSecurity: vi.fn(),
  clearPluginCache: vi.fn(),
  reloadApp: vi.fn(),
  setCurrentWallet: vi.fn(),
  executeTransactionBytes: vi.fn(),
  walletConnect: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    approveSession: vi.fn(),
    rejectSession: vi.fn(),
    emitEvent: vi.fn(),
  },
  executeScheduledTransaction: vi.fn(),
  deleteScheduledTransaction: vi.fn(),
  getScheduledTransaction: vi.fn(),
} as const;

const defaultState = useMCPStore.getState();

const mockConnectionResponse = {
  success: true,
  data: {
    success: true,
    tools: [
      {
        name: 'listDirectory',
      },
    ],
  },
};

const mockServersResponse = {
  success: true,
  data: [
    {
      id: 'registry-1',
      name: 'Local Filesystem',
      type: 'filesystem',
      status: 'disconnected',
      enabled: true,
      config: {
        type: 'filesystem',
        rootPath: '/tmp',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        githubStars: {
          status: 'ok',
          value: 320,
          lastUpdated: new Date().toISOString(),
        },
        installCount: {
          status: 'ok',
          value: 8175,
          lastUpdated: new Date().toISOString(),
        },
      },
      metricFreshness: {
        githubStars: 'fresh',
        installations: 'stale',
      },
    },
  ],
};

describe('MCP store registry interactions', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: desktopMock as unknown as Window['desktop'],
    });
  });

  beforeEach(() => {
    resetStore();
    metricUpdateListener = undefined;

    const resetMocks = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          resetMocks(obj[key]);
        } else if (typeof obj[key] === 'function' && obj[key].mockReset) {
          obj[key].mockReset();
        }
      }
    };
    resetMocks(desktopMock);

    desktopMock.on.mockImplementation((channel: string, callback: (...args: unknown[]) => void) => {
      if (channel === 'mcp_metrics_updated') {
        metricUpdateListener = callback;
      }
      return () => {
        if (metricUpdateListener === callback) {
          metricUpdateListener = undefined;
        }
      };
    });

    loadMCPServersMock.mockResolvedValue(mockServersResponse);
    searchMCPRegistryMock.mockResolvedValue({
      success: true,
      data: {
        servers: mockServersResponse.data,
        total: 1,
        hasMore: false,
        categories: [],
      },
    });
    connectMCPServerMock.mockResolvedValue(mockConnectionResponse);
    testMCPConnectionMock.mockResolvedValue(mockConnectionResponse);
    refreshMCPServerToolsMock.mockResolvedValue(mockConnectionResponse);
    getMCPServerToolsMock.mockResolvedValue({
      success: true,
      data: mockConnectionResponse.data.tools,
    });
    saveMCPServersMock.mockResolvedValue({ success: true });
    disconnectMCPServerMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    resetStore();
  });

  it('loads servers and connects enabled entries', async () => {
    await useMCPStore.getState().loadServers();

    expect(loadMCPServersMock).toHaveBeenCalled();
    expect(connectMCPServerMock).toHaveBeenCalledWith('registry-1');

    const { servers } = useMCPStore.getState();
    const server = servers.find((entry) => entry.id === 'registry-1');
    expect(server?.status).toBe('connected');
    expect(server?.tools?.length).toBe(1);
  });

  it('refreshes server tools via bridge IPC', async () => {
    await useMCPStore.getState().loadServers();
    await useMCPStore.getState().refreshServerTools('registry-1');

    expect(refreshMCPServerToolsMock).toHaveBeenCalledWith('registry-1');
    const server = useMCPStore.getState().servers.find((entry) => entry.id === 'registry-1');
    expect(server?.tools?.length).toBe(1);
  });

  it('persists metrics and freshness data from load response', async () => {
    await useMCPStore.getState().loadServers();

    const server = useMCPStore.getState().servers.find((entry) => entry.id === 'registry-1');
    expect(server?.metrics?.githubStars?.value).toBe(320);
    expect(server?.metrics?.installCount?.value).toBe(8175);
    expect(server?.metricFreshness?.githubStars).toBe('fresh');
    expect(server?.metricFreshness?.installations).toBe('stale');
  });

  it('updates metrics when IPC event emits mcp_metrics_updated', async () => {
    await useMCPStore.getState().loadServers();

    expect(desktopMock.on).toHaveBeenCalledWith('mcp_metrics_updated', expect.any(Function));
    expect(metricUpdateListener).toBeTypeOf('function');

    const payload = {
      serverId: 'registry-1',
      metrics: {
        githubStars: {
          status: 'error',
          value: 999,
          lastUpdated: new Date().toISOString(),
          errorCode: 'REMOTE_UNAVAILABLE',
          errorMessage: 'Remote registry unavailable',
        },
      },
      metricFreshness: {
        githubStars: 'fresh',
      },
    } as const;

    metricUpdateListener?.(payload);

    const server = useMCPStore.getState().servers.find((entry) => entry.id === 'registry-1');
    expect(server?.metrics?.githubStars?.value).toBe(999);
    expect(server?.metrics?.githubStars?.status).toBe('error');
    expect(server?.metrics?.githubStars?.errorCode).toBe('REMOTE_UNAVAILABLE');
    expect(server?.metrics?.githubStars?.errorMessage).toBe('Remote registry unavailable');
    expect(server?.metricFreshness?.githubStars).toBe('fresh');
  });
});

function resetStore() {
  useMCPStore.setState(defaultState, true);
  useMCPStore.setState({
    servers: [],
    isLoading: false,
    error: null,
    connectionTests: {},
    initializationState: 'pending',
    serverInitStates: {},
  });
}
