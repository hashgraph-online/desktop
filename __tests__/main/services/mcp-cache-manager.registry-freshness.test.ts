jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}))
jest.mock('../../../src/main/db/connection', () => ({
  getDatabase: jest.fn(),
  schema: { registrySync: { registry: 'registry', lastSuccessAt: 'last_success_at' } },
}))

import { MCPCacheManager, type FreshnessPolicy } from '../../../src/main/services/mcp-cache-manager'
import { getDatabase } from '../../../src/main/db/connection'

describe('Registry freshness tiers', () => {
  const baseNow = new Date('2025-03-01T00:00:00.000Z')
  const policy: FreshnessPolicy = { freshMs: 60 * 60 * 1000, ttlMs: 4 * 60 * 60 * 1000 }
  let cache: MCPCacheManager
  let mockDb: any

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(baseNow)
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    }
    ;(getDatabase as jest.Mock).mockReturnValue(mockDb)
    ;(MCPCacheManager as any).instance = null
    cache = MCPCacheManager.getInstance()
  })
  afterEach(() => { jest.useRealTimers() })

  it('fresh -> stale -> expired based on policy windows', async () => {
    mockDb.get.mockImplementation(() => ({ registry: 'pulsemcp', lastSuccessAt: new Date(baseNow) }))
    await expect(cache.getRegistryFreshnessTier('pulsemcp', policy)).resolves.toBe('fresh')
    jest.setSystemTime(new Date(baseNow.getTime() + policy.freshMs + 1))
    await expect(cache.getRegistryFreshnessTier('pulsemcp', policy)).resolves.toBe('stale')
    jest.setSystemTime(new Date(baseNow.getTime() + policy.ttlMs + 1))
    await expect(cache.getRegistryFreshnessTier('pulsemcp', policy)).resolves.toBe('expired')
  })

  it('returns expired when no sync info exists', async () => {
    mockDb.get.mockReturnValueOnce(null)
    await expect(cache.getRegistryFreshnessTier('pulsemcp', policy)).resolves.toBe('expired')
  })
})

