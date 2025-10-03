import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  FiSearch,
  FiDownload,
  FiExternalLink,
  FiStar,
  FiCalendar,
  FiUser,
  FiTag,
  FiRefreshCw,
  FiDatabase,
  FiClock,
  FiActivity,
  FiCheck,
  FiX,
  FiChevronDown,
} from 'react-icons/fi';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import {
  getInstalledServerInstallKey,
  getRegistryServerInstallKey,
  getRegistryServerInstallCommandParts,
  selectPreferredRegistryServer,
  type RegistryServerLike,
} from '../../utils/mcp-install-keys';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/**
 * Utility to keep client-side ordering consistent when merging pages.
 */
type MetricEntry = {
  value?: number | string | null;
  status?: string;
  lastUpdated?: string;
  [key: string]: unknown;
};

function coerceMetricNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[,_]/g, '');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return coerceMetricNumber((value as Record<string, unknown>).value);
  }

  return null;
}

function resolveMetricValue(
  server: MCPRegistryServer,
  keys: string[]
): number {
  for (const key of keys) {
    const direct = (server as unknown as Record<string, unknown>)[key];
    const directNumber = coerceMetricNumber(direct);
    if (directNumber !== null) {
      return directNumber;
    }

    const metricEntry = server.metrics?.[key];
    const metricNumber = coerceMetricNumber(metricEntry);
    if (metricNumber !== null) {
      return metricNumber;
    }
  }

  return 0;
}

function sortServersByStars(items: MCPRegistryServer[]): MCPRegistryServer[] {
  const list = [...items];
  list.sort((a, b) => {
    const aStars = resolveMetricValue(a, ['githubStars', 'stars']);
    const bStars = resolveMetricValue(b, ['githubStars', 'stars']);
    if (aStars !== bStars) return bStars - aStars;
    const aInst = resolveMetricValue(a, ['installCount', 'installations', 'npmDownloads']);
    const bInst = resolveMetricValue(b, ['installCount', 'installations', 'npmDownloads']);
    if (aInst !== bInst) return bInst - aInst;
    return a.name.localeCompare(b.name);
  });
  return list;
}

/**
 * Builds a stable unique key for React lists and dedupe.
 */
function uniqueKeyForServer(s: MCPRegistryServer): string {
  const key = getRegistryServerInstallKey(s);
  if (key) {
    return key;
  }
  if (s.id) {
    return s.id;
  }
  return s.name;
}

/**
 * Removes duplicate servers based on the unique key.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (
  source: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumber = (
  source: Record<string, unknown>,
  key: string
): number | undefined => {
  const value = source[key];
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
};

const parseMetrics = (
  value: unknown
): Record<string, MetricEntry> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries: Record<string, MetricEntry> = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (isRecord(entryValue)) {
      const entry: MetricEntry = {};
      if ('value' in entryValue) {
        entry.value = entryValue.value as number | string | null | undefined;
      }
      if (typeof entryValue.status === 'string') {
        entry.status = entryValue.status as string;
      }
      if (typeof entryValue.lastUpdated === 'string') {
        entry.lastUpdated = entryValue.lastUpdated as string;
      }
      entries[key] = entry;
      return;
    }

    const numeric = coerceMetricNumber(entryValue);
    if (numeric !== null) {
      entries[key] = { value: numeric };
    }
  });

  return Object.keys(entries).length > 0 ? entries : undefined;
};

const parseRegistryServer = (value: unknown): MCPRegistryServer | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id') ?? getString(value, 'identifier') ?? '';
  const name = getString(value, 'name');
  const description = getString(value, 'description') ?? '';
  if (!name || description === undefined) {
    return null;
  }

  let tools: Array<{ name: string; description?: string }> | undefined;
  const toolsRaw = (value['tools'] ?? value['availableTools']) as unknown;
  if (Array.isArray(toolsRaw)) {
    const collected: Array<{ name: string; description?: string }> = [];
    for (const toolEntry of toolsRaw) {
      if (isRecord(toolEntry)) {
        const toolName = getString(toolEntry, 'name');
        if (toolName) {
          const toolDescription = getString(toolEntry, 'description');
          collected.push(
            toolDescription
              ? { name: toolName, description: toolDescription }
              : { name: toolName }
          );
        }
      }
    }
    if (collected.length > 0) {
      tools = collected;
    }
  }

  const registryServer: MCPRegistryServer = {
    id,
    name,
    description,
    author: getString(value, 'author'),
    version: getString(value, 'version'),
    url: getString(value, 'url') ?? getString(value, 'homepage'),
    packageRegistry: getString(value, 'packageRegistry'),
    packageName: getString(value, 'packageName'),
    repository: isRecord(value['repository'])
      ? {
          type: getString(value['repository'], 'type') ?? 'git',
          url: getString(value['repository'], 'url') ?? '',
        }
      : undefined,
    tags: toStringArray(value['tags']) ?? toStringArray(value['keywords']) ?? [],
    license: getString(value, 'license'),
    createdAt: getString(value, 'createdAt'),
    updatedAt: getString(value, 'updatedAt'),
    installCount: getNumber(value, 'installCount'),
    rating: getNumber(value, 'rating'),
    githubStars: getNumber(value, 'githubStars') ?? getNumber(value, 'stars'),
    tools,
    metrics: parseMetrics(value['metrics']),
  };

  return registryServer;
};

const parseRegistryResponse = (
  value: unknown
): MCPRegistryResponse | null => {
  if (!isRecord(value)) {
    return null;
  }

  const serversSource = value['servers'];
  const servers = Array.isArray(serversSource)
    ? serversSource
        .map((entry) => parseRegistryServer(entry))
        .filter((server): server is MCPRegistryServer => server !== null)
    : [];

  return {
    servers,
    total: typeof value['total'] === 'number' ? (value['total'] as number) : undefined,
    hasMore: typeof value['hasMore'] === 'boolean' ? (value['hasMore'] as boolean) : undefined,
    page: typeof value['page'] === 'number' ? (value['page'] as number) : undefined,
    limit: typeof value['limit'] === 'number' ? (value['limit'] as number) : undefined,
  };
};

const parseCacheStats = (value: unknown): CacheStats | null => {
  if (!isRecord(value)) {
    return null;
  }

  const serversByRegistrySource = value['serversByRegistry'];
  const serversByRegistry = isRecord(serversByRegistrySource)
    ? Object.entries(serversByRegistrySource).reduce<Record<string, number>>(
        (acc, [key, val]) => {
          if (typeof val === 'number') {
            acc[key] = val;
          }
          return acc;
        },
        {}
      )
    : {};

  return {
    totalServers:
      typeof value['totalServers'] === 'number' ? (value['totalServers'] as number) : 0,
    serversByRegistry,
    cacheEntries:
      typeof value['cacheEntries'] === 'number' ? (value['cacheEntries'] as number) : 0,
    averageResponseTime:
      typeof value['averageResponseTime'] === 'number'
        ? (value['averageResponseTime'] as number)
        : 0,
    cacheHitRate:
      typeof value['cacheHitRate'] === 'number' ? (value['cacheHitRate'] as number) : 0,
    oldestEntry:
      typeof value['oldestEntry'] === 'string' ? (value['oldestEntry'] as string) : null,
    newestEntry:
      typeof value['newestEntry'] === 'string' ? (value['newestEntry'] as string) : null,
  };
};

function dedupeServers(servers: MCPRegistryServer[]): MCPRegistryServer[] {
  const map = new Map<string, MCPRegistryServer>();
  for (const s of servers) {
    const key = uniqueKeyForServer(s);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
      continue;
    }
    const preferred = selectPreferredRegistryServer(existing, s);
    map.set(key, preferred as MCPRegistryServer);
  }
  return Array.from(map.values());
}

interface MCPRegistryServer extends RegistryServerLike {
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
  metrics?: Record<string, MetricEntry>;
}

interface MCPRegistryResponse {
  servers: MCPRegistryServer[];
  total?: number;
  hasMore?: boolean;
  page?: number;
  limit?: number;
}

interface MCPRegistryProps {
  onInstall?: (server: MCPRegistryServer) => void;
  className?: string;
}

interface CacheStats {
  totalServers: number;
  serversByRegistry: Record<string, number>;
  cacheEntries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

/**
 * MCP Registry component for discovering and installing servers from public registries
 */
export const MCPRegistry: React.FC<MCPRegistryProps> = ({
  onInstall,
  className,
}) => {
  const [servers, setServers] = useState<MCPRegistryServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [uninstallingKey, setUninstallingKey] = useState<string | null>(null);
  const [installedServerIds, setInstalledServerIds] = useState<
    Record<string, string>
  >({});
  const [installedServers, setInstalledServers] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [showCacheStats, setShowCacheStats] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState<number | null>(null);
  const pageSize = 50;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadCacheStats = useCallback(async () => {
    if (!window.desktop?.getMCPCacheStats) return;

    try {
      const result = await window?.desktop?.getMCPCacheStats();
      if (result.success) {
        const stats = parseCacheStats(result.data);
        if (stats) {
          setCacheStats(stats);
        }
      }
    } catch (error) {}
  }, []);

  const searchRegistries = useCallback(
    async (
      query: string = '',
      tags: string[] = [],
      pageNum: number = 0,
      append: boolean = false
    ) => {
      if (!window.desktop?.searchMCPRegistry) {
        setError('Registry search not available');
        return;
      }

      if (pageNum === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const searchStartTime = Date.now();

      try {
        const result = await window?.desktop?.searchMCPRegistry({
          query: query.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
          limit: pageSize,
          offset: pageNum * pageSize,
        });

        const searchTime = Date.now() - searchStartTime;
        setLastSearchTime(searchTime);

        if (result.success) {
          const parsed = parseRegistryResponse(result.data);
          if (!parsed) {
            setError('Failed to parse registry response');
            if (!append) {
              setServers([]);
              setTotal(0);
            }
            return;
          }

          if (append) {
            setServers((prev) =>
              sortServersByStars(
                dedupeServers([...prev, ...parsed.servers])
              )
            );
          } else {
            setServers(sortServersByStars(dedupeServers(parsed.servers)));
          }
          setTotal(parsed.total ?? 0);
          const calculatedHasMore = parsed.hasMore ?? false;
          setHasMore(calculatedHasMore);
          setPage(pageNum);

          loadCacheStats();
        } else {
          setError(result.error || 'Failed to search registries');
          if (!append) {
            setServers([]);
            setTotal(0);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to search registries'
        );
        if (!append) {
          setServers([]);
          setTotal(0);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageSize, loadCacheStats]
  );

  useEffect(() => {
    searchRegistries('', [], 0, false);
    loadCacheStats();
    loadInstalledServers();
  }, []);

  const loadInstalledServers = async () => {
    if (!window.desktop?.loadMCPServers) return;

    try {
      const result = await window?.desktop?.loadMCPServers();
      if (result.success && result.data) {
        const keys = new Set<string>();
        const idMap: Record<string, string> = {};
        const records = Array.isArray(result.data) ? result.data : [];
        records.forEach((server) => {
          const configForKey =
            server.config.type === 'custom'
              ? {
                  type: 'custom',
                  command: server.config.command ?? null,
                  args: server.config.args ?? null,
                }
              : { type: server.config.type };

          const key = getInstalledServerInstallKey({
            id: server.id,
            name: server.name,
            config: configForKey,
          });

          if (key) {
            keys.add(key);
            idMap[key] = server.id;
          }
        });
        setInstalledServers(Array.from(keys));
        setInstalledServerIds(idMap);
      }
    } catch (error) {}
  };

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'ai', label: 'AI/ML' },
    { value: 'database', label: 'Database' },
    { value: 'development', label: 'Development' },
    { value: 'devops', label: 'DevOps' },
    { value: 'communication', label: 'Communication' },
    { value: 'filesystem', label: 'File System' },
    { value: 'api', label: 'API/Integration' },
    { value: 'security', label: 'Security' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'cloud', label: 'Cloud' },
  ];

  const getCategoryKeywords = (category: string): string[] => {
    const keywordMap: Record<string, string[]> = {
      ai: [
        'ai',
        'ml',
        'llm',
        'gpt',
        'claude',
        'model',
        'neural',
        'artificial',
        'intelligence',
      ],
      database: [
        'database',
        'sql',
        'postgres',
        'mysql',
        'mongodb',
        'db',
        'sqlite',
        'redis',
      ],
      development: [
        'code',
        'developer',
        'programming',
        'ide',
        'editor',
        'debug',
        'lint',
      ],
      devops: [
        'docker',
        'kubernetes',
        'ci/cd',
        'deployment',
        'monitoring',
        'jenkins',
        'terraform',
      ],
      communication: [
        'slack',
        'discord',
        'email',
        'chat',
        'messaging',
        'notification',
      ],
      filesystem: ['file', 'filesystem', 'directory', 'folder', 'storage'],
      api: ['api', 'rest', 'graphql', 'webhook', 'integration', 'http'],
      security: [
        'security',
        'auth',
        'encryption',
        'password',
        'ssl',
        'oauth',
        'jwt',
      ],
      analytics: [
        'analytics',
        'metrics',
        'monitoring',
        'logging',
        'tracking',
        'telemetry',
      ],
      cloud: ['aws', 'azure', 'gcp', 'cloud', 's3', 'lambda', 'ec2'],
    };
    return keywordMap[category] || [];
  };

  const filterServersByCategory = (
    servers: MCPRegistryServer[],
    category: string
  ) => {
    if (!category) return servers;

    const keywords = getCategoryKeywords(category);
    return servers.filter((server) => {
      const text = (server.name + ' ' + server.description).toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(0);
    searchRegistries(query, selectedTags, 0, false);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newTags);
    setPage(0);
    searchRegistries(searchQuery, newTags, 0, false);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(0);
  };

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    searchRegistries(searchQuery, selectedTags, nextPage, true);
  }, [page, searchQuery, selectedTags, searchRegistries]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    const computedHasMore = hasMore || total > servers.length;
    if (!currentRef || !computedHasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && computedHasMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, total, servers.length, isLoadingMore, loadMore]);

  const handleInstall = async (server: MCPRegistryServer) => {
    if (!window.desktop?.installMCPFromRegistry) {
      setError('Installation not available');
      return;
    }

    const installKey = uniqueKeyForServer(server);
    if (installedServers.includes(installKey)) {
      setError(`${server.name} is already installed`);
      return;
    }

    setInstallingKey(installKey);
    setError(null);

    const installParts = getRegistryServerInstallCommandParts(server);

    try {
      const result = await window?.desktop?.installMCPFromRegistry(
        server.id,
        server.packageName,
        installParts ?? undefined
      );

      if (result.success) {
        setInstalledServers((prev) => {
          const next = new Set(prev);
          next.add(installKey);
          return Array.from(next);
        });
        if (isRecord(result.data)) {
          const savedId = getString(result.data, 'id');
          if (savedId) {
            setInstalledServerIds((prev) => ({
              ...prev,
              [installKey]: savedId,
            }));
          }
        }

        setSuccessMessage(`${server.name} installed successfully!`);

        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);

        onInstall?.(server);

        setTimeout(() => {
          loadInstalledServers();
        }, 1000);
      } else {
        setError(result.error || 'Failed to install server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install server');
    } finally {
      setInstallingKey((current) => (current === installKey ? null : current));
    }
  };

  const handleUninstall = async (server: MCPRegistryServer) => {
    const installKey = uniqueKeyForServer(server);
    const targetId = installedServerIds[installKey];
    if (!targetId) {
      setError('Unable to locate installed server for removal');
      return;
    }

    setUninstallingKey(installKey);
    setError(null);

    try {
      const currentResult = await window?.desktop?.loadMCPServers();
      if (!currentResult.success) {
        throw new Error(
          currentResult.error || 'Failed to load current servers'
        );
      }

      const rawServers = Array.isArray(currentResult.data)
        ? currentResult.data
        : [];

      const targetEntry = rawServers.find((entry) => entry.id === targetId);
      if (!targetEntry) {
        setError('Installed server configuration not found');
        return;
      }

      const status = targetEntry.status;
      if (status === 'connected') {
        const disconnectResult = await window?.desktop?.disconnectMCPServer(
          targetId
        );
        if (!disconnectResult.success) {
          throw new Error(
            disconnectResult.error ||
              'Failed to disconnect server before removal'
          );
        }
      }

      const remaining = rawServers.filter((entry) => entry.id !== targetId);
      const saveResult = await window?.desktop?.saveMCPServers(remaining);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to persist server removal');
      }

      setInstalledServers((prev) => prev.filter((key) => key !== installKey));
      setInstalledServerIds((prev) => {
        const next = { ...prev };
        delete next[installKey];
        return next;
      });

      setSuccessMessage(`${server.name} uninstalled successfully.`);

      setTimeout(() => {
        loadInstalledServers();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to uninstall server'
      );
    } finally {
      setUninstallingKey((current) =>
        current === installKey ? null : current
      );
    }
  };

  const availableTags = React.useMemo(() => {
    const tags = new Set<string>();
    servers.forEach((server) => {
      server.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [servers]);

  const filteredServers = React.useMemo(() => {
    return filterServersByCategory(servers, selectedCategory);
  }, [servers, selectedCategory]);

  const sortedServers = React.useMemo(
    () => sortServersByStars(filteredServers),
    [filteredServers]
  );

  const selectedCategoryOption = React.useMemo(
    () =>
      categories.find((category) => category.value === selectedCategory) ??
      categories[0],
    [categories, selectedCategory]
  );

  return (
    <div className={cn('space-y-6', className)}>
      <div className='space-y-4'>
        <div className='flex items-center gap-4'>
          <div className='flex-1 relative'>
            <FiSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
            <Input
              placeholder='Search MCP servers...'
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className='pl-10'
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='flex items-center justify-between gap-2 min-w-[200px]'
              >
                <span>
                  {selectedCategoryOption.label}
                </span>
                <FiChevronDown className='w-4 h-4 opacity-70' />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            sideOffset={8}
            className='z-[60] min-w-[220px] bg-white shadow-lg dark:bg-gray-900'
          >
            {categories.map((category) => {
              const isActive = category.value === selectedCategory;
              return (
                <DropdownMenuItem
                  key={category.value || 'all'}
                    onSelect={(event) => {
                      event.preventDefault();
                      handleCategoryChange(category.value);
                    }}
                    className={cn(
                      'flex items-center gap-2',
                      isActive && 'font-semibold text-primary-600'
                    )}
                  >
                    {isActive && <FiCheck className='w-4 h-4' />}
                    <span>{category.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant='outline'
            onClick={async () => {
              if (window.desktop?.clearMCPRegistryCache) {
                await window?.desktop?.clearMCPRegistryCache();
              }
              if (window.desktop?.triggerMCPBackgroundSync) {
                await window?.desktop?.triggerMCPBackgroundSync();
              }
              setPage(0);
              searchRegistries(searchQuery, selectedTags, 0, false);
            }}
            disabled={isLoading}
            className='flex items-center gap-2'
          >
            <FiRefreshCw
              className={cn('w-4 h-4', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setShowCacheStats(!showCacheStats)}
            className='flex items-center gap-2'
          >
            <FiActivity className='w-4 h-4' />
            Stats
          </Button>
        </div>

        {availableTags.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            <Typography
              variant='body1'
              color='muted'
              className='text-sm font-medium mr-2'
            >
              Filter by tags:
            </Typography>
            {availableTags.slice(0, 10).map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900 dark:border-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                <FiTag className='inline w-3 h-3 mr-1' />
                {tag}
              </button>
            ))}
          </div>
        )}

        {showCacheStats && cacheStats && (
          <div className='p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border'>
            <div className='flex items-center gap-2 mb-3'>
              <FiDatabase className='w-4 h-4' />
              <Typography variant='h6'>Cache Statistics</Typography>
            </div>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
              <div>
                <Typography variant='body1' color='muted' className='text-xs'>
                  Total Servers
                </Typography>
                <Typography variant='body1' className='font-semibold'>
                  {cacheStats.totalServers?.toLocaleString() || '0'}
                </Typography>
              </div>
              <div>
                <Typography variant='body1' color='muted' className='text-xs'>
                  Cache Entries
                </Typography>
                <Typography variant='body1' className='font-semibold'>
                  {cacheStats.cacheEntries?.toLocaleString() || '0'}
                </Typography>
              </div>
              <div>
                <Typography variant='body1' color='muted' className='text-xs'>
                  Hit Rate
                </Typography>
                <Typography variant='body1' className='font-semibold'>
                  {cacheStats.cacheHitRate?.toFixed(1) || '0.0'}%
                </Typography>
              </div>
              <div>
                <Typography variant='body1' color='muted' className='text-xs'>
                  Avg Response
                </Typography>
                <Typography variant='body1' className='font-semibold'>
                  {cacheStats.averageResponseTime
                    ? Math.round(cacheStats.averageResponseTime)
                    : 0}
                  ms
                </Typography>
              </div>
            </div>
            <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
              <Typography
                variant='body1'
                color='muted'
                className='text-xs mb-2'
              >
                Servers by Registry
              </Typography>
              <div className='flex flex-wrap gap-2'>
                {cacheStats.serversByRegistry &&
                  Object.entries(cacheStats.serversByRegistry).map(
                    ([registry, count]) => (
                      <span
                        key={registry}
                        className='px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded'
                      >
                        {registry}: {count?.toLocaleString() || '0'}
                      </span>
                    )
                  )}
              </div>
            </div>
            {lastSearchTime && (
              <div className='mt-2 flex items-center gap-2 text-xs text-gray-500'>
                <FiClock className='w-3 h-3' />
                Last search: {lastSearchTime}ms
              </div>
            )}
          </div>
        )}
      </div>

      <div className='flex items-center justify-between'>
        <Typography variant='body1' color='muted'>
          {(() => {
            if (isLoading) return 'Searching...';
            if (selectedCategory && filteredServers.length < servers.length) {
              return `Showing ${filteredServers.length} of ${total} servers`;
            }
            return `Found ${total} server${total !== 1 ? 's' : ''}`;
          })()}
        </Typography>
        {(selectedTags.length > 0 || selectedCategory) && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setSelectedTags([]);
              setSelectedCategory('');
              setPage(0);
              searchRegistries(searchQuery, [], 0, false);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
          <Typography
            variant='body1'
            className='text-red-700 dark:text-red-300'
          >
            {error}
          </Typography>
        </div>
      )}

      {successMessage && (
        <div className='p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2'>
          <FiCheck className='w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0' />
          <Typography
            variant='body1'
            className='text-green-700 dark:text-green-300'
          >
            {successMessage}
          </Typography>
        </div>
      )}

      {isLoading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className='p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse'
            >
              <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2' />
              <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4' />
              <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded' />
            </div>
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <div className='text-center py-12'>
          <Typography variant='body1' color='muted'>
            {(() => {
              if (selectedCategory) {
                const categoryLabel = categories.find(
                  (c) => c.value === selectedCategory
                )?.label;
                return `No servers found in the ${categoryLabel} category`;
              }
              if (searchQuery || selectedTags.length > 0) {
                return 'No servers found matching your search criteria';
              }
              return 'No servers available in the registry';
            })()}
          </Typography>
        </div>
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {sortedServers.map((server) => {
              const serverKey = uniqueKeyForServer(server);
              const isInstalled = Boolean(installedServerIds[serverKey]);
              return (
                <ServerCard
                  key={serverKey}
                  server={server}
                  onInstall={() => handleInstall(server)}
                  isInstalling={installingKey === serverKey}
                  isInstalled={isInstalled}
                  onUninstall={() => handleUninstall(server)}
                  isUninstalling={uninstallingKey === serverKey}
                />
              );
            })}
          </div>

          {(hasMore || total > servers.length) && (
            <div className='mt-8 text-center' ref={loadMoreRef}>
              <Button
                variant='outline'
                onClick={loadMore}
                disabled={isLoadingMore}
                className='min-w-[200px]'
              >
                {isLoadingMore ? (
                  <>
                    <FiRefreshCw className='w-4 h-4 mr-2 animate-spin' />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More Servers
                    <span className='ml-2 text-sm text-gray-500'>
                      ({servers.length} of {total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}

          {isLoadingMore && (
            <div className='mt-4 text-center'>
              <Typography
                variant='body1'
                color='muted'
                className='flex items-center justify-center gap-2'
              >
                <FiRefreshCw className='w-4 h-4 animate-spin' />
                Loading more servers...
              </Typography>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ServerCardProps {
  server: MCPRegistryServer;
  onInstall: () => void;
  onUninstall?: () => void;
  isInstalling: boolean;
  isInstalled?: boolean;
  isUninstalling?: boolean;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onInstall,
  onUninstall,
  isInstalling,
  isInstalled,
  isUninstalling,
}) => {
  const formatUpdatedAt = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'PP');
    } catch {
      return null;
    }
  };

  const isInstallable = !!(
    server.packageName ||
    (server.repository?.url && server.repository.url.includes('github.com')) ||
    server.name
  );

  return (
    <div
      className={cn(
        'p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800 relative',
        !isInstallable && 'opacity-75'
      )}
    >
      <div className='absolute top-3 right-3'>
        {isInstalled ? (
          isUninstalling ? (
            <div className='h-8 w-8 rounded-lg bg-muted flex items-center justify-center'>
              <FiRefreshCw className='w-4 h-4 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onUninstall?.()}
              className='h-8 w-8 p-0 rounded-lg bg-[#dc2626]/10 text-[#dc2626] hover:bg-[#dc2626]/20'
              title='Uninstall server'
            >
              <FiX className='w-4 h-4' />
            </Button>
          )
        ) : isInstalling ? (
          <div className='h-8 w-8 rounded-lg bg-muted flex items-center justify-center'>
            <FiRefreshCw className='w-4 h-4 animate-spin text-muted-foreground' />
          </div>
        ) : !isInstallable ? (
          <div className='h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center'>
            <FiX className='w-3 h-3 text-muted-foreground' />
          </div>
        ) : (
          <Button
            variant='ghost'
            size='sm'
            onClick={onInstall}
            className='h-8 w-8 p-0 rounded-lg hover:bg-[#5599fe]/10 hover:text-[#5599fe] transition-colors'
            title='Install server'
          >
            <FiDownload className='w-4 h-4' />
          </Button>
        )}
      </div>

      <div className='mb-3'>
        <div className='flex items-start justify-between mb-2'>
          <div className='flex items-center gap-2 pr-10'>
            <Typography variant='h6' className='line-clamp-1'>
              {server.name}
            </Typography>
            {isInstalled && (
              <span className='px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs font-medium rounded-full'>
                Installed
              </span>
            )}
          </div>
          {server.rating && (
            <div className='flex items-center gap-1 text-yellow-500 mr-10'>
              <FiStar className='w-3 h-3 fill-current' />
              <Typography variant='caption'>
                {server.rating.toFixed(1)}
              </Typography>
            </div>
          )}
        </div>

        <Typography variant='body1' color='muted' className='line-clamp-2 mb-2'>
          {server.description}
        </Typography>

        <div className='flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400'>
          {server.githubStars !== undefined && server.githubStars !== null && (
            <div className='flex items-center gap-1'>
              <FiStar className='w-3 h-3' />
              <span>{server.githubStars.toLocaleString()} stars</span>
            </div>
          )}
          {server.installCount !== undefined &&
            server.installCount !== null && (
              <div className='flex items-center gap-1'>
                <FiDownload className='w-3 h-3' />
                <span>{server.installCount.toLocaleString()} installs</span>
              </div>
            )}
          {server.author && (
            <div className='flex items-center gap-1'>
              <FiUser className='w-3 h-3' />
              <span>{server.author}</span>
            </div>
          )}
          {server.version && (
            <div className='flex items-center gap-1'>
              <span>v{server.version}</span>
            </div>
          )}
          {server.packageRegistry && (
            <div className='flex items-center gap-1'>
              <span>{server.packageRegistry}</span>
            </div>
          )}
          {formatUpdatedAt(server.updatedAt) && (
            <div className='flex items-center gap-1'>
              <FiCalendar className='w-3 h-3' />
              <span>{formatUpdatedAt(server.updatedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {server.tags && server.tags.length > 0 && (
        <div className='mb-3 flex flex-wrap gap-1'>
          {server.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className='px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded'
            >
              {tag}
            </span>
          ))}
          {server.tags.length > 3 && (
            <span className='px-2 py-1 text-xs text-gray-500 dark:text-gray-400'>
              +{server.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {server.tools && server.tools.length > 0 && (
        <div className='mb-3'>
          <Typography variant='caption' color='muted' className='block mb-1'>
            Available Tools ({server.tools.length})
          </Typography>
          <div className='flex flex-wrap gap-1'>
            {server.tools.slice(0, 4).map((tool, index) => (
              <span
                key={index}
                className='px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs rounded-full'
                title={tool.description}
              >
                {tool.name}
              </span>
            ))}
            {server.tools.length > 4 && (
              <span className='px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs rounded-full'>
                +{server.tools.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {(server.repository?.url || server.url) && (
        <div className='pt-2 border-t border-gray-100 dark:border-gray-700'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              const url = server.repository?.url || server.url;
              if (url) window.open(url, '_blank');
            }}
            className='h-6 px-2 text-xs text-muted-foreground hover:text-foreground'
          >
            <FiExternalLink className='w-3 h-3 mr-1' />
            View Source
          </Button>
        </div>
      )}
    </div>
  );
};
