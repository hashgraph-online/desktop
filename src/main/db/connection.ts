import type Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import { homedir } from 'node:os';
import { Logger } from '../utils/logger';
import type { DatabasePathProvider } from '../interfaces/services';
import { lt, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname as pathDirname } from 'node:path';

const require = createRequire(import.meta.url);

interface BetterSqlite3LoadResult {
  mod: typeof import('better-sqlite3');
  resolvedFrom: string;
  nativeBindingPath?: string;
}

/**
 * Loads better-sqlite3 at runtime via CommonJS require.
 * Returns null if the module is unavailable so callers can gracefully disable DB features.
 */
/**
 * Attempts to load better-sqlite3 and report the module path and native binding path.
 * Tries Node resolution first, then common packaged locations under resourcesPath.
 */
function loadBetterSqlite3(): BetterSqlite3LoadResult | null {
  try {
    const Module = require('module') as unknown as { globalPaths: string[]; _initPaths: () => void };
    const rp = (process as unknown as { resourcesPath?: string }).resourcesPath;
    const candidates = rp
      ? [
          join(rp, 'app', 'node_modules'),
          join(rp, 'app.asar.unpacked', 'node_modules'),
        ]
      : [];
    let changed = false;
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && !Module.globalPaths.includes(c)) {
          Module.globalPaths.unshift(c);
          changed = true;
        }
      } catch {}
    }
    if (changed && typeof Module._initPaths === 'function') Module._initPaths();
  } catch {}

  const attempt = (target: string): BetterSqlite3LoadResult | null => {
    try {
      const resolved = require.resolve(target);
      const mod = require(target) as typeof import('better-sqlite3');

      let moduleRoot = pathDirname(resolved);
      try {
        const pkgResolved = require.resolve(join(target, 'package.json'));
        moduleRoot = pathDirname(pkgResolved);
      } catch {}

      const bindingCandidates = [
        join(moduleRoot, 'build', 'Release', 'better_sqlite3.node'),
        join(moduleRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'electron', 'napi-v3', 'better_sqlite3.node'),
      ];
      const foundBinding = bindingCandidates.find((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      });
      return { mod, resolvedFrom: resolved, nativeBindingPath: foundBinding };
    } catch {
      return null;
    }
  };

  const direct = attempt('better-sqlite3');
  if (direct) return direct;

  const rp = (process as unknown as { resourcesPath?: string }).resourcesPath;
  if (rp) {
    const candidates = [
      join(rp, 'app', 'node_modules', 'better-sqlite3'),
      join(rp, 'app.asar.unpacked', 'node_modules', 'better-sqlite3'),
    ];
    for (const c of candidates) {
      const mod = attempt(c);
      if (mod) return mod;
    }
  }
  return null;
}

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export type MCPRegistryDatabase = BetterSQLite3Database<typeof schema>;

class DatabaseManager {
  private static instance: DatabaseManager;
  private database: MCPRegistryDatabase | null = null;
  private sqlite: Database.Database | null = null;
  private logger: Logger;
  private pathProvider?: DatabasePathProvider;
  private disabled = false;

  private constructor(pathProvider?: DatabasePathProvider) {
    this.logger = new Logger({ module: 'DatabaseManager' });
    this.pathProvider = pathProvider;
  }

  static getInstance(pathProvider?: DatabasePathProvider): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(pathProvider);
    }
    return DatabaseManager.instance;
  }

  getDatabase(): MCPRegistryDatabase | null {
    if (this.disabled) return null;
    if (!this.database) this.initializeDatabase();
    return this.database;
  }

  initializeDatabaseForTesting(dbPath?: string): void {
    if (this.disabled) return;
    try {
      const path = dbPath || this.getDatabasePath();
      this.ensureDatabaseDirectory(path);
      this.logger.info(`Initializing test database at: ${path}`);

      try {
        const load = loadBetterSqlite3();
        if (!load) {
          this.logger.warn('better-sqlite3 module not found; disabling test database');
          this.database = null;
          this.sqlite = null;
          this.disabled = true;
          return;
        }
        this.logger.info(
          `better-sqlite3 loaded`,
          { modulePath: load.resolvedFrom, nativeBindingPath: load.nativeBindingPath || 'unknown' }
        );
        this.sqlite = new load.mod(path);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (
          msg.includes('Could not locate the bindings file') ||
          msg.includes('ERR_DLOPEN_FAILED') ||
          msg.includes('NODE_MODULE_VERSION') ||
          msg.includes('compiled against a different Node.js version')
        ) {
          this.logger.warn('better-sqlite3 native binding unavailable or ABI mismatch; disabling test database');
          this.database = null;
          this.sqlite = null;
          this.disabled = true;
          return;
        }
        throw error;
      }
      if (!this.sqlite) throw new Error('Failed to create SQLite connection');
      this.applyPragmas();
      this.database = drizzle(this.sqlite, { schema });
      this.runMigrations();
      this.logger.info('Test database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize test database:', error);
      this.database = null;
      this.sqlite = null;
      this.disabled = true;
    }
  }

  private initializeDatabase(): void {
    if (this.disabled) return;
    try {
      const dbPath = this.getDatabasePath();
      this.ensureDatabaseDirectory(dbPath);
      this.logger.info(`Initializing database at: ${dbPath}`);

      try {
        const load = loadBetterSqlite3();
        if (!load) {
          this.logger.warn('better-sqlite3 module not found; disabling database features');
          this.database = null;
          this.sqlite = null;
          this.disabled = true;
          return;
        }
        this.logger.info(
          `better-sqlite3 loaded`,
          { modulePath: load.resolvedFrom, nativeBindingPath: load.nativeBindingPath || 'unknown' }
        );
        this.sqlite = new load.mod(dbPath);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (
          msg.includes('Could not locate the bindings file') ||
          msg.includes('ERR_DLOPEN_FAILED') ||
          msg.includes('NODE_MODULE_VERSION') ||
          msg.includes('compiled against a different Node.js version')
        ) {
          this.logger.warn('better-sqlite3 native binding unavailable or ABI mismatch; disabling database features');
          this.database = null;
          this.sqlite = null;
          this.disabled = true;
          return;
        }
        throw error;
      }
      if (!this.sqlite) throw new Error('Failed to create SQLite connection');
      this.applyPragmas();
      this.database = drizzle(this.sqlite, { schema });
      this.runMigrations();
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      this.database = null;
      this.sqlite = null;
      this.disabled = true;
    }
  }

  private applyPragmas(): void {
    if (!this.sqlite) return;
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('cache_size = 10000');
    this.sqlite.pragma('temp_store = MEMORY');
    this.sqlite.pragma('mmap_size = 268435456');
  }

  /**
   * Resolves a writable database path.
   * 1) Electron app.getPath('userData') when available.
   * 2) Fallback to user config dir: macOS/Linux ~/.config/hashgraph-online, Windows %APPDATA%/HashgraphOnline.
   */
  private getDatabasePath(): string {
    if (this.pathProvider) return this.pathProvider.getDatabasePath();

    try {
      const electron = require('electron') as typeof import('electron');
      if (electron?.app && typeof electron.app.getPath === 'function') {
        const userDataPath = electron.app.getPath('userData');
        this.logger.info(`Using Electron userData path for DB: ${userDataPath}`);
        return join(userDataPath, 'mcp-registry.db');
      }
    } catch {}

    const home = homedir();
    const baseDir = process.platform === 'win32'
      ? (process.env.APPDATA
          ? join(process.env.APPDATA, 'HashgraphOnline')
          : join(home, 'AppData', 'Roaming', 'HashgraphOnline'))
      : join(home, '.config', 'hashgraph-online');

    const fallback = join(baseDir, 'mcp-registry.db');
    this.logger.warn(`Electron app path unavailable; using fallback DB path: ${fallback}`);
    return fallback;
  }

  private ensureDatabaseDirectory(dbPath: string): void {
    const dbDir = dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  }

  private resolveMigrationsFolder(): string | null {
    const candidates = [
      join(currentDir, 'migrations'),
      join(currentDir, '..', 'migrations'),
      join(currentDir, '..', '..', 'migrations'),
      join(process.cwd(), 'src', 'main', 'db', 'migrations'),
      join(process.cwd(), 'desktop', 'src', 'main', 'db', 'migrations'),
      (process as { resourcesPath?: string }).resourcesPath
        ? join((process as { resourcesPath?: string }).resourcesPath, 'migrations')
        : '',
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch {}
    }
    return null;
  }

  private runMigrations(): void {
    const folder = this.resolveMigrationsFolder();
    if (!folder) throw new Error('Migrations not available');
    this.logger.info(`Running migrations via Drizzle from: ${folder}`);

    try {
      this.baselineMigrationsIfNeeded(folder);
    } catch (e) {
      this.logger.warn('Baseline check failed, continuing without baselining:', e);
    }

    migrate(this.database!, { migrationsFolder: folder });
    this.logger.info('Migrations completed successfully');

  }
  

  private baselineMigrationsIfNeeded(migrationsFolder: string): void {
    if (!this.sqlite) return;
    const db = this.sqlite;

    try {
      db.exec(
        'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, hash text NOT NULL, created_at numeric)'
      );

      const row = db.prepare('SELECT COUNT(1) as cnt FROM "__drizzle_migrations"').get() as { cnt?: number } | undefined;
      const appliedCount = Number(row?.cnt || 0);
      if (appliedCount > 0) {
        return; // Already managed by Drizzle
      }

      const tableExists = (name: string): boolean => {
        const r = db
          .prepare(
            'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = ?'
          )
          .get(name) as { name?: string } | undefined;
        return Boolean(r && r.name);
      };
      const columnExists = (table: string, col: string): boolean => {
        try {
          const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
          return cols?.some((c) => String(c?.name).toLowerCase() === col.toLowerCase());
        } catch {
          return false;
        }
      };

      const has0000 = [
        'chat_messages',
        'chat_sessions',
        'mcp_servers',
        'registry_sync',
        'search_cache',
        'server_categories',
        'performance_metrics',
      ].some(tableExists);

      const has0001 = tableExists('entity_associations');
      const has0002 =
        columnExists('mcp_servers', 'package_registry') ||
        columnExists('mcp_servers', 'github_stars');

      if (!has0000 && !has0001 && !has0002) {
        return;
      }

      const journalPath = join(migrationsFolder, 'meta', '_journal.json');
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries: Array<{ tag: string; when: number }>;
      };

      let baselineTag: string | null = null;
      if (has0002) baselineTag = '0002_add_pkg_registry_and_github_stars';
      else if (has0001) baselineTag = '0001_lively_swordsman';
      else if (has0000) baselineTag = '0000_supreme_leader';

      if (!baselineTag) return;

      const entry = journal.entries.find((e) => e.tag === baselineTag);
      if (!entry) return;

      const sqlPath = join(migrationsFolder, `${baselineTag}.sql`);
      let hash = 'baseline';
      try {
        const content = fs.readFileSync(sqlPath, 'utf8');
        hash = createHash('sha256').update(content).digest('hex');
      } catch {}

      db.prepare(
        'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)'
      )
        .run(hash, entry.when);

      this.logger.info(
        `Baseline applied for existing schema -> ${baselineTag} (when=${entry.when})`
      );
    } catch (e) {
      this.logger.warn('Failed to baseline legacy database:', e);
    }
  }

  async cleanupExpiredCache(): Promise<void> {
    try {
      const db = this.getDatabase();
      if (!db) return;
      const result = db
        .delete(schema.searchCache)
        .where(lt(schema.searchCache.expiresAt, new Date()))
        .run();
      if (result.changes > 0)
        this.logger.info(`Cleaned up ${result.changes} expired cache entries`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired cache:', error);
    }
  }

  getStats(): {
    servers: number;
    categories: number;
    cacheEntries: number;
    dbSizeMB: number;
  } {
    try {
      const db = this.getDatabase();
      if (!db)
        return { servers: 0, categories: 0, cacheEntries: 0, dbSizeMB: 0 };
      const servers =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.mcpServers)
          .get()?.count || 0;
      const categories =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.serverCategories)
          .get()?.count || 0;
      const cache =
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.searchCache)
          .get()?.count || 0;
      let size = 0;
      try {
        const stats = fs.statSync(this.getDatabasePath());
        size = Math.round((stats.size / (1024 * 1024)) * 100) / 100;
      } catch {}
      return { servers, categories, cacheEntries: cache, dbSizeMB: size };
    } catch (error) {
      this.logger.error('Failed to get database stats:', error);
      return { servers: 0, categories: 0, cacheEntries: 0, dbSizeMB: 0 };
    }
  }

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

export const databaseManager = DatabaseManager.getInstance();
export const getDatabase = (): MCPRegistryDatabase | null =>
  databaseManager.getDatabase();
export const initializeDatabase = (dbPath?: string): void =>
  databaseManager.initializeDatabaseForTesting(dbPath);
export const createDatabaseManager = (
  pathProvider?: DatabasePathProvider
): DatabaseManager => DatabaseManager.getInstance(pathProvider);
export { schema };
