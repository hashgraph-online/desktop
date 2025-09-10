jest.mock('../../../src/main/services/mcp-registry-service')

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    mcpMetricStatus: {
      serverId: 'server_id', metricType: 'metric_type', status: 'status', value: 'value', lastSuccessAt: 'last_success_at', nextUpdateAt: 'next_update_at',
    },
  }
}))

import { setupMCPHandlers } from '../../../src/main/ipc/handlers/mcp-handlers'
import { ipcMain } from 'electron'
import { MCPRegistryService } from '../../../src/main/services/mcp-registry-service'
import { getDatabase } from '../../../src/main/db/connection'

describe('IPC mcp:searchRegistry metric freshness', () => {
  const baseNow = new Date('2025-03-01T00:00:00.000Z')
  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(baseNow)
    ;(ipcMain.handle as jest.Mock).mockReset()
    ;(MCPRegistryService as any).getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [ { id: 's1', name: 'A', description: '' }, { id: 's2', name: 'B', description: '' } ], total: 2, hasMore: false,
      }),
    })
    const mockDb = {
      select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), all: jest.fn().mockResolvedValue([
        { serverId: 's1', metricType: 'githubStars', status: 'success', value: 5, lastSuccessAt: new Date(baseNow.getTime() - 60*60*1000), nextUpdateAt: new Date(baseNow.getTime() + 5*60*60*1000) },
        { serverId: 's1', metricType: 'npmDownloads', status: 'success', value: 100, lastSuccessAt: new Date(baseNow.getTime() - 3*60*60*1000), nextUpdateAt: new Date(baseNow.getTime() + 21*60*60*1000) },
      ]),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    setupMCPHandlers()
  })
  afterEach(() => { jest.useRealTimers() })

  it('includes metricFreshness with fresh/stale/expired summaries', async () => {
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:searchRegistry')
    const handler = call[1]
    const res = await handler({} as any, { query: 'x' })
    expect(res.success).toBe(true)
    const payload = res.data
    expect(payload.metricFreshness).toBeDefined()
    expect(payload.metricFreshness['s1'].githubStars).toBe('fresh')
    expect(payload.metricFreshness['s1'].downloads).toBe('fresh')
  })
})
