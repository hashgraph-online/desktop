jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpServers: {
      id: 'id',
      name: 'name',
      description: 'description',
      packageRegistry: 'package_registry',
      packageName: 'package_name',
      repositoryUrl: 'repository_url',
      lastFetched: 'last_fetched',
    },
  },
}))

import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher'
import { getDatabase } from '../../../src/main/db/connection'

describe('MCPMetricsEnricher TTLs', () => {
  let enricher: MCPMetricsEnricher
  let mockDb: any
  const baseNow = new Date('2025-02-01T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(baseNow)
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      all: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPMetricsEnricher as any).instance = null
    enricher = MCPMetricsEnricher.getInstance()
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as any).fetch && ((global as any).fetch as jest.Mock).mockRestore?.()
  })

  it('fresh/stale/expired transitions for github stars', () => {
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS.githubStars
    enricher.setMetricTimestampForTest('s1', 'githubStars', Date.now())
    expect(enricher.getMetricFreshness('s1', 'githubStars')).toBe('fresh')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl * 0.75))
    expect(enricher.getMetricFreshness('s1', 'githubStars')).toBe('stale')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl + 1))
    expect(enricher.getMetricFreshness('s1', 'githubStars')).toBe('expired')
  })

  it('skips network for fresh metrics and fetches for expired', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: 's1', name: 'S', description: '', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b' },
    ])
    const fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock

    enricher.setMetricTimestampForTest('s1', 'githubStars', Date.now())
    enricher.setMetricTimestampForTest('s1', 'npmDownloads', Date.now())

    await enricher.enrichMissing(10, 1)
    expect(fetchMock).not.toHaveBeenCalled()

    jest.setSystemTime(new Date(baseNow.getTime() + MCPMetricsEnricher.METRIC_TTLS_MS.githubStars + 1))
    mockDb.all.mockResolvedValueOnce([
      { id: 's1', name: 'S', description: '', packageRegistry: 'npm', packageName: 'pkg', repositoryUrl: 'https://github.com/a/b' },
    ])
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ stargazers_count: 10, downloads: 1000 }) })
    await enricher.enrichMissing(10, 1)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('fresh/stale/expired transitions for npm downloads', () => {
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS.npmDownloads
    enricher.setMetricTimestampForTest('s2', 'npmDownloads', Date.now())
    expect(enricher.getMetricFreshness('s2', 'npmDownloads')).toBe('fresh')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl * 0.75))
    expect(enricher.getMetricFreshness('s2', 'npmDownloads')).toBe('stale')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl + 1))
    expect(enricher.getMetricFreshness('s2', 'npmDownloads')).toBe('expired')
  })

  it('fresh/stale/expired transitions for PyPI downloads', () => {
    const ttl = MCPMetricsEnricher.METRIC_TTLS_MS.pypiDownloads
    enricher.setMetricTimestampForTest('s3', 'pypiDownloads', Date.now())
    expect(enricher.getMetricFreshness('s3', 'pypiDownloads')).toBe('fresh')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl * 0.75))
    expect(enricher.getMetricFreshness('s3', 'pypiDownloads')).toBe('stale')
    jest.setSystemTime(new Date(baseNow.getTime() + ttl + 1))
    expect(enricher.getMetricFreshness('s3', 'pypiDownloads')).toBe('expired')
  })
})
