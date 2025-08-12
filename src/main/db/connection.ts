import Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import { app } from 'electron';
import { Logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export type MCPRegistryDatabase = BetterSQLite3Database<typeof schema>;

class DatabaseManager {
  private static instance: DatabaseManager;
  private database: MCPRegistryDatabase | null = null;
  private sqlite: Database.Database | null = null;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger({ module: 'DatabaseManager' });
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get database connection, creating it if necessary
   */
  getDatabase(): MCPRegistryDatabase | null {
    if (!this.database) {
      this.initializeDatabase();
    }
    return this.database;
  }

  /**
   * Initialize database connection and run migrations
   */
  private initializeDatabase(): void {
    try {
      const dbPath = this.getDatabasePath();
      this.ensureDatabaseDirectory(dbPath);

      this.logger.info(`Initializing database at: ${dbPath}`);

      this.sqlite = new Database(dbPath);

      if (!this.sqlite) {
        throw new Error('Failed to create SQLite connection');
      }

      this.sqlite.pragma('journal_mode = WAL');
      this.sqlite.pragma('synchronous = NORMAL');
      this.sqlite.pragma('cache_size = 10000');
      this.sqlite.pragma('temp_store = MEMORY');
      this.sqlite.pragma('mmap_size = 268435456');
      this.database = drizzle(this.sqlite, { schema });

      this.runMigrations();

      this.initializeRegistrySync();

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      this.database = null;
      this.sqlite = null;
    }
  }

  /**
   * Get the appropriate database file path
   */
  private getDatabasePath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'mcp-registry.db');
  }

  /**
   * Ensure database directory exists
   */
  private ensureDatabaseDirectory(dbPath: string): void {
    const dbDir = dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    try {
      const migrationsFolder = join(currentDir, 'migrations');

      if (!fs.existsSync(migrationsFolder)) {
        fs.mkdirSync(migrationsFolder, { recursive: true });
        this.logger.info('Created migrations directory');
      }

      const migrationFiles = fs
        .readdirSync(migrationsFolder)
        .filter((f) => f.endsWith('.sql'));

      if (migrationFiles.length > 0 && this.database) {
        this.logger.info(`Running ${migrationFiles.length} migrations...`);
        migrate(this.database, { migrationsFolder });
        this.logger.info('Migrations completed successfully');
      } else {
        this.createInitialSchema();
      }
    } catch (error) {
      this.logger.error('Migration failed:', error);
      this.createInitialSchema();
    }
  }

  /**
   * Create initial schema for new installations
   */
  private createInitialSchema(): void {
    try {
      this.logger.info('Creating initial database schema...');

      const createTablesSQL = `
        CREATE TABLE IF NOT EXISTS mcp_servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          author TEXT,
          version TEXT,
          url TEXT,
          package_name TEXT,
          repository_type TEXT,
          repository_url TEXT,
          config_command TEXT,
          config_args TEXT,
          config_env TEXT,
          tags TEXT,
          license TEXT,
          created_at TEXT,
          updated_at TEXT,
          install_count INTEGER DEFAULT 0,
          rating REAL,
          registry TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          last_fetched INTEGER DEFAULT (unixepoch()),
          search_vector TEXT
        );

        CREATE TABLE IF NOT EXISTS server_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id TEXT NOT NULL,
          category TEXT NOT NULL,
          confidence REAL DEFAULT 1.0,
          source TEXT DEFAULT 'manual',
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (server_id) REFERENCES mcp_servers (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS search_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_hash TEXT NOT NULL UNIQUE,
          query_text TEXT,
          tags TEXT,
          category TEXT,
          search_offset INTEGER DEFAULT 0,
          page_limit INTEGER DEFAULT 50,
          result_ids TEXT NOT NULL,
          total_count INTEGER NOT NULL,
          has_more INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          hit_count INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS registry_sync (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          registry TEXT NOT NULL UNIQUE,
          last_sync_at INTEGER,
          last_success_at INTEGER,
          server_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          sync_duration_ms INTEGER,
          next_sync_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          cache_hit INTEGER DEFAULT 0,
          result_count INTEGER,
          error_count INTEGER DEFAULT 0,
          memory_usage_mb REAL,
          timestamp INTEGER DEFAULT (unixepoch())
        );
      `;

      const createIndexesSQL = `
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers (name);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_author ON mcp_servers (author);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_registry ON mcp_servers (registry);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_install_count ON mcp_servers (install_count);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_rating ON mcp_servers (rating);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_last_fetched ON mcp_servers (last_fetched);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_active ON mcp_servers (is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_servers_package_name ON mcp_servers (package_name);

        CREATE INDEX IF NOT EXISTS idx_server_categories_server_category ON server_categories (server_id, category);
        CREATE INDEX IF NOT EXISTS idx_server_categories_category ON server_categories (category);
        CREATE INDEX IF NOT EXISTS idx_server_categories_confidence ON server_categories (confidence);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_search_cache_query_hash ON search_cache (query_hash);
        CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache (expires_at);
        CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON search_cache (created_at);
        CREATE INDEX IF NOT EXISTS idx_search_cache_hit_count ON search_cache (hit_count);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_sync_registry ON registry_sync (registry);
        CREATE INDEX IF NOT EXISTS idx_registry_sync_last_sync ON registry_sync (last_sync_at);
        CREATE INDEX IF NOT EXISTS idx_registry_sync_status ON registry_sync (status);
        CREATE INDEX IF NOT EXISTS idx_registry_sync_next_sync ON registry_sync (next_sync_at);

        CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics (operation);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics (timestamp);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_duration ON performance_metrics (duration_ms);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_cache_hit ON performance_metrics (cache_hit);
      `;

      this.sqlite!.exec(createTablesSQL);
      this.sqlite!.exec(createIndexesSQL);

      this.logger.info('Initial schema created successfully');
    } catch (error) {
      this.logger.error('Failed to create initial schema:', error);
      throw error;
    }
  }

  /**
   * Initialize registry sync records
   */
  private initializeRegistrySync(): void {
    try {
      const registries = ['pulsemcp', 'official', 'smithery'];
      const db = this.getDatabase();

      if (!db) {
        this.logger.warn(
          'Database not available - skipping registry sync initialization'
        );
        return;
      }

      for (const registry of registries) {
        const existing = db
          .select()
          .from(schema.registrySync)
          .where(eq(schema.registrySync.registry, registry))
          .get();

        if (!existing) {
          db.insert(schema.registrySync)
            .values({
              registry,
              status: 'pending' as const,
              nextSyncAt: new Date(Date.now() + 60000),
            } as any)
            .run();
        }
      }

      this.logger.info('Registry sync records initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize registry sync records:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      const db = this.getDatabase();
      if (!db) return;

      const result = db
        .delete(schema.searchCache)
        .where(lt(schema.searchCache.expiresAt, new Date()))
        .run();

      if (result.changes > 0) {
        this.logger.info(`Cleaned up ${result.changes} expired cache entries`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired cache:', error);
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    servers: number;
    categories: number;
    cacheEntries: number;
    dbSizeMB: number;
  } {
    try {
      const db = this.getDatabase();
      if (!db) {
        return { servers: 0, categories: 0, cacheEntries: 0, dbSizeMB: 0 };
      }

      const serversCount =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.mcpServers)
          .get()?.count || 0;

      const categoriesCount =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.serverCategories)
          .get()?.count || 0;

      const cacheCount =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.searchCache)
          .get()?.count || 0;

      const dbPath = this.getDatabasePath();
      let dbSizeMB = 0;
      try {
        const stats = fs.statSync(dbPath);
        dbSizeMB = Math.round((stats.size / (1024 * 1024)) * 100) / 100;
      } catch (error) {
        this.logger.warn('Failed to get database file size:', error);
      }

      return {
        servers: serversCount,
        categories: categoriesCount,
        cacheEntries: cacheCount,
        dbSizeMB,
      };
    } catch (error) {
      this.logger.error('Failed to get database stats:', error);
      return { servers: 0, categories: 0, cacheEntries: 0, dbSizeMB: 0 };
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      if (this.sqlite) {
        this.sqlite.close();
        this.sqlite = null;
        this.database = null;
        this.logger.info('Database connection closed');
      }
    } catch (error) {
      this.logger.error('Failed to close database:', error);
    }
  }
}

import { eq, lt, sql } from 'drizzle-orm';

export const databaseManager = DatabaseManager.getInstance();
export const getDatabase = (): MCPRegistryDatabase | null =>
  databaseManager.getDatabase();
export { schema };
