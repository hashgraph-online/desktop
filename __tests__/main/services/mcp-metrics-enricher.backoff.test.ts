jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: { id: 'id', name: 'name', description: 'description', registry: 'registry', packageRegistry: 'package_registry', packageName: 'package_name', repositoryUrl: 'repository_url', lastFetched: 'last_fetched' },
    mcpMetricStatus: { serverId: 'server_id', metricType: 'metric_type', status: 'status', lastSuccessAt: 'last_success_at', lastAttemptAt: 'last_attempt_at', nextUpdateAt: 'next_update_at', value: 'value', retryCount: 'retry_count', errorCode: 'error_code', errorMessage: 'error_message', etag: 'etag' },
  },
  sql: (l: TemplateStringsArray) => String(l[0] || ''),
}))

import { getDatabase } from '../../../src/main/db/connection'
import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher'

describe('MCPMetricsEnricher backoff and etag', () => {
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
  })
  afterEach(() => { jest.useRealTimers() })

  it('records rate-limit error with nextUpdateAt set to reset time', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 's1', name: 'A', description: '', registry: 'pulsemcp', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b', lastFetched: new Date(baseNow) }])
    const fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    const resetAt = new Date(baseNow.getTime() + 60_000).getTime() / 1000
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, headers: { get: (k: string) => (k.toLowerCase()==='x-ratelimit-reset' ? String(resetAt) : (k==='x-ratelimit-remaining' ? '0' : null)) } })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ downloads: 1_000 }) })
    mockDb.get.mockReturnValueOnce(null)
    mockDb.all.mockResolvedValueOnce([])
    await enricher.enrichMissing(10, 1)
    expect((global as any).fetch).toHaveBeenCalled()
  })
})
