import React, { useState, useEffect } from 'react'
import { FiWifi, FiWifiOff, FiServer, FiTool, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import Typography from '../ui/Typography'
import { cn } from '../../lib/utils'

interface MCPConnectionTesterProps {
  serverId: string
  serverName: string
  onTest: () => Promise<void>
  result?: {
    success: boolean
    error?: string
    details?: {
      version?: string
      tools?: number
      capabilities?: string[]
    }
  }
  loading?: boolean
}

enum TestStage {
  Idle,
  Connecting,
  Authenticating,
  LoadingTools,
  Complete
}

interface TestProgress {
  stage: TestStage
  message: string
  progress: number
}

/**
 * Enhanced MCP Connection Tester with progress tracking
 */
export const MCPConnectionTester: React.FC<MCPConnectionTesterProps> = ({
  serverId,
  serverName,
  onTest,
  result,
  loading = false
}) => {
  const [testProgress, setTestProgress] = useState<TestProgress>({
    stage: TestStage.Idle,
    message: '',
    progress: 0
  })
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (loading) {
      simulateTestProgress()
    } else {
      setTestProgress({
        stage: TestStage.Idle,
        message: '',
        progress: 0
      })
    }
  }, [loading])

  const simulateTestProgress = () => {
    const stages = [
      { stage: TestStage.Connecting, message: 'Establishing connection...', progress: 25 },
      { stage: TestStage.Authenticating, message: 'Authenticating...', progress: 50 },
      { stage: TestStage.LoadingTools, message: 'Loading available tools...', progress: 75 },
      { stage: TestStage.Complete, message: 'Connection test complete', progress: 100 }
    ]

    stages.forEach((stage, index) => {
      setTimeout(() => {
        if (loading) {
          setTestProgress(stage)
        }
      }, index * 1000)
    })
  }

  const handleTest = async () => {
    setRetryCount(0)
    await onTest()
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    setRetryCount(prev => prev + 1)
    
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
    
    setTimeout(async () => {
      await onTest()
      setIsRetrying(false)
    }, delay)
  }

  const getStageIcon = (stage: TestStage) => {
    switch (stage) {
      case TestStage.Connecting:
        return <FiWifi className="w-5 h-5 animate-pulse" />
      case TestStage.Authenticating:
        return <FiServer className="w-5 h-5 animate-pulse" />
      case TestStage.LoadingTools:
        return <FiTool className="w-5 h-5 animate-pulse" />
      case TestStage.Complete:
        if (result?.success) {
          return <FiCheck className="w-5 h-5" />
        }
        return <FiX className="w-5 h-5" />
      default:
        return <FiWifiOff className="w-5 h-5" />
    }
  }

  const getProgressColor = () => {
    if (testProgress.stage === TestStage.Complete) {
      if (result?.success) {
        return 'bg-green-500'
      }
      return 'bg-red-500'
    }
    return 'bg-brand-blue'
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <Typography variant="h6" className="mb-2">
            Connection Test
          </Typography>
          <Typography variant="caption" color="muted">
            Testing connection to {serverName}
          </Typography>
        </div>

        {(loading || testProgress.stage !== TestStage.Idle) && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                testProgress.stage === TestStage.Complete && result?.success
                  ? "bg-green-100 dark:bg-green-900/20 text-green-600"
                  : testProgress.stage === TestStage.Complete && !result?.success
                  ? "bg-red-100 dark:bg-red-900/20 text-red-600"
                  : "bg-brand-blue/10 text-brand-blue"
              )}>
                {getStageIcon(testProgress.stage)}
              </div>
              <div className="flex-1">
                <Typography variant="body1" className="font-medium">
                  {testProgress.message}
                </Typography>
                {testProgress.stage === TestStage.Complete && result && (
                  <Typography variant="caption" color="muted">
                    {result.success ? 'Connection successful' : result.error || 'Connection failed'}
                  </Typography>
                )}
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-out",
                  getProgressColor()
                )}
                style={{ width: `${testProgress.progress}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { stage: TestStage.Connecting, label: 'Connect' },
                { stage: TestStage.Authenticating, label: 'Authenticate' },
                { stage: TestStage.LoadingTools, label: 'Load Tools' },
                { stage: TestStage.Complete, label: 'Complete' }
              ].map((step) => (
                <div
                  key={step.stage}
                  className={cn(
                    "text-center transition-colors",
                    testProgress.stage >= step.stage
                      ? "text-gray-900 dark:text-white font-medium"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {result && testProgress.stage === TestStage.Complete && (
          <div className={cn(
            "p-4 rounded-lg border",
            result.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          )}>
            {result.success && result.details ? (
              <div className="space-y-2">
                <Typography variant="body1" className="font-medium text-green-800 dark:text-green-200">
                  Connection Successful
                </Typography>
                <div className="space-y-1 text-sm">
                  {result.details.version && (
                    <div className="flex justify-between">
                      <Typography variant="caption" color="muted">Version:</Typography>
                      <Typography variant="caption">{result.details.version}</Typography>
                    </div>
                  )}
                  {result.details.tools !== undefined && (
                    <div className="flex justify-between">
                      <Typography variant="caption" color="muted">Available Tools:</Typography>
                      <Typography variant="caption">{result.details.tools}</Typography>
                    </div>
                  )}
                  {result.details.capabilities && result.details.capabilities.length > 0 && (
                    <div>
                      <Typography variant="caption" color="muted">Capabilities:</Typography>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.details.capabilities.map((cap, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300 text-xs rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Typography variant="body1" className="font-medium text-red-800 dark:text-red-200">
                  Connection Failed
                </Typography>
                <Typography variant="caption" className="text-red-700 dark:text-red-300">
                  {result.error || 'Unable to connect to the server'}
                </Typography>
                {retryCount > 0 && (
                  <Typography variant="caption" color="muted">
                    Retry attempt {retryCount} failed. Next retry in {Math.min(1000 * Math.pow(2, retryCount), 10000) / 1000}s
                  </Typography>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!loading && testProgress.stage === TestStage.Idle && (
            <Button
              onClick={handleTest}
              className="flex-1"
            >
              <FiWifi className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
          )}
          
          {result && !result.success && !loading && !isRetrying && (
            <Button
              onClick={handleRetry}
              variant="outline"
              className="flex-1"
            >
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
          )}
          
          {isRetrying && (
            <Button
              disabled
              variant="outline"
              className="flex-1"
            >
              <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Retrying...
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}