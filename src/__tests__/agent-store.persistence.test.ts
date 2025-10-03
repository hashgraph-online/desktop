import { describe, beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';

const matchMediaMock = vi.hoisted(() =>
  vi
    .fn()
    .mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
);

vi.stubGlobal('matchMedia', matchMediaMock);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

import type { Message, FormMessage } from '../renderer/stores/agentStore';
import { useAgentStore } from '../renderer/stores/agentStore';

type AgentStoreState = ReturnType<typeof useAgentStore['getState']>;

let defaultState: AgentStoreState;

type InvokeMock = ReturnType<typeof vi.fn>;

describe('AgentStore Tauri persistence bridge', () => {
  let invokeMock: InvokeMock;

  beforeAll(async () => {
    defaultState = useAgentStore.getState();
  });

  beforeEach(() => {
    invokeMock = vi.fn();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    Object.defineProperty(window, 'electron', {
      value: {
        invoke: invokeMock,
      },
      configurable: true,
    });

    resetAgentStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'electron');
    resetAgentStore();
  });

  it('persists messages with structured payloads and message type information', async () => {
    invokeMock.mockResolvedValue({ success: true });

    const formMessage: FormMessage = {
      type: 'form',
      id: 'form-1',
      originalPrompt: 'Test form prompt',
      toolName: 'test-tool',
      formConfig: {
        title: 'Test Form',
        fields: [],
      },
    };

    const message: Message = {
      id: 'message-1',
      role: 'assistant',
      content: 'Hello world',
      timestamp: new Date('2025-09-27T12:00:00.000Z'),
      messageType: 'form',
      metadata: { formMessage },
    };

    await useAgentStore.getState().saveMessage(message, 'session-123');

    expect(invokeMock).toHaveBeenCalledWith(
      'chat_save_message',
      expect.objectContaining({
        sessionId: 'session-123',
        message: expect.objectContaining({
          id: 'message-1',
          role: 'assistant',
          content: 'Hello world',
          timestamp: '2025-09-27T12:00:00.000Z',
          messageType: 'form',
          metadata: expect.objectContaining({
            formMessage: expect.objectContaining({ id: 'form-1' }),
          }),
        }),
      })
    );
  });

  it('hydrates renderer messages with metadata objects and message types', async () => {
    invokeMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'message-2',
          role: 'assistant',
          content: 'Stored',
          timestamp: '2025-09-27T13:00:00.000Z',
          messageType: 'text',
          metadata: {
            formMessage: {
              id: 'form-2',
              completionState: 'completed',
            },
          },
        },
      ],
    });

    const messages = await useAgentStore
      .getState()
      .loadSessionMessages('session-456');

    expect(messages).toHaveLength(1);
    expect(messages[0].timestamp.toISOString()).toBe(
      '2025-09-27T13:00:00.000Z'
    );
    expect(messages[0].messageType).toBe('text');
    expect(messages[0].metadata).toEqual({
      formMessage: { id: 'form-2', completionState: 'completed' },
    });
  });

  it('loads sessions from Tauri and stores them in-state', async () => {
    const sessions = [
      {
        id: 'session-789',
        name: 'Session 789',
        mode: 'personal',
        topicId: null,
        createdAt: '2025-09-27T10:00:00.000Z',
        updatedAt: '2025-09-27T11:00:00.000Z',
        lastMessageAt: '2025-09-27T11:30:00.000Z',
        isActive: true,
        messages: [],
      },
    ];

    invokeMock.mockResolvedValue({ success: true, data: sessions });

    const result = await useAgentStore.getState().loadAllSessions();

    expect(result).toEqual(sessions);
    expect(useAgentStore.getState().sessions).toEqual(sessions);
  });
});

function resetAgentStore() {
  useAgentStore.setState(defaultState, true);
  useAgentStore.setState(
    {
      sessions: [],
      messages: [],
      hcs10Messages: {},
      currentSession: null,
      currentSessionId: null,
    },
    false
  );
}
