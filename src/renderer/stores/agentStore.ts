import { create } from 'zustand';
import { useConfigStore } from './configStore';
import {
  TransactionParser,
  Logger,
  HCSMessage,
} from '@hashgraphonline/standards-sdk';
import { useNotificationStore } from './notificationStore';
import type { ChatSession, ChatMessage } from '../../main/db/schema';

interface ParsedTransactionData {
  type: string;
  humanReadableType?: string;
  details: Record<string, unknown>;
  transfers?: Array<{
    accountId: string;
    amount: string | number;
    isDecimal?: boolean;
  }>;
  tokenTransfers?: Array<{
    tokenId: string;
    accountId: string;
    amount: number;
  }>;
  memo?: string;
}

interface SessionData {
  id: string;
  name: string;
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
}

const logger = new Logger({ module: 'AgentStore' });

export type AgentStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';
export type OperationalMode = 'autonomous' | 'provideBytes';

export interface FormMessage {
  type: 'form';
  id: string;
  completionState?: 'active' | 'submitting' | 'completed' | 'failed';
  completedAt?: number;
  completionResult?: {
    success: boolean;
    message: string;
    timestamp: number;
  };
  formConfig: {
    title: string;
    description?: string;
    fields: Array<{
      name: string;
      label: string;
      type:
        | 'text'
        | 'number'
        | 'select'
        | 'checkbox'
        | 'textarea'
        | 'file'
        | 'array'
        | 'object'
        | 'currency'
        | 'percentage';
      required: boolean;
      placeholder?: string;
      helpText?: string;
      defaultValue?: unknown;
      validation?: {
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        custom?: string;
      };
      options?: Array<{
        value: string;
        label: string;
        description?: string;
      }>;
      priority?: 'essential' | 'common' | 'advanced' | 'expert';
    }>;
    submitLabel?: string;
    cancelLabel?: string;
    metadata?: Record<string, unknown>;
  };
  originalPrompt: string;
  toolName: string;
  partialInput?: Record<string, unknown>;
  validationErrors?: Array<{
    path: string[];
    message: string;
    code: string;
  }>;
  jsonSchema?: Record<string, unknown>;
  uiSchema?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown> & {
    transactionBytes?: string;
    pendingApproval?: boolean;
    parsedTransaction?: ParsedTransactionData;
    transactionParsingError?: string;
    formMessage?: FormMessage;
  };
}

type ChatMode = 'personal' | 'hcs10';

interface ChatContext {
  mode: ChatMode;
  topicId?: string;
  agentName?: string;
}

export interface AgentStore {
  status: AgentStatus;
  isConnected: boolean;
  connectionError: string | null;
  messages: Message[];
  hcs10Messages: Record<string, Message[]>;
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  isTyping: boolean;
  processingContext: 'message' | 'form' | null;
  operationalMode: OperationalMode;
  chatContext: ChatContext;
  hcs10LoadingMessages: Record<string, boolean>;
  isInitialized: boolean;
  lastActiveSessionId: string | null;

  _operationLocks: Record<string, boolean>;
  _isCreatingSession: boolean;

  setStatus: (status: AgentStatus) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearConnectionError: () => void;
  setIsTyping: (typing: boolean, context?: 'message' | 'form' | null) => void;
  setOperationalMode: (mode: OperationalMode) => Promise<void>;
  setChatContext: (context: ChatContext) => void;

  addMessage: (message: Message, topicId?: string) => void;
  clearMessages: (topicId?: string) => void;
  getMessages: (topicId?: string) => Message[];
  loadConversationMessages: (topicId: string) => Promise<void>;
  refreshConversationMessages: (
    topicId: string,
    showLoading?: boolean
  ) => Promise<void>;
  setHCS10Messages: (topicId: string, messages: Message[]) => void;

  setSessionId: (sessionId: string | null) => void;
  startNewSession: (sessionId: string) => void;
  setCurrentSession: (session: ChatSession | null) => void;

  initializeSessions: () => Promise<void>;
  restoreLastSession: () => Promise<void>;

  _lockOperation: (key: string) => boolean;
  _unlockOperation: (key: string) => void;
  createSession: (
    name: string,
    mode: ChatMode,
    topicId?: string
  ) => Promise<ChatSession>;
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: (session: ChatSession) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  loadAllSessions: () => Promise<ChatSession[]>;
  saveMessage: (message: Message, sessionId: string) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<Message[]>;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (
    content: string,
    attachments?: Array<{
      name: string;
      data: string;
      type: string;
      size: number;
    }>,
    topicId?: string
  ) => Promise<void>;

  approveTransaction: (messageId: string) => Promise<void>;
  rejectTransaction: (messageId: string) => Promise<void>;
  findFormMessage: (formId: string) => Promise<Message | null>;
  updateFormState: (
    formId: string,
    newState: 'active' | 'submitting' | 'completed' | 'failed',
    result?: { success?: boolean; message?: string; timestamp?: number }
  ) => Promise<void>;
  processFormSubmission: (
    formId: string,
    formData: Record<string, unknown>
  ) => Promise<void>;
}

/**
 * Generates auto-incremented session name based on existing sessions
 * @param mode - The chat mode ('personal' or 'hcs10')
 * @returns Promise resolving to auto-incremented session name
 */
const generateAutoSessionName = async (mode: string): Promise<string> => {
  try {
    const result = await window.electron.invoke('chat:load-all-sessions');
    if (!result.success) {
      return mode === 'hcs10' ? 'HCS-10 Chat 1' : 'Session 1';
    }

    const sessions = result.data || [];
    const prefix = mode === 'hcs10' ? 'HCS-10 Chat' : 'Session';

    const existingNumbers = sessions
      .filter((session: SessionData) => session.mode === mode)
      .map((session: SessionData) => {
        const match = session.name.match(new RegExp(`^${prefix} (\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num: number) => num > 0);

    const nextNumber =
      existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
    return `${prefix} ${nextNumber}`;
  } catch (error) {
    return mode === 'hcs10' ? 'HCS-10 Chat 1' : 'Session 1';
  }
};

export const useAgentStore = create<AgentStore>((set, get) => {
  const configStore = useConfigStore.getState();
  const initialOperationalMode =
    configStore.config?.advanced?.operationalMode || 'autonomous';

  return {
    status: 'idle' as AgentStatus,
    isConnected: false,
    connectionError: null,
    messages: [],
    hcs10Messages: {},
    currentSessionId: null,
    currentSession: null,
    sessions: [],
    isTyping: false,
    processingContext: null,
    operationalMode: initialOperationalMode as OperationalMode,
    chatContext: {
      mode: 'personal',
      agentName: 'Personal Assistant',
    },
    hcs10LoadingMessages: {},
    isInitialized: false,
    lastActiveSessionId: null,

    _operationLocks: {},
    _isCreatingSession: false,

    setStatus: (status) => set({ status }),

    setConnected: (connected) =>
      set({
        isConnected: connected,
        status: connected ? 'connected' : 'idle',
      }),

    setIsTyping: (typing, context = null) =>
      set({ isTyping: typing, processingContext: typing ? context : null }),

    /**
     * Updates operational mode and reconnects agent if currently connected
     * @param mode - The operational mode to set (autonomous or provideBytes)
     */
    setOperationalMode: async (mode) => {
      const { isConnected, status } = get();

      if (status === 'connecting' || status === 'disconnecting') {
        return;
      }

      set({ operationalMode: mode });

      const configStore = useConfigStore.getState();
      configStore.setOperationalMode(mode);
      await configStore.saveConfig();

      if (isConnected) {
        set({
          status: 'disconnecting' as AgentStatus,
          connectionError: null,
        });

        await get().disconnect();

        await new Promise((resolve) => setTimeout(resolve, 500));

        set({ status: 'idle' as AgentStatus });

        await get().connect();
      }
    },

    setConnectionError: (error) =>
      set({
        connectionError: error,
        status: 'error',
        isConnected: false,
      }),

    clearConnectionError: () => set({ connectionError: null }),

    setChatContext: (context) => {
      set({ chatContext: context });
      const { currentSession } = get();
      if (context.mode === 'personal' && currentSession) {
        try {
          localStorage.setItem(
            'hashgraph-online-last-session',
            currentSession.id
          );
        } catch (error) {}
      }
    },

    addMessage: (message, topicId) => {
      set((state) => {
        if (topicId) {
          return {
            hcs10Messages: {
              ...state.hcs10Messages,
              [topicId]: [...(state.hcs10Messages[topicId] || []), message],
            },
          };
        } else {
          return {
            messages: [...state.messages, message],
          };
        }
      });

      const { currentSession, chatContext } = get();

      const shouldSaveMessage = (() => {
        if (!currentSession) {
          return false;
        }

        if (chatContext.mode === 'personal' && !topicId) {
          return true;
        }

        if (
          chatContext.mode === 'hcs10' &&
          topicId === chatContext.topicId &&
          topicId === currentSession.topicId
        ) {
          return true;
        }

        return false;
      })();

      if (shouldSaveMessage) {
        get()
          .saveMessage(message, currentSession.id)
          .catch((error) => {
            logger.error('Failed to save message', { error: error.message });
            if (message.metadata?.formMessage) {
              logger.error('CRITICAL: Form message failed to save', {
                formId: message.metadata.formMessage.id,
                toolName: message.metadata.formMessage.toolName,
                error: error.message,
              });
            }
          });

        const updatedSession = {
          ...currentSession,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        } as ChatSession;

        get()
          .saveSession(updatedSession)
          .catch((error) => {
            logger.error('Failed to save session', { error: error.message });
          });
      }
    },

    clearMessages: (topicId) =>
      set((state) => {
        if (topicId) {
          return {
            hcs10Messages: {
              ...state.hcs10Messages,
              [topicId]: [],
            },
          };
        } else {
          return { messages: [] };
        }
      }),

    getMessages: (topicId) => {
      const state = get();
      return topicId ? state.hcs10Messages[topicId] || [] : state.messages;
    },

    /**
     * Loads and transforms HCS-10 messages for a specific topic
     * @param topicId - The HCS topic ID to load messages from
     */
    loadConversationMessages: async (topicId: string) => {
      const { hcs10LoadingMessages } = get();

      if (hcs10LoadingMessages[topicId]) {
        return;
      }

      set((state) => ({
        hcs10LoadingMessages: {
          ...state.hcs10LoadingMessages,
          [topicId]: true,
        },
      }));

      try {
        const result = await window.electron.invoke('hcs10:get-messages', {
          topicId,
          network: 'testnet',
        });

        if (result.success && result.messages) {
          const transformedMessages: Message[] = result.messages.map(
            (hcsMsg: HCSMessage) => {
              let content = '';

              const messageContent = hcsMsg.data;

              if (messageContent) {
                try {
                  const normalizedData =
                    typeof messageContent === 'object' &&
                    messageContent !== null
                      ? JSON.stringify(messageContent)
                      : messageContent;

                  const shouldParse = (() => {
                    if (hcsMsg.op === 'message') {
                      return true;
                    }
                    if (
                      typeof normalizedData === 'string' &&
                      normalizedData.trim().startsWith('{')
                    ) {
                      return true;
                    }
                    return false;
                  })();

                  if (shouldParse) {
                    const parsedData = JSON.parse(normalizedData);

                    if (typeof parsedData === 'object' && parsedData !== null) {
                      if (parsedData.text) {
                        content = parsedData.text;
                      } else if (parsedData.content) {
                        content = parsedData.content;
                      } else if (parsedData.data) {
                        content =
                          typeof parsedData.data === 'string'
                            ? parsedData.data
                            : JSON.stringify(parsedData.data);
                      } else {
                        content = normalizedData;
                      }
                    } else {
                      content = normalizedData;
                    }
                  } else {
                    content = normalizedData;
                  }
                } catch {
                  content =
                    typeof messageContent === 'string'
                      ? messageContent
                      : JSON.stringify(messageContent);
                }
              }

              if (!content) {
                content = '[Empty message]';
              }

              const configStore = useConfigStore.getState();
              const myAccountId = configStore.config?.hedera?.accountId;

              const normalizeAccountId = (accountId: string) => {
                if (!accountId) return '';
                if (accountId.includes('@')) {
                  const parts = accountId.split('@');
                  return parts[parts.length - 1];
                }
                return accountId.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1');
              };

              const normalizedMyAccountId = normalizeAccountId(
                myAccountId || ''
              );
              const normalizedOperatorId = normalizeAccountId(
                hcsMsg.operator_id || hcsMsg.payer || ''
              );

              const isFromUser = (() => {
                if (normalizedMyAccountId && normalizedOperatorId) {
                  return normalizedMyAccountId === normalizedOperatorId;
                }
                return false;
              })();

              return {
                id: `hcs-${topicId}-${hcsMsg.sequence_number || Date.now()}`,
                role: isFromUser ? 'user' : 'assistant',
                content,
                timestamp: hcsMsg.created
                  ? hcsMsg.created instanceof Date
                    ? hcsMsg.created
                    : new Date(hcsMsg.created)
                  : new Date(hcsMsg.consensus_timestamp || Date.now()),
                metadata: {
                  operatorId: hcsMsg.operator_id || hcsMsg.payer,
                  sequenceNumber: hcsMsg.sequence_number,
                  topicId,
                  isHCS10Message: true,
                  op: hcsMsg.op,
                  scheduleId: hcsMsg.schedule_id,
                  data: hcsMsg.data,
                  ...Object.fromEntries(
                    Object.entries(hcsMsg).filter(
                      ([key, value]) =>
                        ![
                          'operator_id',
                          'payer',
                          'sequence_number',
                          'op',
                          'schedule_id',
                          'data',
                          'created',
                          'consensus_timestamp',
                        ].includes(key) &&
                        value !== undefined &&
                        value !== null
                    )
                  ),
                },
              } as Message;
            }
          );

          transformedMessages.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );

          const existingMessages = get().hcs10Messages[topicId] || [];
          const existingIds = new Set(
            existingMessages.map(
              (msg) => msg.metadata?.sequenceNumber || msg.id
            )
          );

          const newMessages = transformedMessages.filter(
            (msg) => !existingIds.has(msg.metadata?.sequenceNumber || msg.id)
          );

          const allMessages = [...existingMessages, ...newMessages].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );

          set((state) => ({
            hcs10Messages: {
              ...state.hcs10Messages,
              [topicId]: allMessages,
            },
          }));
        }
      } catch (error) {
      } finally {
        set((state) => ({
          hcs10LoadingMessages: {
            ...state.hcs10LoadingMessages,
            [topicId]: false,
          },
        }));
      }
    },

    refreshConversationMessages: async (
      topicId: string,
      showLoading = false
    ) => {
      if (showLoading) {
        set((state) => ({
          hcs10LoadingMessages: {
            ...state.hcs10LoadingMessages,
            [topicId]: true,
          },
        }));
      }

      try {
        const result = await window.electron.invoke('hcs10:get-messages', {
          topicId,
          network: 'testnet',
        });

        if (result.success && result.messages) {
          const transformedMessages: Message[] = result.messages.map(
            (hcsMsg: HCSMessage) => {
              let content = '';

              const messageContent = hcsMsg.data;

              if (messageContent) {
                try {
                  const normalizedData =
                    typeof messageContent === 'object' &&
                    messageContent !== null
                      ? JSON.stringify(messageContent)
                      : messageContent;

                  const shouldParse = (() => {
                    if (hcsMsg.op === 'message') {
                      return true;
                    }
                    if (
                      typeof normalizedData === 'string' &&
                      normalizedData.trim().startsWith('{')
                    ) {
                      return true;
                    }
                    return false;
                  })();

                  if (shouldParse) {
                    const parsedData = JSON.parse(normalizedData);

                    if (typeof parsedData === 'object' && parsedData !== null) {
                      if (parsedData.text) {
                        content = parsedData.text;
                      } else if (parsedData.content) {
                        content = parsedData.content;
                      } else if (parsedData.data) {
                        content =
                          typeof parsedData.data === 'string'
                            ? parsedData.data
                            : JSON.stringify(parsedData.data);
                      } else {
                        content = normalizedData;
                      }
                    } else {
                      content = normalizedData;
                    }
                  } else {
                    content = normalizedData;
                  }
                } catch {
                  content =
                    typeof messageContent === 'string'
                      ? messageContent
                      : JSON.stringify(messageContent);
                }
              }

              if (!content) {
                content = '[Empty message]';
              }

              const configStore = useConfigStore.getState();
              const myAccountId = configStore.config?.hedera?.accountId;

              const normalizeAccountId = (accountId: string) => {
                if (!accountId) return '';
                if (accountId.includes('@')) {
                  const parts = accountId.split('@');
                  return parts[parts.length - 1];
                }
                return accountId.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1');
              };

              const normalizedMyAccountId = normalizeAccountId(
                myAccountId || ''
              );
              const normalizedOperatorId = normalizeAccountId(
                hcsMsg.operator_id || hcsMsg.payer || ''
              );

              const isFromUser = (() => {
                if (normalizedMyAccountId && normalizedOperatorId) {
                  return normalizedMyAccountId === normalizedOperatorId;
                }
                return false;
              })();

              return {
                id: `hcs-${topicId}-${hcsMsg.sequence_number || Date.now()}`,
                role: isFromUser ? 'user' : 'assistant',
                content,
                timestamp: hcsMsg.created
                  ? hcsMsg.created instanceof Date
                    ? hcsMsg.created
                    : new Date(hcsMsg.created)
                  : new Date(hcsMsg.consensus_timestamp || Date.now()),
                metadata: {
                  operatorId: hcsMsg.operator_id || hcsMsg.payer,
                  sequenceNumber: hcsMsg.sequence_number,
                  topicId,
                  isHCS10Message: true,
                  op: hcsMsg.op,
                  scheduleId: hcsMsg.schedule_id,
                  data: hcsMsg.data,
                  ...Object.fromEntries(
                    Object.entries(hcsMsg).filter(
                      ([key, value]) =>
                        ![
                          'operator_id',
                          'payer',
                          'sequence_number',
                          'op',
                          'schedule_id',
                          'data',
                          'created',
                          'consensus_timestamp',
                        ].includes(key) &&
                        value !== undefined &&
                        value !== null
                    )
                  ),
                },
              } as Message;
            }
          );

          transformedMessages.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );

          const currentMessages = get().hcs10Messages[topicId] || [];
          const hasNewMessages =
            transformedMessages.length !== currentMessages.length ||
            !transformedMessages.every((newMsg, index) => {
              const existingMsg = currentMessages[index];
              return (
                existingMsg &&
                newMsg.id === existingMsg.id &&
                newMsg.content === existingMsg.content &&
                newMsg.timestamp.getTime() === existingMsg.timestamp.getTime()
              );
            });

          if (hasNewMessages) {
            set((state) => ({
              hcs10Messages: {
                ...state.hcs10Messages,
                [topicId]: transformedMessages,
              },
              hcs10LoadingMessages: {
                ...state.hcs10LoadingMessages,
                [topicId]: false,
              },
            }));
          } else {
            set((state) => ({
              hcs10LoadingMessages: {
                ...state.hcs10LoadingMessages,
                [topicId]: false,
              },
            }));
          }
        }
      } catch (error) {
        set((state) => ({
          hcs10LoadingMessages: {
            ...state.hcs10LoadingMessages,
            [topicId]: false,
          },
        }));
      }
    },

    setHCS10Messages: (topicId: string, messages: Message[]) => {
      set((state) => ({
        hcs10Messages: {
          ...state.hcs10Messages,
          [topicId]: messages,
        },
      }));
    },

    setSessionId: (sessionId) => set({ currentSessionId: sessionId }),

    startNewSession: (sessionId) => {
      set({
        currentSessionId: sessionId,
        messages: [],
      });

      window.electron?.invoke?.('agent:update-session-context', {
        sessionId,
        mode: 'personal',
      });
    },

    _lockOperation: (key: string) => {
      const locks = get()._operationLocks;
      if (locks[key]) {
        return false;
      }
      set((state) => ({
        _operationLocks: { ...state._operationLocks, [key]: true },
      }));
      return true;
    },

    _unlockOperation: (key: string) => {
      set((state) => {
        const { [key]: removed, ...remainingLocks } = state._operationLocks;
        return { _operationLocks: remainingLocks };
      });
    },

    setCurrentSession: (session) => {
      set({
        currentSession: session,
        currentSessionId: session?.id || null,
      });

      if (session) {
        try {
          localStorage.setItem('hashgraph-online-last-session', session.id);
        } catch (error) {}
      }
    },

    initializeSessions: async () => {
      try {
        const sessions = await get().loadAllSessions();
        set({
          sessions,
          isInitialized: true,
        });
      } catch (error) {
        set({ isInitialized: true });
      }
    },

    restoreLastSession: async () => {
      try {
        let lastSessionId: string | null = null;
        try {
          lastSessionId = localStorage.getItem('hashgraph-online-last-session');
        } catch (error) {}

        if (lastSessionId) {
          const { sessions } = get();
          const sessionExists = sessions.find((s) => s.id === lastSessionId);

          if (sessionExists) {
            await get().loadSession(lastSessionId);
            set({ lastActiveSessionId: lastSessionId });
          } else {
            try {
              localStorage.removeItem('hashgraph-online-last-session');
            } catch (error) {}
          }
        }
      } catch (error) {
        try {
          localStorage.removeItem('hashgraph-online-last-session');
        } catch (cleanupError) {}
      }
    },

    /**
     * Establishes connection to the agent using stored configuration
     * Initializes sessions and restores last active session if applicable
     */
    connect: async () => {
      set({ status: 'connecting' as AgentStatus, connectionError: null });

      try {
        const rawConfig = await window.electron.loadConfig();

        if (!rawConfig) {
          throw new Error(
            'No configuration found. Please configure your settings first.'
          );
        }

        const accountId =
          rawConfig.hedera?.accountId || (rawConfig as any).accountId || '';
        const privateKey =
          rawConfig.hedera?.privateKey || (rawConfig as any).privateKey || '';
        const network =
          rawConfig.hedera?.network || (rawConfig as any).network || 'testnet';
        const llmProvider = rawConfig.llmProvider || 'openai';

        let apiKey = '';
        let modelName = '';

        if (llmProvider === 'anthropic') {
          apiKey = rawConfig.anthropic?.apiKey || '';
          modelName =
            rawConfig.anthropic?.model || 'claude-3-5-sonnet-20241022';
        } else {
          apiKey =
            rawConfig.openai?.apiKey || (rawConfig as any).openAIApiKey || '';
          modelName =
            rawConfig.openai?.model ||
            (rawConfig as any).modelName ||
            'gpt-4o-mini';
        }

        if (!accountId || !privateKey || !apiKey) {
          throw new Error('Invalid configuration. Please check your settings.');
        }

        const { operationalMode } = get();

        const initTimeout = 90000;
        const initPromise = window.electron.initializeAgent({
          accountId,
          privateKey,
          network,
          openAIApiKey: apiKey,
          modelName,
          operationalMode,
          llmProvider,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Agent initialization timed out after ${initTimeout / 1000} seconds. The backend may be unresponsive.`
              )
            );
          }, initTimeout);
        });

        const result = await Promise.race([initPromise, timeoutPromise]);

        if (result.success) {
          set({
            isConnected: true,
            status: 'connected' as AgentStatus,
            currentSessionId: result.data?.sessionId || null,
          });

          const { isInitialized } = get();
          if (!isInitialized) {
            await get().initializeSessions();
          }

          const currentUrl = window.location.href;
          const hasAgentIdInUrl =
            currentUrl.includes('/chat/') && currentUrl.split('/chat/')[1];

          if (!hasAgentIdInUrl) {
            await get().restoreLastSession();
          }
        } else {
          throw new Error(result.error || 'Failed to connect');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Connection failed';
        set({
          isConnected: false,
          status: 'error' as AgentStatus,
          connectionError: errorMessage,
        });
        throw error;
      }
    },

    disconnect: async () => {
      set({ status: 'disconnecting' as AgentStatus });

      try {
        await window.electron.disconnectAgent();
        set({
          isConnected: false,
          status: 'idle' as AgentStatus,
          currentSessionId: null,
          connectionError: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Disconnect failed';
        set({
          status: 'error' as AgentStatus,
          connectionError: errorMessage,
        });
        throw error;
      }
    },

    /**
     * Sends a message through the appropriate channel (personal or HCS-10)
     * @param content - The message content to send
     * @param attachments - Optional file attachments
     * @param topicId - Optional HCS topic ID for HCS-10 messages
     */
    sendMessage: async (
      content: string,
      attachments?: Array<{
        name: string;
        data: string;
        type: string;
        size: number;
      }>,
      topicId?: string
    ) => {
      const { isConnected, chatContext } = get();
      const messages = get().getMessages(topicId);

      if (!isConnected) {
        throw new Error('Not connected to agent');
      }

      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content,
        timestamp: new Date(),
        metadata:
          attachments && attachments.length > 0 ? { attachments } : undefined,
      };

      get().addMessage(userMessage, topicId);

      try {
        get().setIsTyping(true, 'message');

        if (chatContext.mode === 'hcs10' && topicId) {
          const result = await window.electron.invoke('hcs10:send-message', {
            topicId,
            message: content,
            attachments,
            network: 'testnet',
          });

          if (result.success) {
            setTimeout(() => {
              get().refreshConversationMessages(topicId);
            }, 1500);

            setTimeout(() => {
              get().refreshConversationMessages(topicId);
            }, 5000);
          } else {
            const currentMessages = get().getMessages(topicId);
            const filteredMessages = currentMessages.filter(
              (msg) => msg.id !== userMessage.id
            );
            get().setHCS10Messages(topicId, filteredMessages);

            throw new Error(result.error || 'Failed to send HCS-10 message');
          }

          return;
        }

        const chatHistory = messages.map((msg) => ({
          type: msg.role === 'user' ? ('human' as const) : ('ai' as const),
          content: msg.content,
        }));

        const result = await window.electron.sendAgentMessage({
          content,
          chatHistory,
          attachments,
        });

        if (result.success && result.response) {
          const assistantMessage: Message = {
            id: result.response.id || generateMessageId(),
            role: 'assistant',
            content: result.response.content || '',
            timestamp: new Date(result.response.timestamp || Date.now()),
            metadata: result.response.metadata,
          };

          if (result.response.formMessage || result.formMessage) {
            assistantMessage.metadata = {
              ...assistantMessage.metadata,
              formMessage: result.response.formMessage || result.formMessage,
            };
          }

          const { operationalMode } = get();
          const txBytes = result.response.metadata?.transactionBytes;
          if (operationalMode === 'autonomous' && txBytes) {
            try {
              const validation = TransactionParser.validateTransactionBytes(txBytes);
              if (validation.isValid) {
                assistantMessage.metadata = {
                  ...assistantMessage.metadata,
                  transactionBytes: txBytes,
                  pendingApproval: true,
                };
              } else {
                assistantMessage.metadata = {
                  ...assistantMessage.metadata,
                  transactionParsingError: 'Invalid transaction bytes format',
                };
              }
            } catch (error) {}
          }

          get().addMessage(assistantMessage, topicId);

          if (operationalMode === 'autonomous' && assistantMessage.metadata?.transactionBytes) {
            get()
              .approveTransaction(assistantMessage.id)
              .catch(() => {
              });
          }
        } else {
          const errorMessage: Message = {
            id: generateMessageId(),
            role: 'assistant',
            content: result.error || 'Failed to get response',
            timestamp: new Date(),
            metadata: {
              isError: true,
            },
          };
          get().addMessage(errorMessage, topicId);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Send failed';
        set({ connectionError: errorMessage });
        throw error;
      } finally {
        get().setIsTyping(false);
      }
    },

    approveTransaction: async (messageId: string) => {
      const { messages, hcs10Messages, chatContext } = get();
      let message: Message | undefined;

      if (chatContext.mode === 'hcs10' && chatContext.topicId) {
        const topicMessages = hcs10Messages[chatContext.topicId] || [];
        message = topicMessages.find((m) => m.id === messageId);
      } else {
        message = messages.find((m) => m.id === messageId);
      }

      if (
        !message ||
        !message.metadata?.transactionBytes ||
        !message.metadata?.pendingApproval
      ) {
        throw new Error('Message not found or not pending approval');
      }

      try {
        const result = await window.electron.sendAgentMessage({
          content: `Execute this transaction: ${message.metadata.transactionBytes}`,
          transactionBytes: message.metadata.transactionBytes,
          executeTransaction: true,
        });

        if (result.success) {
          const { chatContext: currentChatContext } = get();

          if (
            currentChatContext.mode === 'hcs10' &&
            currentChatContext.topicId
          ) {
            set((state) => ({
              hcs10Messages: {
                ...state.hcs10Messages,
                [currentChatContext.topicId!]: (
                  state.hcs10Messages[currentChatContext.topicId!] || []
                ).map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        metadata: {
                          ...m.metadata,
                          pendingApproval: false,
                          approved: true,
                          transactionId:
                            result.transactionId ||
                            result.response?.metadata?.transactionId,
                          executedAt: new Date().toISOString(),
                        },
                      }
                    : m
                ),
              },
            }));
          } else {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        pendingApproval: false,
                        approved: true,
                        transactionId:
                          result.transactionId ||
                          result.response?.metadata?.transactionId,
                        executedAt: new Date().toISOString(),
                      },
                    }
                  : m
              ),
            }));
          }

          const addNotification =
            useNotificationStore.getState().addNotification;
          addNotification({
            type: 'success',
            title: 'Transaction Approved',
            message: result.transactionId
              ? `Transaction executed successfully. ID: ${result.transactionId}`
              : 'Transaction approved and executed successfully',
            duration: 7000,
          });
        } else {
          throw new Error(result.error || 'Failed to execute transaction');
        }
      } catch (error) {
        const { chatContext: currentChatContext } = get();

        if (currentChatContext.mode === 'hcs10' && currentChatContext.topicId) {
          set((state) => ({
            hcs10Messages: {
              ...state.hcs10Messages,
              [currentChatContext.topicId!]: (
                state.hcs10Messages[currentChatContext.topicId!] || []
              ).map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        pendingApproval: false,
                        approved: false,
                        approvalError:
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                      },
                    }
                  : m
              ),
            },
          }));
        } else {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      pendingApproval: false,
                      approved: false,
                      approvalError:
                        error instanceof Error
                          ? error.message
                          : 'Unknown error',
                    },
                  }
                : m
            ),
          }));
        }

        const addNotification = useNotificationStore.getState().addNotification;
        addNotification({
          type: 'error',
          title: 'Transaction Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to execute transaction',
        });

        throw error;
      }
    },

    rejectTransaction: async (messageId: string) => {
      const { messages, hcs10Messages, chatContext } = get();
      let message: Message | undefined;

      if (chatContext.mode === 'hcs10' && chatContext.topicId) {
        const topicMessages = hcs10Messages[chatContext.topicId] || [];
        message = topicMessages.find((m) => m.id === messageId);
      } else {
        message = messages.find((m) => m.id === messageId);
      }

      if (!message || !message.metadata?.pendingApproval) {
        throw new Error('Message not found or not pending approval');
      }

      const { chatContext: currentChatContext } = get();

      if (currentChatContext.mode === 'hcs10' && currentChatContext.topicId) {
        set((state) => ({
          hcs10Messages: {
            ...state.hcs10Messages,
            [currentChatContext.topicId!]: (
              state.hcs10Messages[currentChatContext.topicId!] || []
            ).map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      pendingApproval: false,
                      approved: false,
                      rejected: true,
                      rejectedAt: new Date().toISOString(),
                    },
                  }
                : m
            ),
          },
        }));
      } else {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  metadata: {
                    ...m.metadata,
                    pendingApproval: false,
                    approved: false,
                    rejected: true,
                    rejectedAt: new Date().toISOString(),
                  },
                }
              : m
          ),
        }));
      }

      const addNotification = useNotificationStore.getState().addNotification;
      addNotification({
        type: 'info',
        title: 'Transaction Rejected',
        message: 'Transaction was cancelled by user',
        duration: 5000,
      });
    },

    findFormMessage: async (formId: string) => {
      const { chatContext } = get();

      const messages = get().getMessages(
        chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
      );
      const formMessage = messages.find(
        (m) => m.metadata?.formMessage?.id === formId
      );

      if (formMessage?.metadata?.formMessage) {
        return formMessage;
      }

      try {
        const currentSession = get().currentSession;
        const sessionId = currentSession?.id;

        const dbResult = await window.electron.findFormById(formId, sessionId);

        if (dbResult?.success && dbResult.data?.metadata?.formMessage) {
          const dbMessage = dbResult.data;
          const parsedMetadata =
            typeof dbMessage.metadata === 'string'
              ? JSON.parse(dbMessage.metadata)
              : dbMessage.metadata;

          if (parsedMetadata?.formMessage?.id === formId) {
            const cacheMessage: Message = {
              id: dbMessage.id,
              role: dbMessage.role as 'user' | 'assistant',
              content: dbMessage.content,
              timestamp: new Date(dbMessage.timestamp),
              metadata: parsedMetadata,
            };

            const currentState = get();
            const topicId =
              chatContext.mode === 'hcs10' ? chatContext.topicId : undefined;
            if (topicId) {
              const existingMessages =
                currentState.hcs10Messages[topicId] || [];
              if (!existingMessages.find((m) => m.id === cacheMessage.id)) {
                set({
                  hcs10Messages: {
                    ...currentState.hcs10Messages,
                    [topicId]: [...existingMessages, cacheMessage],
                  },
                });
              }
            } else {
              const existingMessages = currentState.messages || [];
              if (!existingMessages.find((m) => m.id === cacheMessage.id)) {
                set({ messages: [...existingMessages, cacheMessage] });
              }
            }

            return cacheMessage;
          }
        }
      } catch (error) {
        logger.warn('Database fallback failed for form lookup', {
          error: error.message,
        });
      }

      return null;
    },

    updateFormState: async (
      formId: string,
      newState: 'active' | 'submitting' | 'completed' | 'failed',
      result?: { success?: boolean; message?: string; timestamp?: number }
    ) => {
      try {
        const { chatContext } = get();
        const messages = get().getMessages(
          chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
        );
        const messageIndex = messages.findIndex(
          (m) => m.metadata?.formMessage?.id === formId
        );

        if (messageIndex >= 0 && messages[messageIndex].metadata?.formMessage) {
          const updatedMessages = [...messages];
          const formMessage = {
            ...updatedMessages[messageIndex].metadata.formMessage,
          };
          formMessage.completionState = newState;

          if (newState === 'completed' || newState === 'failed') {
            formMessage.completedAt = Date.now();
            if (result) {
              formMessage.completionResult = {
                success: result.success ?? newState === 'completed',
                message: result.message || '',
                timestamp: result.timestamp || Date.now(),
              };
            }
          }

          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            metadata: {
              ...updatedMessages[messageIndex].metadata,
              formMessage,
            },
          };

          const currentState = get();
          const topicId =
            chatContext.mode === 'hcs10' ? chatContext.topicId : undefined;
          if (topicId) {
            set({
              hcs10Messages: {
                ...currentState.hcs10Messages,
                [topicId]: updatedMessages,
              },
            });
          } else {
            set({ messages: updatedMessages });
          }
        }

        await window.electron.updateFormState(formId, newState, result);
      } catch (error) {
        logger.error('Failed to update form state', { error: error.message });
        throw error;
      }
    },

    processFormSubmission: async (
      formId: string,
      formData: Record<string, unknown>
    ) => {
      const { isConnected, chatContext } = get();

      if (!isConnected) {
        throw new Error('Not connected to agent');
      }

      const formMessage = await get().findFormMessage(formId);

      if (!formMessage?.metadata?.formMessage) {
        logger.error('Form submission failed - form message not found', {
          formId,
          availableMessages: get().getMessages(
            chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
          ).length,
          chatContext: chatContext.mode,
          topicId: chatContext.topicId,
        });
        throw new Error(
          `Form not found (ID: ${formId}). The form may have been permanently deleted.`
        );
      }

      if (formMessage.metadata.formMessage.completionState === 'completed') {
        throw new Error(
          'This form has already been submitted and cannot be submitted again.'
        );
      }

      try {
        await get().updateFormState(formId, 'submitting');
        get().setIsTyping(true, 'form');

        const safeFormData = formData || {};

        const currentMessages = get().getMessages(
          chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
        );
        const result = await window.electron.sendAgentMessage({
          content: `Form submission for ${formMessage.metadata.formMessage.toolName}`,
          formSubmission: {
            formId,
            data: safeFormData,
            timestamp: Date.now(),
            toolName: formMessage.metadata.formMessage.toolName,
            originalPrompt: formMessage.metadata.formMessage.originalPrompt,
            partialInput: formMessage.metadata.formMessage.partialInput || {},
          },
          chatHistory: currentMessages.map((msg) => ({
            type: msg.role === 'user' ? ('human' as const) : ('ai' as const),
            content: msg.content,
          })),
        });

        if (result.success && result.response) {
          const assistantMessage: Message = {
            id: result.response.id || generateMessageId(),
            role: 'assistant',
            content: result.response.content || '',
            timestamp: new Date(result.response.timestamp || Date.now()),
            metadata: result.response.metadata,
          };

          if (result.response.formMessage) {
            assistantMessage.metadata = {
              ...assistantMessage.metadata,
              formMessage: result.response.formMessage,
            };
          }

          const { chatContext: currentChatContext } = get();
          get().addMessage(
            assistantMessage,
            currentChatContext.mode === 'hcs10'
              ? currentChatContext.topicId
              : undefined
          );

          await get().updateFormState(formId, 'completed', {
            success: true,
            message: 'Form submitted successfully',
            timestamp: Date.now(),
          });

          const addNotification =
            useNotificationStore.getState().addNotification;
          addNotification({
            type: 'success',
            title: 'Form Submitted',
            message: 'Your form has been processed successfully',
            duration: 5000,
          });
        } else {
          throw new Error(result.error || 'Failed to process form submission');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Form submission failed';

        try {
          await get().updateFormState(formId, 'failed', {
            success: false,
            message: errorMessage,
            timestamp: Date.now(),
          });
        } catch (stateError) {
          logger.error('Failed to update form state to failed', {
            error: stateError.message,
          });
        }

        const errorMessageObj: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: `Error processing form: ${errorMessage}`,
          timestamp: new Date(),
          metadata: {
            isError: true,
          },
        };

        const { chatContext: currentChatContext } = get();
        get().addMessage(
          errorMessageObj,
          currentChatContext.mode === 'hcs10'
            ? currentChatContext.topicId
            : undefined
        );

        const addNotification = useNotificationStore.getState().addNotification;
        addNotification({
          type: 'error',
          title: 'Form Submission Failed',
          message: errorMessage,
          duration: 7000,
        });

        throw error;
      } finally {
        get().setIsTyping(false);
      }
    },

    createSession: async (name: string, mode: ChatMode, topicId?: string) => {
      const lockKey = `createSession-${mode}-${topicId || 'personal'}`;

      if (!get()._lockOperation(lockKey)) {
        throw new Error('Session creation already in progress');
      }

      if (get()._isCreatingSession) {
        get()._unlockOperation(lockKey);
        throw new Error('Another session creation is in progress');
      }

      set({ _isCreatingSession: true });

      try {
        let finalSessionName = name?.trim();

        if (!finalSessionName) {
          finalSessionName = await generateAutoSessionName(mode);
        }

        const sessionData = {
          name: finalSessionName,
          mode,
          topicId,
          isActive: true,
        };

        const result = await window.electron.invoke(
          'chat:create-session',
          sessionData
        );

        if (result.success && result.data) {
          const session = result.data as ChatSession;

          get().setCurrentSession(session);

          if (session.mode === 'personal') {
            set({
              messages: [],
              hcs10Messages: {},
              chatContext: {
                mode: session.mode as ChatMode,
                topicId: undefined,
                agentName: session.name,
              },
            });
          } else if (session.mode === 'hcs10' && session.topicId) {
            set({
              messages: [],
              hcs10Messages: get().hcs10Messages,
              chatContext: {
                mode: session.mode as ChatMode,
                topicId: session.topicId,
                agentName: session.name,
              },
            });
          }

          set((state) => ({
            sessions: [...state.sessions, session],
          }));

          return session;
        } else {
          throw new Error(result.error || 'Failed to create session');
        }
      } catch (error) {
        throw error;
      } finally {
        set({ _isCreatingSession: false });
        get()._unlockOperation(lockKey);
      }
    },

    loadSession: async (sessionId: string) => {
      try {
        const result = await window.electron.invoke('chat:load-session', {
          sessionId,
        });

        if (result.success && result.data) {
          const session = result.data as ChatSession;
          const messages = await get().loadSessionMessages(sessionId);

          get().setCurrentSession(session);

          window.electron?.invoke?.('agent:update-session-context', {
            sessionId: session.id,
            mode: session.mode,
            topicId: session.topicId,
          });

          if (session.mode === 'personal') {
            set({
              messages,
              hcs10Messages: {},
              chatContext: {
                mode: session.mode as ChatMode,
                topicId: undefined,
                agentName: 'Personal Assistant',
              },
            });
          } else if (session.mode === 'hcs10' && session.topicId) {
            const currentHcs10Messages = get().hcs10Messages;
            const liveMessages = currentHcs10Messages[session.topicId] || [];

            const storedMessageIds = new Set(messages.map((m) => m.id));
            const uniqueLiveMessages = liveMessages.filter(
              (m) => !storedMessageIds.has(m.id)
            );
            const allMessages = [...messages, ...uniqueLiveMessages].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );

            set({
              messages: [],
              hcs10Messages: {
                ...currentHcs10Messages,
                [session.topicId]: allMessages,
              },
              chatContext: {
                mode: session.mode as ChatMode,
                topicId: session.topicId,
                agentName: session.name,
              },
            });
          }
        } else {
          throw new Error(result.error || 'Failed to load session');
        }
      } catch (error) {
        throw error;
      }
    },

    saveSession: async (session: ChatSession) => {
      try {
        const result = await window.electron.invoke(
          'chat:save-session',
          session
        );

        if (result.success) {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === session.id ? session : s
            ),
          }));
        } else {
          throw new Error(result.error || 'Failed to save session');
        }
      } catch (error) {
        throw error;
      }
    },

    deleteSession: async (sessionId: string) => {
      try {
        const result = await window.electron.invoke('chat:delete-session', {
          sessionId,
        });

        if (result.success) {
          set((state) => {
            const newState = {
              ...state,
              sessions: state.sessions.filter((s) => s.id !== sessionId),
            };

            if (state.currentSessionId === sessionId) {
              newState.currentSession = null;
              newState.currentSessionId = null;
              newState.messages = [];
              newState.hcs10Messages = {};
            }

            return newState;
          });
        } else {
          throw new Error(result.error || 'Failed to delete session');
        }
      } catch (error) {
        throw error;
      }
    },

    loadAllSessions: async () => {
      try {
        const result = await window.electron.invoke('chat:load-all-sessions');

        if (result.success && result.data) {
          const sessions = result.data as ChatSession[];
          set({ sessions });
          return sessions;
        } else {
          throw new Error(result.error || 'Failed to load sessions');
        }
      } catch (error) {
        throw error;
      }
    },

    saveMessage: async (message: Message, sessionId: string) => {
      try {
        const messageData = {
          id: message.id,
          sessionId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata ? JSON.stringify(message.metadata) : null,
          messageType: 'text',
        };

        const result = await window.electron.invoke(
          'chat:save-message',
          messageData
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to save message');
        }
      } catch (error) {
        throw error;
      }
    },

    loadSessionMessages: async (sessionId: string) => {
      try {
        const result = await window.electron.invoke(
          'chat:load-session-messages',
          { sessionId }
        );

        if (result.success && result.data) {
          const dbMessages = result.data as ChatMessage[];

          const messages: Message[] = dbMessages.map((dbMsg) => {
            let metadata;
            if (dbMsg.metadata) {
              try {
                metadata = JSON.parse(dbMsg.metadata);
              } catch (error) {
                logger.error('Failed to parse message metadata', {
                  error: error.message,
                });
                metadata = undefined;
              }
            }

            return {
              id: dbMsg.id,
              role: dbMsg.role as 'user' | 'assistant' | 'system',
              content: dbMsg.content,
              timestamp: new Date(dbMsg.timestamp),
              metadata,
            };
          });

          const formMessages = messages.filter((m) => m.metadata?.formMessage);
          if (formMessages.length > 0) {
            logger.info(
              `Loaded ${formMessages.length} form messages from database:`,
              formMessages.map((m) => ({
                id: m.metadata?.formMessage?.id,
                toolName: m.metadata?.formMessage?.toolName,
              }))
            );
          }

          return messages;
        } else {
          throw new Error(result.error || 'Failed to load session messages');
        }
      } catch (error) {
        return [];
      }
    },
  };
});

/**
 * Generates a unique message ID using timestamp and random string
 * @returns A unique message identifier
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
