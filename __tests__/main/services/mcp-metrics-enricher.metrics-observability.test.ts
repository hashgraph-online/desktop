jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}))

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

describe('MCPMetricsEnricher metrics observability', () => {
  it('records provider performance metrics', async () => {
    const mockDb = {
      select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), all: jest.fn(), get: jest.fn(),
      insert: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), onConflictDoUpdate: jest.fn().mockReturnThis(), target: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), run: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPMetricsEnricher as any).instance = null
    const enricher = MCPMetricsEnricher.getInstance()
    ;(enricher as any).logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
    const fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    ;(mockDb.all as jest.Mock).mockResolvedValueOnce([
      { id: 's1', name: 'A', description: '', registry: 'pulsemcp', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b', lastFetched: new Date() },
    ])
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stargazers_count: 1 }), headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloads: 100 }) })
    mockDb.get.mockReturnValueOnce(null)
    mockDb.all.mockResolvedValueOnce([])
    await enricher.enrichMissing(10, 1)
    expect(mockDb.insert).toHaveBeenCalled()
  })
})
