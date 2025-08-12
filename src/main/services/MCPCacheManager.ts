import { getDatabase, schema } from '../db/connection'
import { eq, and, or, sql, desc, asc, inArray, gt, lt } from 'drizzle-orm'
import { Logger } from '../utils/logger'
import { createHash } from 'crypto'
import type {
  MCPServer,
  NewMCPServer,
  SearchCacheEntry,
  NewSearchCacheEntry,
  NewPerformanceMetric,
  NewServerCategory
} from '../db/schema'

type MCPServerInput = {
  id: string
  name: string
  description?: string
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
}

export interface CacheSearchOptions {
  query?: string
  tags?: string[]
  category?: string
  author?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'rating' | 'installCount' | 'updatedAt'
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
      } as any

      await this.db!.insert(schema.mcpServers)
        .values(serverData)
        .onConflictDoUpdate({
          target: schema.mcpServers.id,
          set: {
            ...serverData,
            lastFetched: new Date()
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
    
    try {
      for (const server of servers) {
        const serverData = {
          ...server,
          lastFetched: new Date(),
          searchVector: this.generateSearchVector(server)
        } as any

        await this.db!.insert(schema.mcpServers)
          .values(serverData)
          .onConflictDoUpdate({
            target: schema.mcpServers.id,
            set: {
              ...serverData,
              lastFetched: new Date()
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
      }
      
      this.logger.info(`Bulk cached ${servers.length} servers in ${Date.now() - startTime}ms`)
      this.recordMetric('bulk_cache', Date.now() - startTime, false, servers.length)
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
      const updateData: any = {
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

  private async getCachedSearch(queryHash: string): Promise<SearchCacheEntry | null> {
    if (!this.isDatabaseAvailable()) {
      return null
    }

    try {
      const cached = await this.db!.select()
        .from(schema.searchCache)
        .where(and(
          eq(schema.searchCache.queryHash, queryHash),
          gt(schema.searchCache.expiresAt, new Date())
        ))
        .get()

      if (cached) {
        await this.db!.update(schema.searchCache)
          .set({ hitCount: (cached.hitCount || 0) + 1 } as any)
          .where(eq(schema.searchCache.id, cached.id))
          .run()

        return {
          ...cached,
          resultIds: JSON.parse(cached.resultIds)
        }
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
        )!
      )
    }

    if (options.author) {
      conditions.push(sql`lower(${schema.mcpServers.author}) LIKE ${'%' + options.author.toLowerCase() + '%'}`)
    }

    const sortBy = options.sortBy || 'installCount'
    const sortOrder = options.sortOrder || 'desc'
    
    const sortColumn = {
      name: schema.mcpServers.name,
      rating: schema.mcpServers.rating,
      installCount: schema.mcpServers.installCount,
      updatedAt: schema.mcpServers.updatedAt
    }[sortBy] || schema.mcpServers.installCount

    const query = this.db!.select().from(schema.mcpServers)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))

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
          queryText: options.query,
          tags: options.tags ? JSON.stringify(options.tags) : null,
          category: options.category,
          searchOffset: options.offset || 0,
          pageLimit: options.limit || 50,
          resultIds: JSON.stringify(resultIds),
          totalCount: result.total,
          hasMore: result.hasMore,
          expiresAt
        } as any)
        .onConflictDoUpdate({
          target: schema.searchCache.queryHash,
          set: {
            resultIds: JSON.stringify(resultIds),
            totalCount: result.total,
            hasMore: result.hasMore,
            expiresAt: new Date(Date.now() + this.SEARCH_CACHE_TTL),
            hitCount: 1
          } as any
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
      } as any

      this.db!.insert(schema.performanceMetrics).values(metric).run()
    } catch (error) {
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