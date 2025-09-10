jest.mock('../../../src/main/utils/logger', () => {
  const inst = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
  const Ctor = jest.fn().mockImplementation(() => inst)
  return { Logger: Ctor }
})

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: { id: 'id', name: 'name', description: 'description', registry: 'registry', packageRegistry: 'package_registry', packageName: 'package_name', repositoryUrl: 'repository_url', lastFetched: 'last_fetched', githubStars: 'github_stars', installCount: 'install_count' },
    mcpMetricStatus: { serverId: 'server_id', metricType: 'metric_type', status: 'status', lastSuccessAt: 'last_success_at', lastAttemptAt: 'last_attempt_at', nextUpdateAt: 'next_update_at', value: 'value', retryCount: 'retry_count', errorCode: 'error_code', errorMessage: 'error_message', etag: 'etag' },
    performanceMetrics: { operation: 'operation', durationMs: 'duration_ms', cacheHit: 'cache_hit', resultCount: 'result_count', errorCount: 'error_count' },
  },
  sql: (l: TemplateStringsArray) => String(l[0] || ''),
}))

import { getDatabase } from '../../../src/main/db/connection'
import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher'

jest.mock('../../../src/main/services/mcp-cache-manager', () => ({
  MCPCacheManager: { getInstance: jest.fn().mockReturnValue({ cacheServer: jest.fn() }) }
}))

describe('MCPMetricsEnricher provider pause', () => {
  let enricher: MCPMetricsEnricher
  let mockDb: any
  const baseNow = new Date('2025-03-01T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(baseNow)
    mockDb = {
      select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), all: jest.fn(), get: jest.fn(),
      insert: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), onConflictDoUpdate: jest.fn().mockReturnThis(), target: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), run: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPMetricsEnricher as any).instance = null
    enricher = MCPMetricsEnricher.getInstance()
    ;(enricher as any).logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
  })
  afterEach(() => { jest.useRealTimers() })

  it('skips GitHub fetch while provider is paused due to rate-limit', async () => {
    mockDb.all.mockImplementationOnce(async () => ([
      { id: 's1', name: 'A', description: '', registry: 'pulsemcp', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b', lastFetched: new Date(baseNow) },
    ]))
    const fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    const resetAt = new Date(baseNow.getTime() + 60_000).getTime() / 1000
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 403, headers: { get: (k: string) => (k.toLowerCase()==='x-ratelimit-reset' ? String(resetAt) : (k==='x-ratelimit-remaining' ? '0' : null)) } })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloads: 1_000 }) })
    mockDb.get.mockReturnValueOnce(null)
    mockDb.all.mockImplementationOnce(async () => ([]))
    mockDb.all.mockResolvedValue([])
    await enricher.enrichMissing(10, 1)

    fetchMock.mockClear()
    await enricher.enrichMissing(10, 1)
    const ghCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('api.github.com')).length
    expect(ghCalls).toBe(0)
  })
})
