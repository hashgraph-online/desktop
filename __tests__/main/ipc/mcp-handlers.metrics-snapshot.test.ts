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

describe('IPC mcp:searchRegistry metric status snapshot', () => {
  beforeEach(() => {
    ;(ipcMain.handle as jest.Mock).mockReset()
    ;(MCPRegistryService as any).getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [ { id: 's1', name: 'A', description: '' }, { id: 's2', name: 'B', description: '' } ], total: 2, hasMore: false,
      }),
    })
    const mockDb = {
      select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), all: jest.fn().mockResolvedValue([
        { serverId: 's1', metricType: 'githubStars', status: 'success', value: 5, lastSuccessAt: new Date('2025-01-01T00:00:00Z'), nextUpdateAt: new Date('2025-01-01T06:00:00Z') },
      ]),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    setupMCPHandlers()
  })

  it('includes metricStatuses grouped by serverId', async () => {
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:searchRegistry')
    const handler = call[1]
    const res = await handler({} as any, { query: 'x' })
    expect(res.success).toBe(true)
    const payload = res.data
    expect(payload.metricStatuses).toBeDefined()
    expect(Array.isArray(payload.metricStatuses['s1'])).toBe(true)
  })
})

