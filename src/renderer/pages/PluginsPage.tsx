import React, { useEffect, useMemo } from 'react'
import { ShieldCheck, PlugZap, AlertCircle, Loader2 } from 'lucide-react'

import Typography from '../components/ui/Typography'
import { Card, CardContent } from '../components/ui/Card'
import { Switch } from '../components/ui/switch'
import { Button } from '../components/ui/Button'
import { usePluginStore, builtinPluginDefinitions } from '../stores/pluginStore'
import { cn } from '../lib/utils'

const PluginsPage: React.FC = () => {
  const {
    plugins,
    isLoading,
    error,
    initializationState,
    loadInstalledPlugins,
    enablePlugin,
    disablePlugin,
    clearError
  } = usePluginStore()

  useEffect(() => {
    loadInstalledPlugins().catch(() => {})
  }, [loadInstalledPlugins])

  const orderedPlugins = useMemo(() => {
    return builtinPluginDefinitions
      .map(definition => plugins[definition.id])
      .filter((plugin): plugin is NonNullable<typeof plugin> => Boolean(plugin))
  }, [plugins])

  const handleToggle = (pluginId: string, nextValue: boolean) => {
    if (nextValue) {
      void enablePlugin(pluginId)
    } else {
      void disablePlugin(pluginId)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-5xl space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-hgo-blue/10 px-3 py-1 text-sm font-medium text-hgo-blue">
            <ShieldCheck className="h-4 w-4" />
            Trusted Plugins
          </div>
          <div className="space-y-2">
            <Typography variant="h1" className="text-3xl font-bold">
              Plugins
            </Typography>
            <Typography variant="body1" className="text-muted-foreground max-w-2xl">
              Toggle first-party plugins that extend the Moonscape assistant. Third-party and npm based
              plugins are coming later; for now you can enable or disable the curated experiences that ship
              with the desktop app.
            </Typography>
          </div>
        </header>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1 space-y-1">
                <Typography variant="body1" className="font-medium">
                  Something went wrong
                </Typography>
                <Typography variant="body2" className="text-muted-foreground">
                  {error}
                </Typography>
              </div>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <Typography variant="h2" className="text-xl font-semibold">
            Installed Plugins
          </Typography>

          {isLoading && initializationState !== 'ready' ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-muted-foreground/40 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <Typography variant="body1">Loading plugins…</Typography>
            </div>
          ) : orderedPlugins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-muted-foreground/40 py-12 text-center">
              <Typography variant="body1" className="text-muted-foreground">
                No plugins available yet.
              </Typography>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {orderedPlugins.map(plugin => {
                const definition = builtinPluginDefinitions.find(def => def.id === plugin.id)
                return (
                  <Card key={plugin.id} className="h-full border-muted-foreground/20">
                    <CardContent className="flex h-full flex-col justify-between gap-4 py-5">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Typography variant="h3" className="text-lg font-semibold">
                              {plugin.name}
                            </Typography>
                            <Typography variant="body2" className="text-xs text-muted-foreground">
                              Version {plugin.version}
                            </Typography>
                          </div>
                          <PlugZap className="h-5 w-5 text-hgo-blue" />
                        </div>
                        {definition && (
                          <Typography variant="body2" className="text-muted-foreground">
                            {definition.description}
                          </Typography>
                        )}
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                        <div className="text-sm text-muted-foreground">
                          {plugin.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={value => handleToggle(plugin.id, value)}
                          aria-label={`Toggle ${plugin.name}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-muted-foreground/20 bg-muted/40 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Typography variant="body1" className="font-semibold">
                Third-party plugins are on the roadmap
              </Typography>
              <Typography variant="body2" className="text-muted-foreground">
                We are building out the catalogue, permissions, and security review process for external
                integrations. Stay tuned for updates as we expand beyond the built-in experiences.
              </Typography>
            </div>
            <div className={cn('inline-flex items-center gap-2 rounded-full bg-hgo-blue/10 px-3 py-1 text-sm text-hgo-blue')}>
              <Loader2 className="h-4 w-4 animate-spin" />
              In development
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default PluginsPage
