jest.mock('../../../src/main/utils/logger')
jest.mock('../../../src/main/services/mcp-cache-manager')

import { MCPRegistryService } from '../../../src/main/services/mcp-registry-service'
import { MCPCacheManager } from '../../../src/main/services/mcp-cache-manager'

describe('MCPRegistryService background sync gating by cache availability', () => {
  it('does not trigger background sync when cache is unavailable', async () => {
    const mockCacheManager = require('../../../src/main/services/mcp-cache-manager').MCPCacheManager
    mockCacheManager.getInstance = jest.fn().mockReturnValue({
      isCacheAvailable: jest.fn(() => false),
    })
    ;(MCPRegistryService as any).instance = null
    const svc = MCPRegistryService.getInstance() as any
    const spy = jest.spyOn(svc, 'performBackgroundSync').mockImplementation(async () => {})
    ;(svc as any).triggerBackgroundSync()
    await new Promise(r => setTimeout(r, 10))
    expect(spy).not.toHaveBeenCalled()
  })
})
