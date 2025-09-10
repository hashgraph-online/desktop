;(window as any).electron = {
  invoke: jest.fn(),
  loadConfig: jest.fn().mockResolvedValue({}),
  disconnectAgent: jest.fn().mockResolvedValue({ success: true }),
  updateFormState: jest.fn().mockResolvedValue({ success: true })
};

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  TransactionParser: jest.fn().mockImplementation(() => ({
    parseTransaction: jest.fn()
  })),
  HCSMessage: jest.fn()
}));



jest.mock('../../../src/renderer/stores/configStore', () => {
  const mockConfigStore = {
    config: {
      hedera: { accountId: '0.0.12345', network: 'testnet' },
      advanced: { operationalMode: 'autonomous' }
    },
    setOperationalMode: jest.fn(),
    saveConfig: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    destroy: jest.fn()
  };

  const useConfigStore = () => mockConfigStore;
  useConfigStore.getState = () => mockConfigStore;

  return {
    useConfigStore
  };
});

jest.mock('../../../src/renderer/stores/notificationStore', () => ({
  useNotificationStore: jest.fn()
}));

import { act, renderHook } from '@testing-library/react';
import {
  useAgentStore,
  type AgentStore,
  type Message,
  type ChatSession,
  type FormMessage
} from '../../../src/renderer/stores/agentStore';



describe('AgentStore', () => {
  const mockSession: ChatSession = {
    id: 'session-1',
    name: 'Test Session',
    mode: 'personal',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T01:00:00Z'
  };

  const mockMessage: Message = {
    id: 'message-1',
    role: 'user',
    content: 'Test message',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    metadata: {}
  };

  const mockFormMessage: FormMessage = {
    type: 'form',
    id: 'form-1',
    completionState: 'active'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const mockConfigStore = {
      config: {
        hedera: { network: 'testnet', accountId: '', privateKey: '' },
        openai: { apiKey: '', model: 'gpt-4o' },
        anthropic: { apiKey: '', model: 'claude-3-5-sonnet-20241022' },
        llmProvider: 'openai' as const,
        autonomousMode: false,
        advanced: {
          operationalMode: 'provideBytes' as const,
          autoStart: false,
          logLevel: 'info' as const,
          theme: 'light' as const
        }
      },
      isLoading: false,
      error: null,
      saveConfig: jest.fn(),
      loadConfig: jest.fn(),
      updateHederaConfig: jest.fn(),
      updateOpenAIConfig: jest.fn(),
      updateAnthropicConfig: jest.fn(),
      setLLMProvider: jest.fn(),
      setAutonomousMode: jest.fn(),
      updateAdvancedConfig: jest.fn()
    };

    const mockNotificationStore = {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
      clearNotifications: jest.fn(),
      notifications: []
    };

    (require('../../../src/renderer/stores/configStore') as any).useConfigStore = jest.fn(() => mockConfigStore);
    (require('../../../src/renderer/stores/notificationStore') as any).useNotificationStore = jest.fn(() => mockNotificationStore);

    const mockElectron = {
      invoke: jest.fn().mockResolvedValue({ success: true })
    };
    Object.defineProperty(window, 'electron', {
      value: mockElectron,
      writable: true
    });

    useAgentStore.setState({
      status: 'idle',
      isConnected: false,
      connectionError: null,
      messages: [],
      hcs10Messages: {},
      currentSessionId: null,
      currentSession: null,
      sessions: [],
      isTyping: false,
      processingContext: null,
      operationalMode: 'autonomous',
      chatContext: { mode: 'personal' },
      hcs10LoadingMessages: {},
      isInitialized: false,
      lastActiveSessionId: null,
      _operationLocks: {},
      _isCreatingSession: false
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useAgentStore());

      expect(result.current.status).toBe('idle');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionError).toBe(null);
      expect(result.current.messages).toEqual([]);
      expect(result.current.hcs10Messages).toEqual({});
      expect(result.current.currentSessionId).toBe(null);
      expect(result.current.currentSession).toBe(null);
      expect(result.current.sessions).toEqual([]);
      expect(result.current.isTyping).toBe(false);
      expect(result.current.processingContext).toBe(null);
      expect(result.current.operationalMode).toBe('autonomous');
      expect(result.current.chatContext).toEqual({ mode: 'personal' });
      expect(result.current.hcs10LoadingMessages).toEqual({});
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.lastActiveSessionId).toBe(null);
    });
  });

  describe('Status Management', () => {
    test('should set status correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setStatus('connecting');
      });

      expect(result.current.status).toBe('connecting');

      act(() => {
        result.current.setStatus('connected');
      });

      expect(result.current.status).toBe('connected');
    });

    test('should set connected state correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setConnected(true);
      });

      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.setConnected(false);
      });

      expect(result.current.isConnected).toBe(false);
    });

    test('should manage connection error correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setConnectionError('Connection failed');
      });

      expect(result.current.connectionError).toBe('Connection failed');

      act(() => {
        result.current.clearConnectionError();
      });

      expect(result.current.connectionError).toBe(null);
    });
  });

  describe('Typing State', () => {
    test('should set typing state correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setIsTyping(true, 'message');
      });

      expect(result.current.isTyping).toBe(true);
      expect(result.current.processingContext).toBe('message');

      act(() => {
        result.current.setIsTyping(false);
      });

      expect(result.current.isTyping).toBe(false);
      expect(result.current.processingContext).toBe(null);
    });
  });

  describe('Operational Mode', () => {
    test('should set operational mode correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      await act(async () => {
        await result.current.setOperationalMode('provideBytes');
      });

      expect(result.current.operationalMode).toBe('provideBytes');

      await act(async () => {
        await result.current.setOperationalMode('autonomous');
      });

      expect(result.current.operationalMode).toBe('autonomous');
    });
  });

  describe('Chat Context', () => {
    test('should set chat context correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setChatContext({
          mode: 'hcs10',
          topicId: '0.0.12345',
          agentName: 'Test Agent'
        });
      });

      expect(result.current.chatContext).toEqual({
        mode: 'hcs10',
        topicId: '0.0.12345',
        agentName: 'Test Agent'
      });
    });
  });

  describe('Message Management', () => {
    test('should add message to personal chat', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(mockMessage);
    });

    test('should add message to HCS-10 topic', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage, 'topic-123');
      });

      expect(result.current.hcs10Messages['topic-123']).toHaveLength(1);
      expect(result.current.hcs10Messages['topic-123'][0]).toEqual(mockMessage);
    });

    test('should clear messages for personal chat', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage);
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    test('should clear messages for specific HCS-10 topic', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage, 'topic-123');
        result.current.clearMessages('topic-123');
      });

      expect(result.current.hcs10Messages['topic-123']).toEqual([]);
    });

    test('should get messages for personal chat', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage);
      });

      const messages = result.current.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(mockMessage);
    });

    test('should get messages for specific HCS-10 topic', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage(mockMessage, 'topic-123');
      });

      const messages = result.current.getMessages('topic-123');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(mockMessage);
    });
  });

  describe('Session Management', () => {
    test('should set session ID correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setSessionId('session-123');
      });

      expect(result.current.currentSessionId).toBe('session-123');
    });

    test('should start new session correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.startNewSession('session-123');
      });

      expect(result.current.currentSessionId).toBe('session-123');
      expect(result.current.messages).toEqual([]);
    });

    test('should set current session correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setCurrentSession(mockSession);
      });

      expect(result.current.currentSession).toEqual(mockSession);
    });
  });

  describe('Operation Locking', () => {
    test('should lock and unlock operations correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      const locked1 = result.current._lockOperation('test-operation');
      expect(locked1).toBe(true);
      expect(result.current._operationLocks['test-operation']).toBe(true);

      const locked2 = result.current._lockOperation('test-operation');
      expect(locked2).toBe(false);

      result.current._unlockOperation('test-operation');
      expect(result.current._operationLocks['test-operation']).toBeUndefined();

      const locked3 = result.current._lockOperation('test-operation');
      expect(locked3).toBe(true);
    });
  });

  describe('Form Management', () => {
    test('should find form message correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.addMessage({
          ...mockMessage,
          metadata: { formMessage: mockFormMessage }
        });
      });

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [{
          ...mockMessage,
          metadata: { formMessage: mockFormMessage }
        }]
      });

      const foundMessage = await result.current.findFormMessage('form-1');
      expect(foundMessage).toBeTruthy();
      expect(foundMessage?.metadata?.formMessage?.id).toBe('form-1');
    });

    test('should update form state correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.updateFormState('form-1', 'completed', {
          success: true,
          message: 'Form completed successfully',
          timestamp: Date.now()
        });
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('form:update-state', {
        formId: 'form-1',
        newState: 'completed',
        result: {
          success: true,
          message: 'Form completed successfully',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should process form submission correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      const formData = { field1: 'value1' };

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.processFormSubmission('form-1', formData);
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('form:submit', {
        formId: 'form-1',
        formData
      });
    });
  });

  describe('Transaction Management', () => {
    test('should approve transaction correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.approveTransaction('message-123');
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('transaction:approve', {
        messageId: 'message-123'
      });
    });

    test('should reject transaction correctly', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.rejectTransaction('message-123');
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('transaction:reject', {
        messageId: 'message-123'
      });
    });
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    test('should handle connection failure', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.connectionError).toBe('Connection failed');
    });

    test('should disconnect successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.setConnected(true);
        result.current.setStatus('connected');
      });

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.disconnect();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Message Sending', () => {
    test('should send message successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      const messageContent = 'Test message';
      const attachments = [
        {
          name: 'test.txt',
          data: 'file data',
          type: 'text/plain',
          size: 1024
        }
      ];

      await act(async () => {
        await result.current.sendMessage(messageContent, attachments);
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('agent:send-message', {
        content: messageContent,
        attachments,
        topicId: undefined
      });
    });

    test('should send message with topic ID', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.sendMessage('Test message', [], 'topic-123');
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('agent:send-message', {
        content: 'Test message',
        attachments: [],
        topicId: 'topic-123'
      });
    });
  });

  describe('Session Operations', () => {
    test('should create session successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: mockSession
      });

      const session = await act(async () => {
        return await result.current.createSession('Test Session', 'personal');
      });

      expect(session).toEqual(mockSession);
      expect(result.current.sessions).toContain(mockSession);
    });

    test('should load session successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: mockSession
      });

      await act(async () => {
        await result.current.loadSession('session-1');
      });

      expect(result.current.currentSession).toEqual(mockSession);
      expect(result.current.currentSessionId).toBe('session-1');
    });

    test('should save session successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.saveSession(mockSession);
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('chat:save-session', mockSession);
    });

    test('should delete session successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        result.current.sessions.push(mockSession);
      });

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.deleteSession('session-1');
      });

      expect(result.current.sessions).not.toContain(mockSession);
    });

    test('should load all sessions successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [mockSession]
      });

      const sessions = await act(async () => {
        return await result.current.loadAllSessions();
      });

      expect(sessions).toEqual([mockSession]);
      expect(result.current.sessions).toEqual([mockSession]);
    });

    test('should save message successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true
      });

      await act(async () => {
        await result.current.saveMessage(mockMessage, 'session-1');
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('chat:save-message', {
        message: mockMessage,
        sessionId: 'session-1'
      });
    });

    test('should load session messages successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [mockMessage]
      });

      const messages = await act(async () => {
        return await result.current.loadSessionMessages('session-1');
      });

      expect(messages).toEqual([mockMessage]);
    });
  });

  describe('HCS-10 Message Management', () => {
    test('should set HCS-10 messages correctly', () => {
      const { result } = renderHook(() => useAgentStore());

      const messages = [mockMessage];

      act(() => {
        result.current.setHCS10Messages('topic-123', messages);
      });

      expect(result.current.hcs10Messages['topic-123']).toEqual(messages);
    });

    test('should load conversation messages successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [mockMessage]
      });

      await act(async () => {
        await result.current.loadConversationMessages('topic-123');
      });

      expect(result.current.hcs10Messages['topic-123']).toEqual([mockMessage]);
    });

    test('should refresh conversation messages successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [mockMessage]
      });

      await act(async () => {
        await result.current.refreshConversationMessages('topic-123', true);
      });

      expect(result.current.hcs10LoadingMessages['topic-123']).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize sessions successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: [mockSession]
      });

      await act(async () => {
        await result.current.initializeSessions();
      });

      expect(result.current.sessions).toEqual([mockSession]);
      expect(result.current.isInitialized).toBe(true);
    });

    test('should restore last session successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: true,
        data: mockSession
      });

      await act(async () => {
        await result.current.restoreLastSession();
      });

      expect(result.current.currentSession).toEqual(mockSession);
      expect(result.current.currentSessionId).toBe(mockSession.id);
    });
  });

  describe('Error Handling', () => {
    test('should handle session creation failure', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: false,
        error: 'Failed to create session'
      });

      await expect(act(async () => {
        await result.current.createSession('Test Session', 'personal');
      })).rejects.toThrow('Failed to create session');
    });

    test('should handle message sending failure', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockResolvedValue({
        success: false,
        error: 'Failed to send message'
      });

      await expect(act(async () => {
        await result.current.sendMessage('Test message');
      })).rejects.toThrow('Failed to send message');
    });

    test('should handle connection failure gracefully', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.connectionError).toBe('Network error');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete session lifecycle', async () => {
      const { result } = renderHook(() => useAgentStore());

      (window.electron as any).invoke.mockImplementation((method: string, params?: any) => {
        switch (method) {
          case 'chat:create-session':
            return Promise.resolve({ success: true, data: { ...mockSession, id: params.sessionId } });
          case 'chat:load-session':
            return Promise.resolve({ success: true, data: mockSession });
          case 'agent:send-message':
            return Promise.resolve({ success: true });
          case 'chat:save-message':
            return Promise.resolve({ success: true });
          default:
            return Promise.resolve({ success: true });
        }
      });

      const session = await act(async () => {
        return await result.current.createSession('Test Session', 'personal');
      });

      expect(session.id).toBeDefined();
      expect(result.current.currentSessionId).toBe(session.id);

      await act(async () => {
        await result.current.loadSession(session.id);
      });

      expect(result.current.currentSession).toEqual(mockSession);

      await act(async () => {
        await result.current.sendMessage('Hello, world!');
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('agent:send-message', {
        content: 'Hello, world!',
        attachments: undefined,
        topicId: undefined
      });
    });

    test('should handle HCS-10 conversation flow', async () => {
      const { result } = renderHook(() => useAgentStore());

      const topicId = '0.0.12345';

      (window.electron as any).invoke.mockImplementation((method: string, params?: any) => {
        switch (method) {
          case 'hcs10:load-messages':
            return Promise.resolve({ success: true, data: [mockMessage] });
          case 'hcs10:send-message':
            return Promise.resolve({ success: true });
          default:
            return Promise.resolve({ success: true });
        }
      });

      act(() => {
        result.current.setChatContext({ mode: 'hcs10', topicId });
      });

      await act(async () => {
        await result.current.loadConversationMessages(topicId);
      });

      expect(result.current.hcs10Messages[topicId]).toEqual([mockMessage]);

      await act(async () => {
        await result.current.sendMessage('HCS-10 message', [], topicId);
      });

      expect((window.electron as any).invoke).toHaveBeenCalledWith('agent:send-message', {
        content: 'HCS-10 message',
        attachments: [],
        topicId
      });
    });
  });
});
