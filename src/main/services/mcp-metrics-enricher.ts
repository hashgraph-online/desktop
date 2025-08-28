import { Logger } from '../utils/logger'
import { getDatabase, schema } from '../db/connection'
import { sql, asc } from 'drizzle-orm'
import { MCPCacheManager, type MCPServerInput } from './mcp-cache-manager'

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

async function fetchGithubStars(repoUrl?: string | null, token?: string): Promise<{ stars: number | null; rateLimited: boolean }> {
  const parsed = parseGithubRepo(repoUrl)
  if (!parsed) return { stars: null, rateLimited: false }
  const headers: Record<string, string> = {
    'User-Agent': 'HOL-Desktop',
    'Accept': 'application/vnd.github+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const resp = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers })
  if (!resp.ok) {
    const rl = resp.headers.get('x-ratelimit-remaining')
    const rateLimited = resp.status === 403 || resp.status === 429 || rl === '0'
    return { stars: null, rateLimited }
  }
  const data = await resp.json()
  const stars = Number(data?.stargazers_count)
  return { stars: Number.isFinite(stars) ? stars : null, rateLimited: false }
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
    const anyData: any = data
    const dls = Number(anyData?.data?.last_month)
    return Number.isFinite(dls) ? dls : null
  } catch {
    return null
  }
}

export class MCPMetricsEnricher {
  private static instance: MCPMetricsEnricher
  private logger: Logger
  private cache: MCPCacheManager

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

    const queue = [...rows]
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, rows.length)) }).map(async () => {
      while (queue.length) {
        if (rateLimited) break
        const s = queue.shift()!
        try {
          let dls: number | null = null
          if (s.packageRegistry === 'npm') {
            dls = await fetchNpmDownloads(s.packageName)
          } else if (s.packageRegistry === 'pypi') {
            dls = await fetchPyPiDownloads(s.packageName)
          } else if (s.packageName) {
            dls = await fetchNpmDownloads(s.packageName)
            if (dls === null) { dls = await fetchPyPiDownloads(s.packageName) }
          }
          let gh: { stars: number | null; rateLimited: boolean } = { stars: null, rateLimited: false }
          if (!ghDisabled && s.repositoryUrl) {
            gh = await fetchGithubStars(s.repositoryUrl, token)
            if (gh.rateLimited) {
              ghDisabled = true
              rateLimited = true
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
            updated++
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
}
