import { Logger } from '../utils/logger'
import { MCPServerConfig } from './MCPService'
import { MCPCacheManager } from './MCPCacheManager'
import type { NewMCPServer } from '../db/schema'

export interface MCPRegistryServer {
  id: string
  name: string
  description: string
  author?: string
  version?: string
  url?: string
  packageName?: string
  repository?: {
    type: string
    url: string
  }
  config?: {
    command?: string
    args?: string[]
    env?: Record<string, string>
  }
  tags?: string[]
  license?: string
  createdAt?: string
  updatedAt?: string
  installCount?: number
  rating?: number
  tools?: Array<{
    name: string
    description?: string
  }>
}

export interface MCPRegistryResponse {
  servers: MCPRegistryServer[]
  total?: number
  cursor?: string
  hasMore?: boolean
}

export interface MCPRegistrySearchOptions {
  query?: string
  limit?: number
  offset?: number
  cursor?: string
  tags?: string[]
  author?: string
}

/**
 * Service for discovering MCP servers from various registries
 */
export class MCPRegistryService {
  private static instance: MCPRegistryService
  private logger: Logger
  private cacheManager!: MCPCacheManager
  private backgroundSyncActive = false
  private readonly REGISTRY_SYNC_INTERVAL = 60 * 60 * 1000;
  private readonly BACKGROUND_BATCH_SIZE = 50;

  private constructor() {
    this.logger = new Logger({ module: 'MCPRegistryService' })
    try {
      this.cacheManager = MCPCacheManager.getInstance()
      this.initializeBackgroundSync()
    } catch (error) {
      this.logger.error('Failed to initialize cache manager:', error)
      this.logger.warn('MCPRegistryService will operate without caching')
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPRegistryService {
    if (!MCPRegistryService.instance) {
      MCPRegistryService.instance = new MCPRegistryService()
    }
    return MCPRegistryService.instance
  }

  /**
   * Search for MCP servers with intelligent caching
   */
  async searchServers(options: MCPRegistrySearchOptions = {}): Promise<MCPRegistryResponse> {
    try {
      this.logger.info('Searching MCP registries with options:', options)
      
      if (this.cacheManager) {
        const cacheOptions = {
          query: options.query,
          tags: options.tags,
          author: options.author,
          limit: options.limit || 50,
          offset: options.offset || 0,
          sortBy: 'installCount' as const,
          sortOrder: 'desc' as const
        }

        try {
          const cacheResult = await this.cacheManager.searchServers(cacheOptions)
          
          if (cacheResult.servers.length > 0) {
            const convertedServers = cacheResult.servers.map(this.convertFromCachedServer)
            const installableServers = convertedServers.filter(server => {
              const installable = this.isServerInstallable(server)
              if (!installable) {
                this.logger.debug(`Filtering out non-installable server from cache: ${server.name}`)
              }
              return installable
            })
            
            this.logger.info(`Using cached results: Found ${installableServers.length} installable servers (filtered from ${cacheResult.servers.length}, fromCache: ${cacheResult.fromCache}, total: ${cacheResult.total}, ${cacheResult.queryTime}ms)`)
            return {
              servers: installableServers,
              total: cacheResult.total,
              hasMore: cacheResult.hasMore
            }
          }
          
          this.logger.info(`Cache returned no results - serverCount: ${cacheResult.servers.length}, total: ${cacheResult.total}, proceeding to fresh search`)

          this.triggerBackgroundSync()
        } catch (cacheError) {
          this.logger.warn('Cache search failed, falling back to direct API:', cacheError)
        }
      }
      
      this.logger.info('Performing fresh registry search...')
      const freshResults = await this.searchRegistriesWithTimeout(options, 5000)
      this.logger.info(`Fresh search completed: ${freshResults.servers.length} servers, total: ${freshResults.total}, hasMore: ${freshResults.hasMore}`)
      
      return freshResults

    } catch (error) {
      this.logger.error('Failed to search MCP registries:', error)
      return { servers: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    try {
      this.logger.info(`Getting server details for: ${serverId}, packageName: ${packageName}`)
      
      const effectivePackageName = packageName || serverId
      
      const detailPromises = [
        this.getServerDetailsFromPulseMCP(serverId, effectivePackageName),
        this.getServerDetailsFromOfficialRegistry(serverId),
        this.getServerDetailsFromSmitheryRegistry(serverId, effectivePackageName)
      ]

      const results = await Promise.allSettled(detailPromises)
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const source = ['PulseMCP', 'Official Registry', 'Smithery'][i]
        if (result.status === 'fulfilled' && result.value) {
          this.logger.info(`Found server details from ${source}`)
          return result.value
        } else if (result.status === 'rejected') {
          this.logger.debug(`${source} failed:`, result.reason)
        }
      }

      this.logger.warn(`No details found for server: ${serverId} (packageName: ${packageName}, effectivePackageName: ${effectivePackageName})`)
      return null

    } catch (error) {
      this.logger.error(`Failed to get server details for ${serverId}:`, error)
      return null
    }
  }

  /**
   * Check if a server can be installed
   */
  isServerInstallable(registryServer: MCPRegistryServer): boolean {
    const hasCommand = !!registryServer.config?.command
    const hasGitHub = !!(registryServer.repository?.url && registryServer.repository.url.includes('github.com'))
    const hasPackageName = !!registryServer.packageName
    const hasName = !!registryServer.name
    
    if (hasCommand || hasGitHub) {
      return true
    }
    
    if (hasPackageName && registryServer.packageName) {
      const invalidPackageNames = ['bitcoin-mcp', 'mcp-notes']
      if (invalidPackageNames.includes(registryServer.packageName)) {
        this.logger.debug(`Filtering out server with invalid packageName: ${registryServer.packageName}`)
        return false
      }
      return true
    }
    
    // Allow servers with at least a name (can potentially be installed by name)
    if (hasName) {
      return true
    }
    
    return false
  }

  /**
   * Convert registry server to MCP server config for installation
   */
  convertToMCPConfig(registryServer: MCPRegistryServer): Partial<MCPServerConfig> {
    const config: Partial<MCPServerConfig> = {
      name: registryServer.name,
      type: 'custom',
      enabled: true,
      config: {}
    }

    if (registryServer.config?.command) {
      config.config!.command = registryServer.config.command
      config.config!.args = registryServer.config.args || []
      config.config!.env = registryServer.config.env || {}
    } else if (registryServer.packageName) {
      config.config!.command = 'npx'
      config.config!.args = ['-y', registryServer.packageName]
      config.config!.env = registryServer.config?.env || {}
    } else if (registryServer.repository?.url) {
      if (registryServer.repository.url.includes('github.com')) {
        const repoMatch = registryServer.repository.url.match(/github\.com\/([^/]+\/[^/]+)/)
        if (repoMatch) {
          config.config!.command = 'npx'
          config.config!.args = ['-y', `github:${repoMatch[1]}`]
        }
      }
    } else {
      config.config!.command = 'npx'
      config.config!.args = ['-y', registryServer.id]
    }

    if (registryServer.description) {
      config.description = registryServer.description
    }

    return config
  }


  private async searchPulseMCP(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    const baseUrl = 'https://api.pulsemcp.com/v0beta'
    const params = new URLSearchParams()
    
    if (options.query) params.append('query', options.query)
    
    const limit = options.limit || 50
    params.append('count_per_page', limit.toString())
    
    if (options.offset) {
      params.append('offset', options.offset.toString())
    }
    
    const url = `${baseUrl}/servers?${params.toString()}`
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ConversationalAgent/1.0 (https://hashgraphonline.com)',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`PulseMCP API error: ${response.status}`)
      }

      const data = await response.json()
      
      const totalServers = data.total_count || 0
      const hasNext = data.next !== null && data.next !== undefined
      const serversCount = (data.servers || []).length
      
      this.logger.info(`PulseMCP API response: offset=${options.offset}, count=${serversCount}, total=${totalServers}, hasNext=${hasNext}, next=${data.next}`)
      
      const normalizedServers = (data.servers || []).map((server: any) => {
        try {
          return this.normalizePulseMCPServer(server)
        } catch (error) {
          this.logger.warn(`Failed to normalize server:`, error, server)
          return null
        }
      }).filter(Boolean).filter((server: any) => {
        const installable = this.isServerInstallable(server)
        if (!installable) {
          this.logger.debug(`Filtering out non-installable server: ${server.name}`)
        }
        return installable
      })
      
      return {
        servers: normalizedServers,
        total: totalServers,
        hasMore: hasNext
      }
    } catch (error) {
      this.logger.warn('PulseMCP error:', error)
      throw error
    }
  }

  private async searchOfficialRegistry(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    const baseUrl = 'https://registry.modelcontextprotocol.io/v0'
    const params = new URLSearchParams()
    
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.cursor) params.append('cursor', options.cursor)
    
    const url = `${baseUrl}/servers?${params.toString()}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Official Registry API error: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        servers: (data.servers || []).map(this.normalizeOfficialRegistryServer),
        total: data.total,
        cursor: data.cursor,
        hasMore: !!data.cursor
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.warn('Official Registry request timed out after 5 seconds')
      } else if (error.cause?.code === 'ENOTFOUND') {
        this.logger.warn('Official Registry domain not found - registry may be temporarily unavailable')
      } else {
        this.logger.warn('Official Registry error:', error.message)
      }
      
      return { servers: [], total: 0, hasMore: false }
    }
  }

  private async searchSmitheryRegistry(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    this.logger.info('Smithery Registry search skipped (requires authentication)')
    return { servers: [], total: 0, hasMore: false }
  }

  private async getServerDetailsFromPulseMCP(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    if (!packageName) {
      this.logger.debug(`PulseMCP detail lookup skipped - no packageName provided for serverId: ${serverId}`)
      return null
    }
    
    const baseUrl = 'https://api.pulsemcp.com/v0beta'
    const url = `${baseUrl}/servers/${encodeURIComponent(packageName)}`
    
    try {
      this.logger.debug(`Fetching PulseMCP details from: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ConversationalAgent/1.0 (https://hashgraphonline.com)',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        this.logger.debug(`PulseMCP detail request failed with status: ${response.status}`)
        return null
      }

      const data = await response.json()
      this.logger.debug(`PulseMCP detail response:`, data)
      return this.normalizePulseMCPServer(data)
    } catch (error) {
      this.logger.debug(`PulseMCP detail request error:`, error)
      return null
    }
  }

  private async getServerDetailsFromOfficialRegistry(serverId: string): Promise<MCPRegistryServer | null> {
    const baseUrl = 'https://registry.modelcontextprotocol.io/v0'
    const url = `${baseUrl}/servers/${encodeURIComponent(serverId)}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) return null

      const data = await response.json()
      return this.normalizeOfficialRegistryServer(data)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.debug('Official Registry detail request timed out')
      } else if (error.cause?.code === 'ENOTFOUND') {
        this.logger.debug('Official Registry domain not found')
      } else {
        this.logger.debug('Official Registry detail error:', error.message)
      }
      return null
    }
  }

  private async getServerDetailsFromSmitheryRegistry(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    return null
  }


  private normalizePulseMCPServer = (server: any): MCPRegistryServer => {
    const description = server.short_description || server.description || ''
    
    if (!server.package_name && server.name) {
      this.logger.debug(`Server "${server.name}" has no package_name field`)
    }
    
    const invalidPackageNames = ['bitcoin-mcp', 'mcp-notes']
    
    let packageName = server.package_name
    if (packageName && invalidPackageNames.includes(packageName)) {
      this.logger.debug(`Removing invalid packageName "${packageName}" from server "${server.name}"`)
      packageName = undefined
    }
    
    return {
      id: server.id || server.name || server.package_name,
      name: server.name || server.package_name,
      description: String(description),
      author: server.author,
      version: server.version,
      packageName: packageName,
      repository: server.repository ? {
        type: 'git',
        url: server.repository.url || server.repository
      } : undefined,
      tags: server.tags || server.keywords || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
      installCount: server.downloads || server.install_count,
      rating: server.rating,
      tools: server.tools || server.capabilities?.tools || undefined
    }
  }

  private normalizeOfficialRegistryServer = (server: any): MCPRegistryServer => {
    return {
      id: server.id,
      name: server.name,
      description: server.description || '',
      author: server.author,
      version: server.version,
      url: server.url,
      repository: server.repository,
      config: server.config,
      tags: server.tags || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
      tools: server.tools || server.capabilities?.tools || undefined
    }
  }

  private deduplicateServers(servers: MCPRegistryServer[]): MCPRegistryServer[] {
    const seen = new Set<string>()
    const unique: MCPRegistryServer[] = []

    for (const server of servers) {
      const key = server.packageName || server.repository?.url || server.name
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(server)
      }
    }

    return unique
  }

  private filterServers(servers: MCPRegistryServer[], options: MCPRegistrySearchOptions): MCPRegistryServer[] {
    let filtered = servers

    if (options.query) {
      const query = options.query.toLowerCase()
      filtered = filtered.filter(server => 
        server.name.toLowerCase().includes(query) ||
        server.description.toLowerCase().includes(query) ||
        (server.tags && server.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(server =>
        server.tags && options.tags!.some(tag => server.tags!.includes(tag))
      )
    }

    if (options.author) {
      filtered = filtered.filter(server =>
        server.author && server.author.toLowerCase().includes(options.author!.toLowerCase())
      )
    }

    return filtered
  }

  private sortServers(servers: MCPRegistryServer[], query?: string): MCPRegistryServer[] {
    return servers.sort((a, b) => {
      if (query) {
        const aExact = a.name.toLowerCase() === query.toLowerCase() ? 1 : 0
        const bExact = b.name.toLowerCase() === query.toLowerCase() ? 1 : 0
        if (aExact !== bExact) return bExact - aExact
      }

      const aInstalls = a.installCount || 0
      const bInstalls = b.installCount || 0
      if (aInstalls !== bInstalls) return bInstalls - aInstalls

      const aRating = a.rating || 0
      const bRating = b.rating || 0
      if (aRating !== bRating) return bRating - aRating

      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    if (this.cacheManager) {
      try {
        await this.cacheManager.clearSearchCache()
        await this.cacheManager.clearRegistrySync()
        // Also clear all server cache
        await this.cacheManager.clearRegistryCache('pulsemcp')
        await this.cacheManager.clearRegistryCache('official')
        await this.cacheManager.clearRegistryCache('smithery')
        this.logger.info('Registry cache and sync status cleared completely')
      } catch (error) {
        this.logger.error('Failed to clear cache:', error)
      }
    } else {
      this.logger.warn('Cache manager not available - no cache to clear')
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    if (this.cacheManager) {
      try {
        return await this.cacheManager.getCacheStats()
      } catch (error) {
        this.logger.error('Failed to get cache stats:', error)
        return {
          totalServers: 0,
          serversByRegistry: {},
          cacheEntries: 0,
          averageResponseTime: 0,
          cacheHitRate: 0,
          oldestEntry: null,
          newestEntry: null
        }
      }
    } else {
      return {
        totalServers: 0,
        serversByRegistry: {},
        cacheEntries: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        oldestEntry: null,
        newestEntry: null
      }
    }
  }

  /**
   * Initialize background sync system
   */
  private initializeBackgroundSync(): void {
    if (!this.cacheManager) {
      this.logger.warn('Cache manager not available - skipping background sync initialization')
      return
    }

    setTimeout(() => {
      this.triggerBackgroundSync()
    }, 30000)

    setInterval(() => {
      this.triggerBackgroundSync()
    }, this.REGISTRY_SYNC_INTERVAL)
  }

  /**
   * Trigger background sync if not already running
   */
  private triggerBackgroundSync(): void {
    if (!this.cacheManager) {
      this.logger.debug('Cache manager not available - skipping background sync')
      return
    }

    if (this.backgroundSyncActive) {
      this.logger.debug('Background sync already active, skipping')
      return
    }

    setTimeout(() => {
      this.performBackgroundSync().catch(error => {
        this.logger.error('Background sync failed:', error)
      })
    }, 5000)
  }

  /**
   * Perform background sync of all registries
   */
  private async performBackgroundSync(): Promise<void> {
    if (this.backgroundSyncActive) return

    this.backgroundSyncActive = true
    const startTime = Date.now()

    try {
      this.logger.info('Starting background registry sync...')

      const registries = ['pulsemcp', 'official', 'smithery']
      const syncPromises = registries.map(registry => this.syncRegistry(registry))

      await Promise.allSettled(syncPromises)

      const duration = Date.now() - startTime
      this.logger.info(`Background sync completed in ${duration}ms`)

    } catch (error) {
      this.logger.error('Background sync failed:', error)
    } finally {
      this.backgroundSyncActive = false
    }
  }

  /**
   * Sync a specific registry
   */
  private async syncRegistry(registry: string): Promise<void> {
    const startTime = Date.now()

    try {
      const isFresh = await this.cacheManager.isRegistryFresh(registry)
      if (isFresh) {
        this.logger.debug(`Registry ${registry} is already fresh, skipping sync`)
        return
      }

      await this.cacheManager.updateRegistrySync(registry, 'syncing')

      let totalServers = 0
      let offset = 0
      const servers: MCPRegistryServer[] = []

      while (true) {
        const options: MCPRegistrySearchOptions = {
          limit: this.BACKGROUND_BATCH_SIZE,
          offset
        }

        let batchResults: MCPRegistryResponse
        
        switch (registry) {
          case 'pulsemcp':
            batchResults = await this.searchPulseMCP(options)
            break
          case 'official':
            batchResults = await this.searchOfficialRegistry(options)
            break
          case 'smithery':
            batchResults = await this.searchSmitheryRegistry(options)
            break
          default:
            throw new Error(`Unknown registry: ${registry}`)
        }

        if (!batchResults.servers || batchResults.servers.length === 0) {
          this.logger.info(`${registry} sync: No servers returned, stopping at offset ${offset}`)
          break
        }

        servers.push(...batchResults.servers)
        totalServers += batchResults.servers.length

        this.logger.info(`${registry} sync: Fetched ${batchResults.servers.length} servers, total so far: ${totalServers}, hasMore: ${batchResults.hasMore}`)

        const cacheServers = batchResults.servers.map(server => this.convertToCachedServer(server, registry))
        try {
          await this.cacheManager.bulkCacheServers(cacheServers)
        } catch (cacheError) {
          this.logger.error(`Failed to cache servers for ${registry}:`, cacheError)
        }

        offset += this.BACKGROUND_BATCH_SIZE

        if (!batchResults.hasMore || batchResults.servers.length < this.BACKGROUND_BATCH_SIZE) {
          this.logger.info(`${registry} sync: Stopping - hasMore: ${batchResults.hasMore}, servers.length: ${batchResults.servers.length}, batchSize: ${this.BACKGROUND_BATCH_SIZE}`)
          break
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const duration = Date.now() - startTime
      await this.cacheManager.updateRegistrySync(registry, 'success', {
        serverCount: totalServers,
        syncDurationMs: duration
      })

      this.logger.info(`Synced ${totalServers} servers from ${registry} in ${duration}ms`)

    } catch (error) {
      const duration = Date.now() - startTime
      await this.cacheManager.updateRegistrySync(registry, 'error', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        syncDurationMs: duration
      })

      this.logger.error(`Failed to sync registry ${registry}:`, error)
      throw error
    }
  }

  /**
   * Search registries with timeout for immediate responses
   */
  private async searchRegistriesWithTimeout(options: MCPRegistrySearchOptions, timeoutMs: number): Promise<MCPRegistryResponse> {
    try {
      const registryPromises = [
        this.searchPulseMCP(options),
        this.searchOfficialRegistry(options),
        this.searchSmitheryRegistry(options)
      ]

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Registry search timeout')), timeoutMs)
      })

      const results = await Promise.allSettled([
        Promise.race([Promise.allSettled(registryPromises), timeoutPromise])
      ])

      const allServers: MCPRegistryServer[] = []

      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
        results[0].value.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            allServers.push(...result.value.servers)
          } else {
            const registryNames = ['PulseMCP', 'Official Registry', 'Smithery Registry']
            this.logger.warn(`Failed to fetch from ${registryNames[index]}:`, 
              result.status === 'rejected' ? result.reason : 'Unknown error')
          }
        })
      }

      const uniqueServers = this.deduplicateServers(allServers)
      const filteredServers = this.filterServers(uniqueServers, options)
      const sortedServers = this.sortServers(filteredServers, options.query)
      
      // Calculate total based on actual filtered results, not registry totals
      const totalCount = sortedServers.length

      const cacheServers = sortedServers.map(server => this.convertToCachedServer(server, 'mixed'))
      if (cacheServers.length > 0) {
        await this.cacheManager.bulkCacheServers(cacheServers)
      }

      const offset = options.offset || 0
      const hasMoreResults = offset + sortedServers.length < totalCount

      return {
        servers: sortedServers,
        total: totalCount,
        hasMore: hasMoreResults
      }

    } catch (error) {
      this.logger.warn('Timeout registry search failed:', error)
      return { servers: [], total: 0, hasMore: false }
    }
  }

  /**
   * Convert registry server to cached format
   */
  private convertToCachedServer(server: MCPRegistryServer, registry: string): {
    id: string
    name: string
    description: string
    author?: string | null
    version?: string | null
    url?: string | null
    packageName?: string | null
    repositoryType?: string | null
    repositoryUrl?: string | null
    configCommand?: string | null
    configArgs?: string | null
    configEnv?: string | null
    tags?: string | null
    license?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    installCount?: number | null
    rating?: number | null
    registry: string
    isActive?: boolean | null
    searchVector?: string | null
  } {
    return {
      id: server.id,
      name: server.name,
      description: server.description || '',
      author: server.author || null,
      version: server.version || null,
      url: server.url || null,
      packageName: server.packageName || null,
      repositoryType: server.repository?.type || null,
      repositoryUrl: server.repository?.url || null,
      configCommand: server.config?.command || null,
      configArgs: server.config?.args ? JSON.stringify(server.config.args) : null,
      configEnv: server.config?.env ? JSON.stringify(server.config.env) : null,
      tags: server.tags ? JSON.stringify(server.tags) : null,
      license: server.license || null,
      createdAt: server.createdAt || null,
      updatedAt: server.updatedAt || null,
      installCount: server.installCount || 0,
      rating: server.rating || null,
      registry,
      isActive: true
    }
  }

  /**
   * Convert cached server to registry format
   */
  private convertFromCachedServer = (server: any): MCPRegistryServer => {
    return {
      id: server.id,
      name: server.name,
      description: String(server.description || ''),
      author: server.author,
      version: server.version,
      url: server.url,
      packageName: server.packageName,
      repository: server.repositoryUrl ? {
        type: server.repositoryType || 'git',
        url: server.repositoryUrl
      } : undefined,
      config: server.configCommand ? {
        command: server.configCommand,
        args: server.configArgs ? JSON.parse(server.configArgs) : [],
        env: server.configEnv ? JSON.parse(server.configEnv) : {}
      } : undefined,
      tags: server.tags ? JSON.parse(server.tags) : [],
      license: server.license,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      installCount: server.installCount,
      rating: server.rating
    }
  }
}