jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: { id: 'id', name: 'name', registry: 'registry' },
    mcpMetricStatus: {
      serverId: 'server_id',
      metricType: 'metric_type',
      status: 'status',
      lastSuccessAt: 'last_success_at',
      lastAttemptAt: 'last_attempt_at',
      nextUpdateAt: 'next_update_at',
      value: 'value',
      retryCount: 'retry_count',
      errorCode: 'error_code',
      errorMessage: 'error_message',
    },
  },
  sql: (lits: TemplateStringsArray) => String(lits[0] || ''),
}))

import { getDatabase } from '../../../src/main/db/connection'
import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher'

describe('MCPMetricsEnricher persistence', () => {
  let enricher: MCPMetricsEnricher
  let mockDb: any
  const baseNow = new Date('2025-03-01T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(baseNow)
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnValue(null),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue([
        { id: 's1', name: 'A', description: '', registry: 'pulsemcp', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b' },
      ]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      target: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      run: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPMetricsEnricher as any).instance = null
    enricher = MCPMetricsEnricher.getInstance()
  })

  afterEach(() => { jest.useRealTimers() })

  it('persists success status to mcp_metric_status with correct TTL-derived nextUpdateAt', async () => {
    const fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stargazers_count: 42 }), headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloads: 1000 }) })

    const res = await enricher.enrichMissing(10, 1)
    expect(res.processed).toBe(1)
    expect(mockDb.insert).toHaveBeenCalled()
    const call = mockDb.values.mock.calls.find(Boolean)?.[0]
    expect(call).toBeTruthy()
    const payload = call as any
    expect(payload.serverId).toBe('s1')
    expect(mockDb.onConflictDoUpdate).toHaveBeenCalled()
  })
})
