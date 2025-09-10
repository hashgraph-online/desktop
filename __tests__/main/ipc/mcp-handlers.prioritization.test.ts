jest.mock('../../../src/main/services/mcp-registry-service')

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }))

const svcMock = {
  start: jest.fn(), on: jest.fn(), setActive: jest.fn(), scheduleImmediateFetch: jest.fn(), markSurfaced: jest.fn(),
}

jest.mock('../../../src/main/services/mcp-metrics-service', () => ({
  MCPMetricsService: { getInstance: jest.fn().mockReturnValue(svcMock) },
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), all: jest.fn().mockResolvedValue([]),
  }),
  schema: { mcpMetricStatus: { serverId: 'server_id' } },
}))

import { setupMCPHandlers } from '../../../src/main/ipc/handlers/mcp-handlers'
import { ipcMain } from 'electron'
import { MCPMetricsService } from '../../../src/main/services/mcp-metrics-service'

describe('mcp:searchRegistry prioritization hooks', () => {
  beforeEach(() => {
    ;(ipcMain.handle as jest.Mock).mockReset()
    Object.values(svcMock).forEach((fn: any) => fn.mockReset && fn.mockReset())
    const mockSvc = {
      searchServers: jest.fn().mockResolvedValue({
        servers: [ { id: 's1', name: 'A', description: '', githubStars: 0, installCount: 0 }, { id: 's2', name: 'B', description: '', githubStars: 10, installCount: 0 } ], total: 2, hasMore: false,
      }),
    }
    const reg = require('../../../src/main/services/mcp-registry-service')
    reg.MCPRegistryService.getInstance = jest.fn().mockReturnValue(mockSvc)
    setupMCPHandlers()
  })

  it('calls metricsService setActive and scheduleImmediateFetch for missing metrics', async () => {
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:searchRegistry')
    const handler = call[1]
    const res = await handler({} as any, { query: 'x' })
    expect(res.success).toBe(true)
    expect(svcMock.setActive).toHaveBeenCalled()
    expect(svcMock.markSurfaced).toHaveBeenCalled()
    expect(svcMock.scheduleImmediateFetch).toHaveBeenCalled()
  })
})

