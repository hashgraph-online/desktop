import { MCPCacheManager } from '../src/main/services/MCPCacheManager';
import { getDatabase, schema } from '../src/main/db/connection';

/**
 * Focused test for UNIQUE constraint SQLite error scenario
 * Tests the original bug: "SqliteError: UNIQUE constraint failed: mcp_servers.package_name"
 */
describe('MCPCacheManager UNIQUE Constraint Bug', () => {
  let cacheManager: MCPCacheManager;

  beforeEach(async () => {
    cacheManager = MCPCacheManager.getInstance();
    const db = getDatabase();
    if (db) {
      await db.delete(schema.mcpServers).run();
      await db.delete(schema.serverCategories).run();
    }
  });

  afterEach(async () => {
    const db = getDatabase();
    if (db) {
      await db.delete(schema.mcpServers).run();
      await db.delete(schema.serverCategories).run();
    }
  });

  it('should reproduce the original UNIQUE constraint error and verify it is fixed', async () => {

    const batchOfServers = [
      {
        id: 'registry-server-1',
        name: 'First MCP Server',
        description: 'First server with shared package name',
        packageName: '@shared/mcp-package',
        registry: 'pulsemcp'
      },
      {
        id: 'registry-server-2',
        name: 'Second MCP Server',
        description: 'Second server with same package name',
        packageName: '@shared/mcp-package', // Same package name - this should cause conflict
        registry: 'pulsemcp'
      },
      {
        id: 'registry-server-3',
        name: 'Third MCP Server',
        description: 'Third server with same package name',
        packageName: '@shared/mcp-package', // Same package name - this should cause conflict
        registry: 'pulsemcp'
      }
    ];

    await expect(
      cacheManager.bulkCacheServers(batchOfServers)
    ).resolves.not.toThrow();

    const server1 = await cacheManager.getServer('registry-server-1');
    expect(server1).toBeTruthy();
    expect(server1?.packageName).toBe('@shared/mcp-package');
    
    const server2 = await cacheManager.getServer('registry-server-2');
    const server3 = await cacheManager.getServer('registry-server-3');
    
    expect(server2).toBeNull();
    expect(server3).toBeNull();
  });

  it('should handle the real-world sync scenario from "./mcp-registry-service"', async () => {

    const batch1 = Array.from({ length: 50 }, (_, i) => ({
      id: `batch1-server-${i}`,
      name: `Batch 1 Server ${i}`,
      description: `Server ${i} from first batch`,
      packageName: i < 5 ? 'shared-batch-package' : `unique-batch1-package-${i}`,
      registry: 'pulsemcp'
    }));

    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      id: `batch2-server-${i}`,
      name: `Batch 2 Server ${i}`,
      description: `Server ${i} from second batch`,
      packageName: i < 5 ? 'shared-batch-package' : `unique-batch2-package-${i}`,
      registry: 'pulsemcp'
    }));

    await expect(
      cacheManager.bulkCacheServers(batch1)
    ).resolves.not.toThrow();

    await expect(
      cacheManager.bulkCacheServers(batch2)
    ).resolves.not.toThrow();

    const batch1Server = await cacheManager.getServer('batch1-server-10');
    const batch2Server = await cacheManager.getServer('batch2-server-10');
    
    expect(batch1Server).toBeTruthy();
    expect(batch2Server).toBeTruthy();
    
    const sharedPackageServer = await cacheManager.getServer('batch1-server-0');
    expect(sharedPackageServer).toBeTruthy();
    expect(sharedPackageServer?.packageName).toBe('shared-batch-package');
    
    const duplicateServer1 = await cacheManager.getServer('batch1-server-1'); // has shared-batch-package
    const duplicateServer2 = await cacheManager.getServer('batch2-server-0'); // has shared-batch-package
    expect(duplicateServer1).toBeNull(); // Deduplicated in batch1
    expect(duplicateServer2).toBeNull(); // Deduplicated in batch2
  });

  it('should handle packageName conflicts between existing database data and new sync data', async () => {
    
    const existingServers = [
      {
        id: 'existing-1',
        name: 'Existing Server 1',
        description: 'Server from previous sync',
        packageName: 'existing-conflict-package',
        registry: 'pulsemcp',
        version: '1.0.0'
      },
      {
        id: 'existing-2',
        name: 'Existing Server 2', 
        description: 'Another server from previous sync',
        packageName: 'another-existing-package',
        registry: 'pulsemcp',
        version: '1.0.0'
      }
    ];

    await cacheManager.bulkCacheServers(existingServers);

    const newSyncServers = [
      {
        id: 'new-sync-1',
        name: 'New Sync Server 1',
        description: 'Server from new sync with conflicting packageName',
        packageName: 'existing-conflict-package', // Conflicts with existing-1
        registry: 'pulsemcp',
        version: '2.0.0'
      },
      {
        id: 'new-sync-2',
        name: 'New Sync Server 2',
        description: 'Server from new sync with unique packageName',
        packageName: 'completely-new-package',
        registry: 'pulsemcp',
        version: '2.0.0'
      }
    ];

    await expect(
      cacheManager.bulkCacheServers(newSyncServers)
    ).resolves.not.toThrow();

    const existingServer = await cacheManager.getServer('existing-1');
    expect(existingServer).toBeTruthy();
    expect(existingServer?.packageName).toBe('existing-conflict-package');
    expect(existingServer?.name).toBe('Existing Server 1'); // Should remain unchanged
    
    const conflictingNewServer = await cacheManager.getServer('new-sync-1');
    expect(conflictingNewServer).toBeNull();

    const uniqueServer = await cacheManager.getServer('new-sync-2');
    expect(uniqueServer).toBeTruthy();
    expect(uniqueServer?.packageName).toBe('completely-new-package');
  });
});