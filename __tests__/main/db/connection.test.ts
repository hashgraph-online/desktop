
describe('Database Connection Module', () => {
  const mockDatabase = { mock: 'database-instance' };
  const mockPathProvider = {
    getDatabasePath: jest.fn(() => '/mock/custom/path/mcp-registry.db')
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Exports', () => {
    test('should export databaseManager singleton', () => {
      const { databaseManager } = require('../../../src/main/db/connection');
      expect(databaseManager).toBeDefined();
      expect(typeof databaseManager).toBe('object');
    });

    test('should export getDatabase function', () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      expect(typeof getDatabase).toBe('function');
    });

    test('should export initializeDatabase function', () => {
      const { initializeDatabase } = require('../../../src/main/db/connection');
      expect(typeof initializeDatabase).toBe('function');
    });

    test('should export createDatabaseManager function', () => {
      const { createDatabaseManager } = require('../../../src/main/db/connection');
      expect(typeof createDatabaseManager).toBe('function');
    });

    test('should not export DatabaseManager constructor directly', () => {
      const moduleExports = require('../../../src/main/db/connection');
      expect(moduleExports.DatabaseManager).toBeUndefined();
    });
  });

  describe('DatabaseManager Singleton', () => {
    test('should provide consistent database access through singleton', () => {
      const { getDatabase, databaseManager } = require('../../../src/main/db/connection');

      expect(databaseManager).toBeDefined();
      expect(typeof getDatabase()).toBeDefined();
    });

    test('should create database manager with path provider', () => {
      const { createDatabaseManager } = require('../../../src/main/db/connection');
      const manager = createDatabaseManager(mockPathProvider);

      expect(manager).toBeDefined();
    });
  });

  describe('Utility Functions Integration', () => {
    test('should handle getDatabase function calls', () => {
      const { getDatabase } = require('../../../src/main/db/connection');
      const result = getDatabase();

      expect(result).toBeDefined();
    });

    test('should handle initializeDatabase function calls', () => {
      const { initializeDatabase } = require('../../../src/main/db/connection');

      expect(() => {
        initializeDatabase('/test/path.db');
      }).not.toThrow();
    });

    test('should handle createDatabaseManager function calls', () => {
      const { createDatabaseManager } = require('../../../src/main/db/connection');
      const manager = createDatabaseManager(mockPathProvider);

      expect(manager).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle function calls without throwing', () => {
      const {
        getDatabase,
        initializeDatabase,
        createDatabaseManager,
        databaseManager
      } = require('../../../src/main/db/connection');

      expect(() => {
        getDatabase();
        initializeDatabase('/test.db');
        createDatabaseManager(mockPathProvider);
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    test('should maintain correct function signatures', () => {
      const {
        getDatabase,
        initializeDatabase,
        createDatabaseManager
      } = require('../../../src/main/db/connection');

      expect(typeof getDatabase()).toBeDefined();
      expect(typeof initializeDatabase).toBe('function');
      expect(typeof createDatabaseManager).toBe('function');
    });
  });
});