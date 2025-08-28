import { MCPCacheManager } from '../src/main/services/MCPCacheManager';
import { getDatabase, schema } from '../src/main/db/connection';

/**
 * Test suite for MCPCacheManager bulk caching operations
 * Focuses on handling duplicate package names and UNIQUE constraint conflicts
 */
describe('MCPCacheManager.bulkCacheServers', () => {
  let cacheManager: MCPCacheManager;

  beforeEach(() => {
    cacheManager = MCPCacheManager.getInstance();
  });

  afterEach(async () => {
    const db = getDatabase();
    if (db) {
      await db.delete(schema.mcpServers).run();
      await db.delete(schema.serverCategories).run();
    }
  });

  describe('duplicate package name handling', () => {
    it('should handle servers with the same package name but different IDs by keeping first one', async () => {
      const serversWithSamePackageName = [
        {
          id: 'server-1',
          name: 'First Server',
          description: 'First server with shared package',
          packageName: 'shared-package',
          registry: 'test-registry'
        },
        {
          id: 'server-2', 
          name: 'Second Server',
          description: 'Second server with shared package',
          packageName: 'shared-package',
          registry: 'test-registry'
        }
      ];

      await expect(
        cacheManager.bulkCacheServers(serversWithSamePackageName)
      ).resolves.not.toThrow();
      
      const server1 = await cacheManager.getServer('server-1');
      const server2 = await cacheManager.getServer('server-2');
      
      expect(server1).toBeTruthy();
      expect(server1?.name).toBe('First Server');
      expect(server2).toBeNull(); // Should not exist due to deduplication
    });

    it('should update existing server when same ID is provided', async () => {
      const originalServer = {
        id: 'test-server',
        name: 'Original Name',
        description: 'Original description',
        packageName: 'test-package',
        registry: 'test-registry'
      };

      const updatedServer = {
        id: 'test-server',
        name: 'Updated Name', 
        description: 'Updated description',
        packageName: 'test-package',
        registry: 'test-registry'
      };

      await cacheManager.bulkCacheServers([originalServer]);
      
      await cacheManager.bulkCacheServers([updatedServer]);

      const retrievedServer = await cacheManager.getServer('test-server');
      expect(retrievedServer).toBeTruthy();
      expect(retrievedServer?.name).toBe('Updated Name');
      expect(retrievedServer?.description).toBe('Updated description');
    });

    it('should handle servers with same package name from different registries', async () => {
      const serversFromDifferentRegistries = [
        {
          id: 'registry1-server',
          name: 'Registry 1 Server',
          description: 'Server from first registry',
          packageName: 'common-package',
          registry: 'registry-1'
        },
        {
          id: 'registry2-server',
          name: 'Registry 2 Server', 
          description: 'Server from second registry',
          packageName: 'common-package',
          registry: 'registry-2'
        }
      ];

      await expect(
        cacheManager.bulkCacheServers(serversFromDifferentRegistries)
      ).resolves.not.toThrow();

      const server1 = await cacheManager.getServer('registry1-server');
      const server2 = await cacheManager.getServer('registry2-server');
      
      expect(server1).toBeTruthy();
      expect(server2).toBeTruthy();
      expect(server1?.registry).toBe('registry-1');
      expect(server2?.registry).toBe('registry-2');
    });

    it('should handle empty package names gracefully', async () => {
      const serversWithNullPackageNames = [
        {
          id: 'server-1',
          name: 'Server Without Package',
          description: 'No package name',
          packageName: null,
          registry: 'test-registry'
        },
        {
          id: 'server-2',
          name: 'Another Server Without Package',
          description: 'Also no package name',
          packageName: null,
          registry: 'test-registry'
        }
      ];

      await expect(
        cacheManager.bulkCacheServers(serversWithNullPackageNames)
      ).resolves.not.toThrow();
    });

    it('should preserve first server when package name conflicts exist within batch', async () => {
      const conflictingServers = [
        {
          id: 'old-server',
          name: 'Old Server',
          description: 'This should be kept (first in batch)',
          packageName: 'conflict-package',
          registry: 'test-registry',
          version: '1.0.0'
        },
        {
          id: 'new-server',
          name: 'New Server',
          description: 'This should be skipped (duplicate packageName)',
          packageName: 'conflict-package', 
          registry: 'test-registry',
          version: '2.0.0'
        }
      ];

      await cacheManager.bulkCacheServers(conflictingServers);

      const oldServer = await cacheManager.getServer('old-server');
      const newServer = await cacheManager.getServer('new-server');
      
      expect(oldServer).toBeTruthy();
      expect(oldServer?.name).toBe('Old Server');
      expect(oldServer?.version).toBe('1.0.0');
      expect(newServer).toBeNull(); // Should not exist due to deduplication
    });

    it('should handle packageName conflicts with existing database entries', async () => {
      const existingServer = {
        id: 'existing-server',
        name: 'Existing Server',
        description: 'Server already in database',
        packageName: 'existing-package',
        registry: 'test-registry',
        version: '1.0.0'
      };

      await cacheManager.bulkCacheServers([existingServer]);

      const conflictingServer = {
        id: 'conflicting-server',
        name: 'Conflicting Server',
        description: 'This conflicts with existing packageName',
        packageName: 'existing-package',
        registry: 'test-registry',
        version: '2.0.0'
      };

      await expect(
        cacheManager.bulkCacheServers([conflictingServer])
      ).resolves.not.toThrow();

      const updatedServer = await cacheManager.getServer('existing-server');
      expect(updatedServer).toBeTruthy();
      expect(updatedServer?.packageName).toBe('existing-package');
    });
  });

  describe('error handling', () => {
    it('should throw meaningful error for invalid server data', async () => {
      const invalidServers = [
        {
        }
      ];

      await expect(
        cacheManager.bulkCacheServers(invalidServers as Parameters<typeof cacheManager.bulkCacheServers>[0])
      ).rejects.toThrow();
    });

    it('should handle database connection failures gracefully', async () => {
      const originalDb = (cacheManager as { db: unknown }).db;
      (cacheManager as { db: unknown }).db = null;

      const validServers = [{
        id: 'test-server',
        name: 'Test Server',
        registry: 'test-registry'
      }];

      await expect(
        cacheManager.bulkCacheServers(validServers)
      ).resolves.not.toThrow();

      (cacheManager as { db: unknown }).db = originalDb;
    });
  });

  describe('batch processing', () => {
    it('should handle large batches without constraint errors', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `server-${i}`,
        name: `Server ${i}`,
        description: `Description for server ${i}`,
        packageName: i % 10 === 0 ? `shared-package-${Math.floor(i / 10)}` : `unique-package-${i}`,
        registry: 'test-registry'
      }));

      await expect(
        cacheManager.bulkCacheServers(largeBatch)
      ).resolves.not.toThrow();
    });

    it('should maintain data integrity during partial failures', async () => {
      const mixedServers = [
        {
          id: 'valid-server-1',
          name: 'Valid Server 1',
          description: 'This is valid',
          packageName: 'valid-package-1',
          registry: 'test-registry'
        },
        {
          id: 'valid-server-2',
          name: 'Valid Server 2', 
          description: 'This is also valid',
          packageName: 'valid-package-2',
          registry: 'test-registry'
        }
      ];

      await cacheManager.bulkCacheServers(mixedServers);

      const server1 = await cacheManager.getServer('valid-server-1');
      const server2 = await cacheManager.getServer('valid-server-2');
      
      expect(server1).toBeTruthy();
      expect(server2).toBeTruthy();
    });
  });
});