import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiMoon, FiSun, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi'
import { useConfigStore } from '../../stores/configStore'
import { advancedConfigSchema, type AdvancedConfigForm } from '../../schemas/configuration'
import Typography from '../../components/ui/Typography'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Button } from '../../components/ui/Button'
import { useLegalStore } from '../../stores/legalStore'

interface AdvancedSettingsProps { }

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = () => {
  const { config, setTheme, setAutoStart, setLogLevel } = useConfigStore()
  const { reset: resetLegal, legalAcceptance } = useLegalStore()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const {
    register,
    watch,
    reset
  } = useForm<AdvancedConfigForm>({
    resolver: zodResolver(advancedConfigSchema),
    defaultValues: {
      theme: config?.advanced?.theme || 'light',
      autoStart: config?.advanced?.autoStart || false,
      logLevel: config?.advanced?.logLevel || 'info'
    }
  })

  useEffect(() => {
    if (config?.advanced) {
      reset({
        theme: config.advanced.theme || 'light',
        autoStart: config.advanced.autoStart || false,
        logLevel: config.advanced.logLevel || 'info'
      })
    }
  }, [config, reset])

  const watchTheme = watch('theme')
  const watchAutoStart = watch('autoStart')
  const watchLogLevel = watch('logLevel')

  useEffect(() => {
    const updateTheme = async () => {
      await setTheme(watchTheme || 'light')
    }
    updateTheme()
  }, [watchTheme, setTheme])

  useEffect(() => {
    setAutoStart(watchAutoStart || false)
  }, [watchAutoStart, setAutoStart])

  useEffect(() => {
    setLogLevel(watchLogLevel || 'info')
  }, [watchLogLevel, setLogLevel])

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" noMargin>Advanced Settings</Typography>
        <div className="mt-2">
          <Typography variant="body1" color="muted" noMargin>
            Customize your application preferences and behavior.
          </Typography>
        </div>
      </div>

      <form className="space-y-6">
        <div>
          <Typography variant="body1" className="font-medium mb-3" noMargin>
            Theme
          </Typography>
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="light"
                {...register('theme')}
                className="mr-3"
              />
              <FiSun className="w-5 h-5 mr-2 text-yellow-500" />
              <div>
                <Typography variant="body1" className="font-medium">Light Mode</Typography>
                <Typography variant="caption" color="muted">Bright theme for daytime use</Typography>
              </div>
            </label>
            <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="radio"
                value="dark"
                {...register('theme')}
                className="mr-3"
              />
              <FiMoon className="w-5 h-5 mr-2 text-gray-700 dark:text-gray-300" />
              <div>
                <Typography variant="body1" className="font-medium">Dark Mode</Typography>
                <Typography variant="caption" color="muted">Dark theme for reduced eye strain</Typography>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="autoStart" className="text-base font-medium">Start on System Boot</Label>
              <Typography variant="caption" color="muted">
                Automatically launch the application when your computer starts
              </Typography>
            </div>
            <Switch
              id="autoStart"
              checked={watchAutoStart}
              onCheckedChange={(checked) => {
                reset({ ...watch(), autoStart: checked })
              }}
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="space-y-2">
            <Label htmlFor="logLevel" className="text-base font-medium">Log Level</Label>
            <Select
              value={watchLogLevel}
              onValueChange={(value) => {
                reset({ ...watch(), logLevel: value as any })
              }}
            >
              <SelectTrigger id="logLevel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Typography variant="caption" color="muted">Controls the verbosity of logs.</Typography>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="space-y-4">
            <div>
              <Typography variant="body1" className="font-medium mb-1" noMargin>Legal Agreements</Typography>
              <Typography variant="caption" color="muted">
                Manage your acceptance of Terms of Service and Privacy Policy
              </Typography>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="space-y-3">
                {legalAcceptance.termsAccepted && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <Typography variant="caption">
                      Terms accepted on {new Date(legalAcceptance.termsAcceptedAt || '').toLocaleDateString()}
                    </Typography>
                  </div>
                )}
                {legalAcceptance.privacyAccepted && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <Typography variant="caption">
                      Privacy Policy accepted on {new Date(legalAcceptance.privacyAcceptedAt || '').toLocaleDateString()}
                    </Typography>
                  </div>
                )}
                {(!legalAcceptance.termsAccepted || !legalAcceptance.privacyAccepted) && (
                  <Typography variant="caption" color="muted">
                    No legal agreements accepted yet
                  </Typography>
                )}
              </div>

              <div className="mt-4">
                {!showResetConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={!legalAcceptance.termsAccepted && !legalAcceptance.privacyAccepted}
                  >
                    <FiRefreshCw className="w-4 h-4" />
                    Reset Legal Agreements
                  </Button>
                ) : (
                  <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-2">
                      <FiAlertTriangle className="w-5 h-5 text-[#a679f0] mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <Typography variant="body2" className="font-medium">
                          Reset Legal Agreements?
                        </Typography>
                        <Typography variant="caption" color="muted">
                          This will reset your acceptance of Terms of Service and Privacy Policy.
                          You'll need to accept them again when the app reloads.
                        </Typography>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowResetConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#a679f0] to-[#5599fe] hover:from-[#9568e0] hover:to-[#4488ee] text-white"
                        onClick={() => {
                          resetLegal()
                          setTimeout(() => {
                            window.location.reload()
                          }, 100)
                        }}
                      >
                        Reset & Reload
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <Typography variant="body1" className="font-medium mb-3" noMargin>Application Info</Typography>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Version</Typography>
              <Typography variant="caption">1.0.0</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Electron</Typography>
              <Typography variant="caption">37.2.4</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Chrome</Typography>
              <Typography variant="caption">{navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || 'Unknown'}</Typography>
            </div>
            <div className="flex justify-between">
              <Typography variant="caption" color="muted">Node.js</Typography>
              <Typography variant="caption">{process.versions.node}</Typography>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}