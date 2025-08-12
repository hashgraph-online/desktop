import { renderHook, act } from '@testing-library/react'
import { useAgentStore, Message } from '../../../src/renderer/stores/agentStore'

// Mock the configStore since it's used by agentStore
jest.mock('../../../src/renderer/stores/configStore', () => ({
  useConfigStore: {
    getState: () => ({
      config: {
        advanced: { operationalMode: 'autonomous' }
      },
      setOperationalMode: jest.fn(),
      saveConfig: jest.fn()
    })
  }
}))

// Mock the notification store
jest.mock('../../../src/renderer/stores/notificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      addNotification: jest.fn()
    })
  }
}))

// Mock TransactionParser
jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: {
    validateTransactionBytes: jest.fn(() => ({ isValid: true })),
    parseTransactionBytes: jest.fn(() => ({ type: 'test' }))
  }
}))

const mockElectron = {
  connectAgent: jest.fn(),
  disconnectAgent: jest.fn(),
  sendMessage: jest.fn(),
  loadConfig: jest.fn(),
  initializeAgent: jest.fn(),
  sendAgentMessage: jest.fn(),
}

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
})

describe('agentStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAgentStore.setState({
      status: 'idle',
      isConnected: false,
      connectionError: null,
      messages: [],
      currentSessionId: null,
    })
  })

  describe('Status Management', () => {
    it('should set status', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setStatus('connecting')
      })

      expect(result.current.status).toBe('connecting')
    })

    it('should set connected state', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.status).toBe('connected')

      act(() => {
        result.current.setConnected(false)
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.status).toBe('idle')
    })

    it('should set connection error', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnectionError('Connection failed')
      })

      expect(result.current.connectionError).toBe('Connection failed')
      expect(result.current.status).toBe('error')
      expect(result.current.isConnected).toBe(false)
    })

    it('should clear connection error', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnectionError('Test error')
      })

      expect(result.current.connectionError).toBe('Test error')

      act(() => {
        result.current.clearConnectionError()
      })

      expect(result.current.connectionError).toBe(null)
    })
  })

  describe('Message Management', () => {
    it('should add messages', () => {
      const { result } = renderHook(() => useAgentStore())

      const message1: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      }

      const message2: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date()
      }

      act(() => {
        result.current.addMessage(message1)
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toEqual(message1)

      act(() => {
        result.current.addMessage(message2)
      })

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[1]).toEqual(message2)
    })

    it('should clear messages', () => {
      const { result } = renderHook(() => useAgentStore())

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Test',
        timestamp: new Date()
      }

      act(() => {
        result.current.addMessage(message)
      })

      expect(result.current.messages).toHaveLength(1)

      act(() => {
        result.current.clearMessages()
      })

      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('Session Management', () => {
    it('should set session ID', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setSessionId('session-123')
      })

      expect(result.current.currentSessionId).toBe('session-123')
    })

    it('should start new session', () => {
      const { result } = renderHook(() => useAgentStore())

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Old message',
        timestamp: new Date()
      }

      act(() => {
        result.current.addMessage(message)
        result.current.setSessionId('old-session')
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.currentSessionId).toBe('old-session')

      act(() => {
        result.current.startNewSession('new-session')
      })

      expect(result.current.currentSessionId).toBe('new-session')
      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('Agent Connection', () => {
    it('should connect successfully', async () => {
      const { result } = renderHook(() => useAgentStore())

      mockElectron.loadConfig.mockResolvedValue({
        hedera: {
          accountId: '0.0.12345',
          privateKey: 'test-key',
          network: 'testnet'
        },
        openai: {
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini'
        }
      })

      mockElectron.initializeAgent.mockResolvedValue({
        success: true,
        data: { sessionId: 'session-456' }
      })

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.status).toBe('connected')
      expect(result.current.currentSessionId).toBe('session-456')
      expect(result.current.connectionError).toBe(null)
    })

    it('should handle connection failure', async () => {
      const { result } = renderHook(() => useAgentStore())

      mockElectron.loadConfig.mockResolvedValue({
        hedera: {
          accountId: '0.0.12345',
          privateKey: 'test-key',
          network: 'testnet'
        },
        openai: {
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini'
        }
      })

      mockElectron.initializeAgent.mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      await act(async () => {
        try {
          await result.current.connect()
        } catch (error) {
        }
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.status).toBe('error')
      expect(result.current.connectionError).toBe('Network error')
    })

    it('should disconnect successfully', async () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-789')
      })

      mockElectron.disconnectAgent.mockResolvedValue(undefined)

      await act(async () => {
        await result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.status).toBe('idle')
      expect(result.current.currentSessionId).toBe(null)
      expect(result.current.connectionError).toBe(null)
    })

    it('should handle disconnect failure', async () => {
      const { result } = renderHook(() => useAgentStore())

      const error = new Error('Disconnect failed')
      mockElectron.disconnectAgent.mockRejectedValue(error)

      await act(async () => {
        try {
          await result.current.disconnect()
        } catch (e) {
        }
      })

      expect(result.current.status).toBe('error')
      expect(result.current.connectionError).toBe('Disconnect failed')
    })
  })

  describe('Message Sending', () => {
    it('should send message when connected', async () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-999')
      })

      const assistantMessage: Message = {
        id: 'msg-assistant',
        role: 'assistant',
        content: 'I can help with that!',
        timestamp: new Date()
      }

      mockElectron.sendAgentMessage.mockResolvedValue({
        success: true,
        response: assistantMessage
      })

      await act(async () => {
        await result.current.sendMessage('How can you help?')
      })

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[0].content).toBe('How can you help?')
      expect(result.current.messages[1]).toEqual(expect.objectContaining({
        role: 'assistant',
        content: 'I can help with that!'
      }))

      expect(mockElectron.sendAgentMessage).toHaveBeenCalledWith({
        content: 'How can you help?',
        chatHistory: [{ type: 'user', content: 'How can you help?' }],
        attachments: undefined
      })
    })

    it('should not send message when not connected', async () => {
      const { result } = renderHook(() => useAgentStore())

      await act(async () => {
        try {
          await result.current.sendMessage('Test message')
        } catch (error: any) {
          expect(error.message).toBe('Not connected to agent')
        }
      })

      expect(result.current.messages).toHaveLength(0)
      expect(mockElectron.sendAgentMessage).not.toHaveBeenCalled()
    })

    it('should handle send message error', async () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-error')
      })

      const error = new Error('Send failed')
      mockElectron.sendAgentMessage.mockResolvedValue({
        success: false,
        error: 'Send failed'
      })

      await act(async () => {
        try {
          await result.current.sendMessage('This will fail')
        } catch (e: any) {
          expect(e.message).toBe('Send failed')
        }
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].content).toBe('This will fail')
      expect(result.current.connectionError).toBe('Send failed')
    })
  })

  describe('Message ID Generation', () => {
    it('should generate unique message IDs', () => {
      const { result } = renderHook(() => useAgentStore())

      act(() => {
        result.current.setConnected(true)
        result.current.setSessionId('session-id-test')
      })

      mockElectron.sendAgentMessage.mockResolvedValue({
        success: false,
        error: 'Test error'
      })

      const messages: string[] = []

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.sendMessage(`Message ${i}`).catch(() => {})
        }
      })

      const messageIds = result.current.messages.map(m => m.id)
      const uniqueIds = new Set(messageIds)
      expect(uniqueIds.size).toBe(messageIds.length)

      messageIds.forEach(id => {
        expect(id).toMatch(/^msg-\d+-[a-z0-9]{9}$/)
      })
    })
  })
})