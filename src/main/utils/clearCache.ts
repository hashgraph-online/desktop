import { getDatabase, schema } from '../db/connection'
import { Logger } from '../utils/logger'
import { sql } from 'drizzle-orm'

/**
 * Clear the MCP registry cache and force a re-sync
 */
export async function clearMCPCache(): Promise<{ success: boolean; message: string }> {
  const logger = new Logger({ module: 'ClearCache' })
  
  try {
    const db = getDatabase()
    
    if (!db) {
      return { success: false, message: 'Database not available' }
    }
    
    const deleteServers = db.delete(schema.mcpServers).run()
    logger.info(`Cleared ${deleteServers.changes} servers from cache`)
    
    const deleteCache = db.delete(schema.searchCache).run()
    logger.info(`Cleared ${deleteCache.changes} search cache entries`)
    
    const resetSync = db.update(schema.registrySync)
      .set({ 
        status: 'pending' as const, 
        lastSyncAt: null, 
        lastSuccessAt: null 
      } as any)
      .run()
    logger.info(`Reset ${resetSync.changes} registry sync records`)
    
    return {
      success: true,
      message: `Cleared ${deleteServers.changes} servers and ${deleteCache.changes} cache entries. Registry will re-sync on next search.`
    }
  } catch (error) {
    logger.error('Failed to clear cache:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}