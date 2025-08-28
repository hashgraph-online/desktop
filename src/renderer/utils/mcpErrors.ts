export type MCPErrorType = 'network' | 'authentication' | 'protocol' | 'resource' | 'configuration' | 'unknown'

export interface MCPError {
  type: MCPErrorType
  code: string
  message: string
  details?: MCPErrorDetails
  timestamp: Date
  serverId?: string
  recoverable: boolean
}

export interface MCPErrorDetails {
  stack?: string
  code?: string | number
  context?: Record<string, unknown>
  serverInfo?: {
    name?: string
    version?: string
    type?: string
  }
  requestInfo?: {
    method?: string
    id?: string | number
    params?: Record<string, unknown>
  }
}

export interface MCPErrorClassification {
  type: MCPErrorType
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
  autoRetry: boolean
  userAction: boolean
  remediationSteps: string[]
  description: string
}

/**
 * Error classification patterns and their corresponding types
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp
  type: MCPErrorType
  classification: Omit<MCPErrorClassification, 'type'>
}> = [
  {
    pattern: /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|ENETUNREACH/i,
    type: 'network',
    classification: {
      severity: 'medium',
      recoverable: true,
      autoRetry: true,
      userAction: false,
      description: 'Network connectivity issue preventing connection to the MCP server',
      remediationSteps: [
        'Check network connectivity',
        'Verify server is running and accessible',
        'Check firewall settings',
        'Wait for automatic retry'
      ]
    }
  },
  {
    pattern: /timeout|timed out/i,
    type: 'network',
    classification: {
      severity: 'medium',
      recoverable: true,
      autoRetry: true,
      userAction: false,
      description: 'Connection attempt timed out',
      remediationSteps: [
        'Check network latency',
        'Verify server responsiveness',
        'Consider increasing timeout values',
        'Wait for automatic retry'
      ]
    }
  },
  {
    pattern: /network.*connection.*failed|connection.*failed/i,
    type: 'network',
    classification: {
      severity: 'medium',
      recoverable: true,
      autoRetry: true,
      userAction: false,
      description: 'Network connection failed',
      remediationSteps: [
        'Check network connectivity',
        'Verify server is running',
        'Check firewall settings',
        'Wait for automatic retry'
      ]
    }
  },

  {
    pattern: /ENOENT|file.*not.*found|path.*not.*exist/i,
    type: 'resource',
    classification: {
      severity: 'medium',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'Required file or directory not found',
      remediationSteps: [
        'Verify file/directory paths in configuration',
        'Check file system permissions',
        'Create missing directories if needed',
        'Update configuration with correct paths'
      ]
    }
  },
  {
    pattern: /EACCES|EACCES.*permission.*denied|EACCES.*access.*denied/i,
    type: 'resource',
    classification: {
      severity: 'medium',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'File system permission denied',
      remediationSteps: [
        'Check file/directory permissions',
        'Run with appropriate user privileges',
        'Modify file system permissions',
        'Contact system administrator'
      ]
    }
  },
  {
    pattern: /EMFILE|ENFILE|too.*many.*files/i,
    type: 'resource',
    classification: {
      severity: 'high',
      recoverable: true,
      autoRetry: true,
      userAction: false,
      description: 'System resource exhaustion (file handles)',
      remediationSteps: [
        'Wait for automatic retry',
        'Close unused applications',
        'Increase system file handle limits',
        'Contact system administrator'
      ]
    }
  },

  {
    pattern: /forbidden|not.*authorized/i,
    type: 'authentication',
    classification: {
      severity: 'high',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'Insufficient permissions to access the resource',
      remediationSteps: [
        'Check user permissions',
        'Verify role assignments',
        'Contact administrator for proper access',
        'Review server access policies'
      ]
    }
  },
  {
    pattern: /unauthorized|authentication|invalid.*token|access.*denied.*resource|permission.*denied/i,
    type: 'authentication',
    classification: {
      severity: 'high',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'Authentication credentials are invalid or expired',
      remediationSteps: [
        'Verify authentication credentials',
        'Check if tokens have expired',
        'Update server configuration with valid credentials',
        'Contact administrator for access'
      ]
    }
  },
  
  {
    pattern: /protocol.*error|invalid.*message|jsonrpc|malformed/i,
    type: 'protocol',
    classification: {
      severity: 'high',
      recoverable: false,
      autoRetry: false,
      userAction: true,
      description: 'MCP protocol communication error',
      remediationSteps: [
        'Check MCP server version compatibility',
        'Verify server implements MCP protocol correctly',
        'Update server to compatible version',
        'Report issue to server maintainer'
      ]
    }
  },
  {
    pattern: /unsupported.*method|method.*not.*found/i,
    type: 'protocol',
    classification: {
      severity: 'medium',
      recoverable: false,
      autoRetry: false,
      userAction: true,
      description: 'Server does not support the requested operation',
      remediationSteps: [
        'Check server capabilities',
        'Update server to newer version',
        'Use alternative methods if available',
        'Contact server maintainer'
      ]
    }
  },

  {
    pattern: /configuration|config.*invalid|missing.*parameter/i,
    type: 'configuration',
    classification: {
      severity: 'high',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'Server configuration is invalid or incomplete',
      remediationSteps: [
        'Review server configuration settings',
        'Check for missing required parameters',
        'Validate configuration format',
        'Refer to server documentation'
      ]
    }
  },
  {
    pattern: /command.*not.*found|executable.*not.*found/i,
    type: 'configuration',
    classification: {
      severity: 'high',
      recoverable: true,
      autoRetry: false,
      userAction: true,
      description: 'Server executable or command not found',
      remediationSteps: [
        'Install required server packages',
        'Check PATH environment variable',
        'Verify server installation',
        'Update configuration with correct paths'
      ]
    }
  }
]

/**
 * Classify an error based on its message and context
 */
export function classifyError(error: string | Error, _serverId?: string): MCPErrorClassification {
  const errorMessage = typeof error === 'string' ? error : error.message
  
  for (const { pattern, type, classification } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        type,
        ...classification
      }
    }
  }
  
  return {
    type: 'unknown',
    severity: 'medium',
    recoverable: true,
    autoRetry: false,
    userAction: true,
    description: 'An unrecognized error occurred',
    remediationSteps: [
      'Check server logs for more details',
      'Verify server configuration',
      'Try restarting the server',
      'Contact support if issue persists'
    ]
  }
}

/**
 * Create a standardized error object
 */
export function createMCPError(
  error: string | Error,
  serverId?: string,
  details?: MCPErrorDetails
): MCPError {
  const errorMessage = typeof error === 'string' ? error : error.message
  const classification = classifyError(error, serverId)
  
  return {
    type: classification.type,
    code: generateErrorCode(classification.type, errorMessage),
    message: errorMessage,
    details,
    timestamp: new Date(),
    serverId,
    recoverable: classification.recoverable
  }
}

/**
 * Generate a unique error code based on type and message
 */
function generateErrorCode(type: MCPErrorType, message: string): string {
  const typePrefix = type.toUpperCase().slice(0, 3)
  const messageHash = message
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8)
  const timestamp = Date.now().toString().slice(-8) // Use more digits for better uniqueness
  const random = Math.random().toString(36).substring(2, 5) // Add random component

  return `MCP_${typePrefix}_${messageHash}_${timestamp}_${random}`
}

/**
 * Get user-friendly error message with remediation suggestions
 */
export function getErrorMessage(error: MCPError): {
  title: string
  description: string
  actions: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  const classification = classifyError(error.message, error.serverId)
  
  const titles: Record<MCPErrorType, string> = {
    network: 'Network Connection Error',
    authentication: 'Authentication Error',
    protocol: 'Protocol Error',
    resource: 'Resource Error',
    configuration: 'Configuration Error',
    unknown: 'Unknown Error'
  }
  
  return {
    title: titles[error.type],
    description: classification.description,
    actions: classification.remediationSteps,
    severity: classification.severity
  }
}

/**
 * Check if an error should trigger automatic retry
 */
export function shouldAutoRetry(error: MCPError): boolean {
  const classification = classifyError(error.message, error.serverId)
  return classification.autoRetry && classification.recoverable
}

/**
 * Check if an error requires user action
 */
export function requiresUserAction(error: MCPError): boolean {
  const classification = classifyError(error.message, error.serverId)
  return classification.userAction
}

/**
 * Get error statistics and patterns
 */
export class MCPErrorTracker {
  private errors: Map<string, MCPError[]> = new Map()
  private readonly maxErrors = 100
  
  /**
   * Record a new error
   */
  recordError(error: MCPError): void {
    if (!error.serverId) return
    
    let serverErrors = this.errors.get(error.serverId) || []
    serverErrors.unshift(error)
    
    if (serverErrors.length > this.maxErrors) {
      serverErrors = serverErrors.slice(0, this.maxErrors)
    }
    
    this.errors.set(error.serverId, serverErrors)
  }
  
  /**
   * Get error history for a server
   */
  getErrorHistory(serverId: string): MCPError[] {
    return this.errors.get(serverId) || []
  }
  
  /**
   * Get error statistics for a server
   */
  getErrorStats(serverId: string): {
    totalErrors: number
    errorsByType: Record<MCPErrorType, number>
    recentErrors: number
    recoverableErrors: number
    criticalErrors: number
  } {
    const serverErrors = this.errors.get(serverId) || []
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const stats = {
      totalErrors: serverErrors.length,
      errorsByType: {
        network: 0,
        authentication: 0,
        protocol: 0,
        resource: 0,
        configuration: 0,
        unknown: 0
      } as Record<MCPErrorType, number>,
      recentErrors: 0,
      recoverableErrors: 0,
      criticalErrors: 0
    }
    
    serverErrors.forEach(error => {
      stats.errorsByType[error.type]++
      
      if (error.timestamp > oneHourAgo) {
        stats.recentErrors++
      }
      
      if (error.recoverable) {
        stats.recoverableErrors++
      }
      
      const classification = classifyError(error.message, error.serverId)
      if (classification.severity === 'critical') {
        stats.criticalErrors++
      }
    })
    
    return stats
  }
  
  /**
   * Clear error history for a server
   */
  clearErrors(serverId: string): void {
    this.errors.delete(serverId)
  }
  
  /**
   * Get most common error patterns
   */
  getCommonErrors(serverId: string, limit = 5): Array<{
    message: string
    count: number
    type: MCPErrorType
    lastOccurrence: Date
  }> {
    const serverErrors = this.errors.get(serverId) || []
    const errorCounts = new Map<string, { count: number, type: MCPErrorType, lastOccurrence: Date }>()
    
    serverErrors.forEach(error => {
      const key = error.message
      const existing = errorCounts.get(key)
      
      if (existing) {
        existing.count++
        if (error.timestamp > existing.lastOccurrence) {
          existing.lastOccurrence = error.timestamp
        }
      } else {
        errorCounts.set(key, {
          count: 1,
          type: error.type,
          lastOccurrence: error.timestamp
        })
      }
    })
    
    return Array.from(errorCounts.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

export const mcpErrorTracker = new MCPErrorTracker()