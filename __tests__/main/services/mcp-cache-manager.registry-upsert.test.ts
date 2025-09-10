jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}))

jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: {
    registrySync: { registry: 'registry' },
    mcpServers: { lastFetched: 'last_fetched', registry: 'registry', isActive: 'is_active' },
  },
}))

import { MCPCacheManager } from '../../../src/main/services/mcp-cache-manager'
import { getDatabase } from '../../../src/main/db/connection'

describe('MCPCacheManager registry upsert', () => {
  it('upserts registrySync on updateRegistrySync', async () => {
    const mockDb = {
      insert: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), onConflictDoUpdate: jest.fn().mockReturnThis(), run: jest.fn(),
      select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), get: jest.fn().mockReturnValue(null),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPCacheManager as any).instance = null
    const cache = MCPCacheManager.getInstance()
    await cache.updateRegistrySync('pulsemcp', 'success', { serverCount: 10, syncDurationMs: 1000 })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.onConflictDoUpdate).toHaveBeenCalled()
  })
})

