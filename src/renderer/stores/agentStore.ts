import { create } from 'zustand';
import { useConfigStore } from './configStore';
import { TransactionParser } from '@hashgraphonline/standards-sdk';
import { useNotificationStore } from './notificationStore';

export type AgentStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';
export type OperationalMode = 'autonomous' | 'provideBytes';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any> & {
    transactionBytes?: string;
    pendingApproval?: boolean;
    parsedTransaction?: any;
    transactionParsingError?: string;
  };
}

export interface AgentStore {
  status: AgentStatus;
  isConnected: boolean;
  connectionError: string | null;
  messages: Message[];
  currentSessionId: string | null;
  isTyping: boolean;
  operationalMode: OperationalMode;

  setStatus: (status: AgentStatus) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearConnectionError: () => void;
  setIsTyping: (typing: boolean) => void;
  setOperationalMode: (mode: OperationalMode) => Promise<void>;

  addMessage: (message: Message) => void;
  clearMessages: () => void;

  setSessionId: (sessionId: string | null) => void;
  startNewSession: (sessionId: string) => void;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (
    content: string,
    attachments?: Array<{
      name: string;
      data: string;
      type: string;
      size: number;
    }>
  ) => Promise<void>;

  approveTransaction: (messageId: string) => Promise<void>;
  rejectTransaction: (messageId: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => {
  const configStore = useConfigStore.getState();
  const initialOperationalMode =
    configStore.config?.advanced?.operationalMode || 'autonomous';

  return {
    status: 'idle' as AgentStatus,
    isConnected: false,
    connectionError: null,
    messages: [],
    currentSessionId: null,
    isTyping: false,
    operationalMode: initialOperationalMode as OperationalMode,

    setStatus: (status) => set({ status }),

    setConnected: (connected) =>
      set({
        isConnected: connected,
        status: connected ? 'connected' : 'idle',
      }),

    setIsTyping: (typing) => set({ isTyping: typing }),

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

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),

    clearMessages: () => set({ messages: [] }),

    setSessionId: (sessionId) => set({ currentSessionId: sessionId }),

    startNewSession: (sessionId) =>
      set({
        currentSessionId: sessionId,
        messages: [],
      }),

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

        const result = await window.electron.initializeAgent({
          accountId,
          privateKey,
          network,
          openAIApiKey: apiKey,
          modelName,
          operationalMode,
          llmProvider,
        });

        if (result.success) {
          set({
            isConnected: true,
            status: 'connected' as AgentStatus,
            currentSessionId: result.data?.sessionId || null,
          });
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

    sendMessage: async (
      content: string,
      attachments?: Array<{
        name: string;
        data: string;
        type: string;
        size: number;
      }>
    ) => {
      const { isConnected, messages } = get();

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

      set((state) => ({ messages: [...state.messages, userMessage] }));

      try {
        set({ isTyping: true });

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
          let assistantMessage: Message = {
            id: result.response.id || generateMessageId(),
            role: 'assistant',
            content: result.response.content || '',
            timestamp: new Date(result.response.timestamp || Date.now()),
            metadata: result.response.metadata,
          };

          const { operationalMode } = get();

          if (
            operationalMode === 'autonomous' &&
            result.response.metadata?.transactionBytes
          ) {
            try {
              const validation = TransactionParser.validateTransactionBytes(
                result.response.metadata.transactionBytes
              );
              if (validation.isValid) {
                assistantMessage.metadata = {
                  ...assistantMessage.metadata,
                  transactionBytes: result.response.metadata.transactionBytes,
                  pendingApproval: true,
                };

                try {
                  const parsedTransaction =
                    await TransactionParser.parseTransactionBytes(
                      result.response.metadata.transactionBytes
                    );
                  assistantMessage.metadata.parsedTransaction =
                    parsedTransaction;
                } catch (parseError) {
                  assistantMessage.metadata.transactionParsingError =
                    parseError instanceof Error
                      ? parseError.message
                      : 'Unknown parsing error';
                }
              } else {
                assistantMessage.metadata = {
                  ...assistantMessage.metadata,
                  transactionParsingError: 'Invalid transaction bytes format',
                };
              }
            } catch (error) {}
          }

          set((state) => ({ messages: [...state.messages, assistantMessage] }));
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
          set((state) => ({ messages: [...state.messages, errorMessage] }));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Send failed';
        set({ connectionError: errorMessage });
        throw error;
      } finally {
        set({ isTyping: false });
      }
    },

    approveTransaction: async (messageId: string) => {
      const { messages } = get();
      const message = messages.find((m) => m.id === messageId);

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
                      error instanceof Error ? error.message : 'Unknown error',
                  },
                }
              : m
          ),
        }));

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
      const { messages } = get();
      const message = messages.find((m) => m.id === messageId);

      if (!message || !message.metadata?.pendingApproval) {
        throw new Error('Message not found or not pending approval');
      }

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

      const addNotification = useNotificationStore.getState().addNotification;
      addNotification({
        type: 'info',
        title: 'Transaction Rejected',
        message: 'Transaction was cancelled by user',
        duration: 5000,
      });
    },
  };
});

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
