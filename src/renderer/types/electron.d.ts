import { AppConfig } from '../stores/configStore'
import { Message } from '../stores/agentStore'
import { MCPServerConfig, MCPServerTool } from './mcp'
import { 
  PluginConfig, 
  PluginSearchResult, 
  PluginInstallOptions, 
  PluginPermissions, 
  PluginUpdateInfo,
  PluginRuntimeContext 
} from '../../shared/types/plugin'

interface AgentConfig {
  accountId: string;
  privateKey: string;
  network: 'mainnet' | 'testnet';
  openAIApiKey: string;
  openAIModelName?: string;
  llmProvider?: 'openai' | 'anthropic';
  userAccountId?: string;
  verbose?: boolean;
  disableLogging?: boolean;
}

interface ChatSession {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ScheduleInfo {
  scheduleId: string;
  scheduledTransactionBody: string;
  memo?: string;
  adminKey?: string;
  payerAccountId?: string;
  expirationTime?: string;
}

interface TransactionInfo {
  transactionId: string;
  timestamp: string;
  type: string;
  result: string;
  payerAccountId: string;
  fee: string;
}

interface AgentResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type ElectronIPCData = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

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
  send: (channel: string, data?: ElectronIPCData) => void
  on: (channel: string, callback: (...args: ElectronIPCData[]) => void) => () => void
  invoke: (channel: string, data?: ElectronIPCData) => Promise<ElectronIPCData>
  credentials: CredentialAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    electron: {
      saveConfig: (config: AppConfig) => Promise<void>
      loadConfig: () => Promise<AppConfig | null>
      getEnvironmentConfig: () => Promise<{
        enableMainnet: boolean
        hedera?: { accountId?: string; privateKey?: string; network?: 'mainnet' | 'testnet' }
        openai?: { apiKey?: string; model?: string }
        anthropic?: { apiKey?: string; model?: string }
        llmProvider?: 'openai' | 'anthropic'
        walletConnect?: { projectId?: string; appName?: string; appUrl?: string; appIcon?: string }
      }>
      
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
      
      initializeAgent: (config: AgentConfig) => Promise<{ success: boolean; data?: { sessionId?: string }; error?: string }>
      preloadAgent: (config: AgentConfig) => Promise<{ success: boolean; error?: string }>
      sendAgentMessage: (data: { content: string; sessionId: string }) => Promise<{ success: boolean; data?: Message; error?: string }>
      disconnectAgentNew: () => Promise<{ success: boolean; error?: string }>
      getAgentStatus: () => Promise<{ success: boolean; data?: { connected: boolean; sessionId?: string; status?: string }; error?: string }>
      
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
      configurePlugin: (pluginId: string, config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
      grantPluginPermissions: (pluginId: string, permissions: PluginPermissions) => Promise<{ success: boolean; error?: string }>
      revokePluginPermissions: (pluginId: string, permissions: PluginPermissions) => Promise<{ success: boolean; data?: PluginPermissions; error?: string }>
      getInstalledPlugins: () => Promise<{ success: boolean; data?: PluginConfig[]; error?: string }>
      checkPluginUpdates: () => Promise<{ success: boolean; data?: PluginUpdateInfo[]; error?: string }>
      
      'chat:create-session': (data: { title?: string }) => Promise<{ success: boolean; data?: ChatSession; error?: string }>
      'chat:load-session': (data: { sessionId: string }) => Promise<{ success: boolean; data?: ChatSession; error?: string }>
      'chat:save-session': (data: ChatSession) => Promise<{ success: boolean; error?: string }>
      'chat:delete-session': (data: { sessionId: string }) => Promise<{ success: boolean; error?: string }>
      'chat:load-all-sessions': () => Promise<{ success: boolean; data?: ChatSession[]; error?: string }>
      'chat:save-message': (data: { sessionId: string; message: Message }) => Promise<{ success: boolean; error?: string }>
      'chat:load-session-messages': (data: { sessionId: string }) => Promise<{ success: boolean; data?: Message[]; error?: string }>
      
      mirrorNode: {
        getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: ScheduleInfo; error?: string }>
        getTransactionByTimestamp: (timestamp: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: TransactionInfo[]; error?: string }>
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
        info?: ScheduleInfo
        error?: string
      }>
      setCurrentWallet: (info: { accountId: string; network: 'mainnet' | 'testnet' } | null) => Promise<{ success: boolean; error?: string }>
      executeTransactionBytes: (transactionBytes: string, entityContext?: { name?: string, description?: string }) => Promise<{
        success: boolean
        transactionId?: string
        error?: string
        status?: string
        entityId?: string
        entityType?: string
      }>
      
      send: (channel: string, data?: ElectronIPCData) => void
      invoke: (channel: string, data?: ElectronIPCData) => Promise<ElectronIPCData>
      on: (channel: string, callback: (...args: ElectronIPCData[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: ElectronIPCData[]) => void) => void
      openExternal: (url: string) => Promise<void>
    }
    
    api: {
      invoke: (channel: string, data?: ElectronIPCData) => Promise<ElectronIPCData>
      on: (channel: string, callback: (...args: ElectronIPCData[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: ElectronIPCData[]) => void) => void
    }
  }
}
