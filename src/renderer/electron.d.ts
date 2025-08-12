/**
 * Type declarations for the electron API exposed to the renderer process
 */

import type {
  PluginPermissions,
  PluginInstallOptions,
  PluginInstallProgress,
} from '../shared/types/plugin';

export interface ElectronAPI {
  saveConfig: (config: any) => Promise<any>;
  loadConfig: () => Promise<any>;
  getEnvironmentConfig: () => Promise<{ enableMainnet: boolean }>;

  testHederaConnection: (credentials: any) => Promise<any>;
  testOpenAIConnection: (credentials: any) => Promise<any>;
  testAnthropicConnection: (credentials: any) => Promise<any>;

  setTheme: (theme: string) => Promise<any>;
  setAutoStart: (enabled: boolean) => Promise<any>;
  setLogLevel: (level: string) => Promise<any>;

  connectAgent: () => Promise<any>;
  disconnectAgent: () => Promise<any>;
  sendMessage: (data: any) => Promise<any>;

  initializeAgent: (config: any) => Promise<any>;
  sendAgentMessage: (data: any) => Promise<any>;
  disconnectAgentNew: () => Promise<any>;
  getAgentStatus: () => Promise<any>;

  loadMCPServers: () => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  saveMCPServers: (
    servers: any
  ) => Promise<{ success: boolean; error?: string }>;
  testMCPConnection: (
    server: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  connectMCPServer: (
    serverId: string
  ) => Promise<{ success: boolean; error?: string }>;
  disconnectMCPServer: (
    serverId: string
  ) => Promise<{ success: boolean; error?: string }>;
  getMCPServerTools: (
    serverId: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;

  searchMCPRegistry: (
    options?: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  getMCPRegistryServerDetails: (
    serverId: string,
    packageName?: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  installMCPFromRegistry: (
    serverId: string,
    packageName?: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  clearMCPRegistryCache: () => Promise<{ success: boolean; error?: string }>;
  getMCPCacheStats: () => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  triggerMCPBackgroundSync: () => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;

  send: (channel: string, data?: any) => void;
  invoke: (channel: string, data?: any) => Promise<any>;

  searchPlugins: (
    query: string,
    options?: any
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  installPlugin: (
    packageName: string,
    options?: PluginInstallOptions
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  uninstallPlugin: (
    pluginId: string
  ) => Promise<{ success: boolean; error?: string }>;
  updatePlugin: (
    pluginId: string,
    version?: string
  ) => Promise<{ success: boolean; error?: string }>;
  enablePlugin: (
    pluginId: string
  ) => Promise<{ success: boolean; error?: string }>;
  disablePlugin: (
    pluginId: string
  ) => Promise<{ success: boolean; error?: string }>;
  configurePlugin: (
    pluginId: string,
    config: Record<string, any>
  ) => Promise<{ success: boolean; error?: string }>;
  getPluginPermissions: (
    pluginId: string
  ) => Promise<{ success: boolean; data?: PluginPermissions; error?: string }>;
  grantPluginPermissions: (
    pluginId: string,
    permissions: PluginPermissions
  ) => Promise<{ success: boolean; error?: string }>;
  getInstalledPlugins: () => Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }>;
  checkPluginUpdates: () => Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }>;
  validatePluginConfig: (
    pluginId: string,
    config: Record<string, any>
  ) => Promise<{
    success: boolean;
    data?: { valid: boolean; errors?: string[] };
    error?: string;
  }>;
  validatePluginSecurity: (
    packageName: string
  ) => Promise<{
    success: boolean;
    data?: { safe: boolean; issues?: string[] };
    error?: string;
  }>;
  clearPluginCache: () => Promise<{ success: boolean; error?: string }>;

  onPluginInstallProgress: (
    callback: (progress: PluginInstallProgress) => void
  ) => void;
  onPluginUpdateProgress: (
    callback: (progress: PluginInstallProgress) => void
  ) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    electronAPI: any;
  }
}

export {};
