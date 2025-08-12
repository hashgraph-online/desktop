import React, { useState, useEffect, useMemo } from 'react'
import { 
  Package,
  Search,
  Download,
  Power,
  PowerOff,
  Trash2,
  RefreshCw,
  CheckCircle,
  Loader2,
  Info,
  Grid3x3,
  List,
  Sparkles,
  Puzzle,
  AlertCircle,
  X,
  Wrench
} from 'lucide-react'
import Typography from '../components/ui/Typography'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/input'
import { usePluginStore } from '../stores/pluginStore'
import type { PluginConfig, PluginSearchResult } from '../../shared/types/plugin'
import { cn } from '../lib/utils'

type ViewMode = 'installed' | 'catalog'

interface PluginsPageProps {}

/**
 * Main page for plugin management with discovery, installation, and configuration
 */
const PluginsPage: React.FC<PluginsPageProps> = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('installed')
  const [searchQuery, setSearchQuery] = useState('')
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set())
  
  const {
    plugins,
    searchResults,
    isSearching,
    isInstalling,
    isLoading,
    error,
    searchError,
    installError,
    installProgress,
    updateInfo,
    searchPlugins,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    enablePlugin,
    disablePlugin,
    loadInstalledPlugins,
    checkForUpdates,
    clearError,
    getEnabledPlugins
  } = usePluginStore()

  useEffect(() => {
    loadInstalledPlugins()
  }, [loadInstalledPlugins])

  useEffect(() => {
    const checkUpdates = () => checkForUpdates().catch(() => {})
    checkUpdates()
    const interval = setInterval(checkUpdates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkForUpdates])

  useEffect(() => {
    if (viewMode === 'catalog' && searchQuery) {
      const debounceTimer = setTimeout(() => {
        searchPlugins(searchQuery).catch(() => {})
      }, 500)
      return () => clearTimeout(debounceTimer)
    }
  }, [searchQuery, viewMode, searchPlugins])

  const installedPluginsList = useMemo(() => {
    const pluginsList = Object.values(plugins)
    if (!searchQuery) return pluginsList
    
    const query = searchQuery.toLowerCase()
    return pluginsList.filter(plugin => 
      plugin.name.toLowerCase().includes(query) ||
      plugin.metadata.description?.toLowerCase().includes(query) ||
      plugin.metadata.keywords?.some(k => k.toLowerCase().includes(query))
    )
  }, [plugins, searchQuery])

  const isPluginInstalled = (name: string) => {
    return Object.values(plugins).some(p => p.name === name)
  }

  const handleInstallPlugin = async (name: string) => {
    setInstallingPlugins(prev => new Set(prev).add(name))
    try {
      await installPlugin(name)
    } catch (error) {
    } finally {
      setInstallingPlugins(prev => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  const handleUninstallPlugin = async (pluginId: string) => {
    const plugin = plugins[pluginId]
    if (!plugin) return
    
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"? This action cannot be undone.`)) {
      try {
        await uninstallPlugin(pluginId)
      } catch (error) {
      }
    }
  }

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enablePlugin(pluginId)
      } else {
        await disablePlugin(pluginId)
      }
    } catch (error) {
    }
  }

  const handleUpdatePlugin = async (pluginId: string) => {
    try {
      await updatePlugin(pluginId)
    } catch (error) {
    }
  }

  const renderPluginCard = (plugin: PluginConfig) => {
    const updateAvailable = updateInfo[plugin.id]
    const progress = installProgress[plugin.id]
    
    return (
      <Card 
        key={plugin.id} 
        className={cn(
          "group hover:shadow-md transition-all duration-200 border overflow-hidden",
          plugin.enabled && "border-[#5599fe]/30 bg-gradient-to-br from-[#5599fe]/5 to-transparent"
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1">
              <Typography variant="h6" className="font-medium text-sm mb-1">
                {plugin.name}
              </Typography>
              <div className="flex items-center gap-2">
                <Typography variant="body2" className="text-xs text-muted-foreground">
                  v{plugin.version}
                </Typography>
                {updateAvailable && (
                  <span className="text-xs px-1.5 py-0.5 bg-[#5599fe] text-white rounded">
                    Update available
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTogglePlugin(plugin.id, !plugin.enabled)}
              className={cn(
                "h-6 w-6 p-0 transition-colors",
                plugin.enabled 
                  ? "text-[#5599fe] hover:text-[#4488ed]" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {plugin.enabled ? (
                <Power className="h-3.5 w-3.5" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          
          <Typography variant="body2" className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {plugin.metadata.description}
          </Typography>
          
          {progress && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{progress.phase}</span>
                {progress.progress && <span className="text-[#5599fe]">{progress.progress}%</span>}
              </div>
              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                <div 
                  className="h-full bg-[#5599fe] transition-all duration-300"
                  style={{ width: `${progress.progress || 0}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {updateAvailable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdatePlugin(plugin.id)}
                disabled={isInstalling}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleUninstallPlugin(plugin.id)}
              disabled={isInstalling}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSearchResultCard = (result: PluginSearchResult) => {
    const installed = isPluginInstalled(result.name)
    const installing = installingPlugins.has(result.name)
    
    return (
      <Card key={result.name} className="group hover:shadow-md transition-all duration-200">
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1">
              <Typography variant="h6" className="font-medium text-sm mb-1">
                {result.name}
              </Typography>
              <Typography variant="body2" className="text-xs text-muted-foreground">
                v{result.version}
              </Typography>
            </div>
            {installed && (
              <div className="flex items-center gap-1 text-[#5599fe]">
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="text-xs">Installed</span>
              </div>
            )}
          </div>
          
          <Typography variant="body2" className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {result.description}
          </Typography>
          
          {result.score && (
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1">
                <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#5599fe]"
                    style={{ width: `${result.score.detail.quality * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Quality</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#5599fe]/70"
                    style={{ width: `${result.score.detail.popularity * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Popular</span>
              </div>
            </div>
          )}
          
          {!installed && (
            <Button
              size="sm"
              onClick={() => handleInstallPlugin(result.name)}
              disabled={installing || isInstalling}
              className="h-6 px-3 text-xs bg-[#5599fe] text-white hover:bg-[#4488ed] border-0"
            >
              {installing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-6xl">

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Typography variant="h1" className="text-3xl font-bold bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent">
                Plugins
              </Typography>
              <div className="px-2 py-1 bg-[#5599fe]/20 text-[#5599fe] dark:text-[#5599fe] rounded-md text-xs font-semibold">
                COMING SOON
              </div>
            </div>
            
            <div className="flex items-center p-1 bg-muted rounded-lg opacity-50 pointer-events-none">
              <Button
                variant={viewMode === 'installed' ? 'default' : 'ghost'}
                size="sm"
                disabled
                className={cn(
                  "transition-all",
                  viewMode === 'installed' && "bg-[#5599fe] text-white hover:bg-[#4488ed]"
                )}
              >
                <List className="h-4 w-4 mr-2" />
                Installed
              </Button>
              <Button
                variant={viewMode === 'catalog' ? 'default' : 'ghost'}
                size="sm"
                disabled
                className={cn(
                  "transition-all",
                  viewMode === 'catalog' && "bg-[#5599fe] text-white hover:bg-[#4488ed]"
                )}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                Discover
              </Button>
            </div>
          </div>
          
          <Typography variant="body1" className="text-muted-foreground mb-3 text-sm">
            The plugin system will allow you to extend your agent with additional capabilities
          </Typography>
          
          {/* Coming Soon Notice - Made more prominent */}
          <div className="p-4 bg-gradient-to-br from-[#5599fe]/20 to-[#5599fe]/10 rounded-lg border-2 border-[#5599fe]/30">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#5599fe] mt-0.5" />
              <div>
                <Typography variant="body1" className="font-semibold text-[#5599fe] mb-1">
                  Plugin System Under Development
                </Typography>
                <Typography variant="body2" className="text-sm text-muted-foreground">
                  The plugin system is currently being developed and is not yet functional. Soon you'll be able to:
                </Typography>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]" />
                    Install plugins from the NPM registry
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]" />
                    Extend your agent with custom tools and integrations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]" />
                    Manage plugin configurations and permissions
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>


        {(error || searchError || installError) && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Typography variant="body1" className="font-medium mb-1">
                Error
              </Typography>
              <Typography variant="body2" className="text-muted-foreground">
                {error || searchError || installError}
              </Typography>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="p-1 hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Coming Soon Message - Moved up */}
        <div className="text-center py-8 mb-6 bg-gradient-to-br from-[#5599fe]/5 to-[#5599fe]/10 rounded-xl border border-[#5599fe]/20">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5599fe]/20 to-[#5599fe]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-8 h-8 text-[#5599fe]" />
            </div>
            <Typography variant="h4" className="font-bold mb-2">
              Plugin System Coming Soon
            </Typography>
            <Typography variant="body1" className="text-muted-foreground mb-4">
              We're working hard to bring you an amazing plugin ecosystem. Check back soon!
            </Typography>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#5599fe]/10 text-[#5599fe] rounded-full text-sm">
              <Loader2 className="w-3 h-3 animate-spin" />
              In Development
            </div>
          </div>
        </div>

        {/* Search Bar - Disabled */}
        <div className="mb-6 opacity-50 pointer-events-none">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search"
              value=""
              disabled
              className="pl-10 h-9"
            />
          </div>
        </div>

        {/* Main Content - With overlay */}
        <div className="relative">
          {/* Overlay to show content is not functional */}
          <div className="absolute inset-0 bg-background/60 z-10 rounded-lg flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <Typography variant="body1" className="text-muted-foreground">
                Preview of upcoming plugin interface
              </Typography>
            </div>
          </div>
          
          {/* Original content - now behind overlay */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
            {viewMode === 'installed' ? (
              <>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <Typography variant="body1" className="text-muted-foreground">
                      Loading plugins...
                    </Typography>
                  </div>
                ) : installedPluginsList.length === 0 ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#5599fe]/20 to-[#5599fe]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Package className="h-8 w-8 text-[#5599fe]" />
                      </div>
                      <Typography variant="h5" className="text-lg mb-2">
                        No Plugins Installed
                      </Typography>
                      <Typography variant="body1" className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                        Browse the catalog to discover and install plugins.
                      </Typography>
                      <Button
                        onClick={() => setViewMode('catalog')}
                        size="sm"
                        className="bg-[#5599fe] text-white hover:bg-[#4488ed] border-0"
                      >
                        <Grid3x3 className="h-3.5 w-3.5 mr-1.5" />
                        Browse Catalog
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {installedPluginsList.map(plugin => renderPluginCard(plugin))}
                  </div>
                )}
              </>
            ) : (
              <>
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <Typography variant="body1" className="text-muted-foreground">
                      Searching plugins...
                    </Typography>
                  </div>
                ) : searchResults.length === 0 && searchQuery ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="p-16 text-center">
                      <Typography variant="h5" className="mb-2">
                        No Results Found
                      </Typography>
                      <Typography variant="body1" className="text-muted-foreground">
                        Try searching with different keywords
                      </Typography>
                    </CardContent>
                  </Card>
                ) : searchResults.length > 0 ? (
                  <div className="grid gap-3">
                    {searchResults.map(result => renderSearchResultCard(result))}
                  </div>
                ) : (
                  <Card className="border-dashed border-2">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#5599fe]/20 to-[#5599fe]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Puzzle className="h-8 w-8 text-[#5599fe]" />
                      </div>
                      <Typography variant="body1" className="text-sm text-muted-foreground">
                        Enter a search term to discover plugins
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>


          <div className="space-y-4">

            <Card className="overflow-hidden">
              <div className="h-0.5 bg-[#5599fe]" />
              <CardContent className="p-4">
                <Typography variant="h6" className="font-medium text-sm mb-3">
                  Statistics
                </Typography>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Installed
                    </Typography>
                    <Typography variant="body2" className="text-xs font-medium">
                      {Object.keys(plugins).length}
                    </Typography>
                  </div>
                  <div className="flex justify-between items-center">
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Enabled
                    </Typography>
                    <Typography variant="body2" className="text-xs font-medium text-[#5599fe]">
                      {getEnabledPlugins().length}
                    </Typography>
                  </div>
                  <div className="flex justify-between items-center">
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Updates
                    </Typography>
                    <Typography variant="body2" className="text-xs font-medium text-[#5599fe]">
                      {Object.keys(updateInfo).length}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardContent className="p-4">
                <Typography variant="h6" className="font-medium text-sm mb-3">
                  Quick Actions
                </Typography>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-8 text-xs border-[#48df7b]/30 hover:bg-[#48df7b]/5"
                    onClick={() => checkForUpdates()}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Check Updates
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-8 text-xs border-[#5599fe]/30 hover:bg-[#5599fe]/5"
                    onClick={() => setViewMode('catalog')}
                  >
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Discover
                  </Button>
                </div>
              </CardContent>
            </Card>


            <Card className="bg-gradient-to-br from-[#5599fe]/10 to-[#5599fe]/5 border-[#5599fe]/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-3.5 w-3.5 text-[#5599fe]" />
                  <Typography variant="h6" className="font-medium text-sm">
                    Coming Soon
                  </Typography>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]" />
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Local development
                    </Typography>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]/70" />
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Custom registries
                    </Typography>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]/50" />
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Permissions
                    </Typography>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#5599fe]/30" />
                    <Typography variant="body2" className="text-xs text-muted-foreground">
                      Advanced config
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default PluginsPage