import { AppConfig } from '../stores/configStore'
import { Message } from '../stores/agentStore'
import { MCPServerConfig, MCPServerTool } from './mcp'
import type { EntityAssociation } from '../../main/db/schema'
import {
  PluginConfig,
  PluginSearchResult,
  PluginInstallOptions,
  PluginPermissions,
  PluginUpdateInfo,
  PluginRuntimeContext,
} from '../../shared/types/plugin'
import { BasePlugin } from '@hashgraphonline/standards-agent-kit'

type CommandResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  [key: string]: unknown
}

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
  disabledPlugins?: string[];
  additionalPlugins?: BasePlugin[];
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
  transaction_body?: string;
  consensus_timestamp?: string;
  executed_timestamp?: string;
  expiration_time?: string;
  [key: string]: unknown;
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

export interface BrowserState {
  requestedUrl: string;
  currentUrl: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  lastError: string | null;
}

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DesktopIPCData =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | unknown[];

export interface CredentialAPI {
  store: (service: string, account: string, password: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  get: (service: string, account: string) => Promise<{ success: boolean; data?: string; error?: string }>
  delete: (service: string, account: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
  clear: () => Promise<{ success: boolean; data?: number; error?: string }>
}

export interface DesktopAPI {
  versions: {
    node: string
    chrome: string
    electron: string
  }
  send: (channel: string, data?: DesktopIPCData) => void
  on: (channel: string, callback: (...args: DesktopIPCData[]) => void) => () => void
  invoke: <T = unknown>(channel: string, data?: DesktopIPCData) => Promise<CommandResponse<T>>
  credentials: CredentialAPI
}

declare global {
  interface Window {
    desktopAPI: DesktopAPI
    desktop: {
      saveConfig: (config: AppConfig) => Promise<void>
      loadConfig: () => Promise<{ success: boolean; config?: AppConfig | null; error?: string }>
      getEnvironmentConfig: () => Promise<{
        enableMainnet: boolean
        hedera?: { accountId?: string; privateKey?: string; network?: 'mainnet' | 'testnet' }
        swarm?: { beeApiUrl?: string; beeFeedPK?: string; autoAssignStamp?: boolean; deferredUploadSizeThresholdMB?: number; }
        openai?: { apiKey?: string; model?: string }
        anthropic?: { apiKey?: string; model?: string }
        llmProvider?: 'openai' | 'anthropic'
        walletConnect?: { projectId?: string; appName?: string; appUrl?: string; appIcon?: string }
        legal?: {
          termsSource?: string
          privacySource?: string
          termsMarkdown?: string
          privacyMarkdown?: string
        }
      }>
      getWalletStatus: () => Promise<{ success: boolean; data?: Record<string, unknown> | null; error?: string }>
      
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
      
      getOpenRouterModels?: (forceRefresh?: boolean) => Promise<{ success: boolean; data?: unknown; error?: string }>
      getOpenRouterModelsByProvider?: (provider: string) => Promise<{ success: boolean; data?: unknown; error?: string }>

      setTheme: (theme: 'light' | 'dark') => Promise<void>
      setAutoStart: (enabled: boolean) => Promise<void>
      setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => Promise<void>
      
      connectAgent: () => Promise<{ success: boolean; sessionId?: string; error?: string }>
      disconnectAgent: () => Promise<{ success: boolean; error?: string }>
      sendMessage: (data: { content: string; sessionId: string }) => Promise<Message>
      
      initializeAgent: (config: AgentConfig) => Promise<{ success: boolean; data?: { sessionId?: string }; error?: string }>
      preloadAgent: (config: AgentConfig) => Promise<{ success: boolean; error?: string }>
      sendAgentMessage: (data: {
        content: string
        chatHistory?: Array<{ type: string; content: string }>
        attachments?: Array<{ name: string; data: string; type: string; size: number }>
        formSubmission?: Record<string, unknown>
        sessionId?: string
      }) => Promise<{
        success: boolean
        response?: {
          id: string
          role: string
          content: string
          timestamp: string
          metadata?: Record<string, unknown>
        }
        error?: string
      }>
      disconnectAgentNew: () => Promise<{ success: boolean; error?: string }>
      getAgentStatus: () => Promise<{ success: boolean; data?: { connected: boolean; sessionId?: string; activeMessages?: number }; error?: string }>
      
      loadMCPServers: () => Promise<{ success: boolean; data?: MCPServerConfig[]; error?: string }>
      saveMCPServers: (servers: MCPServerConfig[]) => Promise<{ success: boolean; error?: string }>
      testMCPConnection: (server: MCPServerConfig) => Promise<{ success: boolean; data?: { success: boolean; tools?: MCPServerTool[]; error?: string }; error?: string }>
      connectMCPServer: (serverId: string) => Promise<{ success: boolean; data?: { success: boolean; tools?: MCPServerTool[]; error?: string }; error?: string }>
      disconnectMCPServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
      getMCPServerTools: (serverId: string) => Promise<{ success: boolean; data?: MCPServerTool[]; error?: string }>
      refreshMCPServerTools?: (serverId: string) => Promise<{ success: boolean; data?: { success?: boolean; tools?: MCPServerTool[]; error?: string }; error?: string }>
      searchMCPRegistry?: (options?: Record<string, unknown>) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      getMCPRegistryServerDetails?: (serverId: string, packageName?: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      installMCPFromRegistry?: (
        serverId: string,
        packageName?: string,
        installCommand?: { command: string; args: string[] }
      ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      clearMCPRegistryCache?: () => Promise<{ success: boolean; error?: string }>
      getMCPCacheStats?: () => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      triggerMCPBackgroundSync?: () => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      enrichMCPMetrics?: (options?: { limit?: number; concurrency?: number }) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      
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
      
      agent_update_session_context: (data: { sessionId: string; mode: 'personal' | 'hcs10'; topicId?: string }) => Promise<{ success: boolean; error?: string }>
      updateAgentSessionContext?: (payload: { sessionId: string; mode: string; topicId?: string }) => Promise<{ success: boolean; error?: string }>
      chat_create_session: (data: { title?: string }) => Promise<{ success: boolean; data?: ChatSession; error?: string }>
      chat_load_session: (data: { sessionId: string }) => Promise<{ success: boolean; data?: ChatSession; error?: string }>
      chat_save_session: (data: ChatSession) => Promise<{ success: boolean; data?: ChatSession; error?: string }>
      chat_delete_session: (data: { sessionId: string }) => Promise<{ success: boolean; data?: boolean; error?: string }>
      chat_load_all_sessions: () => Promise<{ success: boolean; data?: ChatSession[]; error?: string }>
      chat_save_message: (data: { sessionId: string; message: Message }) => Promise<{ success: boolean; data?: Message; error?: string }>
      chat_load_session_messages: (data: { sessionId: string }) => Promise<{ success: boolean; data?: Message[]; error?: string }>
      chat_update_session_context: (data: { sessionId: string; mode: 'personal' | 'hcs10'; topicId?: string }) => Promise<{ success: boolean; error?: string }>
      chat_update_form_state: (data: {
        sessionId: string
        formId: string
        completionState: 'active' | 'submitting' | 'completed' | 'failed'
        completionData?: Record<string, unknown>
      }) => Promise<{ success: boolean; data?: Message; error?: string }>
      chat_update_message_metadata: (data: { sessionId: string; messageId: string; metadata: Record<string, unknown> }) => Promise<{ success: boolean; data?: Message; error?: string }>
      findFormById?: (formId: string, sessionId?: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
      updateFormState?: (
        formId: string,
        completionState: string,
        completionData?: Record<string, unknown>,
        sessionId?: string
      ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>

      entity: {
        getAll: (filters?: Record<string, unknown>) => Promise<CommandResponse<EntityAssociation[]>>
        delete: (entityId: string) => Promise<CommandResponse<Record<string, unknown>>>
        bulkDelete: (
          entityIds: string[]
        ) => Promise<CommandResponse<{
          successful: string[]
          failed: Array<{ entityId: string; error: string }>
          totalRequested: number
        }>>
        rename: (entityId: string, newName: string) => Promise<CommandResponse<EntityAssociation>>
        export: (
          filters?: Record<string, unknown>,
          format?: 'json' | 'csv'
        ) => Promise<CommandResponse<{ data: string; filename: string; count: number }>>
        getById: (entityId: string) => Promise<CommandResponse<EntityAssociation>>
        search: (query: string, entityType?: string) => Promise<CommandResponse<EntityAssociation[]>>
      }
      
      mirrorNode: {
        getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: ScheduleInfo; error?: string }>
        getTransactionByTimestamp: (timestamp: string, network?: 'mainnet' | 'testnet') => Promise<{ success: boolean; data?: TransactionInfo[]; error?: string }>
        getScheduledTransactionStatus?: (
          scheduleId: string,
          network?: 'mainnet' | 'testnet'
        ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
        getTransaction?: (
          transactionId: string,
          network?: 'mainnet' | 'testnet'
        ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
        getTokenInfo?: (
          tokenId: string,
          network?: 'mainnet' | 'testnet'
        ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
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
      hydrateExecutedTransaction: (
        transactionId: string,
        sessionId: string,
        options?: {
          entityContext?: { name?: string; description?: string }
          network?: string
        }
      ) => Promise<CommandResponse<Record<string, unknown>>>
      reloadApp?: () => Promise<void>
      walletConnect?: {
        connect: (params: Record<string, unknown>) => Promise<unknown>
        disconnect: (params?: Record<string, unknown>) => Promise<unknown>
        approveSession: (params: Record<string, unknown>) => Promise<unknown>
        rejectSession: (params: Record<string, unknown>) => Promise<unknown>
        emitEvent: (params: Record<string, unknown>) => Promise<unknown>
      }
      
      send: (channel: string, data?: DesktopIPCData) => void
    invoke: <T = unknown>(channel: string, data?: DesktopIPCData) => Promise<CommandResponse<T>>
      on: (channel: string, callback: (...args: DesktopIPCData[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: DesktopIPCData[]) => void) => void
      openExternal: (url: string) => Promise<void>
      getPaths: () => Promise<{ moonscapePreload?: string }>
      paths?: { moonscapePreload?: string }
      browser: {
      navigate: (url: string) => Promise<void>
      reload: () => Promise<void>
      goBack: () => Promise<void>
      goForward: () => Promise<void>
      setBounds: (bounds: BrowserBounds & {
        assistantPanel?: {
          isOpen: boolean;
          dock: 'left' | 'right' | 'bottom';
          width: number;
          height: number;
        }
      }) => Promise<void>
        setLayout: (layoutInfo: {
          toolbarHeight: number;
          bookmarkHeight: number;
          windowBounds: { x: number; y: number; width: number; height: number };
          assistantPanel?: {
            isOpen: boolean;
            dock: 'left' | 'right' | 'bottom';
            width: number;
            height: number;
          };
          devicePixelRatio?: number;
        }) => Promise<void>
        getState: () => Promise<BrowserState>
        executeJavaScript: <T = unknown>(script: string) => Promise<T>
        captureContext: () => Promise<{title?: string; description?: string; selection?: string; favicons?: string[]} | null>
        openDevTools: () => Promise<void>
        attach: () => Promise<void>
        detach: () => Promise<void>
        onState: (listener: (state: BrowserState) => void) => () => void
      }
    }

    __walletStatus?: { success: boolean; data?: Record<string, unknown> | null; error?: string }

    api: {
      invoke: <T = unknown>(channel: string, data?: DesktopIPCData) => Promise<CommandResponse<T>>
      on: (channel: string, callback: (...args: DesktopIPCData[]) => void) => () => void
      removeListener: (channel: string, callback: (...args: DesktopIPCData[]) => void) => void
    }
  }
}
