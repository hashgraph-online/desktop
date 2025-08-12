import { AppConfig } from '../stores/configStore'
import { Message } from '../stores/agentStore'
import { MCPServerConfig, MCPServerTool, MCPConnectionTest } from './mcp'
import { 
  PluginConfig, 
  PluginSearchResult, 
  PluginInstallOptions, 
  PluginPermissions, 
  PluginUpdateInfo,
  PluginRuntimeContext 
} from '../../shared/types/plugin'

export interface CredentialAPI {
  store: (service: string, account: string, password: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  get: (service: string, account: string) => Promise<{ success: boolean; data?: string; error?: string }>
  delete: (service: string, account: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  clear: () => Promise<{ success: boolean; data?: number; error?: string }>
}

export interface ElectronAPI {
  versions: {
    node: string
    chrome: string
    electron: string
  }
  send: (channel: string, data?: any) => void
  on: (channel: string, callback: (...args: any[]) => void) => () => void
  invoke: (channel: string, data?: any) => Promise<any>
  credentials: CredentialAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    electron: {
      saveConfig: (config: AppConfig) => Promise<void>
      loadConfig: () => Promise<AppConfig | null>
      
      testHederaConnection: (credentials: {
        accountId: string
        privateKey: string
        network: 'mainnet' | 'testnet'
      }) => Promise<{ success: boolean; balance?: string; error?: string }>
      
      testOpenAIConnection: (credentials: {
        apiKey: string
        model: string
      }) => Promise<{ success: boolean; error?: string }>
      
      testAnthropicConnection: (credentials: {
        apiKey: string
        model: string
      }) => Promise<{ success: boolean; error?: string }>
      
      setTheme: (theme: 'light' | 'dark') => Promise<void>
      setAutoStart: (enabled: boolean) => Promise<void>
      setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => Promise<void>
      
      connectAgent: () => Promise<{ success: boolean; sessionId?: string; error?: string }>
      disconnectAgent: () => Promise<void>
      sendMessage: (data: { content: string; sessionId: string }) => Promise<Message>
      
      initializeAgent: (config: any) => Promise<{ success: boolean; data?: { sessionId?: string }; error?: string }>
      preloadAgent: (config: any) => Promise<{ success: boolean; error?: string }>
      sendAgentMessage: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>
      disconnectAgentNew: () => Promise<{ success: boolean; error?: string }>
      getAgentStatus: () => Promise<{ success: boolean; data?: any; error?: string }>
      
      loadMCPServers: () => Promise<{ success: boolean; data?: MCPServerConfig[]; error?: string }>
      saveMCPServers: (servers: MCPServerConfig[]) => Promise<{ success: boolean; error?: string }>
      testMCPConnection: (server: MCPServerConfig) => Promise<{ success: boolean; data?: { success: boolean; tools?: MCPServerTool[]; error?: string }; error?: string }>
      connectMCPServer: (serverId: string) => Promise<{ success: boolean; data?: { success: boolean; tools?: MCPServerTool[]; error?: string }; error?: string }>
      disconnectMCPServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
      getMCPServerTools: (serverId: string) => Promise<{ success: boolean; data?: MCPServerTool[]; error?: string }>
      
      searchPlugins: (query: string) => Promise<{ success: boolean; data?: PluginSearchResult[]; error?: string }>
      installPlugin: (name: string, options?: PluginInstallOptions) => Promise<{ success: boolean; data?: PluginConfig; error?: string }>
      uninstallPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>
      updatePlugin: (pluginId: string) => Promise<{ success: boolean; data?: PluginConfig; error?: string }>
      enablePlugin: (pluginId: string) => Promise<{ success: boolean; data?: PluginRuntimeContext; error?: string }>
      disablePlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>
      configurePlugin: (pluginId: string, config: Record<string, any>) => Promise<{ success: boolean; error?: string }>
      grantPluginPermissions: (pluginId: string, permissions: PluginPermissions) => Promise<{ success: boolean; error?: string }>
      revokePluginPermissions: (pluginId: string, permissions: PluginPermissions) => Promise<{ success: boolean; data?: PluginPermissions; error?: string }>
      getInstalledPlugins: () => Promise<{ success: boolean; data?: PluginConfig[]; error?: string }>
      checkPluginUpdates: () => Promise<{ success: boolean; data?: PluginUpdateInfo[]; error?: string }>
      
      mirrorNode: {
        getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: any; error?: string }>
        getTransactionByTimestamp: (timestamp: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: any[]; error?: string }>
      }
      
      executeScheduledTransaction: (scheduleId: string) => Promise<{
        success: boolean
        transactionId?: string
        error?: string
      }>
      deleteScheduledTransaction: (scheduleId: string) => Promise<{
        success: boolean
        error?: string
      }>
      getScheduledTransaction: (scheduleId: string) => Promise<{
        success: boolean
        info?: any
        error?: string
      }>
      executeTransactionBytes: (transactionBytes: string, entityContext?: { name?: string, description?: string }) => Promise<{
        success: boolean
        transactionId?: string
        error?: string
        status?: string
        entityId?: string
        entityType?: string
      }>
      
      send: (channel: string, data?: any) => void
      invoke: (channel: string, data?: any) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: any[]) => void) => void
      openExternal: (url: string) => Promise<void>
    }
    
    api: {
      invoke: (channel: string, data?: any) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}