import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { FiSearch, FiDownload, FiExternalLink, FiStar, FiCalendar, FiUser, FiTag, FiRefreshCw, FiDatabase, FiClock, FiActivity, FiCheck, FiX } from 'react-icons/fi'
import Typography from '../ui/Typography'
import { Button } from '../ui/Button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

/**
 * Utility to keep client-side ordering consistent when merging pages.
 */
function sortServersByStars(items: MCPRegistryServer[]): MCPRegistryServer[] {
  const list = [...items]
  list.sort((a, b) => {
    const aStars = Number(a.githubStars ?? 0)
    const bStars = Number(b.githubStars ?? 0)
    if (aStars !== bStars) return bStars - aStars
    const aInst = Number(a.installCount ?? 0)
    const bInst = Number(b.installCount ?? 0)
    if (aInst !== bInst) return bInst - aInst
    return a.name.localeCompare(b.name)
  })
  return list
}

/**
 * Builds a stable unique key for React lists and dedupe.
 */
function uniqueKeyForServer(s: MCPRegistryServer): string {
  return (
    s.packageName ||
    s.repository?.url ||
    s.id ||
    s.name
  )
}

/**
 * Removes duplicate servers based on the unique key.
 */
function dedupeServers(servers: MCPRegistryServer[]): MCPRegistryServer[] {
  const map = new Map<string, MCPRegistryServer>()
  for (const s of servers) {
    const key = uniqueKeyForServer(s)
    if (!map.has(key)) map.set(key, s)
  }
  return Array.from(map.values())
}

interface MCPRegistryServer {
  id: string
  name: string
  description: string
  author?: string
  version?: string
  url?: string
  packageRegistry?: string
  packageName?: string
  repository?: {
    type: string
    url: string
  }
  tags?: string[]
  license?: string
  createdAt?: string
  updatedAt?: string
  installCount?: number
  rating?: number
  githubStars?: number
  tools?: Array<{
    name: string
    description?: string
  }>
}

interface MCPRegistryResponse {
  servers: MCPRegistryServer[]
  total?: number
  hasMore?: boolean
  page?: number
  limit?: number
}

interface MCPRegistryProps {
  onInstall?: (server: MCPRegistryServer) => void
  className?: string
}

interface CacheStats {
  totalServers: number
  serversByRegistry: Record<string, number>
  cacheEntries: number
  averageResponseTime: number
  cacheHitRate: number
  oldestEntry: string | null
  newestEntry: string | null
}

/**
 * MCP Registry component for discovering and installing servers from public registries
 */
export const MCPRegistry: React.FC<MCPRegistryProps> = ({ 
  onInstall,
  className 
}) => {
  const [servers, setServers] = useState<MCPRegistryServer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set())
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [installedServers, setInstalledServers] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [showCacheStats, setShowCacheStats] = useState(false)
  const [lastSearchTime, setLastSearchTime] = useState<number | null>(null)
  const pageSize = 50
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const loadCacheStats = useCallback(async () => {
    if (!window.electron?.getMCPCacheStats) return

    try {
      const result = await window.electron.getMCPCacheStats()
      if (result.success && result.data) {
        setCacheStats(result.data)
      }
    } catch (error) {
    }
  }, [])


  const searchRegistries = useCallback(async (query: string = '', tags: string[] = [], pageNum: number = 0, append: boolean = false) => {
    if (!window.electron?.searchMCPRegistry) {
      setError('Registry search not available')
      return
    }

    if (pageNum === 0) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    const searchStartTime = Date.now()

    try {
      const result = await window.electron.searchMCPRegistry({
        query: query.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        limit: pageSize,
        offset: pageNum * pageSize
      })

      const searchTime = Date.now() - searchStartTime
      setLastSearchTime(searchTime)
      

      if (result.success && result.data) {
        if (append) {
          setServers(prev => sortServersByStars(dedupeServers([...prev, ...(result.data.servers || [])])))
        } else {
          setServers(sortServersByStars(dedupeServers(result.data.servers || [])))
        }
        setTotal(result.data.total || 0)
        const calculatedHasMore = result.data.hasMore || false
        setHasMore(calculatedHasMore)
        setPage(pageNum)

        loadCacheStats()
      } else {
        setError(result.error || 'Failed to search registries')
        if (!append) {
          setServers([])
          setTotal(0)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search registries')
      if (!append) {
        setServers([])
        setTotal(0)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [pageSize, loadCacheStats])

  useEffect(() => {
    searchRegistries('', [], 0, false)
    loadCacheStats()
    loadInstalledServers()
  }, [])
  
  const loadInstalledServers = async () => {
    if (!window.electron?.loadMCPServers) return
    
    try {
      const result = await window.electron.loadMCPServers()
      if (result.success && result.data) {
        const serverNames = result.data.map((server: any) => server.name.toLowerCase())
        setInstalledServers(serverNames)
      }
    } catch (error) {
    }
  }


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
    { value: 'cloud', label: 'Cloud' }
  ]

  const getCategoryKeywords = (category: string): string[] => {
    const keywordMap: Record<string, string[]> = {
      'ai': ['ai', 'ml', 'llm', 'gpt', 'claude', 'model', 'neural', 'artificial', 'intelligence'],
      'database': ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'db', 'sqlite', 'redis'],
      'development': ['code', 'developer', 'programming', 'ide', 'editor', 'debug', 'lint'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deployment', 'monitoring', 'jenkins', 'terraform'],
      'communication': ['slack', 'discord', 'email', 'chat', 'messaging', 'notification'],
      'filesystem': ['file', 'filesystem', 'directory', 'folder', 'storage'],
      'api': ['api', 'rest', 'graphql', 'webhook', 'integration', 'http'],
      'security': ['security', 'auth', 'encryption', 'password', 'ssl', 'oauth', 'jwt'],
      'analytics': ['analytics', 'metrics', 'monitoring', 'logging', 'tracking', 'telemetry'],
      'cloud': ['aws', 'azure', 'gcp', 'cloud', 's3', 'lambda', 'ec2']
    }
    return keywordMap[category] || []
  }

  const filterServersByCategory = (servers: MCPRegistryServer[], category: string) => {
    if (!category) return servers
    
    const keywords = getCategoryKeywords(category)
    return servers.filter(server => {
      const text = (server.name + ' ' + server.description).toLowerCase()
      return keywords.some(keyword => text.includes(keyword))
    })
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(0)
    searchRegistries(query, selectedTags, 0, false)
  }

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    
    setSelectedTags(newTags)
    setPage(0)
    searchRegistries(searchQuery, newTags, 0, false)
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setPage(0)
  }

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    searchRegistries(searchQuery, selectedTags, nextPage, true)
  }, [page, searchQuery, selectedTags, searchRegistries])

  useEffect(() => {
    const currentRef = loadMoreRef.current
    const computedHasMore = hasMore || (total > servers.length)
    if (!currentRef || !computedHasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && computedHasMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(currentRef)

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, total, servers.length, isLoadingMore, loadMore])

  const handleInstall = async (server: MCPRegistryServer) => {
    if (!window.electron?.installMCPFromRegistry) {
      setError('Installation not available')
      return
    }
    
    if (installedServers.includes(server.name.toLowerCase())) {
      setError(`${server.name} is already installed`)
      return
    }

    setInstallingIds(prev => new Set(prev).add(server.id))
    setError(null)
    
    try {
      const result = await window.electron.installMCPFromRegistry(
        server.id,
        server.packageName
      )

      if (result.success) {
        setInstalledIds(prev => new Set(prev).add(server.id))
        setInstalledServers(prev => [...prev, server.name.toLowerCase()])
        
        setSuccessMessage(`${server.name} installed successfully!`)
        
        setTimeout(() => {
          setSuccessMessage(null)
        }, 5000)
        
        setTimeout(() => {
          setInstalledIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(server.id)
            return newSet
          })
        }, 5000)
        
        onInstall?.(server)
        
        setTimeout(() => {
          loadInstalledServers()
        }, 1000)
      } else {
        setError(result.error || 'Failed to install server')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install server')
    } finally {
      setInstallingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(server.id)
        return newSet
      })
    }
  }

  const availableTags = React.useMemo(() => {
    const tags = new Set<string>()
    servers.forEach(server => {
      server.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [servers])

  const filteredServers = React.useMemo(() => {
    return filterServersByCategory(servers, selectedCategory)
  }, [servers, selectedCategory])

  const sortedServers = React.useMemo(() => sortServersByStars(filteredServers), [filteredServers])

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search MCP servers..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={async () => {
              if (window.electron?.clearMCPRegistryCache) {
                await window.electron.clearMCPRegistryCache()
              }
              if (window.electron?.triggerMCPBackgroundSync) {
                await window.electron.triggerMCPBackgroundSync()
              }
              setPage(0)
              searchRegistries(searchQuery, selectedTags, 0, false)
            }}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <FiRefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCacheStats(!showCacheStats)}
            className="flex items-center gap-2"
          >
            <FiActivity className="w-4 h-4" />
            Stats
          </Button>
        </div>

        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Typography variant="body1" color="muted" className="text-sm font-medium mr-2">
              Filter by tags:
            </Typography>
            {availableTags.slice(0, 10).map(tag => (
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
                <FiTag className="inline w-3 h-3 mr-1" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {showCacheStats && cacheStats && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <FiDatabase className="w-4 h-4" />
              <Typography variant="h6">Cache Statistics</Typography>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Typography variant="body1" color="muted" className="text-xs">
                  Total Servers
                </Typography>
                <Typography variant="body1" className="font-semibold">
                  {cacheStats.totalServers?.toLocaleString() || '0'}
                </Typography>
              </div>
              <div>
                <Typography variant="body1" color="muted" className="text-xs">
                  Cache Entries
                </Typography>
                <Typography variant="body1" className="font-semibold">
                  {cacheStats.cacheEntries?.toLocaleString() || '0'}
                </Typography>
              </div>
              <div>
                <Typography variant="body1" color="muted" className="text-xs">
                  Hit Rate
                </Typography>
                <Typography variant="body1" className="font-semibold">
                  {cacheStats.cacheHitRate?.toFixed(1) || '0.0'}%
                </Typography>
              </div>
              <div>
                <Typography variant="body1" color="muted" className="text-xs">
                  Avg Response
                </Typography>
                <Typography variant="body1" className="font-semibold">
                  {cacheStats.averageResponseTime ? Math.round(cacheStats.averageResponseTime) : 0}ms
                </Typography>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Typography variant="body1" color="muted" className="text-xs mb-2">
                Servers by Registry
              </Typography>
              <div className="flex flex-wrap gap-2">
                {cacheStats.serversByRegistry && Object.entries(cacheStats.serversByRegistry).map(([registry, count]) => (
                  <span
                    key={registry}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                  >
                    {registry}: {count?.toLocaleString() || '0'}
                  </span>
                ))}
              </div>
            </div>
            {lastSearchTime && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <FiClock className="w-3 h-3" />
                Last search: {lastSearchTime}ms
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Typography variant="body1" color="muted">
          {(() => {
            if (isLoading) return 'Searching...'
            if (selectedCategory && filteredServers.length < servers.length) {
              return `Showing ${filteredServers.length} of ${total} servers`
            }
            return `Found ${total} server${total !== 1 ? 's' : ''}`
          })()}
        </Typography>
        {(selectedTags.length > 0 || selectedCategory) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTags([])
              setSelectedCategory('')
              setPage(0)
              searchRegistries(searchQuery, [], 0, false)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Typography variant="body1" className="text-red-700 dark:text-red-300">
            {error}
          </Typography>
        </div>
      )}
      
      {successMessage && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <Typography variant="body1" className="text-green-700 dark:text-green-300">
            {successMessage}
          </Typography>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="text-center py-12">
          <Typography variant="body1" color="muted">
            {(() => {
              if (selectedCategory) {
                const categoryLabel = categories.find(c => c.value === selectedCategory)?.label
                return `No servers found in the ${categoryLabel} category`
              }
              if (searchQuery || selectedTags.length > 0) {
                return 'No servers found matching your search criteria'
              }
              return 'No servers available in the registry'
            })()}
          </Typography>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedServers.map(server => (
              <ServerCard
                key={uniqueKeyForServer(server)}
                server={server}
                onInstall={() => handleInstall(server)}
                isInstalling={installingIds.has(server.id)}
                isInstalled={installedIds.has(server.id) || installedServers.includes(server.name.toLowerCase())}
              />
            ))}
          </div>
          
          {(hasMore || total > servers.length) && (
            <div className="mt-8 text-center" ref={loadMoreRef}>
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="min-w-[200px]"
              >
                {isLoadingMore ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More Servers
                    <span className="ml-2 text-sm text-gray-500">
                      ({servers.length} of {total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          
          {isLoadingMore && (
            <div className="mt-4 text-center">
              <Typography variant="body1" color="muted" className="flex items-center justify-center gap-2">
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                Loading more servers...
              </Typography>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface ServerCardProps {
  server: MCPRegistryServer
  onInstall: () => void
  isInstalling: boolean
  isInstalled?: boolean
}

const ServerCard: React.FC<ServerCardProps> = ({ server, onInstall, isInstalling, isInstalled }) => {
  const formatUpdatedAt = (dateString?: string) => {
    if (!dateString) return null
    try {
      return format(new Date(dateString), 'PP')
    } catch {
      return null
    }
  }

  const isInstallable = !!(
    server.packageName ||
    (server.repository?.url && server.repository.url.includes('github.com')) ||
    server.name
  )

  return (
    <div className={cn(
      "p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800 relative",
      !isInstallable && "opacity-75"
    )}>

      <div className="absolute top-3 right-3">
        {isInstalled ? (
          <div className="h-8 w-8 rounded-lg bg-[#5599fe]/10 flex items-center justify-center">
            <FiCheck className="w-4 h-4 text-[#5599fe]" />
          </div>
        ) : isInstalling ? (
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <FiRefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : !isInstallable ? (
          <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
            <FiX className="w-3 h-3 text-muted-foreground" />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onInstall}
            className="h-8 w-8 p-0 rounded-lg hover:bg-[#5599fe]/10 hover:text-[#5599fe] transition-colors"
            title="Install server"
          >
            <FiDownload className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <div className="mb-3">
        <div className="flex items-start justify-between mb-2">
          <Typography variant="h6" className="line-clamp-1 pr-10">
            {server.name}
          </Typography>
          {server.rating && (
            <div className="flex items-center gap-1 text-yellow-500 mr-10">
              <FiStar className="w-3 h-3 fill-current" />
              <Typography variant="caption">
                {server.rating.toFixed(1)}
              </Typography>
            </div>
          )}
        </div>
        
        <Typography variant="body1" color="muted" className="line-clamp-2 mb-2">
          {server.description}
        </Typography>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {server.githubStars !== undefined && server.githubStars !== null && (
            <div className="flex items-center gap-1">
              <FiStar className="w-3 h-3" />
              <span>{server.githubStars.toLocaleString()} stars</span>
            </div>
          )}
          {server.installCount !== undefined && server.installCount !== null && (
            <div className="flex items-center gap-1">
              <FiDownload className="w-3 h-3" />
              <span>{server.installCount.toLocaleString()} installs</span>
            </div>
          )}
          {server.author && (
            <div className="flex items-center gap-1">
              <FiUser className="w-3 h-3" />
              <span>{server.author}</span>
            </div>
          )}
          {server.version && (
            <div className="flex items-center gap-1">
              <span>v{server.version}</span>
            </div>
          )}
          {server.packageRegistry && (
            <div className="flex items-center gap-1">
              <span>{server.packageRegistry}</span>
            </div>
          )}
          {formatUpdatedAt(server.updatedAt) && (
            <div className="flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              <span>{formatUpdatedAt(server.updatedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {server.tags && server.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {server.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
            >
              {tag}
            </span>
          ))}
          {server.tags.length > 3 && (
            <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              +{server.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {server.tools && server.tools.length > 0 && (
        <div className="mb-3">
          <Typography variant="caption" color="muted" className="block mb-1">
            Available Tools ({server.tools.length})
          </Typography>
          <div className="flex flex-wrap gap-1">
            {server.tools.slice(0, 4).map((tool, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs rounded-full"
                title={tool.description}
              >
                {tool.name}
              </span>
            ))}
            {server.tools.length > 4 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs rounded-full">
                +{server.tools.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {(server.repository?.url || server.url) && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const url = server.repository?.url || server.url
              if (url) window.open(url, '_blank')
            }}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <FiExternalLink className="w-3 h-3 mr-1" />
            View Source
          </Button>
        </div>
      )}
    </div>
  )
}
