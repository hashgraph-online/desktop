/**
 * Tests to verify Electron dependencies can be removed/mocked for Node.js testing
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, mkdirSync } from 'node:fs';
import { EntityService } from '../src/main/services/EntityService';
import {
  TestDatabasePathProvider,
  MockMCPServerProvider,
  createMockMCPServer,
} from '../src/main/services/test-implementations';
import { createDatabaseManager } from '../src/main/db/connection';
import { MCPServiceWrapper } from '../src/main/services/mcp-service-wrapper';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { ServiceDependencies } from '../src/main/interfaces/services';

describe('Electron Dependency Removal', () => {
  let testDir: string;
  const logger = new Logger({ module: 'ElectronDependencyTest' });
  let entityService: EntityService;
  let dependencies: ServiceDependencies;

  beforeEach(() => {
    testDir = join(tmpdir(), `hashgraph-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });

    const pathProvider = new TestDatabasePathProvider(testDir);
    const mcpProvider = new MockMCPServerProvider([
      createMockMCPServer({
        id: 'test-filesystem',
        name: 'Test Filesystem',
        type: 'filesystem',
      }),
    ]);

    dependencies = {
      databasePathProvider: pathProvider,
      mcpServerProvider: mcpProvider,
    };

    createDatabaseManager(pathProvider);

    const dbManager = createDatabaseManager(pathProvider);
    dbManager.initializeDatabaseForTesting(pathProvider.getDatabasePath());

    entityService = new EntityService();
  });

  afterEach(() => {
    try {
      if (testDir) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.warn('Failed to clean up test directory', { error });
    }
  });

  describe('Database Operations', () => {
    it('should work without Electron app.getPath()', async () => {
      const result = await entityService.storeEntity(
        '0.0.123456',
        'Test Entity Without Electron',
        'token',
        'tx-test',
        'test-session'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.entityName).toBe('Test Entity Without Electron');

      const entities = await entityService.getEntitiesBySession('test-session');
      expect(entities).toHaveLength(1);
      expect(entities[0].entityName).toBe('Test Entity Without Electron');
    });

    it('should use custom database path provider', () => {
      const pathProvider = dependencies.databasePathProvider!;
      const dbPath = pathProvider.getDatabasePath();
      
      expect(dbPath).toContain(testDir);
      expect(dbPath).toContain('test-mcp-registry.db');
      expect(dbPath).not.toContain('userData'); // Should not use Electron's userData path
    });
  });

  describe('MCP Service Wrapper', () => {
    it('should create wrapper without Electron dependencies', () => {
      const mcpWrapper = new MCPServiceWrapper(dependencies);
      expect(mcpWrapper).toBeDefined();
      expect(mcpWrapper.isTestEnvironment()).toBe(true);
    });

    it('should use mock MCP provider in test environment', async () => {
      const mcpWrapper = new MCPServiceWrapper(dependencies);
      
      const servers = await mcpWrapper.loadServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Test Filesystem');
      expect(servers[0].type).toBe('filesystem');
    });

    it('should handle MCP operations without real MCP service', async () => {
      const mcpWrapper = new MCPServiceWrapper(dependencies);
      
      const servers = await mcpWrapper.loadServers();
      expect(Array.isArray(servers)).toBe(true);

      if (servers.length > 0) {
        const server = await mcpWrapper.getServerById(servers[0].id);
        expect(server).toBeDefined();
        expect(server?.id).toBe(servers[0].id);
      }

      const newServer = createMockMCPServer({
        id: 'new-test-server',
        name: 'New Test Server',
      });
      
      await expect(mcpWrapper.saveServer(newServer)).resolves.toBeUndefined();

      const savedServer = await mcpWrapper.getServerById('new-test-server');
      expect(savedServer).toBeDefined();
      expect(savedServer?.name).toBe('New Test Server');
    });
  });

  describe('Service Dependencies Interface', () => {
    it('should support dependency injection pattern', () => {
      expect(dependencies.databasePathProvider).toBeDefined();
      expect(dependencies.mcpServerProvider).toBeDefined();

      const dbPath = dependencies.databasePathProvider!.getDatabasePath();
      expect(typeof dbPath).toBe('string');
      expect(dbPath.length).toBeGreaterThan(0);
    });

    it('should allow optional dependencies', () => {
      const emptyDeps: ServiceDependencies = {};
      expect(emptyDeps.databasePathProvider).toBeUndefined();
      expect(emptyDeps.mcpServerProvider).toBeUndefined();
    });
  });

  describe('Database Path Provider Implementations', () => {
    it('should use test paths that do not require Electron', () => {
      const testProvider = new TestDatabasePathProvider();
      const path = testProvider.getDatabasePath();
      
      expect(path).toContain('hashgraph-online-test');
      expect(path).not.toContain('Electron');
      expect(path).not.toContain('userData');
    });

    it('should allow custom test directories', () => {
      const customDir = '/tmp/custom-test-dir';
      const customProvider = new TestDatabasePathProvider(customDir);
      const path = customProvider.getDatabasePath();
      
      expect(path).toContain(customDir);
      expect(path).toContain('test-mcp-registry.db');
    });
  });

  describe('Mock MCP Server Provider', () => {
    it('should manage mock servers in memory', async () => {
      const mockProvider = new MockMCPServerProvider();
      expect(await mockProvider.loadServers()).toHaveLength(0);

      const server = createMockMCPServer();
      await mockProvider.saveServer(server);
      
      const servers = await mockProvider.loadServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(server.id);
    });

    it('should support CRUD operations on mock servers', async () => {
      const mockProvider = new MockMCPServerProvider();
      
      const server1 = createMockMCPServer({ id: 'server-1', name: 'Server 1' });
      const server2 = createMockMCPServer({ id: 'server-2', name: 'Server 2' });
      
      await mockProvider.saveServer(server1);
      await mockProvider.saveServer(server2);
      
      expect(await mockProvider.loadServers()).toHaveLength(2);
      
      const retrieved = await mockProvider.getServerById('server-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Server 1');
      
      const updatedServer = { ...server1, name: 'Updated Server 1' };
      await mockProvider.saveServer(updatedServer);
      
      const updated = await mockProvider.getServerById('server-1');
      expect(updated?.name).toBe('Updated Server 1');
      
      await mockProvider.deleteServer('server-1');
      expect(await mockProvider.loadServers()).toHaveLength(1);
      expect(await mockProvider.getServerById('server-1')).toBeNull();
    });
  });

  describe('Entity Persistence Without Electron', () => {
    it('should simulate complete NFT workflow without Electron', async () => {
      const sessionId = 'electron-free-nft-session';
      
      const tokenResult = await entityService.storeEntity(
        '0.0.9999991',
        'Electron-Free Collection',
        'token',
        'tx-create-nft-collection',
        sessionId
      );
      expect(tokenResult.success).toBe(true);
      
      const topicResult = await entityService.storeEntity(
        '0.0.9999992',
        'Electron-Free NFT #1',
        'topic',
        'tx-inscribe-image', 
        sessionId
      );
      expect(topicResult.success).toBe(true);
      
      const sessionEntities = await entityService.getEntitiesBySession(sessionId);
      expect(sessionEntities).toHaveLength(2);
      
      const searchResults = await entityService.searchEntitiesInSession(
        sessionId,
        'Electron-Free NFT #1'  
      );
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].entityType).toBe('topic');
      expect(searchResults[0].entityId).toBe('0.0.9999992');
      
      await entityService.storeEntity(
        '0.0.8888881',
        'Different Session NFT',
        'topic',
        'tx-other',
        'other-session'
      );
      
      const originalSessionEntities = await entityService.getEntitiesBySession(sessionId);
      expect(originalSessionEntities).toHaveLength(2); // Should still be 2, not 3
    });
  });
});