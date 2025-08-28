import { getDatabase, schema } from '../db/connection'
import { eq, and, or, sql, desc, asc, inArray, gt, lt } from 'drizzle-orm'
import { Logger } from '../utils/logger'
import { createHash } from 'crypto'
import type {
  MCPServer,
  SearchCacheEntry
} from '../db/schema'

export type MCPServerInput = {
  id: string
  name: string
  description?: string
  author?: string | null
  version?: string | null
  url?: string | null
  packageName?: string | null
  packageRegistry?: string | null
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
  githubStars?: number | null
  registry: string
  isActive?: boolean | null
  searchVector?: string | null
}

export interface CacheSearchOptions {
  query?: string
  tags?: string[]
  category?: string
  author?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'rating' | 'installCount' | 'updatedAt' | 'githubStars'
  sortOrder?: 'asc' | 'desc'
}

export interface CacheSearchResult {
  servers: MCPServer[]
  total: number
  hasMore: boolean
  fromCache: boolean
  queryTime: number
}

/**
 * Intelligent caching manager for MCP registry data
 */
export class MCPCacheManager {
  private static instance: MCPCacheManager
  private logger: Logger
  private db = getDatabase()

  private readonly SEARCH_CACHE_TTL = 30 * 60 * 1000;
  private readonly SERVER_CACHE_TTL = 4 * 60 * 60 * 1000;
  private readonly MAX_CACHE_ENTRIES = 1000;

  private constructor() {
    this.logger = new Logger({ module: 'MCPCacheManager' })
    this.db = getDatabase()
    
    if (this.isDatabaseAvailable()) {
      this.setupPeriodicCleanup()
      this.logger.info('Cache manager initialized with database support')
    } else {
      this.logger.warn('Database not available - cache manager will operate in memory-only mode')
    }
  }

  static getInstance(): MCPCacheManager {
    if (!MCPCacheManager.instance) {
      MCPCacheManager.instance = new MCPCacheManager()
    }
    return MCPCacheManager.instance
  }

  /**
   * Check if database is available
   */
  private isDatabaseAvailable(): boolean {
    const available = this.db !== null && this.db !== undefined
    if (!available) {
      this.logger.debug('Database not available for cache operation')
    }
    return available
  }

  /**
   * Search for servers with intelligent caching
   */
  async searchServers(options: CacheSearchOptions): Promise<CacheSearchResult> {
    const startTime = Date.now()

    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - returning empty search results')
      return {
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: Date.now() - startTime
      }
    }

    const queryHash = this.generateSearchHash(options)

    try {
      const cachedResult = await this.getCachedSearch(queryHash)
      if (cachedResult) {
        const servers = await this.getServersByIds(Array.isArray(cachedResult.resultIds) ? cachedResult.resultIds : [cachedResult.resultIds])
        this.recordMetric('search', Date.now() - startTime, true, servers.length)
        
        return {
          servers,
          total: cachedResult.totalCount,
          hasMore: cachedResult.hasMore || false,
          fromCache: true,
          queryTime: Date.now() - startTime
        }
      }

      const result = await this.performDatabaseSearch(options)
      
      await this.cacheSearchResult(queryHash, options, result)
      
      this.recordMetric('search', Date.now() - startTime, false, result.servers.length)
      
      return {
        ...result,
        fromCache: false,
        queryTime: Date.now() - startTime
      }
    } catch (error) {
      this.logger.error('Search failed:', error)
      this.recordMetric('search', Date.now() - startTime, false, 0, 1)
      return {
        servers: [],
        total: 0,
        hasMore: false,
        fromCache: false,
        queryTime: Date.now() - startTime
      }
    }
  }

  /**
   * Cache or update a server
   */
  async cacheServer(server: MCPServerInput): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping server cache')
      return
    }

    try {
      const serverData = {
        ...server,
        lastFetched: new Date(),
        searchVector: this.generateSearchVector(server)
      }

      const { id, ...updateFields } = serverData
      await this.db!.insert(schema.mcpServers)
        .values(serverData)
        .onConflictDoUpdate({
          target: schema.mcpServers.id,
          set: {
            ...updateFields,
            [schema.mcpServers.lastFetched.name]: new Date()
          }
        })
        .run()

      if (server.tags) {
        await this.updateServerCategories(server.id, JSON.parse(server.tags))
      }

      this.logger.debug(`Cached server: ${server.name}`)
    } catch (error) {
      this.logger.error(`Failed to cache server ${server.name}:`, error)
    }
  }

  /**
   * Bulk cache servers for efficient batch operations
   */
  async bulkCacheServers(servers: MCPServerInput[]): Promise<void> {
    const startTime = Date.now()
    
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping bulk cache operation')
      return
    }
    
    if (servers.length === 0) {
      this.logger.debug('No servers to cache')
      return
    }
    
    try {
      const deduplicatedServers = this.deduplicateInputServers(servers)
      this.logger.debug(`Processing ${deduplicatedServers.length} servers after deduplication (from ${servers.length} input servers)`)
      
      for (const server of deduplicatedServers) {
        const serverData = {
          ...server,
          lastFetched: new Date(),
          searchVector: this.generateSearchVector(server)
        }

        try {
          const { id, ...updateFields } = serverData
          await this.db!.insert(schema.mcpServers)
            .values(serverData)
            .onConflictDoUpdate({
              target: schema.mcpServers.id,
              set: {
                ...updateFields,
                [schema.mcpServers.lastFetched.name]: new Date()
              }
            })
            .run()

          if (server.tags) {
            try {
              await this.updateServerCategories(server.id, JSON.parse(server.tags))
            } catch (error) {
              this.logger.warn(`Failed to update categories for server ${server.id}:`, error)
            }
          }
        } catch (insertError: unknown) {
          if (
            insertError instanceof Error && 
            (insertError.message.includes('UNIQUE constraint failed: mcp_servers.package_name') ||
             insertError.message.includes('UNIQUE constraint failed: mcp_servers.id'))
          ) {
            if (insertError.message.includes('package_name')) {
              this.logger.debug(`Handling packageName conflict for server ${server.id} with packageName: ${server.packageName}`)
              
              const existingServer = await this.findServerByPackageName(server.packageName)
              if (existingServer) {
                this.logger.debug(`Updating existing server ${existingServer.id} with new data from ${server.id}`)
                
                const { id, ...updateFields } = serverData
                await this.db!.update(schema.mcpServers)
                  .set({
                    ...updateFields,
                    [schema.mcpServers.lastFetched.name]: new Date()
                  })
                  .where(eq(schema.mcpServers.packageName, server.packageName))
                  .run()
              } else {
                this.logger.warn(`Package name conflict but no existing server found for packageName: ${server.packageName}`)
                throw insertError
              }
            } else if (insertError.message.includes('mcp_servers.id')) {
              this.logger.debug(`Handling primary key conflict for server ${server.id} - updating existing record`)
              
              const { id, ...updateFields } = serverData
              await this.db!.update(schema.mcpServers)
                .set({
                  ...updateFields,
                  [schema.mcpServers.lastFetched.name]: new Date()
                })
                .where(eq(schema.mcpServers.id, server.id))
                .run()
            }
          } else {
            this.logger.error(`Failed to cache server ${server.id}:`, insertError)
            throw insertError
          }
        }
      }
      
      this.logger.info(`Bulk cached ${deduplicatedServers.length} servers in ${Date.now() - startTime}ms`)
      this.recordMetric('bulk_cache', Date.now() - startTime, false, deduplicatedServers.length)
    } catch (error) {
      this.logger.error('Bulk cache failed:', error)
      this.recordMetric('bulk_cache', Date.now() - startTime, false, 0, 1)
      throw error
    }
  }

  /**
   * Get server by ID with caching
   */
  async getServer(serverId: string): Promise<MCPServer | null> {
    if (!this.isDatabaseAvailable()) {
      return null
    }

    try {
      const server = await this.db!.select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.id, serverId))
        .get()

      return server || null
    } catch (error) {
      this.logger.error(`Failed to get server ${serverId}:`, error)
      return null
    }
  }

  /**
   * Get servers by registry with freshness check
   */
  async getServersByRegistry(registry: string, maxAgeMs: number = this.SERVER_CACHE_TTL): Promise<MCPServer[]> {
    if (!this.isDatabaseAvailable()) {
      return []
    }

    try {
      const cutoffTime = new Date(Date.now() - maxAgeMs)
      
      return await this.db!.select()
        .from(schema.mcpServers)
        .where(and(
          eq(schema.mcpServers.registry, registry),
          eq(schema.mcpServers.isActive, true),
          gt(schema.mcpServers.lastFetched, cutoffTime)
        ))
        .orderBy(desc(schema.mcpServers.lastFetched))
        .all()
    } catch (error) {
      this.logger.error(`Failed to get servers for registry ${registry}:`, error)
      return []
    }
  }

  /**
   * Check if registry data is fresh
   */
  async isRegistryFresh(registry: string, maxAgeMs: number = this.SERVER_CACHE_TTL): Promise<boolean> {
    if (!this.isDatabaseAvailable()) {
      return false
    }

    try {
      const syncInfo = await this.db!.select()
        .from(schema.registrySync)
        .where(eq(schema.registrySync.registry, registry))
        .get()

      if (!syncInfo?.lastSuccessAt) return false
      
      const ageMs = Date.now() - (syncInfo.lastSuccessAt.getTime())
      return ageMs < maxAgeMs
    } catch (error) {
      this.logger.error(`Failed to check registry freshness for ${registry}:`, error)
      return false
    }
  }

  /**
   * Update registry sync status
   */
  async updateRegistrySync(
    registry: string, 
    status: 'pending' | 'syncing' | 'success' | 'error',
    options?: {
      serverCount?: number
      errorMessage?: string
      syncDurationMs?: number
    }
  ): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping registry sync update')
      return
    }

    try {
      const updateData: Record<string, unknown> = {
        status,
        lastSyncAt: new Date()
      }

      if (status === 'success') {
        updateData.lastSuccessAt = new Date()
        if (options?.serverCount !== undefined) {
          updateData.serverCount = options.serverCount
        }
      }

      if (options?.errorMessage) {
        updateData.errorMessage = options.errorMessage
      }

      if (options?.syncDurationMs) {
        updateData.syncDurationMs = options.syncDurationMs
      }

      const nextSyncDelay = status === 'success' ? 60 * 60 * 1000 : 5 * 60 * 1000
      updateData.nextSyncAt = new Date(Date.now() + nextSyncDelay)

      await this.db!.update(schema.registrySync)
        .set(updateData)
        .where(eq(schema.registrySync.registry, registry))
        .run()

      this.logger.info(`Updated registry sync status for ${registry}: ${status}`)
    } catch (error) {
      this.logger.error(`Failed to update registry sync for ${registry}:`, error)
      throw error
    }
  }

  /**
   * Clear cache for a specific registry
   */
  async clearRegistryCache(registry: string): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping registry cache clear')
      return
    }

    try {
      const result = await this.db!.delete(schema.mcpServers)
        .where(eq(schema.mcpServers.registry, registry))
        .run()

      await this.clearSearchCache()      
      this.logger.info(`Cleared cache for ${registry}: ${result.changes} servers removed`)
    } catch (error) {
      this.logger.error(`Failed to clear cache for ${registry}:`, error)
      throw error
    }
  }

  /**
   * Clear all search cache
   */
  async clearSearchCache(): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping search cache clear')
      return
    }

    try {
      const result = await this.db!.delete(schema.searchCache).run()
      this.logger.info(`Cleared search cache: ${result.changes} entries removed`)
    } catch (error) {
      this.logger.error('Failed to clear search cache:', error)
      throw error
    }
  }

  /**
   * Clear registry sync status to force re-sync
   */
  async clearRegistrySync(): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      this.logger.warn('Database not available - skipping registry sync clear')
      return
    }

    try {
      const result = await this.db!.delete(schema.registrySync).run()
      this.logger.info(`Cleared registry sync status: ${result.changes} entries removed`)
    } catch (error) {
      this.logger.error('Failed to clear registry sync status:', error)
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalServers: number
    serversByRegistry: Record<string, number>
    cacheEntries: number
    averageResponseTime: number
    cacheHitRate: number
    oldestEntry: Date | null
    newestEntry: Date | null
  }> {
    if (!this.isDatabaseAvailable()) {
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

    try {
      const [
        serverCount,
        registryStats,
        cacheCount,
        performanceStats
      ] = await Promise.all([
        this.db!.select({ count: sql<number>`count(*)` })
          .from(schema.mcpServers)
          .get(),
        this.db!.select({
          registry: schema.mcpServers.registry,
          count: sql<number>`count(*)`
        })
          .from(schema.mcpServers)
          .groupBy(schema.mcpServers.registry)
          .all(),
        this.db!.select({ count: sql<number>`count(*)` })
          .from(schema.searchCache)
          .get(),
        this.db!.select({
          avgDuration: sql<number>`avg(duration_ms)`,
          cacheHits: sql<number>`sum(case when cache_hit = 1 then 1 else 0 end)`,
          totalQueries: sql<number>`count(*)`
        })
          .from(schema.performanceMetrics)
          .where(eq(schema.performanceMetrics.operation, 'search'))
          .get()
      ])

      const [oldestEntry, newestEntry] = await Promise.all([
        this.db!.select({ lastFetched: schema.mcpServers.lastFetched })
          .from(schema.mcpServers)
          .orderBy(asc(schema.mcpServers.lastFetched))
          .limit(1)
          .get(),
        this.db!.select({ lastFetched: schema.mcpServers.lastFetched })
          .from(schema.mcpServers)
          .orderBy(desc(schema.mcpServers.lastFetched))
          .limit(1)
          .get()
      ])

      const serversByRegistry: Record<string, number> = {}
      registryStats.forEach(stat => {
        serversByRegistry[stat.registry] = stat.count
      })

      return {
        totalServers: serverCount?.count || 0,
        serversByRegistry,
        cacheEntries: cacheCount?.count || 0,
        averageResponseTime: performanceStats?.avgDuration || 0,
        cacheHitRate: performanceStats ? 
          (performanceStats.cacheHits / Math.max(performanceStats.totalQueries, 1)) * 100 : 0,
        oldestEntry: oldestEntry?.lastFetched || null,
        newestEntry: newestEntry?.lastFetched || null
      }
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
  }


  private generateSearchHash(options: CacheSearchOptions): string {
    const hashData = JSON.stringify({
      query: options.query?.toLowerCase().trim(),
      tags: options.tags?.sort(),
      category: options.category,
      author: options.author?.toLowerCase().trim(),
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder
    })
    return createHash('sha256').update(hashData).digest('hex')
  }

  private generateSearchVector(server: MCPServerInput): string {
    const searchable = [
      server.name,
      server.description,
      server.author,
      server.packageName,
      server.tags ? JSON.parse(server.tags).join(' ') : '',
      server.license
    ].filter(Boolean).join(' ').toLowerCase()
    
    return searchable
  }

  /**
   * Deduplicate input servers by ID and packageName to prevent conflicts
   */
  private deduplicateInputServers(servers: MCPServerInput[]): MCPServerInput[] {
    const seenIds = new Set<string>()
    const seenPackageNames = new Set<string>()
    const deduplicated: MCPServerInput[] = []

    for (const server of servers) {
      let shouldAdd = true
      
      if (seenIds.has(server.id)) {
        this.logger.debug(`Duplicate server ID found: ${server.id}, skipping`)
        shouldAdd = false
      }
      
      if (server.packageName && seenPackageNames.has(server.packageName)) {
        this.logger.debug(`Duplicate package name found: ${server.packageName} for server ${server.id}, skipping`)
        shouldAdd = false
      }
      
      if (shouldAdd) {
        seenIds.add(server.id)
        if (server.packageName) {
          seenPackageNames.add(server.packageName)
        }
        deduplicated.push(server)
      }
    }

    return deduplicated
  }

  /**
   * Find server by package name
   */
  private async findServerByPackageName(packageName: string | null | undefined): Promise<MCPServer | null> {
    if (!packageName || !this.isDatabaseAvailable()) {
      return null
    }

    try {
      const server = await this.db!.select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.packageName, packageName))
        .get()

      return server || null
    } catch (error) {
      this.logger.error(`Failed to find server by package name ${packageName}:`, error)
      return null
    }
  }

  private async getCachedSearch(queryHash: string): Promise<SearchCacheEntry | null> {
    if (!this.isDatabaseAvailable()) {
      return null
    }

    try {
      const cached = await this.db!.select()
        .from(schema.searchCache)
        .where(eq(schema.searchCache.queryHash, queryHash))
        .get()

      if (cached) {
        const isFresh = cached.expiresAt && cached.expiresAt > new Date()
        if (!isFresh) {
          return null
        }

        try {
          await this.db!.update(schema.searchCache)
            .set({ [schema.searchCache.hitCount.name]: (cached.hitCount || 0) + 1 })
            .where(eq(schema.searchCache.id, cached.id))
            .run()
        } catch {}

        return { ...cached, resultIds: JSON.parse(cached.resultIds) }
      }

      return null
    } catch (error) {
      this.logger.warn('Failed to get cached search:', error)
      return null
    }
  }

  private async getServersByIds(ids: string[]): Promise<MCPServer[]> {
    if (ids.length === 0 || !this.isDatabaseAvailable()) return []

    try {
      const servers = await this.db!.select()
        .from(schema.mcpServers)
        .where(inArray(schema.mcpServers.id, ids))
        .all()

      const serverMap = new Map(servers.map(s => [s.id, s]))
      return ids.map(id => serverMap.get(id)).filter(Boolean) as MCPServer[]
    } catch (error) {
      this.logger.error('Failed to get servers by IDs:', error)
      return []
    }
  }

  private async performDatabaseSearch(options: CacheSearchOptions): Promise<{
    servers: MCPServer[]
    total: number
    hasMore: boolean
  }> {
    if (!this.isDatabaseAvailable()) {
      return { servers: [], total: 0, hasMore: false }
    }

    const limit = options.limit || 50
    const offset = options.offset || 0

    const conditions = [eq(schema.mcpServers.isActive, true)]

    if (options.query) {
      const searchTerm = `%${options.query.toLowerCase()}%`
      conditions.push(
        or(
          sql`lower(${schema.mcpServers.name}) LIKE ${searchTerm}`,
          sql`lower(${schema.mcpServers.description}) LIKE ${searchTerm}`,
          sql`lower(${schema.mcpServers.searchVector}) LIKE ${searchTerm}`
        )
      )
    }

    if (options.author) {
      conditions.push(sql`lower(${schema.mcpServers.author}) LIKE ${'%' + options.author.toLowerCase() + '%'}`)
    }

    const sortBy = options.sortBy || 'installCount'
    const sortOrder = options.sortOrder || 'desc'

    const baseOrder = (() => {
      switch (sortBy) {
        case 'name':
          return [sortOrder === 'desc' ? desc(schema.mcpServers.name) : asc(schema.mcpServers.name)]
        case 'rating':
          return [sortOrder === 'desc' ? desc(schema.mcpServers.rating) : asc(schema.mcpServers.rating)]
        case 'updatedAt':
          return [sortOrder === 'desc' ? desc(schema.mcpServers.updatedAt) : asc(schema.mcpServers.updatedAt)]
        case 'githubStars':
          return [
            desc(sql`COALESCE(${schema.mcpServers.githubStars}, 0)`),
            desc(schema.mcpServers.installCount),
            asc(schema.mcpServers.name),
          ]
        case 'installCount':
        default:
          return [sortOrder === 'desc' ? desc(schema.mcpServers.installCount) : asc(schema.mcpServers.installCount)]
      }
    })()

    const query = this.db!.select().from(schema.mcpServers)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(...baseOrder)

    const totalQuery = this.db!.select({ count: sql<number>`count(*)` })
      .from(schema.mcpServers)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))

    const [servers, totalResult] = await Promise.all([
      query.limit(limit).offset(offset).all(),
      totalQuery.get()
    ])

    const total = totalResult?.count || 0
    const hasMore = offset + servers.length < total

    return { servers, total, hasMore }
  }

  private async cacheSearchResult(
    queryHash: string, 
    options: CacheSearchOptions, 
    result: { servers: MCPServer[]; total: number; hasMore: boolean }
  ): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      return
    }

    try {
      const expiresAt = new Date(Date.now() + this.SEARCH_CACHE_TTL)
      const resultIds = result.servers.map(s => s.id)

      await this.db!.insert(schema.searchCache)
        .values({
          queryHash,
          resultIds: JSON.stringify(resultIds),
          totalCount: result.total,
          expiresAt,
          ...(options.query && { queryText: options.query }),
          ...(options.tags && { tags: JSON.stringify(options.tags) }),
          ...(options.category && { category: options.category }),
          ...(typeof options.offset === 'number' && { searchOffset: options.offset }),
          ...(typeof options.limit === 'number' && { pageLimit: options.limit }),
          ...(typeof result.hasMore === 'boolean' && { hasMore: result.hasMore })
        })
        .onConflictDoUpdate({
          target: schema.searchCache.queryHash,
          set: {
            resultIds: JSON.stringify(resultIds),
            totalCount: result.total,
            [schema.searchCache.hasMore.name]: result.hasMore,
            expiresAt: new Date(Date.now() + this.SEARCH_CACHE_TTL),
            [schema.searchCache.hitCount.name]: 1
          }
        })
        .run()

      await this.cleanupOldCacheEntries()
    } catch (error) {
      this.logger.warn('Failed to cache search result:', error)
    }
  }

  private async updateServerCategories(serverId: string, tags: string[]): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      return
    }

    try {
      await this.db!.delete(schema.serverCategories)
        .where(eq(schema.serverCategories.serverId, serverId))
        .run()

      const categories = this.tagsToCategories(tags)
      if (categories.length > 0) {
        await this.db!.insert(schema.serverCategories)
          .values(categories.map(cat => ({
            serverId,
            category: cat.category,
            confidence: cat.confidence,
            source: 'keyword' as const
          })))
          .run()
      }
    } catch (error) {
      this.logger.warn(`Failed to update categories for server ${serverId}:`, error)
    }
  }

  private tagsToCategories(tags: string[]): Array<{ category: string; confidence: number }> {
    const categoryMap: Record<string, string[]> = {
      'ai': ['ai', 'ml', 'llm', 'gpt', 'claude', 'model', 'neural', 'artificial', 'intelligence'],
      'database': ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'db', 'sqlite', 'redis'],
      'development': ['code', 'developer', 'programming', 'ide', 'editor', 'debug', 'lint'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deployment', 'monitoring', 'jenkins', 'terraform'],
      'communication': ['slack', 'discord', 'email', 'chat', 'messaging', 'notification'],
      'filesystem': ['file', 'filesystem', 'directory', 'folder', 'storage'],
      'api': ['api', 'rest', 'graphql', 'webhook', 'integration', 'http'],
      'security': ['security', 'auth', 'encryption', 'password', 'ssl', 'oauth', 'jwt'],
      'analytics': ['analytics', 'metrics', 'monitoring', 'logging', 'tracking', 'telemetry'],
      'cloud': ['aws', 'azure', 'gcp', 'cloud', 's3', 'lambda', 'ec2']
    }

    const categories: Array<{ category: string; confidence: number }> = []
    const normalizedTags = tags.map(tag => tag.toLowerCase())

    for (const [category, keywords] of Object.entries(categoryMap)) {
      const matchCount = keywords.filter(keyword => 
        normalizedTags.some(tag => tag.includes(keyword))
      ).length

      if (matchCount > 0) {
        const confidence = Math.min(matchCount / keywords.length, 1.0)
        categories.push({ category, confidence })
      }
    }

    return categories.sort((a, b) => b.confidence - a.confidence)
  }

  private recordMetric(
    operation: string, 
    durationMs: number, 
    cacheHit: boolean, 
    resultCount: number, 
    errorCount: number = 0
  ): void {
    if (!this.isDatabaseAvailable()) {
      return
    }

    try {
      const metric = {
        operation,
        durationMs,
        cacheHit,
        resultCount,
        errorCount
      }

      this.db!.insert(schema.performanceMetrics).values(metric).run()
    } catch {
    }
  }

  private async cleanupOldCacheEntries(): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      return
    }

    try {
      const totalEntries = await this.db!.select({ count: sql<number>`count(*)` })
        .from(schema.searchCache)
        .get()

      if (totalEntries && totalEntries.count > this.MAX_CACHE_ENTRIES) {
        const entriesToDelete = totalEntries.count - this.MAX_CACHE_ENTRIES
        
        const oldEntries = await this.db!.select({ id: schema.searchCache.id })
          .from(schema.searchCache)
          .orderBy(asc(schema.searchCache.createdAt))
          .limit(entriesToDelete)
          .all()

        if (oldEntries.length > 0) {
          await this.db!.delete(schema.searchCache)
            .where(inArray(schema.searchCache.id, oldEntries.map(e => e.id)))
            .run()
        }
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup old cache entries:', error)
    }
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache().catch(error => {
        this.logger.warn('Periodic cache cleanup failed:', error)
      })
    }, 10 * 60 * 1000)
  }

  private async cleanupExpiredCache(): Promise<void> {
    if (!this.isDatabaseAvailable()) {
      return
    }

    try {
      const result = await this.db!.delete(schema.searchCache)
        .where(lt(schema.searchCache.expiresAt, new Date()))
        .run()

      if (result.changes > 0) {
        this.logger.debug(`Cleaned up ${result.changes} expired cache entries`)
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup expired cache:', error)
    }
  }
}
