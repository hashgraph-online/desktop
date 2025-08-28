/**
 * Tests to verify AgentService can run without Electron dependencies
 * This ensures we can write real end-to-end tests that actually create entities
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, mkdirSync } from 'node:fs';
import { AgentService } from "./agent-service";
import { EntityService } from '../src/main/services/EntityService';
import {
  TestDatabasePathProvider,
  MockMCPServerProvider,
  createMockMCPServer,
} from '../src/main/services/test-implementations';
import { createDatabaseManager } from '../src/main/db/connection';
import type { ServiceDependencies } from '../src/main/interfaces/services';

describe('AgentService Electron Independence', () => {
  let testDir: string;
  let agentService: AgentService;
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
    agentService = AgentService.createTestInstance(dependencies);
  });

  afterEach(() => {
    try {
      if (testDir) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (_error) {
    }
  });

  describe('Service Instantiation', () => {
    it('should create AgentService without Electron dependencies', () => {
      expect(agentService).toBeInstanceOf(AgentService);
    });

    it('should create EntityService without Electron dependencies', () => {
      expect(entityService).toBeInstanceOf(EntityService);
    });

    it('should be able to import AgentService in Node.js environment', async () => {
      const { AgentService: ImportedAgentService } = await import(
        '../desktop/src/main/services/AgentService'
      );
      expect(ImportedAgentService).toBeDefined();
    });
  });

  describe('Entity Operations', () => {
    it('should store and retrieve entities without Electron', async () => {
      const entityId = '0.0.123456';
      const entityName = 'Test NFT Collection';
      const entityType = 'token';
      const sessionId = 'test-session-1';

      const result = await entityService.storeEntity(
        entityId,
        entityName,
        entityType,
        undefined,
        sessionId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.entityId).toBe(entityId);
      expect(result.data?.entityName).toBe(entityName);

      const entities = await entityService.getEntitiesBySession(sessionId);
      expect(entities).toHaveLength(1);
      expect(entities[0].entityId).toBe(entityId);
      expect(entities[0].entityName).toBe(entityName);
    });

    it('should handle multiple entities in different sessions', async () => {
      await entityService.storeEntity(
        '0.0.111111',
        'Session 1 NFT',
        'token',
        undefined,
        'session-1'
      );

      await entityService.storeEntity(
        '0.0.222222', 
        'Session 2 NFT',
        'token',
        undefined,
        'session-2'
      );

      const session1Entities = await entityService.getEntitiesBySession('session-1');
      const session2Entities = await entityService.getEntitiesBySession('session-2');

      expect(session1Entities).toHaveLength(1);
      expect(session1Entities[0].entityName).toBe('Session 1 NFT');

      expect(session2Entities).toHaveLength(1); 
      expect(session2Entities[0].entityName).toBe('Session 2 NFT');
    });
  });

  describe('MCP Service Integration', () => {
    it('should use mock MCP provider in test environment', async () => {
      const mcpWrapper = (agentService as { mcpServiceWrapper: { isTestEnvironment: () => boolean; loadServers: () => Promise<unknown[]> } }).mcpServiceWrapper;
      expect(mcpWrapper.isTestEnvironment()).toBe(true);

      const servers = await mcpWrapper.loadServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Test Filesystem');
    });

    it('should handle MCP operations without Electron', async () => {
      const mcpWrapper = (agentService as { mcpServiceWrapper: { isTestEnvironment: () => boolean; loadServers: () => Promise<unknown[]> } }).mcpServiceWrapper;
      
      const servers = await mcpWrapper.loadServers();
      expect(Array.isArray(servers)).toBe(true);

      if (servers.length > 0) {
        const server = await mcpWrapper.getServerById(servers[0].id);
        expect(server).toBeDefined();
        expect(server?.id).toBe(servers[0].id);
      }
    });
  });

  describe('Real End-to-End Workflow Simulation', () => {
    it('should simulate NFT collection creation and inscription workflow', async () => {
      const sessionId = 'nft-workflow-session';

      const tokenResult = await entityService.storeEntity(
        '0.0.6624881',
        'Forever Collection',
        'token',
        'tx-create-collection',
        sessionId
      );
      expect(tokenResult.success).toBe(true);

      const topicResult = await entityService.storeEntity(
        '0.0.6624888',
        'Forever #1',
        'topic', 
        'tx-inscribe-image',
        sessionId
      );
      expect(topicResult.success).toBe(true);

      const entities = await entityService.getEntitiesBySession(sessionId);
      expect(entities).toHaveLength(2);

      const tokenEntity = entities.find(e => e.entityType === 'token');
      const topicEntity = entities.find(e => e.entityType === 'topic');

      expect(tokenEntity).toBeDefined();
      expect(tokenEntity?.entityName).toBe('Forever Collection');
      expect(tokenEntity?.entityId).toBe('0.0.6624881');

      expect(topicEntity).toBeDefined();
      expect(topicEntity?.entityName).toBe('Forever #1');
      expect(topicEntity?.entityId).toBe('0.0.6624888');

      const searchResults = await entityService.searchEntitiesInSession(
        sessionId,
        'Forever #1'
      );
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].entityName).toBe('Forever #1');
      expect(searchResults[0].entityType).toBe('topic');
    });

    it('should handle entity resolution without cross-session contamination', async () => {
      await entityService.storeEntity(
        '0.0.111111',
        'Forever #1',
        'topic',
        'tx-1',
        'session-old'
      );

      await entityService.storeEntity(
        '0.0.222222', 
        'Forever #1',
        'topic',
        'tx-2',
        'session-current'
      );

      const currentResults = await entityService.searchEntitiesInSession(
        'session-current',
        'Forever #1'
      );
      expect(currentResults).toHaveLength(1);
      expect(currentResults[0].entityId).toBe('0.0.222222');

      const oldResults = await entityService.searchEntitiesInSession(
        'session-old', 
        'Forever #1'
      );
      expect(oldResults).toHaveLength(1);
      expect(oldResults[0].entityId).toBe('0.0.111111');
    });
  });

  describe('Database Operations', () => {
    it('should use custom database path in test environment', async () => {
      const pathProvider = dependencies.databasePathProvider!;
      const dbPath = pathProvider.getDatabasePath();
      
      expect(dbPath).toContain(testDir);
      expect(dbPath).toContain('test-mcp-registry.db');
    });

    it('should perform database operations without app.getPath', async () => {
      const result = await entityService.storeEntity(
        '0.0.999999',
        'Database Test Entity', 
        'token',
        undefined,
        'db-test-session'
      );

      expect(result.success).toBe(true);
      
      const entities = await entityService.getEntitiesBySession('db-test-session');
      expect(entities).toHaveLength(1);
      expect(entities[0].entityName).toBe('Database Test Entity');
    });
  });
});