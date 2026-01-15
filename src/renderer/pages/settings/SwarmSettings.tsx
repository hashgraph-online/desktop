import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DEFAULT_SWARM_GATEWAY_URL } from '@/renderer/constants/swarm'
import { useConfigStore } from '../../stores/configStore'
import { swarmConfigSchema } from '../../schemas/configuration'
import { Input } from '../../components/ui'
import { Switch } from '../../components/ui/switch'
import Typography from '../../components/ui/Typography'

interface SwarmSettingsProps { }

export const SwarmSettings: React.FC<SwarmSettingsProps> = () => {
  const {
    config,
    setSwarmBeeApiUrl,
    setSwarmBeeFeedPK,
    setSwarmAutoAssignStamp,
    setSwarmDeferredUploadSizeThresholdMB,
    isSwarmConfigValid
  } = useConfigStore()

  const isSwarmEnabled = config?.advanced.swarmPluginEnabled ?? true

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm({
    resolver: zodResolver(swarmConfigSchema),
    defaultValues: {
      beeApiUrl: config?.swarm?.beeApiUrl ?? DEFAULT_SWARM_GATEWAY_URL,
      beeFeedPK: config?.swarm?.beeFeedPK ?? '',
      autoAssignStamp: config?.swarm?.autoAssignStamp ?? true,
      deferredUploadSizeThresholdMB: config?.swarm?.deferredUploadSizeThresholdMB ?? 5
    }
  })

  useEffect(() => {
    if (config?.swarm) {
      reset({
        beeApiUrl: config.swarm.beeApiUrl ?? DEFAULT_SWARM_GATEWAY_URL,
        beeFeedPK: config.swarm.beeFeedPK ?? '',
        autoAssignStamp: config.swarm.autoAssignStamp ?? true,
        deferredUploadSizeThresholdMB: config.swarm.deferredUploadSizeThresholdMB ?? 5
      });
    }
  }, [config, reset])

  const watchBeeApiUrl = watch('beeApiUrl')
  const watchBeeFeedPK = watch('beeFeedPK')
  const watchAutoAssignStamp = watch('autoAssignStamp')
  const watchDeferredUploadSizeThresholdMB = watch('deferredUploadSizeThresholdMB')

  useEffect(() => {
    const next = watchBeeApiUrl || ''
    if (config?.swarm?.beeApiUrl !== next) {
      setSwarmBeeApiUrl(next)
    }
  }, [watchBeeApiUrl, setSwarmBeeApiUrl, config?.swarm?.beeApiUrl])

  useEffect(() => {
    const next = watchBeeFeedPK || ''
    if (config?.swarm?.beeFeedPK !== next) {
      setSwarmBeeFeedPK(next)
    }
  }, [watchBeeFeedPK, setSwarmBeeFeedPK, config?.swarm?.beeFeedPK])

  useEffect(() => {
    const next = !!watchAutoAssignStamp
    if (config?.swarm?.autoAssignStamp !== next) {
      setSwarmAutoAssignStamp(next)
    }
  }, [watchAutoAssignStamp, setSwarmAutoAssignStamp, config?.swarm?.autoAssignStamp])

  useEffect(() => {
    const next = Number(watchDeferredUploadSizeThresholdMB) || 0
    if (config?.swarm?.deferredUploadSizeThresholdMB !== next) {
      setSwarmDeferredUploadSizeThresholdMB(next)
    }
  }, [watchDeferredUploadSizeThresholdMB, setSwarmDeferredUploadSizeThresholdMB, config?.swarm?.deferredUploadSizeThresholdMB])

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" noMargin>Swarm Configuration</Typography>
        <div className="mt-2">
          <Typography variant="body1" color="muted" noMargin>
            Configure Swarm plugin.
          </Typography>
        </div>
      </div>

      {!isSwarmEnabled && (
        <div className="p-4 border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <Typography variant="body1" className="font-medium text-yellow-800 dark:text-yellow-300" noMargin>
            Swarm plugin is currently disabled
          </Typography>
          <div className="mt-2">
            <Typography variant="body2" className="text-yellow-700 dark:text-yellow-400">
              To use Swarm features, please enable the plugin in the Advanced settings section.
            </Typography>
          </div>
        </div>
      )}

      {isSwarmEnabled && (
        <form className="space-y-4">
          <div>
            <Typography variant="body1" className="font-medium mb-1" noMargin>
              Bee API URL
            </Typography>
            <Input
              id="beeApiUrl"
              type="text"
              placeholder={DEFAULT_SWARM_GATEWAY_URL}
              {...register('beeApiUrl')}
              className={errors.beeApiUrl ? 'border-red-500' : ''}
            />
            {errors.beeApiUrl && (
              <div className="mt-1">
                <Typography variant="caption" className="text-red-600">{errors.beeApiUrl.message}</Typography>
              </div>
            )}
          </div>

          <div>
            <Typography variant="body1" className="font-medium mb-1" noMargin>
              Feed Private Key
            </Typography>
            <Input
              id="privateKey"
              type="password"
              placeholder="Enter your private key"
              {...register('beeFeedPK')}
              className={errors.beeFeedPK ? 'border-red-500' : ''}
            />
            {errors.beeFeedPK && (
              <div className="mt-1">
                <Typography variant="caption" className="text-red-600">{errors.beeFeedPK.message}</Typography>
              </div>
            )}
            <div className="mt-1">
              <Typography variant="caption" color="muted">
                Your private key is encrypted and stored securely using the system keychain.
              </Typography>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Typography variant="body1" className="font-medium" noMargin>
                Auto-assign postage stamp batch
              </Typography>
              <Typography variant="caption" color="muted">
                Automatically select a usable postage stamp batch for uploads when available.
              </Typography>
            </div>
            <Switch
              checked={watchAutoAssignStamp}
              onCheckedChange={(value) =>
                reset({ ...watch(), autoAssignStamp: value })
              }
            />
          </div>

          <div>
            <Typography variant="body1" className="font-medium mb-1" noMargin>
              Deferred upload size threshold (MB)
            </Typography>
            <Input
              id="deferredUploadSizeThresholdMB"
              type="number"
              min={0}
              step={1}
              {...register('deferredUploadSizeThresholdMB', { valueAsNumber: true })}
              className={errors.deferredUploadSizeThresholdMB ? 'border-red-500' : ''}
            />
            {errors.deferredUploadSizeThresholdMB && (
              <div className="mt-1">
                <Typography variant="caption" className="text-red-600">
                  {errors.deferredUploadSizeThresholdMB.message}
                </Typography>
              </div>
            )}
            <div className="mt-1">
              <Typography variant="caption" color="muted">
                Files larger than this size will be uploaded in the background.
              </Typography>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
