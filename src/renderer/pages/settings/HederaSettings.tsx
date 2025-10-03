import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { useConfigStore } from '../../stores/configStore'
import { hederaConfigSchema, type HederaConfigForm } from '../../schemas/configuration'
import { Input } from '../../components/ui'
import { Button } from '../../components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import Typography from '../../components/ui/Typography'

interface HederaSettingsProps { }

export const HederaSettings: React.FC<HederaSettingsProps> = () => {
  const { config, setHederaAccountId, setHederaPrivateKey, setHederaNetwork, testHederaConnection, isHederaConfigValid } = useConfigStore()
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isMainnetEnabled, setIsMainnetEnabled] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<HederaConfigForm>({
    resolver: zodResolver(hederaConfigSchema),
    defaultValues: {
      accountId: config?.hedera?.accountId || '',
      privateKey: config?.hedera?.privateKey || '',
      network: config?.hedera?.network || 'testnet'
    }
  })

  React.useEffect(() => {
    if (config?.hedera) {
      reset({
        accountId: config.hedera.accountId || '',
        privateKey: config.hedera.privateKey || '',
        network: config.hedera.network || 'testnet'
      })
    }
  }, [config, reset])

  const watchAccountId = watch('accountId')
  const watchPrivateKey = watch('privateKey')
  const watchNetwork = watch('network')

  useEffect(() => {
    window?.desktop?.getEnvironmentConfig?.()?.then((envConfig: any) => {
      const mainnetEnabled = envConfig.enableMainnet || false
      setIsMainnetEnabled(mainnetEnabled)
      
      if (!mainnetEnabled && watchNetwork === 'mainnet') {
        reset({ ...watch(), network: 'testnet' })
        setHederaNetwork('testnet')
      }
    }).catch(() => {
      setIsMainnetEnabled(false)
      if (watchNetwork === 'mainnet') {
        reset({ ...watch(), network: 'testnet' })
        setHederaNetwork('testnet')
      }
    })
  }, [watchNetwork, reset, watch, setHederaNetwork])

  React.useEffect(() => {
    const next = watchAccountId || ''
    if (config?.hedera?.accountId !== next) {
      setHederaAccountId(next)
    }
  }, [watchAccountId, setHederaAccountId, config?.hedera?.accountId])

  React.useEffect(() => {
    const next = watchPrivateKey || ''
    if (config?.hedera?.privateKey !== next) {
      setHederaPrivateKey(next)
    }
  }, [watchPrivateKey, setHederaPrivateKey, config?.hedera?.privateKey])

  React.useEffect(() => {
    const next = watchNetwork || 'testnet'
    if (config?.hedera?.network !== next) {
      setHederaNetwork(next)
    }
  }, [watchNetwork, setHederaNetwork, config?.hedera?.network])

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await testHederaConnection()
      setTestResult({
        success: result.success,
        message: result.success ? 'Connection successful!' : result.error || 'Connection failed'
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h4" noMargin>Hedera Configuration</Typography>
        <div className="mt-2">
          <Typography variant="body1" color="muted" noMargin>
            Configure your Hedera account credentials and network settings.
          </Typography>
        </div>
      </div>

      <form className="space-y-4">
        <div>
          <Typography variant="body1" className="font-medium mb-1" noMargin>
            Account ID
          </Typography>
          <Input
            id="accountId"
            type="text"
            placeholder="0.0.12345"
            {...register('accountId')}
            className={errors.accountId ? 'border-red-500' : ''}
          />
          {errors.accountId && (
            <div className="mt-1">
              <Typography variant="caption" className="text-red-600">{errors.accountId.message}</Typography>
            </div>
          )}
        </div>

        <div>
          <Typography variant="body1" className="font-medium mb-1" noMargin>
            Private Key
          </Typography>
          <Input
            id="privateKey"
            type="password"
            placeholder="Enter your private key"
            {...register('privateKey')}
            className={errors.privateKey ? 'border-red-500' : ''}
          />
          {errors.privateKey && (
            <div className="mt-1">
              <Typography variant="caption" className="text-red-600">{errors.privateKey.message}</Typography>
            </div>
          )}
          <div className="mt-1">
            <Typography variant="caption" color="muted">
              Your private key is encrypted and stored securely using the system keychain.
            </Typography>
          </div>
        </div>

        <div>
          <Typography variant="body1" className="font-medium mb-1" noMargin>
            Network
          </Typography>
          <Select
            value={watchNetwork}
            onValueChange={(value) => {
              reset({ ...watch(), network: value as any })
            }}
          >
            <SelectTrigger id="network" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="testnet">Testnet</SelectItem>
              {isMainnetEnabled && (
                <SelectItem value="mainnet">Mainnet</SelectItem>
              )}
            </SelectContent>
          </Select>
          {!isMainnetEnabled && (
            <div className="mt-1">
              <Typography variant="caption" color="muted">
                Only testnet is available in this configuration.
              </Typography>
            </div>
          )}
        </div>

        <div className="pt-4">
          <Button
            type="button"
            onClick={handleTestConnection}
            disabled={!isHederaConfigValid() || isTesting}
            variant={isHederaConfigValid() ? 'default' : 'secondary'}
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-md flex items-center space-x-2 ${testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
          >
            {testResult.success ? (
              <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <Typography variant="caption">{testResult.message}</Typography>
          </div>
        )}
      </form>
    </div>
  )
}
