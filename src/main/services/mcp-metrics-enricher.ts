import { Logger } from '../utils/logger'
import { getDatabase, schema } from '../db/connection'
import { sql, asc, inArray } from 'drizzle-orm'
import { MCPCacheManager, type MCPServerInput, type FreshnessTier } from './mcp-cache-manager'

function parseGithubRepo(url?: string | null): { owner: string; repo: string } | null {
  if (!url) return null
  try {
    let u = url.trim()
    if (u.startsWith('github:')) {
      const parts = u.replace('github:', '').split('/')
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
      return null
    }
    if (u.startsWith('git@github.com:')) {
      const tail = u.replace('git@github.com:', '')
      const parts = tail.split('/')
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
      return null
    }
    u = u.replace(/^git\+/, '')
    const parsed = new URL(u)
    if (!/github\.com$/i.test(parsed.hostname)) return null
    const segs = parsed.pathname.replace(/^\//, '').split('/')
    if (segs.length >= 2) return { owner: segs[0], repo: segs[1].replace(/\.git$/, '') }
    return null
  } catch {
    return null
  }
}

async function fetchGithubStars(repoUrl?: string | null, token?: string, etag?: string): Promise<{ stars: number | null; rateLimited: boolean; resetAt?: number; etag?: string; notModified?: boolean }> {
  const parsed = parseGithubRepo(repoUrl)
  if (!parsed) return { stars: null, rateLimited: false }
  const headers: Record<string, string> = {
    'User-Agent': 'HOL-Desktop',
    'Accept': 'application/vnd.github+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (etag) headers['If-None-Match'] = etag
  const resp = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers })
  if (!resp.ok) {
    const rl = resp.headers.get('x-ratelimit-remaining')
    const rateLimited = resp.status === 403 || resp.status === 429 || rl === '0'
    const reset = resp.headers.get('x-ratelimit-reset')
    const resetAt = reset ? Number(reset) * 1000 : undefined
    return { stars: null, rateLimited, resetAt }
  }
  if (resp.status === 304) {
    return { stars: null, rateLimited: false, notModified: true }
  }
  const data = await resp.json()
  const stars = Number(data?.stargazers_count)
  const et = resp.headers.get('etag') || undefined
  return { stars: Number.isFinite(stars) ? stars : null, rateLimited: false, etag: et }
}

async function fetchNpmDownloads(pkg?: string | null): Promise<number | null> {
  if (!pkg) return null
  try {
    const resp = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`)
    if (!resp.ok) return null
    const data = await resp.json()
    const dls = Number(data?.downloads)
    return Number.isFinite(dls) ? dls : null
  } catch {
    return null
  }
}


async function fetchPyPiDownloads(pkg?: string | null): Promise<number | null> {
  if (!pkg) return null
  try {
    const resp = await fetch(`https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`, {
      headers: { 'User-Agent': 'HOL-Desktop' }
    })
    if (!resp.ok) return null
    const data = await resp.json() as { data?: { last_month?: number } }
  const d = data as { data?: { last_month?: number } }
  const dls = Number(d?.data?.last_month)
    return Number.isFinite(dls) ? dls : null
  } catch {
    return null
  }
}

export class MCPMetricsEnricher {
  private static instance: MCPMetricsEnricher
  private logger: Logger
  private cache: MCPCacheManager
  static readonly METRIC_TTLS_MS: Record<'githubStars' | 'npmDownloads' | 'pypiDownloads', number> = {
    githubStars: 6 * 60 * 60 * 1000,
    npmDownloads: 24 * 60 * 60 * 1000,
    pypiDownloads: 24 * 60 * 60 * 1000,
  }
  private metricTimestamps = new Map<string, Partial<Record<'githubStars' | 'npmDownloads' | 'pypiDownloads', number>>>()
  private providerPauseUntil: Record<'github' | 'npm' | 'pypi', number> = { github: 0, npm: 0, pypi: 0 }

  private constructor() {
    this.logger = new Logger({ module: 'MCPMetricsEnricher' })
    this.cache = MCPCacheManager.getInstance()
    
  }

  static getInstance(): MCPMetricsEnricher {
    if (!MCPMetricsEnricher.instance) {
      MCPMetricsEnricher.instance = new MCPMetricsEnricher()
    }
    return MCPMetricsEnricher.instance
  }

  /**
   * Records provider performance metrics to the database.
   */
  private recordMetric(operation: string, durationMs: number, resultCount: number, errorCount: number): void {
    const db = getDatabase()
    if (!db) return
    try {
      db.insert(schema.performanceMetrics).values({
        operation,
        durationMs,
        cacheHit: false,
        resultCount,
        errorCount,
      }).run()
    } catch {}
  }

  getMetricFreshness(serverId: string, metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads'): FreshnessTier {
    const now = Date.now()
    const rec = this.metricTimestamps.get(serverId) || {}
    const ts = rec[metric]
    if (!ts) return 'expired'
    const age = now - ts
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS[metric]
    if (age < ttl / 2) return 'fresh'
    if (age < ttl) return 'stale'
    return 'expired'
  }

  setMetricTimestampForTest(serverId: string, metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads', when: number): void {
    const current = this.metricTimestamps.get(serverId) || {}
    current[metric] = when
    this.metricTimestamps.set(serverId, current)
  }

  /**
   * Computes the next update timestamp based on the metric TTL.
   */
  private computeNextUpdateAt(metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads'): number {
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS[metric]
    return Date.now() + ttl
  }

  /**
   * Computes exponential backoff for errors with a cap under the metric TTL window.
   */
  private computeErrorBackoffNext(metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads', baseMs: number, retryCount: number): number {
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS[metric]
    const exp = Math.min(retryCount, 5)
    const raw = Math.min(baseMs * Math.pow(2, exp), Math.floor(ttl / 2))
    const j = (Date.now() % 1000) / 1000
    const delay = Math.floor(raw * (0.9 + 0.2 * j))
    return Date.now() + delay
  }

  /**
   * Persists per-metric status for a server without using inline SQL expressions.
   */
  private async persistMetricStatus(
    serverId: string,
    metric: 'githubStars' | 'npmDownloads' | 'pypiDownloads',
    status: 'success' | 'error',
    value: number | null,
    opts?: { errorCode?: string; errorMessage?: string; etag?: string; nextUpdateAtOverride?: Date }
  ): Promise<void> {
    const db = getDatabase()
    if (!db) return
    try {
      const now = new Date()
      const next = opts?.nextUpdateAtOverride || new Date(this.computeNextUpdateAt(metric))

      const existing = await db
        .select()
        .from(schema.mcpMetricStatus)
        .where(sql`${schema.mcpMetricStatus.serverId} = ${serverId} AND ${schema.mcpMetricStatus.metricType} = ${metric}`)
        .get()

      const nextRetryCount = status === 'error' ? ((existing?.retryCount ?? 0) + 1) : 0
      const nextWhen = status === 'error' && !opts?.nextUpdateAtOverride
        ? new Date(this.computeErrorBackoffNext(metric, 5 * 60 * 1000, nextRetryCount))
        : next
      const finalValue = (() => {
        if (typeof value === 'number') {
          return value;
        } else if (status === 'success') {
          return existing?.value ?? null;
        } else {
          return null;
        }
      })()

      await db
        .insert(schema.mcpMetricStatus)
        .values({
          serverId,
          metricType: metric,
          status,
          lastAttemptAt: now,
          lastSuccessAt: status === 'success' ? now : existing?.lastSuccessAt ?? null,
          nextUpdateAt: nextWhen,
          value: finalValue,
          errorCode: opts?.errorCode ?? null,
          errorMessage: opts?.errorMessage ?? null,
          retryCount: nextRetryCount,
          etag: opts?.etag ?? existing?.etag ?? null,
        })
        .onConflictDoUpdate({
          target: [schema.mcpMetricStatus.serverId, schema.mcpMetricStatus.metricType],
          set: {
            status,
            lastAttemptAt: now,
            lastSuccessAt: status === 'success' ? now : (existing?.lastSuccessAt ?? null),
            nextUpdateAt: nextWhen,
          value: finalValue,
            errorCode: opts?.errorCode ?? null,
            errorMessage: opts?.errorMessage ?? null,
            retryCount: nextRetryCount,
            etag: opts?.etag ?? existing?.etag ?? null,
          }
        })
        .run()
    } catch (e) {
      this.logger.debug('persistMetricStatus failed (non-fatal):', e)
    }
  }

  async enrichMissing(limit = 100, concurrency = 4): Promise<{ processed: number; updated: number }> {
    const db = getDatabase()
    if (!db) return { processed: 0, updated: 0 }

    const rows = await db.select().from(schema.mcpServers)
      .where(sql`( ${schema.mcpServers.githubStars} IS NULL OR ${schema.mcpServers.githubStars} = 0 OR ${schema.mcpServers.installCount} IS NULL OR ${schema.mcpServers.installCount} = 0 )`)
      .orderBy(
        sql`CASE WHEN ${schema.mcpServers.packageName} IS NOT NULL THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${schema.mcpServers.repositoryUrl} IS NOT NULL THEN 0 ELSE 1 END`,
        asc(schema.mcpServers.lastFetched)
      )
      .limit(limit)
      .all()

    if (rows.length === 0) return { processed: 0, updated: 0 }

    this.logger.info(`Enriching metrics for ${rows.length} servers`)
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    if (!token && concurrency > 1) concurrency = 1
    let updated = 0
    let rateLimited = false
    let ghDisabled = false

    const ids = rows.map(r => r.id)
    const statusRows = ids.length
      ? await db.select().from(schema.mcpMetricStatus).where(inArray(schema.mcpMetricStatus.serverId, ids)).all()
      : []
    const statusMap = new Map<string, any>()
    statusRows.forEach(r => statusMap.set(`${r.serverId}:${r.metricType}`, r))
    const queue = [...rows]
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, rows.length)) }).map(async () => {
      while (queue.length) {
        if (rateLimited) break
        const s = queue.shift()!
        try {
          let dls: number | null = null
          const wantsNpm = s.packageRegistry === 'npm' || (!s.packageRegistry && !!s.packageName)
          const wantsPypi = s.packageRegistry === 'pypi' || (!s.packageRegistry && !!s.packageName)
          const dlsMetric: 'npmDownloads' | 'pypiDownloads' | null = (() => {
          if (s.packageRegistry === 'npm') {
            return 'npmDownloads';
          } else if (s.packageRegistry === 'pypi') {
            return 'pypiDownloads';
          } else {
            return null;
          }
        })()
          const dlsFreshness = dlsMetric ? this.getMetricFreshness(s.id, dlsMetric) : 'expired'
          if ((dlsMetric === 'npmDownloads' && dlsFreshness !== 'fresh') || (dlsMetric === null && wantsNpm && dlsFreshness !== 'fresh')) {
            const t0 = Date.now()
            dls = await fetchNpmDownloads(s.packageName)
            this.recordMetric('metrics_npm', Date.now() - t0, typeof dls === 'number' ? 1 : 0, dls === null ? 1 : 0)
          }
          if (dls === null && ((dlsMetric === 'pypiDownloads' && dlsFreshness !== 'fresh') || (dlsMetric === null && wantsPypi && dlsFreshness !== 'fresh'))) {
            const t0 = Date.now()
            dls = await fetchPyPiDownloads(s.packageName)
            this.recordMetric('metrics_pypi', Date.now() - t0, typeof dls === 'number' ? 1 : 0, dls === null ? 1 : 0)
          }
          let gh: { stars: number | null; rateLimited: boolean; resetAt?: number; etag?: string; notModified?: boolean } = { stars: null, rateLimited: false }
          const ghFreshness = this.getMetricFreshness(s.id, 'githubStars')
          const ghStatus = statusMap.get(`${s.id}:githubStars`)
          const ghNextAtOk = !ghStatus?.nextUpdateAt || (new Date(ghStatus.nextUpdateAt)).getTime() <= Date.now()
          const ghProviderOk = Date.now() >= this.providerPauseUntil.github
          if (!ghDisabled && ghProviderOk && s.repositoryUrl && ghFreshness !== 'fresh' && ghNextAtOk) {
            const t0 = Date.now()
            gh = await fetchGithubStars(s.repositoryUrl, token, ghStatus?.etag || undefined)
            this.recordMetric('metrics_github', Date.now() - t0, typeof gh.stars === 'number' ? 1 : 0, gh.rateLimited ? 1 : 0)
            if (gh.rateLimited) {
              ghDisabled = true
              rateLimited = true
              const reset = gh.resetAt || Date.now() + 15 * 60 * 1000
              this.providerPauseUntil.github = reset
            }
          }
          const updates: MCPServerInput = {
            id: s.id,
            name: s.name || s.packageName || s.repositoryUrl || 'Unknown',
            description: s.description || '',
            registry: s.registry,
            githubStars: typeof gh.stars === 'number' && gh.stars > 0 ? gh.stars : null,
            installCount: typeof dls === 'number' && dls > 0 ? dls : null,
          }
          if (updates.githubStars || updates.installCount) {
            await this.cache.cacheServer(updates)
            const now = Date.now()
            if (typeof updates.githubStars === 'number') this.setMetricTimestampForTest(s.id, 'githubStars', now)
            if (typeof updates.installCount === 'number') {
              if (s.packageRegistry === 'npm' || (!s.packageRegistry && updates.installCount)) this.setMetricTimestampForTest(s.id, 'npmDownloads', now)
              if (s.packageRegistry === 'pypi' || (!s.packageRegistry && updates.installCount)) this.setMetricTimestampForTest(s.id, 'pypiDownloads', now)
            }
            try {
              if (typeof updates.githubStars === 'number') {
                await this.persistMetricStatus(s.id, 'githubStars', 'success', updates.githubStars, { etag: gh.etag })
              }
              if (typeof updates.installCount === 'number') {
                const metric: 'npmDownloads' | 'pypiDownloads' = s.packageRegistry === 'pypi' ? 'pypiDownloads' : 'npmDownloads'
                await this.persistMetricStatus(s.id, metric, 'success', updates.installCount)
              }
            } catch {}
            updated++
          }
          if (updates.installCount == null && (wantsNpm || wantsPypi)) {
            const metric: 'npmDownloads' | 'pypiDownloads' = s.packageRegistry === 'pypi' ? 'pypiDownloads' : 'npmDownloads'
            try { await this.persistMetricStatus(s.id, metric, 'error', null, { errorCode: 'fetch_error' }) } catch {}
          }
          if (!updates.githubStars && gh.stars === null && s.repositoryUrl) {
            const nextOverride = gh.rateLimited && gh.resetAt ? new Date(gh.resetAt) : undefined
            try { await this.persistMetricStatus(s.id, 'githubStars', gh.notModified ? 'success' : 'error', null, { errorCode: gh.rateLimited ? 'rate_limited' : (gh.notModified ? undefined : 'fetch_error'), etag: gh.etag, nextUpdateAtOverride: nextOverride }) } catch {}
          }
        } catch (e) {
          this.logger.debug(`Enrichment failed for ${s.id}:`, e)
        }
      }
    })
    await Promise.all(workers)

    this.logger.info(`Enrichment complete. Updated ${updated}/${rows.length}${rateLimited ? ' (rate limited)' : ''}`)
    return { processed: rows.length, updated }
  }

  /**
   * Enrich metrics for a specific list of server IDs.
   */
  async enrichSpecific(serverIds: string[], concurrency = 4): Promise<{ processed: number; updated: number }> {
    const db = getDatabase()
    if (!db || serverIds.length === 0) return { processed: 0, updated: 0 }

    const rows = await db.select().from(schema.mcpServers)
      .where(inArray(schema.mcpServers.id, serverIds))
      .orderBy(asc(schema.mcpServers.lastFetched))
      .limit(serverIds.length)
      .all()

    if (rows.length === 0) return { processed: 0, updated: 0 }

    let updated = 0
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    if (!token && concurrency > 1) concurrency = 1
    let rateLimited = false
    let ghDisabled = false
    const statusRows = await db.select().from(schema.mcpMetricStatus)
      .where(inArray(schema.mcpMetricStatus.serverId, serverIds))
      .all()
    const statusMap = new Map<string, any>()
    statusRows.forEach(r => statusMap.set(`${r.serverId}:${r.metricType}`, r))
    const queue = [...rows]
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, rows.length)) }).map(async () => {
      while (queue.length) {
        if (rateLimited) break
        const s = queue.shift()!
        try {
          let dls: number | null = null
          const wantsNpm = s.packageRegistry === 'npm' || (!s.packageRegistry && !!s.packageName)
          const wantsPypi = s.packageRegistry === 'pypi' || (!s.packageRegistry && !!s.packageName)
          const dlsMetric: 'npmDownloads' | 'pypiDownloads' | null = (() => {
          if (s.packageRegistry === 'npm') {
            return 'npmDownloads';
          } else if (s.packageRegistry === 'pypi') {
            return 'pypiDownloads';
          } else {
            return null;
          }
        })()
          const dlsFreshness = dlsMetric ? this.getMetricFreshness(s.id, dlsMetric) : 'expired'
          const npmStatus = statusMap.get(`${s.id}:npmDownloads`)
          const pyStatus = statusMap.get(`${s.id}:pypiDownloads`)
          const dlsNextAtOk = (() => {
            const cand = (() => {
              if (dlsMetric === 'npmDownloads') {
                return npmStatus?.nextUpdateAt;
              } else if (dlsMetric === 'pypiDownloads') {
                return pyStatus?.nextUpdateAt;
              } else {
                return npmStatus?.nextUpdateAt || pyStatus?.nextUpdateAt;
              }
            })()
            return !cand || (new Date(cand)).getTime() <= Date.now()
          })()
          if ((dlsMetric === 'npmDownloads' && dlsFreshness !== 'fresh') || (dlsMetric === null && wantsNpm && dlsFreshness !== 'fresh')) {
            if (dlsNextAtOk) dls = await fetchNpmDownloads(s.packageName)
          }
          if (dls === null && ((dlsMetric === 'pypiDownloads' && dlsFreshness !== 'fresh') || (dlsMetric === null && wantsPypi && dlsFreshness !== 'fresh'))) {
            if (dlsNextAtOk) dls = await fetchPyPiDownloads(s.packageName)
          }
          let gh: { stars: number | null; rateLimited: boolean; resetAt?: number; etag?: string; notModified?: boolean } = { stars: null, rateLimited: false }
          const ghFreshness = this.getMetricFreshness(s.id, 'githubStars')
          const ghStatus = statusMap.get(`${s.id}:githubStars`)
          const ghNextAtOk = !ghStatus?.nextUpdateAt || (new Date(ghStatus.nextUpdateAt)).getTime() <= Date.now()
          const ghProviderOk = Date.now() >= this.providerPauseUntil.github
          if (!ghDisabled && ghProviderOk && s.repositoryUrl && ghFreshness !== 'fresh' && ghNextAtOk) {
            gh = await fetchGithubStars(s.repositoryUrl, token, ghStatus?.etag || undefined)
            if (gh.rateLimited) {
              ghDisabled = true
              rateLimited = true
              const reset = gh.resetAt || Date.now() + 15 * 60 * 1000
              this.providerPauseUntil.github = reset
            }
          }
          const updates: MCPServerInput = {
            id: s.id,
            name: s.name || s.packageName || s.repositoryUrl || 'Unknown',
            description: s.description || '',
            registry: s.registry,
            githubStars: typeof gh.stars === 'number' && gh.stars > 0 ? gh.stars : null,
            installCount: typeof dls === 'number' && dls > 0 ? dls : null,
          }
          if (updates.githubStars || updates.installCount) {
            await this.cache.cacheServer(updates)
            const now = Date.now()
            if (typeof updates.githubStars === 'number') this.setMetricTimestampForTest(s.id, 'githubStars', now)
            if (typeof updates.installCount === 'number') {
              if (s.packageRegistry === 'npm' || (!s.packageRegistry && updates.installCount)) this.setMetricTimestampForTest(s.id, 'npmDownloads', now)
              if (s.packageRegistry === 'pypi' || (!s.packageRegistry && updates.installCount)) this.setMetricTimestampForTest(s.id, 'pypiDownloads', now)
            }
            try {
              if (typeof updates.githubStars === 'number') await this.persistMetricStatus(s.id, 'githubStars', 'success', updates.githubStars)
              if (typeof updates.installCount === 'number') {
                const metric: 'npmDownloads' | 'pypiDownloads' = s.packageRegistry === 'pypi' ? 'pypiDownloads' : 'npmDownloads'
                await this.persistMetricStatus(s.id, metric, 'success', updates.installCount)
              }
            } catch {}
            updated++
          }
          if (updates.installCount == null && (wantsNpm || wantsPypi)) {
            const metric: 'npmDownloads' | 'pypiDownloads' = s.packageRegistry === 'pypi' ? 'pypiDownloads' : 'npmDownloads'
            try { await this.persistMetricStatus(s.id, metric, 'error', null, { errorCode: 'fetch_error' }) } catch {}
          }
          if (!updates.githubStars && gh.stars === null && s.repositoryUrl) {
            try { await this.persistMetricStatus(s.id, 'githubStars', 'error', null, { errorCode: gh.rateLimited ? 'rate_limited' : 'fetch_error' }) } catch {}
          }
        } catch (e) {
          this.logger.debug(`Enrichment failed for ${s.id}:`, e)
        }
      }
    })
    await Promise.all(workers)
    return { processed: rows.length, updated }
  }
}
