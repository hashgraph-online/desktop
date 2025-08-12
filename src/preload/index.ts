import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args);
  },

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrappedListener = (event: unknown, ...args: unknown[]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  },

  once: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, listener);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

const electronBridge = {
  saveConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke('config:save', config),
  loadConfig: () => ipcRenderer.invoke('config:load'),

  testHederaConnection: (credentials: Record<string, unknown>) =>
    ipcRenderer.invoke('connection:test-hedera', credentials),
  testOpenAIConnection: (credentials: Record<string, unknown>) =>
    ipcRenderer.invoke('connection:test-openai', credentials),
  testAnthropicConnection: (credentials: Record<string, unknown>) =>
    ipcRenderer.invoke('connection:test-anthropic', credentials),

  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
  setAutoStart: (enabled: boolean) =>
    ipcRenderer.invoke('settings:auto-start', enabled),
  setLogLevel: (level: string) =>
    ipcRenderer.invoke('settings:log-level', level),

  initializeAgent: (config: Record<string, unknown>) =>
    ipcRenderer.invoke('agent:initialize', config),
  preloadAgent: (config: Record<string, unknown>) =>
    ipcRenderer.invoke('agent:preload', config),
  disconnectAgent: () => ipcRenderer.invoke('agent:disconnect'),
  sendAgentMessage: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('agent:send-message', data),

  loadMCPServers: () => ipcRenderer.invoke('mcp:loadServers'),
  saveMCPServers: (servers: Record<string, unknown>[]) =>
    ipcRenderer.invoke('mcp:saveServers', servers),
  testMCPConnection: (server: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:testConnection', server),
  connectMCPServer: (serverId: string) =>
    ipcRenderer.invoke('mcp:connectServer', serverId),
  disconnectMCPServer: (serverId: string) =>
    ipcRenderer.invoke('mcp:disconnectServer', serverId),
  getMCPServerTools: (serverId: string) =>
    ipcRenderer.invoke('mcp:getServerTools', serverId),
  refreshMCPServerTools: (serverId: string) =>
    ipcRenderer.invoke('mcp:refreshServerTools', serverId),
  searchMCPRegistry: (options: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:searchRegistry', options),
  getMCPRegistryServerDetails: (serverId: string, packageName?: string) =>
    ipcRenderer.invoke('mcp:getRegistryServerDetails', {
      serverId,
      packageName,
    }),
  installMCPFromRegistry: (serverId: string, packageName?: string) =>
    ipcRenderer.invoke('mcp:installFromRegistry', { serverId, packageName }),
  clearMCPRegistryCache: () => ipcRenderer.invoke('mcp:clearRegistryCache'),
  getMCPCacheStats: () => ipcRenderer.invoke('mcp:getCacheStats'),
  triggerMCPBackgroundSync: () =>
    ipcRenderer.invoke('mcp:triggerBackgroundSync'),

  searchPlugins: (query: string, registry?: string) =>
    ipcRenderer.invoke('plugin:search', { query, registry }),
  installPlugin: (packageName: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('plugin:install', { packageName, options }),
  uninstallPlugin: (pluginId: string) =>
    ipcRenderer.invoke('plugin:uninstall', pluginId),
  updatePlugin: (pluginId: string) =>
    ipcRenderer.invoke('plugin:update', pluginId),
  enablePlugin: (pluginId: string) =>
    ipcRenderer.invoke('plugin:enable', pluginId),
  disablePlugin: (pluginId: string) =>
    ipcRenderer.invoke('plugin:disable', pluginId),
  configurePlugin: (pluginId: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('plugin:configure', { pluginId, config }),
  grantPluginPermissions: (
    pluginId: string,
    permissions: Record<string, unknown>
  ) => ipcRenderer.invoke('plugin:grantPermissions', { pluginId, permissions }),
  revokePluginPermissions: (
    pluginId: string,
    permissions: Record<string, unknown>
  ) =>
    ipcRenderer.invoke('plugin:revokePermissions', { pluginId, permissions }),
  getInstalledPlugins: () => ipcRenderer.invoke('plugin:getInstalled'),
  checkPluginUpdates: () => ipcRenderer.invoke('plugin:checkUpdates'),
  validatePluginConfig: (pluginId: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke('plugin:validateConfig', { pluginId, config }),
  validatePluginSecurity: (packageName: string, version?: string) =>
    ipcRenderer.invoke('plugin:validateSecurity', { packageName, version }),
  clearPluginCache: () => ipcRenderer.invoke('plugin:clearCache'),

  minimizeWindow: () => ipcRenderer.send('window-control', 'minimize'),
  maximizeWindow: () => ipcRenderer.send('window-control', 'maximize'),
  closeWindow: () => ipcRenderer.send('window-control', 'close'),

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrappedListener = (event: unknown, ...args: unknown[]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  },
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },

  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openRepositoryUrl: () => ipcRenderer.invoke('open-repository-url'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  setUpdateChannel: (channel: 'stable' | 'beta') =>
    ipcRenderer.invoke('set-update-channel', channel),
  setAutoDownload: (enabled: boolean) =>
    ipcRenderer.invoke('set-auto-download', enabled),

  getOpenRouterModels: (forceRefresh?: boolean) =>
    ipcRenderer.invoke('openrouter:getModels', forceRefresh),
  getOpenRouterModelsByProvider: (provider: string) =>
    ipcRenderer.invoke('openrouter:getModelsByProvider', provider),
  getOpenRouterModel: (modelId: string) =>
    ipcRenderer.invoke('openrouter:getModel', modelId),

  executeScheduledTransaction: (scheduleId: string) =>
    ipcRenderer.invoke('execute-scheduled-transaction', scheduleId),
  deleteScheduledTransaction: (scheduleId: string) =>
    ipcRenderer.invoke('delete-scheduled-transaction', scheduleId),
  getScheduledTransaction: (scheduleId: string) =>
    ipcRenderer.invoke('get-scheduled-transaction', scheduleId),
  executeTransactionBytes: (
    transactionBytes: string,
    entityContext?: { name?: string; description?: string }
  ) =>
    ipcRenderer.invoke(
      'execute-transaction-bytes',
      transactionBytes,
      entityContext
    ),

  mirrorNode: {
    getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') =>
      ipcRenderer.invoke('mirrorNode:getScheduleInfo', scheduleId, network),
    getTransactionByTimestamp: (
      timestamp: string,
      network?: 'mainnet' | 'testnet'
    ) =>
      ipcRenderer.invoke(
        'mirrorNode:getTransactionByTimestamp',
        timestamp,
        network
      ),
    getTokenInfo: (tokenId: string, network?: 'mainnet' | 'testnet') =>
      ipcRenderer.invoke('mirrorNode:getTokenInfo', tokenId, network),
  },

  transactionParser: {
    validate: (transactionBytes: string) =>
      ipcRenderer.invoke('transactionParser:validate', transactionBytes),
    parse: (transactionBytes: string) =>
      ipcRenderer.invoke('transactionParser:parse', transactionBytes),
  },

  hcs10: {
    retrieveProfile: (accountId: string, network?: 'mainnet' | 'testnet') =>
      ipcRenderer.invoke('hcs10:retrieveProfile', accountId, network),
  },

  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args);
  },
};

contextBridge.exposeInMainWorld('api', electronAPI);
contextBridge.exposeInMainWorld('electron', electronBridge);

declare global {
  interface Window {
    api: typeof electronAPI;
    electron: typeof electronBridge;
  }
}
