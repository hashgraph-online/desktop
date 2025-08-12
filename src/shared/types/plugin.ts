/**
 * Plugin system types for NPM plugin installer
 * Extends patterns from MCPServerConfig for consistency
 */

export type PluginType = 'npm' | 'local' | 'custom'

export type PluginStatus = 'installed' | 'installing' | 'updating' | 'error' | 'disabled' | 'enabled'

/**
 * Plugin metadata from NPM registry or local package.json
 */
export interface PluginMetadata {
  name: string
  version: string
  description: string
  author: string | { name: string; email?: string; url?: string }
  license?: string
  homepage?: string
  repository?: { type: string; url: string }
  keywords?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  engines?: Record<string, string>
  downloads?: number
  lastPublished?: Date
  maintainers?: Array<{ name: string; email?: string }>
  readme?: string
  dist?: {
    tarball?: string
    shasum?: string
    integrity?: string
    fileCount?: number
    unpackedSize?: number
  }
}

/**
 * Security permission scopes for plugins
 */
export interface PluginPermissions {
  filesystem?: {
    read?: string[]
    write?: string[]
  }
  network?: {
    allowedHosts?: string[]
    allowAllHosts?: boolean
  }
  process?: {
    spawn?: boolean
    env?: string[]
  }
  crypto?: boolean
  hedera?: {
    transactions?: boolean
    queries?: boolean
    accounts?: string[]
  }
}

/**
 * Configuration schema for plugins
 */
export interface PluginConfigSchema {
  type: 'object'
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    default?: unknown
    required?: boolean
    enum?: unknown[]
    pattern?: string
    minLength?: number
    maxLength?: number
    minimum?: number
    maximum?: number
    sensitive?: boolean
  }>
  required?: string[]
}

/**
 * NPM-specific plugin configuration
 */
export interface NPMPluginConfig {
  id: string
  name: string
  type: PluginType
  status: PluginStatus
  enabled: boolean
  version: string
  installedVersion?: string
  availableVersion?: string
  metadata: PluginMetadata
  config?: Record<string, unknown>
  configSchema?: PluginConfigSchema
  permissions?: PluginPermissions
  grantedPermissions?: PluginPermissions
  installPath?: string
  registry?: string
  lastUpdated?: Date
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Local plugin configuration
 */
export interface LocalPluginConfig extends Omit<NPMPluginConfig, 'type'> {
  type: 'local'
  path: string
  watchForChanges?: boolean
}

/**
 * Custom plugin configuration
 */
export interface CustomPluginConfig extends Omit<NPMPluginConfig, 'type'> {
  type: 'custom'
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export type PluginConfig = NPMPluginConfig | LocalPluginConfig | CustomPluginConfig

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  registry?: string
  force?: boolean
  saveDev?: boolean
  saveExact?: boolean
  noDeps?: boolean
  legacyPeerDeps?: boolean
  auth?: {
    token?: string
    username?: string
    password?: string
  }
}

/**
 * Plugin search result from NPM registry
 */
export interface PluginSearchResult {
  name: string
  version: string
  description: string
  keywords?: string[]
  date: string
  links?: {
    npm?: string
    homepage?: string
    repository?: string
    bugs?: string
  }
  author?: { name: string; email?: string; url?: string }
  publisher?: { username: string; email?: string }
  maintainers?: Array<{ username: string; email?: string }>
  score?: {
    final: number
    detail: {
      quality: number
      popularity: number
      maintenance: number
    }
  }
}

/**
 * Plugin installation progress
 */
export interface PluginInstallProgress {
  pluginId: string
  phase: 'downloading' | 'extracting' | 'installing' | 'configuring' | 'validating' | 'completed' | 'failed'
  progress?: number
  message?: string
  error?: string
}

/**
 * Plugin update information
 */
export interface PluginUpdateInfo {
  pluginId: string
  currentVersion: string
  availableVersion: string
  updateType: 'patch' | 'minor' | 'major'
  changelog?: string
  breakingChanges?: boolean
  securityUpdate?: boolean
}

/**
 * Plugin runtime context
 */
export interface PluginRuntimeContext {
  pluginId: string
  isEnabled: boolean
  isLoaded: boolean
  instance?: unknown
  tools?: Array<{
    name: string
    description: string
    namespace?: string
  }>
  resourceUsage?: {
    memory?: number
    cpu?: number
  }
  errors?: Array<{
    timestamp: Date
    message: string
    stack?: string
  }>
}

/**
 * Plugin store state
 */
export interface PluginStoreState {
  plugins: Record<string, PluginConfig>
  searchResults: PluginSearchResult[]
  installProgress: Record<string, PluginInstallProgress>
  updateInfo: Record<string, PluginUpdateInfo>
  runtimeContexts: Record<string, PluginRuntimeContext>
  isSearching: boolean
  isInstalling: boolean
  searchQuery?: string
  searchError?: string
  installError?: string
}

/**
 * Plugin IPC channels
 */
export type PluginIPCChannel = 
  | 'plugin:search'
  | 'plugin:install'
  | 'plugin:uninstall'
  | 'plugin:update'
  | 'plugin:enable'
  | 'plugin:disable'
  | 'plugin:configure'
  | 'plugin:getPermissions'
  | 'plugin:grantPermissions'
  | 'plugin:revokePermissions'
  | 'plugin:getInstalled'
  | 'plugin:getAvailable'
  | 'plugin:checkUpdates'
  | 'plugin:loadLocal'
  | 'plugin:reloadLocal'
  | 'plugin:setRegistry'
  | 'plugin:validateConfig'