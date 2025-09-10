import { Logger } from '../utils/logger';
import { MCPServerConfig } from './mcp-service';
import type { MCPCustomConfig } from './mcp-service';
import { MCPCacheManager, type MCPServerInput } from './mcp-cache-manager';
import type { MCPServer } from '../db/schema';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { MCPMetricsEnricher } from './mcp-metrics-enricher';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export interface MCPRegistryServer {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  url?: string;
  packageRegistry?: string;
  packageName?: string;
  repository?: {
    type: string;
    url: string;
  };
  config?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  tags?: string[];
  license?: string;
  createdAt?: string;
  updatedAt?: string;
  installCount?: number;
  rating?: number;
  githubStars?: number;
  tools?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface MCPRegistryResponse {
  servers: MCPRegistryServer[];
  total?: number;
  cursor?: string;
  hasMore?: boolean;
}

export interface MCPRegistrySearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  tags?: string[];
  author?: string;
}

interface RawRegistryServer {
  id?: string;
  name: string;
  description?: string;
  short_description?: string;
  author?: string;
  version?: string;
  url?: string;
  source_code_url?: string;
  package_registry?: string;
  package_name?: string;
  packageName?: string;
  github_stars?: number;
  repository?:
    | {
        type: string;
        url: string;
      }
    | string;
  config?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  tags?: string[];
  license?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  install_count?: number;
  installCount?: number;
  rating?: number;
  tools?: Array<{
    name: string;
    description?: string;
  }>;
  keywords?: string[];
  downloads?: number;
  capabilities?: {
    tools?: Array<{
      name: string;
      description?: string;
    }>;
  };
}

interface MCPCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  lastCleanup?: Date;
  oldestEntry?: Date;
  newestEntry?: Date;
}

/**
 * Service for discovering MCP servers from various registries
 */
export class MCPRegistryService {
  private static instance: MCPRegistryService;
  private logger: Logger;
  private cacheManager!: MCPCacheManager;
  private backgroundSyncActive = false;
  private readonly REGISTRY_SYNC_INTERVAL = 60 * 60 * 1000;
  private readonly BACKGROUND_BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;
  private providerBudgets: Record<string, { dailyLimit: number; consumed: number; resetAt: number }> = {
    pulsemcp: { dailyLimit: 2000, consumed: 0, resetAt: 0 },
    glama: { dailyLimit: 1500, consumed: 0, resetAt: 0 },
  };

  
  private constructor() {
    this.logger = new Logger({ module: 'MCPRegistryService' });
    try {
      this.cacheManager = MCPCacheManager.getInstance();
      this.initializeBackgroundSync();
    } catch (error) {
      this.logger.error('Failed to initialize cache manager:', error);
      this.logger.warn('MCPRegistryService will operate without caching');
    }
  }

  /**
   * Simple per-day token bucket for provider calls
   */
  private tryConsume(provider: 'pulsemcp' | 'glama', tokens = 1): boolean {
    const now = Date.now();
    const b = this.providerBudgets[provider];
    if (now > b.resetAt) {
      const d = new Date();
      const reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
      b.consumed = 0;
      b.resetAt = reset;
    }
    if (b.consumed + tokens > b.dailyLimit) return false;
    b.consumed += tokens;
    return true;
  }

  /**
   * Normalize GitHub references to canonical https URLs
   */
  private normalizeGithubUrl(input?: string | null): string | null {
    if (!input) return null;
    const stripGit = (s: string) => s.replace(/\.git$/i, '');
    const raw = String(input).trim();
    if (raw.startsWith('github:')) {
      const part = raw.slice('github:'.length);
      const m = part.match(/^([^/]+)\/([^/]+)$/);
      if (m) return `https://github.com/${m[1]}/${stripGit(m[2])}`;
    }
    if (raw.startsWith('git@github.com:')) {
      const part = raw.slice('git@github.com:'.length);
      const m = part.match(/^([^/]+)\/([^/]+)$/);
      if (m) return `https://github.com/${m[1]}/${stripGit(m[2])}`;
    }
    const cleaned = raw.replace(/^git\+/, '');
    try {
      const u = new URL(cleaned);
      if (/github\.com$/i.test(u.hostname)) {
        const segs = u.pathname.replace(/^\//, '').split('/');
        if (segs.length >= 2) return `https://github.com/${segs[0]}/${stripGit(segs[1])}`;
      }
    } catch {}
    const m2 = raw.match(/^([^/]+)\/([^/]+)$/);
    if (m2) return `https://github.com/${m2[1]}/${stripGit(m2[2])}`;
    return null;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPRegistryService {
    if (!MCPRegistryService.instance) {
      MCPRegistryService.instance = new MCPRegistryService();
    }
    return MCPRegistryService.instance;
  }

  /**
   * Execute function with retry and exponential backoff
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operation} failed on attempt ${attempt}:`, error);

        if (attempt === this.MAX_RETRIES) {
          this.logger.error(
            `${operation} failed after ${this.MAX_RETRIES} attempts`
          );
          throw lastError;
        }

        const delay = this.BASE_DELAY * Math.pow(2, attempt - 1);
        this.logger.info(
          `Retrying ${operation} in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Load fallback servers from static data
   */
  private async loadFallbackServers(): Promise<MCPRegistryServer[]> {
    try {
      const fallbackPath = path.join(
        currentDir,
        '../../renderer/data/popularMCPServers.json'
      );

      if (!fs.existsSync(fallbackPath)) {
        this.logger.warn('Fallback server data not found at:', fallbackPath);
        return [];
      }

      const fallbackData = fs.readFileSync(fallbackPath, 'utf-8');
      const data = JSON.parse(fallbackData);

      if (!data.servers || !Array.isArray(data.servers)) {
        this.logger.warn('Invalid fallback data structure');
        return [];
      }

      const fallbackServers = data.servers.map((server: RawRegistryServer) => {
        return {
          id: server.id || server.name,
          name: server.name,
          description: server.description || '',
          packageName: server.package_name,
          repository:
            server.repository && typeof server.repository === 'object'
              ? { type: 'git', url: server.repository.url }
              : undefined,
          config: server.config,
          tags: server.tags || [],
          installCount: server.install_count || 0,
          tools: server.tools,
        } as MCPRegistryServer;
      });

      this.logger.info(
        `Loaded ${fallbackServers.length} servers from fallback data`
      );
      return fallbackServers;
    } catch (error) {
      this.logger.error('Failed to load fallback servers:', error);
      return [];
    }
  }

  /**
   * Extract package name from npm install command
   */
  private extractPackageFromCommand(command: string): string | undefined {
    if (command.includes('npm install -g')) {
      const parts = command.split(' ');
      const packageIndex = parts.findIndex((part) => part === '-g') + 1;
      return parts[packageIndex];
    }
    return undefined;
  }

  /**
   * Search for MCP servers with intelligent caching
   */
  async searchServers(
    options: MCPRegistrySearchOptions = {}
  ): Promise<MCPRegistryResponse> {
    try {
      this.logger.info('Searching MCP registries with options:', options);

      if (this.cacheManager) {
        const cacheOptions = {
          query: options.query,
          tags: options.tags,
          author: options.author,
          limit: options.limit || 50,
          offset: options.offset || 0,
          sortBy: 'githubStars' as const,
          sortOrder: 'desc' as const,
        };

        try {
          const cacheResult =
            await this.cacheManager.searchServers(cacheOptions);

          if (cacheResult.servers.length > 0) {
            const convertedServers = cacheResult.servers.map(
              this.convertFromCachedServer
            );
            const installableServers = convertedServers.filter((server) =>
              this.isServerInstallable(server)
            );
            const cachedSorted = this.sortServers(installableServers);

            if ((cacheResult as { staleness?: string }).staleness === 'stale') {
              try {
                this.triggerBackgroundSync();
              } catch {}
            }

            try {
              const api = await Promise.race([
                this.searchPulseMCP({
                  query: options.query,
                  limit: cacheOptions.limit,
                  offset: cacheOptions.offset,
                }),
                new Promise<never>((_, rej) =>
                  setTimeout(() => rej(new Error('API timeout')), 2000)
                ),
              ]);

              if (api && api.servers) {
                const apiInstallable = api.servers.filter((s) =>
                  this.isServerInstallable(s)
                );
                const merged = this.deduplicateServers([
                  ...apiInstallable,
                  ...cachedSorted,
                ]);
                const mergedSorted = this.sortServers(merged);
                const cacheServers = apiInstallable.map((s) =>
                  this.convertToCachedServer(s, 'pulsemcp')
                );
                this.cacheManager
                  .bulkCacheServers(cacheServers)
                  .catch(() => {});

                this.logger.info(
                  `Using cached+API results: ${mergedSorted.length} servers (apiTotal=${api.total}, hasMore=${api.hasMore})`
                );
                return {
                  servers: mergedSorted.slice(0, cacheOptions.limit),
                  total: api.total || mergedSorted.length,
                  hasMore: api.hasMore || false,
                };
              }
            } catch {}

            this.logger.info(
              `Using cached results: Found ${cachedSorted.length} installable servers (filtered from ${cacheResult.servers.length}, fromCache: ${cacheResult.fromCache}, total: ${cacheResult.total}, ${cacheResult.queryTime}ms)`
            );
            return {
              servers: cachedSorted,
              total: cacheResult.total,
              hasMore: cacheResult.hasMore,
            };
          }

          this.logger.info(
            `Cache returned no results - serverCount: ${cacheResult.servers.length}, total: ${cacheResult.total}, proceeding to fresh search`
          );

          this.triggerBackgroundSync();
        } catch (cacheError) {
          this.logger.warn(
            'Cache search failed, falling back to direct API:',
            cacheError
          );
        }
      }

      this.logger.info('Performing fresh registry search...');
      try {
        const isInitialCatalog =
          !options.query &&
          (!options.tags || options.tags.length === 0) &&
          (options.offset || 0) === 0;

        if (isInitialCatalog) {
          const limit = options.limit || 50;
          const pages = this.tryConsume('pulsemcp', 4) ? [0, 50, 100, 150] : [0];

          this.logger.info(
            `Initial catalog: fetching multiple pages concurrently for global sort (offsets=${pages.length})`
          );

          const batchPromises = pages.map((off) =>
            this.searchPulseMCP({ ...options, offset: off, limit })
          );

          const batchResults = await Promise.allSettled(batchPromises);

          const collected: MCPRegistryServer[] = [];
          let totalCount = 0;
          let hasMoreAny = false;
          for (const r of batchResults) {
            if (r.status === 'fulfilled' && r.value) {
              collected.push(...(r.value.servers || []));
              totalCount = Math.max(totalCount, Number(r.value.total || 0));
              hasMoreAny = hasMoreAny || Boolean(r.value.hasMore);
            }
          }

          const unique = this.deduplicateServers(collected);
          const filtered = this.filterServers(unique, options);
          let sorted = this.sortServers(filtered, options.query);

          if (sorted.length === 0) {
            try {
              const gCollected: MCPRegistryServer[] = [];
              let gCursor: string | undefined = undefined;
              for (let i = 0; i < 4; i++) {
                const g = await this.searchGlama({ limit, cursor: gCursor });
                if (g.servers?.length) gCollected.push(...g.servers);
                if (!g.hasMore || !g.cursor) break;
                gCursor = g.cursor;
              }
              const gUnique = this.deduplicateServers(gCollected);
              sorted = this.sortServers(gUnique, options.query);
              this.logger.info(`Initial catalog: Glama fallback yielded ${sorted.length} servers (paged)`);
            } catch (e) {
              this.logger.warn('Initial catalog: Glama fallback failed:', e);
            }
          }

          try {
            const cacheServers = sorted.map((s) =>
              this.convertToCachedServer(s, 'pulsemcp')
            );
            await this.cacheManager.bulkCacheServers(cacheServers);
          } catch {}

          const slice = sorted.slice(0, limit);
          this.logger.info(
            `Fresh search (multi-page) completed: ${slice.length} servers (collected=${sorted.length}, total=${totalCount}, hasMore=${hasMoreAny})`
          );
          return {
            servers: slice,
            total: totalCount || sorted.length,
            hasMore: hasMoreAny,
          };
        }

        let freshResults: MCPRegistryResponse;
        try {
          freshResults = await this.executeWithRetry(
            () => this.searchRegistriesWithTimeout(options, 5000),
            'Registry search'
          );
        } catch (pulseErr) {
          this.logger.warn('Pulse search failed or limited, trying Glama:', pulseErr);
          freshResults = await this.searchGlama(options);
        }
        this.logger.info(
          `Fresh search completed: ${freshResults.servers.length} servers, total: ${freshResults.total}, hasMore: ${freshResults.hasMore}`
        );
        return freshResults;
      } catch (apiError) {
        this.logger.warn(
          'API search failed, falling back to static data:',
          apiError
        );

        const fallbackServers = await this.loadFallbackServers();
        const filteredServers = this.filterServers(fallbackServers, options);
        const sortedServers = this.sortServers(filteredServers, options.query);

        return {
          servers: sortedServers,
          total: sortedServers.length,
          hasMore: false,
        };
      }
    } catch (error) {
      this.logger.error('Failed to search MCP registries:', error);
      return { servers: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(
    serverId: string,
    packageName?: string
  ): Promise<MCPRegistryServer | null> {
    try {
      this.logger.info(
        `Getting server details for: ${serverId}, packageName: ${packageName}`
      );

      const effectivePackageName = packageName || serverId;

      const detailPromises = [
        this.getServerDetailsFromPulseMCP(serverId, effectivePackageName),
      ];

      const results = await Promise.allSettled(detailPromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const source = ['PulseMCP', 'Official Registry', 'Smithery'][i];
        if (result.status === 'fulfilled' && result.value) {
          this.logger.info(`Found server details from ${source}`);
          return result.value;
        } else if (result.status === 'rejected') {
          this.logger.debug(`${source} failed:`, result.reason);
        }
      }

      this.logger.warn(
        `No details found for server: ${serverId} (packageName: ${packageName}, effectivePackageName: ${effectivePackageName})`
      );
      return null;
    } catch (error) {
      this.logger.error(`Failed to get server details for ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Check if a server can be installed
   */
  isServerInstallable(registryServer: MCPRegistryServer): boolean {
    const hasCommand = !!registryServer.config?.command;
    const hasGitHub = !!this.normalizeGithubUrl(registryServer.repository?.url);
    const hasNpmPackage =
      registryServer.packageRegistry === 'npm' &&
      !!registryServer.packageName &&
      this.isValidNpmPackageName(registryServer.packageName);
    const hasPyPiPackage =
      registryServer.packageRegistry === 'pypi' && !!registryServer.packageName;

    if (hasCommand || hasGitHub) {
      return true;
    }

    if (hasNpmPackage || hasPyPiPackage) {
      return true;
    }

    return false;
  }

  /**
   * Convert registry server to MCP server config for installation
   */
  convertToMCPConfig(
    registryServer: MCPRegistryServer
  ): Partial<MCPServerConfig> {
    const config: Partial<MCPServerConfig> = {
      name: registryServer.name,
      type: 'custom',
      enabled: true,
      config: {
        type: 'custom' as const,
        command: 'npx',
        args: [],
      },
    };

    if (registryServer.config?.command) {
      const customConfig = config.config as MCPCustomConfig;
      customConfig.command = registryServer.config.command;
      customConfig.args = registryServer.config.args || [];
      customConfig.env = registryServer.config.env || {};
    } else if (
      registryServer.packageRegistry === 'npm' &&
      registryServer.packageName &&
      this.isValidNpmPackageName(registryServer.packageName)
    ) {
      const customConfig = config.config as MCPCustomConfig;
      customConfig.command = 'npx';
      customConfig.args = ['-y', registryServer.packageName];
      customConfig.env = registryServer.config?.env || {};
    } else if (
      registryServer.packageRegistry === 'pypi' &&
      registryServer.packageName
    ) {
      const customConfig = config.config as MCPCustomConfig;
      customConfig.command = 'uvx';
      customConfig.args = [registryServer.packageName];
      customConfig.env = registryServer.config?.env || {};
    } else if (registryServer.repository?.url) {
      const normalized = this.normalizeGithubUrl(registryServer.repository.url);
      if (normalized) {
        const repoMatch = normalized.match(/github\.com\/([^/]+\/[^/]+)/);
        if (repoMatch) {
          const customConfig = config.config as MCPCustomConfig;
          customConfig.command = 'npx';
          customConfig.args = ['-y', `github:${repoMatch[1]}`];
        }
      }
    } else {
      this.logger.warn(
        `Server "${registryServer.name}" has no installable configuration (no packageName, command, or repository)`
      );
      const customConfig = config.config as MCPCustomConfig;
      customConfig.command = 'echo';
      customConfig.args = [
        'Server configuration incomplete - missing package information',
      ];
    }

    if (registryServer.description) {
      config.description = registryServer.description;
    }

    return config;
  }

  private async searchPulseMCP(
    options: MCPRegistrySearchOptions
  ): Promise<MCPRegistryResponse> {
    const baseUrl = 'https://api.pulsemcp.com/v0beta';
    const params = new URLSearchParams();

    if (options.query) params.append('query', options.query);

    const limit = options.limit || 50;
    params.append('count_per_page', limit.toString());

    if (options.offset) {
      params.append('offset', options.offset.toString());
    }

    const url = `${baseUrl}/servers?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ConversationalAgent/1.0 (https://hashgraphonline.com)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PulseMCP API error: ${response.status}`);
      }

      const data = await response.json();

      const totalServers = data.total_count || 0;
      const hasNext = data.next !== null && data.next !== undefined;
      const serversCount = (data.servers || []).length;

      this.logger.info(
        `PulseMCP API response: offset=${options.offset}, count=${serversCount}, total=${totalServers}, hasNext=${hasNext}, next=${data.next}`
      );

      const normalizedServers = (data.servers || [])
        .map((server: RawRegistryServer) => {
          try {
            return this.normalizePulseMCPServer(server);
          } catch (error) {
            this.logger.warn(`Failed to normalize server:`, error, server);
            return null;
          }
        })
        .filter(Boolean)
        .filter((server: MCPRegistryServer) => {
          const installable = this.isServerInstallable(server);
          if (!installable) {
            this.logger.debug(
              `Filtering out non-installable server: ${server.name}`
            );
          }
          return installable;
        });

      return {
        servers: normalizedServers,
        total: totalServers,
        hasMore: hasNext,
      };
    } catch (error) {
      this.logger.warn('PulseMCP error:', error);
      throw error;
    }
  }

  /**
   * Search Glama MCP provider
   */
  private async searchGlama(
    options: MCPRegistrySearchOptions
  ): Promise<MCPRegistryResponse> {
    if (!this.tryConsume('glama', 1)) {
      throw new Error('Glama rate limit budget exhausted');
    }
    try {
      const first = options.limit || 50;
      const query = options.query || '';
      const url = new URL('https://glama.ai/api/mcp/v1/servers');
      url.searchParams.set('first', String(first));
      if (query) url.searchParams.set('query', query);
      if (options.cursor) url.searchParams.set('after', options.cursor);

      const resp = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'HOL-Desktop',
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`Glama API error: ${resp.status}`);
      const data = await resp.json() as any;
      const servers = Array.isArray(data.servers) ? data.servers : [];
      const mapped: MCPRegistryServer[] = servers.map((s: Record<string, unknown>) => {
        const repo = (s as any).repository?.url ? String((s as any).repository.url) : undefined;
        const normalized = this.normalizeGithubUrl(repo);
        return {
          id: String(s.id || s.name),
          name: String(s.name || s.namespace || s.id || 'Unknown'),
          description: String(s.description || ''),
          repository: normalized ? { type: 'git', url: normalized } : (repo ? { type: 'git', url: repo } : undefined),
          tags: Array.isArray(s.attributes) ? s.attributes.map((a: any) => a?.key || '').filter(Boolean) : [],
        } as MCPRegistryServer;
      });

      return {
        servers: mapped,
        total: undefined,
        hasMore: Boolean((data as any).pageInfo?.hasNextPage),
        cursor: (data as any).pageInfo?.endCursor || undefined,
      };
    } catch (error) {
      this.logger.warn('Glama error:', error);
      throw error;
    }
  }


  private async getServerDetailsFromPulseMCP(
    serverId: string,
    packageName?: string
  ): Promise<MCPRegistryServer | null> {
    this.logger.debug(
      `PulseMCP detail lookup skipped - server details endpoint does not exist in PulseMCP API v0beta. ServerId: ${serverId}, packageName: ${packageName}`
    );

    return null;
  }

  private normalizePulseMCPServer = (
    server: RawRegistryServer
  ): MCPRegistryServer => {
    const description = server.short_description || server.description || '';

    if (!server.package_name && server.name) {
      this.logger.debug(`Server "${server.name}" has no package_name field`);
    }

    const invalidPackageNames = ['bitcoin-mcp', 'mcp-notes'];

    let packageName = server.package_name;
    if (packageName && invalidPackageNames.includes(packageName)) {
      this.logger.debug(
        `Removing invalid packageName "${packageName}" from server "${server.name}"`
      );
      packageName = undefined;
    }

    if (packageName && !this.isValidNpmPackageName(packageName)) {
      this.logger.debug(
        `PulseMCP package_name is not a valid npm package: "${packageName}" for "${server.name}". Ignoring.`
      );
      packageName = undefined;
    }

    const repoCandidate =
      server.source_code_url ||
      (typeof server.repository === 'string'
        ? server.repository
        : server.repository?.url);
    const normalizedRepo = this.normalizeGithubUrl(repoCandidate || undefined);

    return {
      id: server.id || server.name || server.package_name,
      name: server.name || server.package_name,
      description: String(description),
      author: server.author,
      version: server.version,
      packageRegistry: server.package_registry || undefined,
      packageName: packageName,
      repository: normalizedRepo
        ? { type: 'git', url: normalizedRepo }
        : repoCandidate
        ? { type: 'git', url: repoCandidate }
        : undefined,
      tags: server.tags || server.keywords || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
      installCount:
        (server as { package_download_count?: number; downloads?: number; install_count?: number }).package_download_count ||
        (server as { package_download_count?: number; downloads?: number; install_count?: number }).downloads ||
        (server as { package_download_count?: number; downloads?: number; install_count?: number }).install_count,
      githubStars: server.github_stars,
      rating: server.rating,
      tools: server.tools || server.capabilities?.tools || undefined,
    };
  };

  /**
   * Minimal validation for npm package names (scoped or unscoped)
   */
  private isValidNpmPackageName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    if (/[A-Z]/.test(name)) return false;
    if (name.startsWith('@')) {
      const parts = name.split('/');
      if (parts.length !== 2) return false;
      const scope = parts[0].slice(1);
      const pkg = parts[1];
      const re = /^[a-z0-9][a-z0-9._-]*$/;
      return re.test(scope) && re.test(pkg);
    }
    const re = /^[a-z0-9][a-z0-9._-]*$/;
    return re.test(name);
  }

  private normalizeOfficialRegistryServer = (
    server: RawRegistryServer
  ): MCPRegistryServer => {
    return {
      id: server.id,
      name: server.name,
      description: server.description || '',
      author: server.author,
      version: server.version,
      url: server.url,
      repository:
        server.repository && typeof server.repository === 'object'
          ? server.repository
          : undefined,
      config: server.config,
      tags: server.tags || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
      tools: server.tools || server.capabilities?.tools || undefined,
    };
  };

  private deduplicateServers(
    servers: MCPRegistryServer[]
  ): MCPRegistryServer[] {
    const seen = new Set<string>();
    const unique: MCPRegistryServer[] = [];

    for (const server of servers) {
      const key = server.packageName || server.repository?.url || server.name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(server);
      }
    }

    return unique;
  }

  private filterServers(
    servers: MCPRegistryServer[],
    options: MCPRegistrySearchOptions
  ): MCPRegistryServer[] {
    let filtered = servers;

    if (options.query) {
      const query = options.query.toLowerCase();
      filtered = filtered.filter(
        (server) =>
          server.name.toLowerCase().includes(query) ||
          server.description.toLowerCase().includes(query) ||
          (server.tags &&
            server.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(
        (server) =>
          server.tags && options.tags!.some((tag) => server.tags!.includes(tag))
      );
    }

    if (options.author) {
      filtered = filtered.filter(
        (server) =>
          server.author &&
          server.author.toLowerCase().includes(options.author!.toLowerCase())
      );
    }

    return filtered;
  }

  private sortServers(
    servers: MCPRegistryServer[],
    _query?: string
  ): MCPRegistryServer[] {
    return servers.slice().sort((a, b) => {
      const aStars = Number(a.githubStars ?? 0);
      const bStars = Number(b.githubStars ?? 0);
      if (aStars !== bStars) return bStars - aStars;
      const aInstalls = Number(a.installCount ?? 0);
      const bInstalls = Number(b.installCount ?? 0);
      if (aInstalls !== bInstalls) return bInstalls - aInstalls;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    if (this.cacheManager) {
      try {
        await this.cacheManager.clearSearchCache();
        await this.cacheManager.clearRegistrySync();
        await this.cacheManager.clearRegistryCache('pulsemcp');
        this.logger.info('Registry cache and sync status cleared completely');
      } catch (error) {
        this.logger.error('Failed to clear cache:', error);
      }
    } else {
      this.logger.warn('Cache manager not available - no cache to clear');
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<MCPCacheStats> {
    if (this.cacheManager) {
      try {
        const cacheStats = await this.cacheManager.getCacheStats();
        return {
          totalEntries: cacheStats.cacheEntries,
          totalSize: cacheStats.totalServers,
          hitRate: cacheStats.cacheHitRate,
          oldestEntry: cacheStats.oldestEntry,
          newestEntry: cacheStats.newestEntry,
        };
      } catch (error) {
        this.logger.error('Failed to get cache stats:', error);
        return {
          totalEntries: 0,
          totalSize: 0,
          hitRate: 0,
          oldestEntry: new Date(),
          newestEntry: new Date(),
        };
      }
    } else {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        oldestEntry: new Date(),
        newestEntry: new Date(),
      };
    }
  }

  /**
   * Initialize background sync system
   */
  private initializeBackgroundSync(): void {
    if (!this.cacheManager) {
      this.logger.warn(
        'Cache manager not available - skipping background sync initialization'
      );
      return;
    }

    setTimeout(() => {
      this.triggerBackgroundSync();
    }, 30000);

    setInterval(() => {
      this.triggerBackgroundSync();
    }, this.REGISTRY_SYNC_INTERVAL);

    setInterval(() => {
      try {
        const enricher = MCPMetricsEnricher.getInstance();
        void enricher.enrichMissing(100, 4);
      } catch (error) {
        this.logger.debug('Metrics enrichment interval failed:', error);
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Trigger background sync if not already running
   */
  private triggerBackgroundSync(): void {
    if (!this.cacheManager) {
      this.logger.debug(
        'Cache manager not available - skipping background sync'
      );
      return;
    }

    try {
      if (!this.cacheManager.isCacheAvailable()) {
        this.logger.debug('Cache is not available (DB disabled) - skipping background sync');
        return;
      }
    } catch {}

    if (this.backgroundSyncActive) {
      this.logger.debug('Background sync already active, skipping');
      return;
    }

    setTimeout(() => {
      this.performBackgroundSync().catch((error) => {
        this.logger.error('Background sync failed:', error);
      });
    }, 5000);
  }

  /**
   * Perform background sync of all registries
   */
  private async performBackgroundSync(): Promise<void> {
    if (this.backgroundSyncActive) return;

    this.backgroundSyncActive = true;
    const startTime = Date.now();

    try {
      this.logger.info('Starting background registry sync...');

      const registries: Array<'pulsemcp' | 'glama'> = [];
      if (this.tryConsume('pulsemcp', 1)) registries.push('pulsemcp');
      else registries.push('glama');
      const syncPromises = registries.map((registry) =>
        this.syncRegistry(registry)
      );

      await Promise.allSettled(syncPromises);

      const duration = Date.now() - startTime;
      this.logger.info(`Background sync completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Background sync failed:', error);
    } finally {
      this.backgroundSyncActive = false;
    }
  }

  /**
   * Sync a specific registry
   */
  private async syncRegistry(registry: string): Promise<void> {
    const startTime = Date.now();

    try {
      const tier = await (this.cacheManager as { getRegistryFreshnessTier?: (registry: string) => Promise<string> }).getRegistryFreshnessTier
        ? await (this.cacheManager as { getRegistryFreshnessTier?: (registry: string) => Promise<string> }).getRegistryFreshnessTier(registry)
        : (await this.cacheManager.isRegistryFresh(registry) ? 'fresh' : 'expired')
      if (tier === 'fresh') {
        this.logger.debug(
          `Registry ${registry} is already fresh, skipping sync`
        );
        return;
      }

      await this.cacheManager.updateRegistrySync(registry, 'syncing');

      let totalServers = 0;
      let offset = 0;
      let cursor: string | undefined = undefined;
      let currentProvider: 'pulsemcp' | 'glama' = (registry as string) === 'glama' ? 'glama' : 'pulsemcp';
      const servers: MCPRegistryServer[] = [];

      while (true) {
        const options: MCPRegistrySearchOptions =
          currentProvider === 'glama'
            ? { limit: this.BACKGROUND_BATCH_SIZE, cursor }
            : { limit: this.BACKGROUND_BATCH_SIZE, offset };

        let batchResults: MCPRegistryResponse;
        try {
          batchResults =
            currentProvider === 'pulsemcp'
              ? await this.searchPulseMCP(options)
              : await this.searchGlama(options);
        } catch (err) {
          if (currentProvider === 'pulsemcp') {
            this.logger.warn('Pulse batch failed, switching to Glama:', err);
            currentProvider = 'glama';
            cursor = undefined;
            offset = 0;
            continue;
          }
          throw err;
        }

        if (!batchResults.servers || batchResults.servers.length === 0) {
          this.logger.info(
            `${registry} sync: No servers returned, stopping at offset ${offset}`
          );
          break;
        }

        servers.push(...batchResults.servers);
        totalServers += batchResults.servers.length;

        this.logger.info(
          `${currentProvider} sync: Fetched ${batchResults.servers.length} servers, total so far: ${totalServers}, hasMore: ${batchResults.hasMore}`
        );

        const cacheServers = batchResults.servers.map((server) =>
          this.convertToCachedServer(server, registry)
        );
        try {
          await this.cacheManager.bulkCacheServers(cacheServers);
        } catch (cacheError) {
          this.logger.error(
            `Failed to cache servers for ${registry}:`,
            cacheError
          );
        }

        if (currentProvider === 'glama') {
          cursor = (batchResults as { cursor?: string }).cursor || cursor;
        } else {
          offset += this.BACKGROUND_BATCH_SIZE;
        }

        if (!batchResults.hasMore) {
          this.logger.info(
            `${currentProvider} sync: Stopping - hasMore: ${batchResults.hasMore}, servers.length: ${batchResults.servers.length}, batchSize: ${this.BACKGROUND_BATCH_SIZE}`
          );
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      await this.cacheManager.updateRegistrySync(registry, 'success', {
        serverCount: totalServers,
        syncDurationMs: duration,
      });

      this.logger.info(
        `Synced ${totalServers} servers from ${registry} in ${duration}ms`
      );

      try {
        const enricher = MCPMetricsEnricher.getInstance();
        void enricher.enrichMissing(100, 4);
      } catch (e) {
        this.logger.debug('Metrics enrichment trigger failed:', e);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.cacheManager.updateRegistrySync(registry, 'error', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        syncDurationMs: duration,
      });

      this.logger.error(`Failed to sync registry ${registry}:`, error);
      throw error;
    }
  }

  /**
   * Search registries with timeout for immediate responses
   */
  private async searchRegistriesWithTimeout(
    options: MCPRegistrySearchOptions,
    timeoutMs: number
  ): Promise<MCPRegistryResponse> {
    try {
      const registryPromises = [this.searchPulseMCP(options)];

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Registry search timeout')),
          timeoutMs
        );
      });

      const results = await Promise.allSettled([
        Promise.race([Promise.allSettled(registryPromises), timeoutPromise]),
      ]);

      const allServers: MCPRegistryServer[] = [];
      let hasAnyError = false;
      let lastError: Error | undefined;

      if (
        results[0].status === 'fulfilled' &&
        Array.isArray(results[0].value)
      ) {
        results[0].value.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            allServers.push(...result.value.servers);
          } else {
            hasAnyError = true;
            const registryNames = [
              'PulseMCP',
              'Official Registry',
              'Smithery Registry',
            ];
            if (result.status === 'rejected') {
              lastError = result.reason;
            }
            this.logger.warn(
              `Failed to fetch from ${registryNames[index]}:`,
              result.status === 'rejected' ? result.reason : 'Unknown error'
            );
          }
        });
      } else {
        hasAnyError = true;
        if (results[0].status === 'rejected') {
          lastError = results[0].reason;
        }
      }

      if (hasAnyError && allServers.length === 0) {
        throw lastError || new Error('All registry searches failed');
      }

      const uniqueServers = this.deduplicateServers(allServers);
      const filteredServers = this.filterServers(uniqueServers, options);
      const sortedServers = this.sortServers(filteredServers, options.query);

      let totalCount = 0;
      let hasMoreResults = false;
      if (
        results[0].status === 'fulfilled' &&
        Array.isArray(results[0].value)
      ) {
        const fulfilled = results[0].value.find(
          (r: PromiseSettledResult<MCPRegistryResponse>) => r.status === 'fulfilled'
        ) as PromiseFulfilledResult<MCPRegistryResponse> | undefined;
        if (fulfilled) {
          totalCount = Number(fulfilled.value.total || 0);
          hasMoreResults = Boolean(fulfilled.value.hasMore);
        }
      }
      if (!totalCount) {
        const offset = options.offset || 0;
        totalCount = offset + sortedServers.length;
      }

      const cacheServers = sortedServers.map((server) =>
        this.convertToCachedServer(server, 'mixed')
      );
      if (cacheServers.length > 0) {
        await this.cacheManager.bulkCacheServers(cacheServers);
      }

      const offset = options.offset || 0;
      if (totalCount && offset + sortedServers.length < totalCount) {
        hasMoreResults = true;
      }

      return {
        servers: sortedServers,
        total: totalCount,
        hasMore: hasMoreResults,
      };
    } catch (error) {
      this.logger.warn('Timeout registry search failed:', error);
      throw error;
    }
  }

  /**
   * Convert registry server to cached format
   */
  private convertToCachedServer(server: MCPRegistryServer, registry: string): MCPServerInput {
    const result: MCPServerInput = {
      id: server.id,
      name: server.name,
      description: server.description || '',
      author: server.author || null,
      version: server.version || null,
      url: server.url || null,
      packageName: server.packageName || null,
      packageRegistry: server.packageRegistry || null,
      repositoryType: server.repository?.type || null,
      repositoryUrl: this.normalizeGithubUrl(server.repository?.url) || server.repository?.url || null,
      configCommand: server.config?.command || null,
      configArgs: server.config?.args
        ? JSON.stringify(server.config.args)
        : null,
      configEnv: server.config?.env ? JSON.stringify(server.config.env) : null,
      tags: server.tags ? JSON.stringify(server.tags) : null,
      license: server.license || null,
      createdAt: server.createdAt || null,
      updatedAt: server.updatedAt || null,
      installCount: server.installCount || null,
      rating: typeof server.rating === 'number' ? server.rating : null,
      githubStars: server.githubStars || null,
      registry,
      isActive: true,
      searchVector: null,
    };
    return result;
  }

  /**
   * Type guard to check if server has required cached server properties
   */
  private isCachedServerData(server: MCPServer): server is MCPServer {
    return (
      typeof server === 'object' &&
      server !== null &&
      'id' in server &&
      'name' in server
    );
  }

  /**
   * Convert cached server to registry format
   */
  private convertFromCachedServer = (server: MCPServer): MCPRegistryServer => {
    if (!this.isCachedServerData(server)) {
      throw new Error('Invalid cached server data structure');
    }

    return {
      id: server.id,
      name: server.name,
      description: String(server.description || ''),
      author: server.author || undefined,
      version: server.version || undefined,
      url: server.url || undefined,
      packageName: server.packageName || undefined,
      repository: server.repositoryUrl
        ? {
            type: (server.repositoryType as string) || 'git',
            url: server.repositoryUrl,
          }
        : undefined,
      config: server.configCommand
        ? {
            command: server.configCommand,
            args: server.configArgs ? JSON.parse(server.configArgs) : [],
            env: server.configEnv ? JSON.parse(server.configEnv) : {},
          }
        : undefined,
      tags: server.tags ? JSON.parse(server.tags) : [],
      license: server.license || undefined,
      createdAt: server.createdAt || undefined,
      updatedAt: server.updatedAt || undefined,
      installCount: server.installCount ?? undefined,
      rating: server.rating ?? undefined,
      githubStars: server.githubStars ?? undefined,
      packageRegistry: server.packageRegistry ?? undefined,
    };
  };
}
