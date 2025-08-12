import {
  classifyError,
  createMCPError,
  getErrorMessage,
  shouldAutoRetry,
  requiresUserAction,
  MCPErrorTracker,
  mcpErrorTracker,
} from '../../src/renderer/utils/mcpErrors'
import { factories } from './testHelpers'

describe('mcpErrors', () => {
  describe('classifyError', () => {
    it('should classify network errors correctly', () => {
      const networkErrors = [
        'ECONNREFUSED: Connection refused',
        'ENOTFOUND: Host not found',
        'Connection timeout occurred',
        'ETIMEDOUT: Operation timed out',
      ]

      networkErrors.forEach(error => {
        const classification = classifyError(error)
        expect(classification.type).toBe('network')
        expect(classification.severity).toBe('medium')
        expect(classification.recoverable).toBe(true)
        expect(classification.autoRetry).toBe(true)
        expect(classification.userAction).toBe(false)
      })
    })

    it('should classify authentication errors correctly', () => {
      const authErrors = [
        'Unauthorized access',
        'Invalid authentication token',
        'Access denied to resource',
        'Permission denied',
      ]

      authErrors.forEach(error => {
        const classification = classifyError(error)
        expect(classification.type).toBe('authentication')
        expect(classification.severity).toBe('high')
        expect(classification.recoverable).toBe(true)
        expect(classification.autoRetry).toBe(false)
        expect(classification.userAction).toBe(true)
      })
    })

    it('should classify protocol errors correctly', () => {
      const protocolErrors = [
        'Protocol error occurred',
        'Invalid message format',
        'JSONRPC parse error',
        'Malformed request',
      ]

      protocolErrors.forEach(error => {
        const classification = classifyError(error)
        expect(classification.type).toBe('protocol')
        expect(classification.recoverable).toBe(false)
        expect(classification.autoRetry).toBe(false)
        expect(classification.userAction).toBe(true)
      })
    })

    it('should classify resource errors correctly', () => {
      const resourceErrors = [
        'ENOENT: File not found',
        'EACCES: Permission denied',
        'EMFILE: Too many open files',
      ]

      resourceErrors.forEach(error => {
        const classification = classifyError(error)
        expect(classification.type).toBe('resource')
        expect(classification.recoverable).toBe(true)
      })
    })

    it('should classify configuration errors correctly', () => {
      const configErrors = [
        'Configuration invalid',
        'Missing required parameter',
        'Command not found',
      ]

      configErrors.forEach(error => {
        const classification = classifyError(error)
        expect(classification.type).toBe('configuration')
        expect(classification.severity).toBe('high')
        expect(classification.recoverable).toBe(true)
        expect(classification.autoRetry).toBe(false)
        expect(classification.userAction).toBe(true)
      })
    })

    it('should handle unknown errors', () => {
      const classification = classifyError('Some random error message')
      
      expect(classification.type).toBe('unknown')
      expect(classification.severity).toBe('medium')
      expect(classification.recoverable).toBe(true)
      expect(classification.autoRetry).toBe(false)
      expect(classification.userAction).toBe(true)
    })

    it('should classify Error objects', () => {
      const error = new Error('ECONNREFUSED: Connection refused')
      const classification = classifyError(error)
      
      expect(classification.type).toBe('network')
      expect(classification.autoRetry).toBe(true)
    })
  })

  describe('createMCPError', () => {
    it('should create error from string message', () => {
      const error = createMCPError('Test error message', 'server-1', { detail: 'extra info' })
      
      expect(error.message).toBe('Test error message')
      expect(error.serverId).toBe('server-1')
      expect(error.details).toEqual({ detail: 'extra info' })
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.code).toMatch(/^MCP_UNK_/)
      expect(error.recoverable).toBe(true)
    })

    it('should create error from Error object', () => {
      const originalError = new Error('Network connection failed')
      const error = createMCPError(originalError, 'server-2')
      
      expect(error.message).toBe('Network connection failed')
      expect(error.serverId).toBe('server-2')
      expect(error.type).toBe('network')
      expect(error.recoverable).toBe(true)
    })

    it('should generate unique error codes', () => {
      const error1 = createMCPError('Test error')
      const error2 = createMCPError('Test error')
      
      expect(error1.code).not.toBe(error2.code)
      expect(error1.code).toMatch(/^MCP_UNK_/)
      expect(error2.code).toMatch(/^MCP_UNK_/)
    })

    it('should generate different prefixes for different error types', () => {
      const networkError = createMCPError('ECONNREFUSED: Connection failed')
      const authError = createMCPError('Unauthorized access')
      
      expect(networkError.code).toMatch(/^MCP_NET_/)
      expect(authError.code).toMatch(/^MCP_AUT_/)
    })
  })

  describe('getErrorMessage', () => {
    it('should return user-friendly error message', () => {
      const error = factories.error('ECONNREFUSED: Connection failed', 'network')
      const message = getErrorMessage(error)
      
      expect(message.title).toBe('Network Connection Error')
      expect(message.description).toContain('Network connectivity issue')
      expect(message.actions).toContain('Check network connectivity')
      expect(message.severity).toBe('medium')
    })

    it('should handle all error types', () => {
      const errorTypes = ['network', 'authentication', 'protocol', 'resource', 'configuration', 'unknown'] as const
      
      errorTypes.forEach(type => {
        const error = factories.error(`Test ${type} error`, type)
        const message = getErrorMessage(error)
        
        expect(message.title).toBeTruthy()
        expect(message.description).toBeTruthy()
        expect(message.actions).toBeInstanceOf(Array)
        expect(message.actions.length).toBeGreaterThan(0)
        expect(['low', 'medium', 'high', 'critical']).toContain(message.severity)
      })
    })
  })

  describe('shouldAutoRetry', () => {
    it('should return true for auto-retryable errors', () => {
      const networkError = factories.error('ECONNREFUSED: Connection failed', 'network')
      expect(shouldAutoRetry(networkError)).toBe(true)
    })

    it('should return false for non-auto-retryable errors', () => {
      const authError = factories.error('Unauthorized access', 'authentication')
      expect(shouldAutoRetry(authError)).toBe(false)
    })

    it('should return false for non-recoverable errors', () => {
      const protocolError = factories.error('Protocol error', 'protocol')
      expect(shouldAutoRetry(protocolError)).toBe(false)
    })
  })

  describe('requiresUserAction', () => {
    it('should return true for errors requiring user action', () => {
      const authError = factories.error('Unauthorized access', 'authentication')
      expect(requiresUserAction(authError)).toBe(true)
    })

    it('should return false for automatic errors', () => {
      const networkError = factories.error('ECONNREFUSED: Connection failed', 'network')
      expect(requiresUserAction(networkError)).toBe(false)
    })
  })
})

describe('MCPErrorTracker', () => {
  let tracker: MCPErrorTracker

  beforeEach(() => {
    tracker = new MCPErrorTracker()
  })

  describe('recordError', () => {
    it('should record error for server', () => {
      const error = factories.error('Test error', 'network')
      error.serverId = 'server-1'
      
      tracker.recordError(error)
      
      const history = tracker.getErrorHistory('server-1')
      expect(history).toHaveLength(1)
      expect(history[0]).toBe(error)
    })

    it('should ignore errors without serverId', () => {
      const error = factories.error('Test error', 'network')
      delete error.serverId
      
      tracker.recordError(error)
      
      const history = tracker.getErrorHistory('server-1')
      expect(history).toHaveLength(0)
    })

    it('should maintain error order (newest first)', () => {
      const error1 = factories.error('First error', 'network')
      error1.serverId = 'server-1'
      const error2 = factories.error('Second error', 'network')
      error2.serverId = 'server-1'
      
      tracker.recordError(error1)
      tracker.recordError(error2)
      
      const history = tracker.getErrorHistory('server-1')
      expect(history).toHaveLength(2)
      expect(history[0]).toBe(error2)
      expect(history[1]).toBe(error1)
    })

    it('should limit error history to maxErrors', () => {
      const serverId = 'server-1'
      
      for (let i = 0; i < 105; i++) {
        const error = factories.error(`Error ${i}`, 'network')
        error.serverId = serverId
        tracker.recordError(error)
      }
      
      const history = tracker.getErrorHistory(serverId)
      expect(history).toHaveLength(100)
      expect(history[0].message).toBe('Error 104')
      expect(history[99].message).toBe('Error 5')
    })
  })

  describe('getErrorHistory', () => {
    it('should return empty array for unknown server', () => {
      const history = tracker.getErrorHistory('unknown-server')
      expect(history).toEqual([])
    })

    it('should return server-specific errors', () => {
      const error1 = factories.error('Server 1 error', 'network')
      error1.serverId = 'server-1'
      const error2 = factories.error('Server 2 error', 'network')
      error2.serverId = 'server-2'
      
      tracker.recordError(error1)
      tracker.recordError(error2)
      
      expect(tracker.getErrorHistory('server-1')).toHaveLength(1)
      expect(tracker.getErrorHistory('server-2')).toHaveLength(1)
      expect(tracker.getErrorHistory('server-1')[0]).toBe(error1)
      expect(tracker.getErrorHistory('server-2')[0]).toBe(error2)
    })
  })

  describe('getErrorStats', () => {
    it('should return stats for server with no errors', () => {
      const stats = tracker.getErrorStats('unknown-server')
      
      expect(stats.totalErrors).toBe(0)
      expect(stats.recentErrors).toBe(0)
      expect(stats.recoverableErrors).toBe(0)
      expect(stats.criticalErrors).toBe(0)
      expect(stats.errorsByType.network).toBe(0)
    })

    it('should calculate error statistics correctly', () => {
      const serverId = 'server-1'
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 30 * 60 * 1000)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      
      const recentError = factories.error('Recent error', 'network')
      recentError.serverId = serverId
      recentError.timestamp = oneHourAgo
      recentError.recoverable = true
      
      const oldError = factories.error('Old error', 'authentication')
      oldError.serverId = serverId
      oldError.timestamp = twoHoursAgo
      oldError.recoverable = false
      
      tracker.recordError(recentError)
      tracker.recordError(oldError)
      
      const stats = tracker.getErrorStats(serverId)
      
      expect(stats.totalErrors).toBe(2)
      expect(stats.recentErrors).toBe(1)
      expect(stats.recoverableErrors).toBe(1)
      expect(stats.errorsByType.network).toBe(1)
      expect(stats.errorsByType.authentication).toBe(1)
    })
  })

  describe('clearErrors', () => {
    it('should clear errors for specific server', () => {
      const error1 = factories.error('Server 1 error', 'network')
      error1.serverId = 'server-1'
      const error2 = factories.error('Server 2 error', 'network')
      error2.serverId = 'server-2'
      
      tracker.recordError(error1)
      tracker.recordError(error2)
      
      tracker.clearErrors('server-1')
      
      expect(tracker.getErrorHistory('server-1')).toHaveLength(0)
      expect(tracker.getErrorHistory('server-2')).toHaveLength(1)
    })
  })

  describe('getCommonErrors', () => {
    it('should return most common errors', () => {
      const serverId = 'server-1'
      
      for (let i = 0; i < 3; i++) {
        const error = factories.error('Common error', 'network')
        error.serverId = serverId
        tracker.recordError(error)
      }
      
      for (let i = 0; i < 2; i++) {
        const error = factories.error('Less common error', 'authentication')
        error.serverId = serverId
        tracker.recordError(error)
      }
      
      const error = factories.error('Rare error', 'protocol')
      error.serverId = serverId
      tracker.recordError(error)
      
      const commonErrors = tracker.getCommonErrors(serverId, 3)
      
      expect(commonErrors).toHaveLength(3)
      expect(commonErrors[0].message).toBe('Common error')
      expect(commonErrors[0].count).toBe(3)
      expect(commonErrors[1].message).toBe('Less common error')
      expect(commonErrors[1].count).toBe(2)
      expect(commonErrors[2].message).toBe('Rare error')
      expect(commonErrors[2].count).toBe(1)
    })

    it('should limit results to specified count', () => {
      const serverId = 'server-1'
      
      for (let i = 0; i < 5; i++) {
        const error = factories.error(`Error ${i}`, 'network')
        error.serverId = serverId
        tracker.recordError(error)
      }
      
      const commonErrors = tracker.getCommonErrors(serverId, 3)
      expect(commonErrors).toHaveLength(3)
    })

    it('should track last occurrence time', () => {
      const serverId = 'server-1'
      const firstTime = new Date(2023, 0, 1)
      const lastTime = new Date(2023, 0, 2)
      
      const error1 = factories.error('Test error', 'network')
      error1.serverId = serverId
      error1.timestamp = firstTime
      
      const error2 = factories.error('Test error', 'network')
      error2.serverId = serverId
      error2.timestamp = lastTime
      
      tracker.recordError(error1)
      tracker.recordError(error2)
      
      const commonErrors = tracker.getCommonErrors(serverId, 1)
      expect(commonErrors[0].lastOccurrence).toEqual(lastTime)
    })
  })
})

describe('global mcpErrorTracker', () => {
  it('should be a singleton instance', () => {
    expect(mcpErrorTracker).toBeInstanceOf(MCPErrorTracker)
  })
})