/**
 * Type declarations for the electron API exposed to the renderer process
 */

import type {
  PluginPermissions,
  PluginInstallOptions,
  PluginInstallProgress,
} from '../shared/types/plugin';

export interface AppConfig {
  hedera?: {
    accountId?: string;
    privateKey?: string;
    network?: 'testnet' | 'mainnet';
  };
  openai?: {
    apiKey?: string;
  };
  anthropic?: {
    apiKey?: string;
  };
  theme?: 'light' | 'dark' | 'system';
  autoStart?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  [key: string]: unknown;
}

export interface ConnectionCredentials {
  accountId?: string;
  privateKey?: string;
  apiKey?: string;
  network?: string;
  [key: string]: unknown;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface MessageData {
  content: string;
  conversationId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface AgentConfig {
  operationalMode?: 'autonomous' | 'provideBytes' | 'returnBytes';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  network?: string;
  accountId?: string;
  privateKey?: string;
  mcpServers?: unknown[];
  [key: string]: unknown;
}

export interface AgentResponse {
  content?: string;
  error?: string;
  timestamp?: number;
  conversationId?: string;
  [key: string]: unknown;
}

export interface AgentStatus {
  connected: boolean;
  initialized: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface MCPServerData {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface MCPServerInfo {
  servers: MCPServerData[];
  total?: number;
  [key: string]: unknown;
}

export interface MCPConnectionResult {
  success: boolean;
  data?: MCPServerData;
  error?: string;
}

export interface MCPToolsResult {
  success: boolean;
  data?: Array<{
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
  }>;
  error?: string;
}

export interface SearchResult {
  success: boolean;
  data?: MCPServerData[];
  error?: string;
}

export interface PluginData {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface PluginSearchResult {
  success: boolean;
  data?: PluginData[];
  error?: string;
}

export interface PluginValidationResult {
  success: boolean;
  data?: {
    valid: boolean;
    errors?: string[];
  };
  error?: string;
}

export interface PluginSecurityResult {
  success: boolean;
  data?: {
    safe: boolean;
    issues?: string[];
  };
  error?: string;
}

export interface ElectronAPI {
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
  loadConfig: () => Promise<AppConfig>;
  getEnvironmentConfig: () => Promise<{ enableMainnet: boolean }>;

  testHederaConnection: (credentials: ConnectionCredentials) => Promise<ConnectionTestResult>;
  testOpenAIConnection: (credentials: ConnectionCredentials) => Promise<ConnectionTestResult>;
  testAnthropicConnection: (credentials: ConnectionCredentials) => Promise<ConnectionTestResult>;

  setTheme: (theme: string) => Promise<{ success: boolean; error?: string }>;
  setAutoStart: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  setLogLevel: (level: string) => Promise<{ success: boolean; error?: string }>;

  connectAgent: () => Promise<{ success: boolean; error?: string }>;
  disconnectAgent: () => Promise<{ success: boolean; error?: string }>;
  sendMessage: (data: MessageData) => Promise<AgentResponse>;

  initializeAgent: (config: AgentConfig) => Promise<{ success: boolean; error?: string }>;
  sendAgentMessage: (data: MessageData) => Promise<AgentResponse>;
  disconnectAgentNew: () => Promise<{ success: boolean; error?: string }>;
  getAgentStatus: () => Promise<AgentStatus>;

  loadMCPServers: () => Promise<{
    success: boolean;
    data?: MCPServerInfo;
    error?: string;
  }>;
  saveMCPServers: (
    servers: MCPServerData[]
  ) => Promise<{ success: boolean; error?: string }>;
  testMCPConnection: (
    server: MCPServerData
  ) => Promise<MCPConnectionResult>;
  connectMCPServer: (
    serverId: string
  ) => Promise<{ success: boolean; error?: string }>;
  disconnectMCPServer: (
    serverId: string
  ) => Promise<{ success: boolean; error?: string }>;
  getMCPServerTools: (
    serverId: string
  ) => Promise<MCPToolsResult>;

  searchMCPRegistry: (
    options?: Record<string, unknown>
  ) => Promise<SearchResult>;
  getMCPRegistryServerDetails: (
    serverId: string,
    packageName?: string
  ) => Promise<{ success: boolean; data?: MCPServerData; error?: string }>;
  installMCPFromRegistry: (
    serverId: string,
    packageName?: string
  ) => Promise<{ success: boolean; data?: MCPServerData; error?: string }>;
  clearMCPRegistryCache: () => Promise<{ success: boolean; error?: string }>;
  getMCPCacheStats: () => Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }>;
  triggerMCPBackgroundSync: () => Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }>;

  send: (channel: string, data?: unknown) => void;
  invoke: (channel: string, data?: unknown) => Promise<unknown>;

  searchPlugins: (
    query: string,
    options?: Record<string, unknown>
  ) => Promise<PluginSearchResult>;
  installPlugin: (
    packageName: string,
    options?: PluginInstallOptions
  ) => Promise<{ success: boolean; data?: PluginData; error?: string }>;
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
    config: Record<string, unknown>
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
    data?: PluginData[];
    error?: string;
  }>;
  checkPluginUpdates: () => Promise<{
    success: boolean;
    data?: PluginData[];
    error?: string;
  }>;
  validatePluginConfig: (
    pluginId: string,
    config: Record<string, unknown>
  ) => Promise<PluginValidationResult>;
  validatePluginSecurity: (
    packageName: string
  ) => Promise<PluginSecurityResult>;
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
    electronAPI: ElectronAPI;
  }
}

export {};
