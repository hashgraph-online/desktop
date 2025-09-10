jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}))

jest.mock('../../../src/main/services/mcp-metrics-enricher', () => ({
  MCPMetricsEnricher: {
    getInstance: jest.fn().mockReturnValue({
      enrichMissing: jest.fn().mockResolvedValue({ processed: 0, updated: 0 }),
      enrichSpecific: jest.fn().mockResolvedValue({ processed: 0, updated: 0 }),
    }),
  }
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue([]),
  }),
  schema: {
    mcpMetricStatus: {
      lastAttemptAt: 'last_attempt_at',
    },
  },
  sql: (lits: TemplateStringsArray) => String(lits[0] || ''),
}))

import { MCPMetricsService } from '../../../src/main/services/mcp-metrics-service'
import { MCPMetricsEnricher } from '../../../src/main/services/mcp-metrics-enricher'

describe('MCPMetricsService scheduling and coalescing', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2025-03-01T00:00:00.000Z')) })
  afterEach(() => { jest.useRealTimers() })

  it('coalesces duplicate immediate refresh requests', async () => {
    const mockEnricher = { enrichMissing: jest.fn().mockResolvedValue({ processed: 0, updated: 0 }), enrichSpecific: jest.fn().mockResolvedValue({ processed: 0, updated: 0 }) }
    ;(MCPMetricsEnricher.getInstance as unknown as jest.Mock).mockReturnValue(mockEnricher)
    const svc = MCPMetricsService.getInstance()
    svc.scheduleImmediateFetch('s1')
    svc.scheduleImmediateFetch('s1')
    jest.runOnlyPendingTimers()
    expect(mockEnricher.enrichSpecific).toHaveBeenCalledTimes(1)
    const args = mockEnricher.enrichSpecific.mock.calls[0][0]
    expect(args).toEqual(['s1'])
  })
})
