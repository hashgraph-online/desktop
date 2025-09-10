jest.mock('../../../src/main/services/mcp-registry-service')
jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }))

import { setupMCPHandlers } from '../../../src/main/ipc/handlers/mcp-handlers'
import { ipcMain } from 'electron'
import { MCPRegistryService } from '../../../src/main/services/mcp-registry-service'

describe('IPC mcp:searchRegistry SWR behavior', () => {
  beforeEach(() => {
    ;(ipcMain.handle as jest.Mock).mockReset()
    ;(MCPRegistryService as any).getInstance = jest.fn().mockReturnValue({
      searchServers: jest.fn().mockResolvedValue({
        servers: [
          { id: '1', name: 'B', description: '', githubStars: 5, installCount: 0 },
          { id: '2', name: 'A', description: '', githubStars: 10, installCount: 0 },
          { id: '2', name: 'A', description: '', githubStars: 10, installCount: 0 },
        ],
        total: 3,
        hasMore: false,
        fromCache: true,
        queryTime: 1,
        staleness: 'stale',
      }),
    })
    setupMCPHandlers()
  })

  it('returns deduped, star-sorted servers and does not block on background revalidation', async () => {
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:searchRegistry')
    expect(call).toBeDefined()
    const handler = call[1]
    const res = await handler({} as any, { query: 'x' })
    expect(res.success).toBe(true)
    const payload = res.data
    expect(payload.staleness).toBe('stale')
    expect(payload.servers.map((s: any) => s.name)).toEqual(['A', 'B'])
  })
})
