import { EventEmitter } from 'events'
import { MCPMetricsEnricher } from './mcp-metrics-enricher'
import { getDatabase, schema } from '../db/connection'
import { sql, gt } from 'drizzle-orm'

export type MetricKind = 'githubStars' | 'npmDownloads' | 'pypiDownloads'

type UpdateRecord = {
  serverId: string
  metricType: MetricKind
  status: 'pending' | 'success' | 'error'
  value: number | null
  lastSuccessAt: Date | null
  nextUpdateAt: Date | null
  errorCode: string | null
  errorMessage: string | null
}

/**
 * Background scheduler for fetching and refreshing MCP metrics with simple coalescing and prioritization hooks.
 */
export class MCPMetricsService extends EventEmitter {
  private static instance: MCPMetricsService | null = null
  private active: Map<string, number> = new Map()
  private surfaced: Map<string, number> = new Map()
  private pending: Set<string> = new Set()
  private runningImmediate = false
  private tickTimer: NodeJS.Timeout | null = null
  private lastEmitAt = 0
  private readonly tickIntervalMs = 60_000

  static getInstance(): MCPMetricsService {
    if (!MCPMetricsService.instance) MCPMetricsService.instance = new MCPMetricsService()
    return MCPMetricsService.instance
  }

  start(): void {
    if (this.tickTimer) return
    this.lastEmitAt = Date.now()
    this.tickTimer = setInterval(() => {
      void this.tick()
    }, this.tickIntervalMs)
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  setActive(serverIds: string[], ttlMs = 15_000): void {
    const deadline = Date.now() + ttlMs
    for (const id of serverIds) this.active.set(id, deadline)
  }

  markSurfaced(serverIds: string[], ttlMs = 60_000): void {
    const deadline = Date.now() + ttlMs
    for (const id of serverIds) this.surfaced.set(id, deadline)
  }

  scheduleImmediateFetch(serverId: string, _metric?: MetricKind): void {
    this.pending.add(serverId)
    if (this.runningImmediate) return
    this.runningImmediate = true
    setTimeout(async () => {
      try {
        const ids = Array.from(this.pending)
        this.pending.clear()
        if (ids.length > 0) await this.enrichSpecific(ids)
        await this.emitRecentUpdates()
      } finally {
        this.runningImmediate = false
      }
    }, 0)
  }

  private async tick(): Promise<void> {
    try {
      const now = Date.now()
      const visible = Array.from(this.active.entries()).filter(([, until]) => until > now).map(([id]) => id)
      const surfaced = Array.from(this.surfaced.entries()).filter(([, until]) => until > now).map(([id]) => id)
      const prioritized = Array.from(new Set([...visible, ...surfaced]))
      if (prioritized.length > 0) {
        try { await this.enrichSpecific(prioritized.slice(0, 50)) } catch {}
      }
      try { await MCPMetricsEnricher.getInstance().enrichMissing(100, 4) } catch {}
      try { await this.emitRecentUpdates() } catch {}
    } catch {}
  }

  private async enrichSpecific(serverIds: string[], concurrency = 4): Promise<void> {
    await MCPMetricsEnricher.getInstance().enrichSpecific(serverIds, concurrency)
  }

  private async emitRecentUpdates(): Promise<void> {
    const db = getDatabase()
    if (!db) return
    const since = new Date(this.lastEmitAt)
    const rows = await db
      .select()
      .from(schema.mcpMetricStatus)
      .where(sql`${schema.mcpMetricStatus.lastAttemptAt} IS NOT NULL AND ${schema.mcpMetricStatus.lastAttemptAt} > ${since}`)
      .all()
    this.lastEmitAt = Date.now()
    if (!rows || rows.length === 0) return
    const updates: UpdateRecord[] = rows.map((r: any) => ({
      serverId: r.serverId,
      metricType: r.metricType,
      status: r.status,
      value: typeof r.value === 'number' ? r.value : null,
      lastSuccessAt: r.lastSuccessAt || null,
      nextUpdateAt: r.nextUpdateAt || null,
      errorCode: r.errorCode || null,
      errorMessage: r.errorMessage || null,
    }))
    this.emit('updated', updates)
  }
}
