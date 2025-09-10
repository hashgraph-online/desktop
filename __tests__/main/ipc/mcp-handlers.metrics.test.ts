jest.mock('../../../src/main/services/mcp-registry-service')

const sendMock = jest.fn()

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [{ webContents: { send: sendMock } }])
  }
}))


import { setupMCPHandlers } from '../../../src/main/ipc/handlers/mcp-handlers'
import { ipcMain } from 'electron'
import { MCPMetricsService } from '../../../src/main/services/mcp-metrics-service'

describe('IPC metrics handlers', () => {
  beforeEach(() => { (ipcMain.handle as jest.Mock).mockReset(); sendMock.mockReset() })

  it('exposes mcp:refreshMetrics and mcp:set-active-servers', async () => {
    setupMCPHandlers()
    const refresh = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:refreshMetrics')
    const setActive = (ipcMain.handle as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'mcp:set-active-servers')
    expect(refresh).toBeDefined()
    expect(setActive).toBeDefined()
  })
})
