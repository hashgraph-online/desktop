import React, { useState, useMemo } from 'react'
import {
  FiCode,
  FiDatabase,
  FiCpu,
  FiBriefcase,
  FiCloud,
  FiClock,
  FiSearch,
  FiStar,
  FiPlus,
  FiExternalLink,
  FiTerminal,
  FiFilter,
  FiX,
  FiCheck,
  FiDownload
} from 'react-icons/fi'
import { Button } from '../ui'
import { Input } from '../ui'
import Typography from '../ui/Typography'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { cn } from '../../lib/utils'
import popularServersData from '../../data/popularMCPServers.json'

interface MCPServerCatalogProps {
  onQuickInstall: (server: PopularMCPServer) => void
  installedServerIds?: string[]
}

interface PopularMCPServer {
  id: string
  name: string
  description: string
  category: string
  popularity: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  setupTime: string
  template: {
    type: string
    config: Record<string, any>
  }
  requirements: string[]
  documentation?: string
  installCommand?: string
  quickSetup: boolean
}

interface Category {
  id: string
  name: string
  description: string
  icon: string
}

const iconMap: Record<string, React.ElementType> = {
  FiCode,
  FiDatabase,
  FiCpu,
  FiBriefcase,
  FiCloud
}

const difficultyColors = {
  easy: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
  medium: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20',
  hard: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
}

const difficultyLabels = {
  easy: 'Easy Setup',
  medium: 'Moderate',
  hard: 'Advanced'
}

/**
 * Server card component for displaying individual server details
 */
const ServerCard: React.FC<{
  server: PopularMCPServer
  isInstalled: boolean
  onQuickInstall: () => void
}> = ({ server, isInstalled, onQuickInstall }) => {
  const [showRequirements, setShowRequirements] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow relative">
      <div className="absolute top-3 right-3">
        {isInstalled ? (
          <div className="h-8 w-8 rounded-lg bg-[#5599fe]/10 flex items-center justify-center">
            <FiCheck className="w-4 h-4 text-[#5599fe]" />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onQuickInstall}
            className="h-8 w-8 p-0 rounded-lg hover:bg-[#5599fe]/10 hover:text-[#5599fe] transition-colors"
            title="Install server"
          >
            <FiDownload className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-12">
          <div className="mb-1">
            <Typography variant="h3" className="text-lg font-semibold">
              {server.name}
            </Typography>
          </div>
          <Typography variant="body1" className="text-gray-600 dark:text-gray-400 text-sm">
            {server.description}
          </Typography>
        </div>
        <div className="flex items-center gap-1 text-yellow-500 mr-10">
          <FiStar className="w-4 h-4 fill-current" />
          <Typography variant="caption" className="font-medium">
            {server.popularity}%
          </Typography>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          difficultyColors[server.difficulty]
        )}>
          {difficultyLabels[server.difficulty]}
        </span>
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <FiClock className="w-3 h-3" />
          <Typography variant="caption">{server.setupTime}</Typography>
        </div>
        {server.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300"
          >
            {tag}
          </span>
        ))}
      </div>

      {server.requirements.length > 0 && (
        <button
          onClick={() => setShowRequirements(!showRequirements)}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline mb-3 flex items-center gap-1"
        >
          {showRequirements ? 'Hide' : 'Show'} requirements
          <FiFilter className={cn(
            'w-3 h-3 transition-transform',
            showRequirements && 'rotate-180'
          )} />
        </button>
      )}

      {showRequirements && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
          <div className="mb-2">
            <Typography variant="caption" className="font-medium block">
              Requirements:
            </Typography>
          </div>
          <ul className="space-y-1">
            {server.requirements.map((req, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                  {req}
                </Typography>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(server.documentation || server.installCommand) && (
        <div className="flex items-center gap-2">
          {server.documentation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(server.documentation, '_blank')}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <FiExternalLink className="w-3.5 h-3.5 mr-1" />
              Docs
            </Button>
          )}
          
          {server.installCommand && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(server.installCommand!)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FiTerminal className="w-3.5 h-3.5 mr-1" />
                  CLI
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy install command</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * MCP Server Catalog component for browsing and installing popular servers
 */
export const MCPServerCatalog: React.FC<MCPServerCatalogProps> = ({
  onQuickInstall,
  installedServerIds = []
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'popularity' | 'name' | 'difficulty'>('popularity')

  const categories = popularServersData.categories as Category[]
  const servers = popularServersData.servers as PopularMCPServer[]

  const filteredServers = useMemo(() => {
    let filtered = servers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(server =>
        server.name.toLowerCase().includes(query) ||
        server.description.toLowerCase().includes(query) ||
        server.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(server => server.category === selectedCategory)
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.popularity - a.popularity
        case 'name':
          return a.name.localeCompare(b.name)
        case 'difficulty': {
          const difficultyOrder = { easy: 0, medium: 1, hard: 2 }
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
        }
        default:
          return 0
      }
    })

    return filtered
  }, [searchQuery, selectedCategory, sortBy, servers])

  const handleQuickInstall = (server: PopularMCPServer) => {
    onQuickInstall(server)
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <div className="mb-2">
            <Typography variant="h2" className="text-2xl font-bold">
              Popular MCP Servers
            </Typography>
          </div>
        <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
          Discover and install popular MCP servers to extend your agent's capabilities
        </Typography>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search servers by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
        >
          <option value="popularity">Sort by Popularity</option>
          <option value="name">Sort by Name</option>
          <option value="difficulty">Sort by Difficulty</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All Categories
        </Button>
        {categories.map(category => {
          const Icon = iconMap[category.icon] || FiCode
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-1"
            >
              <Icon className="w-4 h-4" />
              {category.name}
            </Button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
          Showing {filteredServers.length} of {servers.length} servers
        </Typography>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1"
          >
            <FiX className="w-4 h-4" />
            Clear search
          </Button>
        )}
      </div>

      {filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              isInstalled={installedServerIds.includes(server.id)}
              onQuickInstall={() => handleQuickInstall(server)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
            No servers found matching your criteria
          </Typography>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory(null)
            }}
            className="mt-4"
          >
            Clear all filters
          </Button>
        </div>
      )}
      </div>
    </TooltipProvider>
  )
}