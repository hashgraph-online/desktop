export type MCPServerType = 'filesystem' | 'github' | 'postgres' | 'sqlite' | 'custom'

export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'handshaking' | 'ready' | 'error'

export interface MCPServerTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface MCPServerConfig {
  id: string
  name: string
  description?: string
  type: MCPServerType
  status: MCPServerStatus
  enabled: boolean
  config: Record<string, any>
  tools?: MCPServerTool[]
  lastConnected?: Date
  errorMessage?: string
  connectionHealth?: MCPConnectionHealth
  createdAt: Date
  updatedAt: Date
}

export interface MCPFilesystemConfig {
  type: 'filesystem'
  rootPath: string
  allowedPaths?: string[]
  excludePaths?: string[]
  readOnly?: boolean
}

export interface MCPGithubConfig {
  type: 'github'
  token: string
  owner: string
  repo: string
  branch?: string
}

export interface MCPPostgresConfig {
  type: 'postgres'
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
}

export interface MCPSqliteConfig {
  type: 'sqlite'
  path: string
  readOnly?: boolean
}

export interface MCPCustomConfig {
  type: 'custom'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export type MCPServerConfigType = 
  | MCPFilesystemConfig
  | MCPGithubConfig
  | MCPPostgresConfig
  | MCPSqliteConfig
  | MCPCustomConfig

export interface MCPConnectionTest {
  id: string
  serverId: string
  status: 'idle' | 'testing' | 'success' | 'failed'
  startedAt: Date
  completedAt?: Date
  result?: {
    success: boolean
    tools?: MCPServerTool[]
    error?: string
    details?: any
    latency?: number
  }
}

export interface MCPConnectionHealth {
  serverId: string
  connectionAttempts: number
  lastAttemptTime?: Date
  averageLatency?: number
  uptime?: number
  errorRate?: number
  lastError?: string
  lastErrorTime?: Date
}

export interface MCPServerFormData {
  name: string
  type: MCPServerType
  config: Record<string, any>
}

export interface MCPServerCardProps {
  server: MCPServerConfig
  onToggle: (serverId: string, enabled: boolean) => void
  onEdit: (serverId: string) => void
  onDelete: (serverId: string) => void
  onTest: (serverId: string) => void
}

export interface MCPServerListProps {
  servers: MCPServerConfig[]
  loading?: boolean
  onToggle: (serverId: string, enabled: boolean) => void
  onEdit: (serverId: string) => void
  onDelete: (serverId: string) => void
  onTest: (serverId: string) => void
  onAdd: () => void
}

export interface AddMCPServerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: MCPServerFormData) => void
  editingServer?: MCPServerConfig | null
}

export interface MCPTestConnectionProps {
  serverId: string
  onTest: () => void
  result?: MCPConnectionTest
  loading?: boolean
}