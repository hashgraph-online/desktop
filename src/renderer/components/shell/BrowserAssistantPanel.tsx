import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiCompass,
  FiExternalLink,
  FiX,
  FiMessageSquare,
  FiClock,
  FiChevronDown,
  FiTrash2,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import Typography from '../ui/Typography';
import MessageList from '../chat/MessageList';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { useWalletStore } from '../../stores/walletStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAgentInit } from '../../hooks/useAgentInit';
import useAssistantMessageController, {
  type ExtraAttachmentsBuilderArgs,
} from '../../hooks/useAssistantMessageController';
import useWalletOperationalMode from '../../hooks/useWalletOperationalMode';
import { cn } from '../../lib/utils';
import type { AgentStatus } from '../../stores/agentStore';
import type { ChatSession } from '../../../main/db/schema';
import MoonscapeComposer from './browser/MoonscapeComposer';
import DockToggleButton, {
  AssistantDockPlacement,
  DockOption,
} from './browser/DockToggleButton';
import { Logger } from '@hashgraphonline/standards-sdk';

type BrowserPageContext = {
  title: string;
  description: string;
  selection: string;
};

type BrowserAssistantPanelProps = {
  isOpen: boolean;
  sessionId: string | null;
  hostLabel: string;
  currentUrl: string;
  pageTitle: string;
  onSessionCreated: (sessionId: string) => void;
  onSessionsCleared: () => void;
  pageContext: BrowserPageContext | null;
  fetchPageContext: () => Promise<BrowserPageContext | null>;
  onClose: () => void;
  dock: AssistantDockPlacement;
  onDockChange: (dock: AssistantDockPlacement) => void;
};

const DOCK_OPTIONS: DockOption[] = [
  { value: 'left', icon: FiArrowLeft, aria: 'Dock assistant to left' },
  { value: 'bottom', icon: FiArrowDown, aria: 'Dock assistant to bottom' },
  { value: 'right', icon: FiArrowRight, aria: 'Dock assistant to right' },
];

const buildSessionName = (host: string, title: string): string => {
  const safeHost = host || 'Unknown Site';
  const trimmedTitle = title.trim()
    ? title.trim().slice(0, 48)
    : 'Browser Session';
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
  return `Browser @ ${safeHost} - ${trimmedTitle} - ${timestamp}`;
};

const getStatusLabel = (connected: boolean, status: AgentStatus): string => {
  if (connected) {
    return 'Ready';
  }
  if (status === 'connecting') {
    return 'Connecting…';
  }
  return 'Offline';
};

const isBrowserSession = (session: ChatSession | null | undefined): boolean => {
  if (!session) {
    return false;
  }
  const name = session.name?.trim().toLowerCase() ?? '';
  if (!name) {
    return false;
  }
  if (!name.includes('browser')) {
    return false;
  }
  if (session.mode === 'personal') {
    return true;
  }
  return name.startsWith('browser');
};

const PanelBackground: React.FC = () => (
  <div className='pointer-events-none absolute inset-0 overflow-hidden'>
    <div className='absolute inset-0 bg-gradient-to-br from-gray-50 via-purple-50/30 to-orange-50/20 dark:from-gray-950 dark:via-purple-950/20 dark:to-orange-950/15' />
    <div className='absolute -top-32 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-purple-400/10 to-orange-400/10 blur-3xl dark:from-purple-600/5 dark:to-orange-600/5' />
    <div className='absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-400/8 to-purple-400/8 blur-3xl dark:from-orange-600/4 dark:to-purple-600/4' />
  </div>
);

const encodeStringToBase64 = (value: string): string => {
  const encoder = new TextEncoder();
  let binary = '';
  encoder.encode(value).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const truncateContext = (value: string, limit: number): string => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
};

const BrowserAssistantEmptyState: React.FC<{
  hostLabel: string;
  pageTitle: string;
}> = (props) => {
  const { hostLabel } = props;

  return (
    <div className='flex h-full min-h-full w-full flex-col items-center justify-center p-8 text-center'>
      <div className='w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center mb-4'>
        <FiCompass className='w-6 h-6 text-white' />
      </div>
      <Typography
        variant='h6'
        className='text-gray-900 dark:text-white font-medium mb-2'
      >
        Ready to help
      </Typography>
      <Typography
        variant='body2'
        className='text-gray-600 dark:text-gray-400 max-w-sm'
      >
        Ask me anything about this page. I can summarize content, explain
        complex topics, or help you take action.
      </Typography>
    </div>
  );
};

const BrowserAssistantPanel: React.FC<BrowserAssistantPanelProps> = (props) => {
  const {
    isOpen,
    sessionId,
    hostLabel,
    currentUrl,
    pageTitle,
    onSessionCreated,
    onSessionsCleared,
    pageContext,
    fetchPageContext,
    onClose,
    dock,
    onDockChange,
  } = props;

  const { walletReady } = useWalletOperationalMode();

  const assistantSessionIdRef = useRef<string | null>(null);
  const currentUrlRef = useRef(currentUrl);
  const pageTitleRef = useRef(pageTitle);
  const hostLabelRef = useRef(hostLabel);
  const pageContextRef = useRef(pageContext);

  useEffect(() => {
    currentUrlRef.current = currentUrl;
    pageTitleRef.current = pageTitle;
    hostLabelRef.current = hostLabel;
    pageContextRef.current = pageContext;
  }, [currentUrl, pageTitle, hostLabel, pageContext]);

  const navigate = useNavigate();
  const panelLogger = useMemo(() => new Logger({ module: 'MoonscapeAssistant' }), []);

  const isConnected = useAgentStore((state) => state.isConnected);
  const status = useAgentStore((state) => state.status);
  const connect = useAgentStore((state) => state.connect);
  const setOperationalMode = useAgentStore((state) => state.setOperationalMode);
  const messages = useAgentStore((state) => state.messages);
  const isTyping = useAgentStore((state) => state.isTyping);
  const processingContext = useAgentStore((state) => state.processingContext);
  const chatContextMode = useAgentStore((state) => state.chatContext.mode);
  const setChatContext = useAgentStore((state) => state.setChatContext);
  const currentSessionId = useAgentStore((state) => state.currentSession?.id);
  const currentSessionName = useAgentStore((state) => state.currentSession?.name);
  const loadSession = useAgentStore((state) => state.loadSession);
  const sessions = useAgentStore((state) => state.sessions);
  const deleteSession = useAgentStore((state) => state.deleteSession);
  const loadAllSessions = useAgentStore((state) => state.loadAllSessions);

  const config = useConfigStore((state) => state.config);
  const isConfigured = useConfigStore((state) => state.isConfigured);
  const walletStore = useWalletStore();
  const walletAccountId = walletStore.accountId;
  const walletConnected = walletStore.isConnected;
  const walletNetwork = walletStore.network;

  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );

  const buildBrowserAttachments = useCallback(
    async ({ addNotification }: ExtraAttachmentsBuilderArgs) => {
      try {
        let freshContext = pageContextRef.current;

        if (!freshContext) {
          try {
            freshContext = await fetchPageContext();
          } catch (fetchError) {
            panelLogger.warn('browser.pageContext.fetchFailed', { fetchError });
          }
        }

        const contextPayload: Record<string, unknown> = {
          url: currentUrlRef.current,
        };

        if (pageTitleRef.current.trim()) {
          contextPayload.title = pageTitleRef.current.trim();
        }

        if (hostLabelRef.current) {
          contextPayload.host = hostLabelRef.current;
        }

        if (freshContext?.description?.trim()) {
          contextPayload.description = freshContext.description.trim();
        }

        if (freshContext?.selection?.trim()) {
          contextPayload.selection = truncateContext(freshContext.selection, 1500);
        }

        const contextString = JSON.stringify(contextPayload, null, 2);

        return [
          {
            name: 'page-context.json',
            data: encodeStringToBase64(contextString),
            type: 'application/json',
            size: contextString.length,
          },
        ];
      } catch (error) {
        panelLogger.error('browser.buildAttachments.error', { error });
        addNotification({
          type: 'warning',
          title: 'Context Collection Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to capture page context for this message.',
          duration: 6000,
        });
        return [];
      }
    },
    [fetchPageContext, panelLogger]
  );

  const handleSessionActivated = useCallback(
    (session: ChatSession) => {
      if (!session.id) {
        return;
      }
      if (assistantSessionIdRef.current === session.id) {
        return;
      }
      assistantSessionIdRef.current = session.id;
      const assistantLabel = session.name || hostLabel || pageTitle;
      setChatContext({
        mode: 'personal',
        agentName: assistantLabel || 'Moonscape Assistant',
      });
      onSessionCreated(session.id);
    },
    [onSessionCreated, setChatContext, hostLabel, pageTitle]
  );

  const buildSessionNameCallback = useCallback(
    () => buildSessionName(hostLabel, pageTitle),
    [hostLabel, pageTitle]
  );

  const onSessionCreatedCallback = useCallback(
    (newSessionId: string) => {
      assistantSessionIdRef.current = newSessionId;
      if (onSessionCreated) {
        onSessionCreated(newSessionId);
      }
    },
    [onSessionCreated]
  );

  const resolvePreferredSessionIdCallback = useCallback(
    () => assistantSessionIdRef.current,
    []
  );

  const {
    inputValue,
    setInputValue,
    isSending,
    isSubmitting,
    selectedFiles,
    fileError,
    handleFileAdd,
    handleFileRemove,
    handleSendMessage,
    resetAttachments,
  } = useAssistantMessageController({
    buildSessionName: buildSessionNameCallback,
    buildExtraAttachments: buildBrowserAttachments,
    onSessionCreated: onSessionCreatedCallback,
    onSessionActivated: handleSessionActivated,
    resolvePreferredSessionId: resolvePreferredSessionIdCallback,
    resetTrigger: isOpen,
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const sessionOpRef = useRef<Promise<void> | null>(null);
  const connectAttemptRef = useRef(false);
  const lastConnectAttemptRef = useRef(0);
  const wasOpenRef = useRef(false);

  const baseAssistantLabel = useMemo(
    () => hostLabel || pageTitle || 'Moonscape Assistant',
    [hostLabel, pageTitle]
  );

  const ensureChatContext = useCallback(
    (label: string) => {
      const state = useAgentStore.getState();
      const { mode, agentName } = state.chatContext;
      if (mode === 'personal' && agentName === label) {
        return;
      }
      setChatContext({
        mode: 'personal',
        agentName: label,
      });
    },
    [setChatContext]
  );

  useAgentInit({
    isConfigured,
    config,
    isConnected,
    status,
    connect,
    ready: isOpen && walletReady,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    ensureChatContext(baseAssistantLabel);
  }, [isOpen, baseAssistantLabel, ensureChatContext]);

  useEffect(() => {
    if (!walletReady) {
      return;
    }
    void setOperationalMode('provideBytes');
  }, [walletReady, setOperationalMode]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const agentState = useAgentStore.getState();
      agentState.setCurrentSession(null);
      agentState.setSessionId(null);
      assistantSessionIdRef.current = null;
    }
    if (!isOpen && wasOpenRef.current) {
      assistantSessionIdRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!walletConnected || !walletAccountId) {
      return;
    }
    ensureChatContext(baseAssistantLabel);
  }, [walletConnected, walletAccountId, baseAssistantLabel, ensureChatContext]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!currentSessionId || currentSessionId !== sessionId) {
      return;
    }
    const assistantLabel = currentSessionName || baseAssistantLabel;
    ensureChatContext(assistantLabel || 'Moonscape Assistant');
  }, [
    isOpen,
    currentSessionId,
    currentSessionName,
    sessionId,
    baseAssistantLabel,
    ensureChatContext,
  ]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleOpenChat = useCallback(() => {
    navigate('/chat');
  }, [navigate]);

  const handleToggleHistory = useCallback(() => {
    setIsHistoryOpen((previous) => !previous);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
  }, []);

  const handleReconnect = useCallback(() => {
    if (status === 'connecting') {
      return;
    }
    if (connectAttemptRef.current) {
      return;
    }
    lastConnectAttemptRef.current = Date.now();
    connectAttemptRef.current = true;
    void (async () => {
      try {
        await connect();
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to connect to the assistant',
          duration: 5000,
        });
      } finally {
        connectAttemptRef.current = false;
      }
    })();
  }, [status, connect, addNotification]);

  useEffect(() => {
    let active = true;
    if (!isHistoryOpen) {
      return () => {
        active = false;
      };
    }

    setIsHistoryLoading(true);
    loadAllSessions()
      .catch((error) => {
        addNotification({
          type: 'error',
          title: 'Failed to load history',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load previous browser conversations',
          duration: 5000,
        });
      })
      .finally(() => {
        if (active) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [addNotification, isHistoryOpen, loadAllSessions]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseHistory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseHistory, isHistoryOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!walletReady) {
      return;
    }
    if (isConnected) {
      connectAttemptRef.current = false;
      return;
    }
    if (status === 'connecting') {
      return;
    }
    if (
      (status === 'idle' || status === 'error') &&
      !connectAttemptRef.current
    ) {
      const now = Date.now();
      if (now - lastConnectAttemptRef.current < 10000) {
        return;
      }
      lastConnectAttemptRef.current = now;
      connectAttemptRef.current = true;
      void (async () => {
        try {
          await connect();
        } catch (error) {
          addNotification({
            type: 'error',
            title: 'Connection Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to connect to the assistant',
            duration: 5000,
          });
        } finally {
          connectAttemptRef.current = false;
        }
      })();
    }
  }, [isOpen, walletReady, isConnected, status, connect, addNotification]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      if (!session?.id) {
        return;
      }
      if (sessionOpRef.current) {
        return;
      }

      handleCloseHistory();

      const operation = (async () => {
        try {
          await loadSession(session.id);
          const assistantLabel = session.name || hostLabel || pageTitle;
          setChatContext({
            mode: 'personal',
            agentName: assistantLabel || 'Moonscape Assistant',
          });
          onSessionCreated(session.id);
        } catch (error) {
          addNotification({
            type: 'error',
            title: 'Assistant Session Error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to load browser session',
            duration: 6000,
          });
        }
      })();

      sessionOpRef.current = operation.finally(() => {
        sessionOpRef.current = null;
      });
    },
    [
      addNotification,
      handleCloseHistory,
      loadSession,
      onSessionCreated,
      setChatContext,
      hostLabel,
      pageTitle,
    ]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession(sessionId);
        addNotification({
          type: 'success',
          title: 'Session Deleted',
          message: 'Browser session deleted successfully',
          duration: 3000,
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Delete Error',
          message:
            error instanceof Error ? error.message : 'Failed to delete session',
          duration: 6000,
        });
      }
    },
    [deleteSession, addNotification]
  );

  const handleDeleteAllSessions = useCallback(async () => {
    if (isDeletingAll) {
      return;
    }

    const targets = sessions.filter(isBrowserSession);

    if (targets.length === 0) {
      onSessionsCleared();
      handleCloseHistory();
      return;
    }

    setIsDeletingAll(true);

    try {
      for (const session of targets) {
        if (session?.id) {
          await deleteSession(session.id);
        }
      }

      await loadAllSessions();
      onSessionsCleared();
      addNotification({
        type: 'success',
        title: 'Sessions Deleted',
        message: 'All browser sessions were deleted.',
        duration: 4000,
      });
      handleCloseHistory();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Delete Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete browser sessions',
        duration: 6000,
      });
    } finally {
      setIsDeletingAll(false);
      resetAttachments();
    }
  }, [
    isDeletingAll,
    sessions,
    deleteSession,
    loadAllSessions,
    onSessionsCleared,
    addNotification,
    handleCloseHistory,
    resetAttachments,
  ]);

  const handleDockSelection = useCallback(
    (value: AssistantDockPlacement) => {
      if (value === dock) {
        return;
      }
      onDockChange(value);
    },
    [dock, onDockChange]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!sessionId) {
      return;
    }

    if (sessionOpRef.current) {
      return;
    }

    if (currentSessionId === sessionId) {
      return;
    }

    const run = async () => {
      try {
        await loadSession(sessionId);
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Assistant Session Error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load browser session',
          duration: 6000,
        });
      } finally {
        sessionOpRef.current = null;
      }
    };

    sessionOpRef.current = run();
  }, [isOpen, sessionId, currentSessionId, loadSession, addNotification]);
  const activeMessages = useMemo(() => {
    if (currentSessionId !== sessionId) {
      return [];
    }
    if (chatContextMode !== 'personal') {
      return [];
    }
    return messages;
  }, [messages, chatContextMode, currentSessionId, sessionId]);

  const statusLabel = useMemo(() => {
    if (isTyping) {
      return processingContext === 'form'
        ? 'Processing form…'
        : 'Assistant is thinking…';
    }
    return getStatusLabel(isConnected, status);
  }, [isTyping, processingContext, isConnected, status]);

  const upperHost = hostLabel ? hostLabel.toUpperCase() : 'MOONSCAPE';
  const displayTitle = pageTitle.trim() || hostLabel;

  // Filter sessions to only show personal browser sessions
  const browserSessions = useMemo(() => {
    if (!isHistoryOpen || !Array.isArray(sessions)) {
      return [];
    }

    try {
      const filtered = sessions.filter(isBrowserSession);

      filtered.sort((a, b) => {
        const aDate = a.lastMessageAt || a.updatedAt;
        const bDate = b.lastMessageAt || b.updatedAt;
        if (!aDate || !bDate) {
          return 0;
        }
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      const MAX_HISTORY_COUNT = 100;
      return filtered.slice(0, MAX_HISTORY_COUNT);
    } catch {
      return [];
    }
  }, [isHistoryOpen, sessions]);

  return (
    <aside className='relative flex h-full w-full flex-col bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800'>
      <PanelBackground />

      <div className='relative z-10 flex h-full flex-col'>
        {/* Clean Header */}
        <header className='flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800'>
          <div className='flex items-center gap-2'>
            <div className='w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center flex-shrink-0'>
              <FiCompass className='w-3 h-3 text-white' />
            </div>
            <span className='text-sm font-medium text-gray-900 dark:text-white'>
              Moonscape
            </span>
            <span className='text-xs text-gray-500 dark:text-gray-400'>•</span>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              {statusLabel}
            </span>
            {!isConnected ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleReconnect}
                disabled={status === 'connecting'}
                className='h-7 px-3 text-xs text-gray-700 dark:text-gray-200'
              >
                {status === 'connecting' ? 'Connecting…' : 'Reconnect'}
              </Button>
            ) : null}
            {walletConnected ? (
              <Badge className='ml-2 text-[10px] uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-200 border border-purple-500/20'>
                {walletNetwork?.toUpperCase() ?? 'TESTNET'} •
                {walletAccountId ? walletAccountId.slice(-6) : '------'}
              </Badge>
            ) : null}
          </div>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={handleToggleHistory}
              aria-label='Session history'
              aria-expanded={isHistoryOpen}
              aria-haspopup='dialog'
              className={cn(
                'w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors',
                isHistoryOpen && 'text-purple-500 dark:text-purple-300'
              )}
            >
              <FiClock className='w-3 h-3' />
            </Button>
            {DOCK_OPTIONS.map((option) => (
              <DockToggleButton
                key={option.value}
                option={option}
                isActive={option.value === dock}
                onSelect={handleDockSelection}
              />
            ))}
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={handleClose}
              className='w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-1'
            >
              <FiX className='w-3 h-3' />
            </Button>
          </div>
        </header>

        {/* Chat Messages */}
        <div className='flex-1 overflow-hidden'>
          <div className='h-full overflow-y-auto'>
            <MessageList
              messages={activeMessages}
              isLoading={isTyping}
              userProfile={null}
              isHCS10={false}
              emptyState={
                <BrowserAssistantEmptyState
                  hostLabel={hostLabel}
                  pageTitle={pageTitle}
                />
              }
            />
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className='border-t border-gray-200 dark:border-gray-800 p-4'>
          <MoonscapeComposer
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            connected={isConnected}
            submitting={isSubmitting || isTyping}
            fileError={fileError}
            files={selectedFiles}
            onFileAdd={handleFileAdd}
            onFileRemove={handleFileRemove}
          />
        </div>
      </div>

      {isHistoryOpen ? (
        <div className='fixed inset-0 z-40 flex items-center justify-center px-4'>
          <div
            className='absolute inset-0 bg-[rgba(10,13,24,0.55)] backdrop-blur-sm'
            onClick={handleCloseHistory}
          />
          <div className='relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-gray-200/80 dark:border-gray-700/60 bg-white/95 dark:bg-gray-900/95 shadow-[0_40px_120px_rgba(15,23,42,0.45)]'>
            <div className='flex items-start justify-between gap-4 border-b border-gray-200/80 dark:border-gray-800/70 px-5 py-4'>
              <div>
                <Typography
                  variant='caption'
                  className='text-xs font-semibold tracking-[0.22em] text-gray-500 dark:text-gray-400 uppercase'
                >
                  Conversation History
                </Typography>
                <Typography
                  variant='body2'
                  className='text-sm text-gray-700 dark:text-gray-300 mt-1'
                >
                  Reopen a previous Moonscape browsing session.
                </Typography>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleDeleteAllSessions}
                  disabled={isDeletingAll || browserSessions.length === 0}
                  className='h-8 rounded-xl border border-red-500/40 bg-red-500/5 text-red-500 hover:bg-red-500/10 disabled:opacity-60'
                >
                  <FiTrash2 className='h-3.5 w-3.5' />
                  <span>Delete All</span>
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={handleCloseHistory}
                  className='w-8 h-8 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/70'
                >
                  <FiX className='w-4 h-4' />
                </Button>
              </div>
            </div>
            {isHistoryLoading ? (
              <div className='px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400'>
                Loading sessions…
              </div>
            ) : browserSessions.length === 0 ? (
              <div className='px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400'>
                No previous browser sessions yet.
              </div>
            ) : (
              <div className='flex flex-col gap-1 px-2 py-3 max-h-80 overflow-y-auto'>
                {browserSessions.map((session) => {
                  const isActive = currentSessionId === session.id;
                  const sessionTitle = session.name
                    .replace(/^Browser @ [^-]+ - /, '')
                    .replace(/ - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, '');
                  const hostMatch = session.name.match(/Browser @ ([^-]+)/);
                  const host = hostMatch ? hostMatch[1] : 'Unknown';
                  const lastTimestamp =
                    session.lastMessageAt || session.updatedAt;
                  const lastUsed = lastTimestamp
                    ? new Date(lastTimestamp)
                    : null;

                  return (
                    <div
                      key={session.id}
                      className='group relative rounded-2xl border border-transparent hover:border-purple-200/80 dark:hover:border-purple-700/60 transition-colors duration-150'
                    >
                      <button
                        type='button'
                        onClick={() => handleSelectSession(session)}
                        className={cn(
                          'w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-colors',
                          isActive
                            ? 'bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-orange-400/10'
                            : 'bg-white/80 dark:bg-gray-900/80 hover:bg-purple-50/80 dark:hover:bg-purple-950/30'
                        )}
                      >
                        <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 shadow-inner shadow-white/30'>
                          <FiCompass className='h-5 w-5 text-white' />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <Typography
                            variant='body2'
                            className='font-semibold text-gray-900 dark:text-white truncate'
                          >
                            {sessionTitle}
                          </Typography>
                          <div className='mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
                            <span className='truncate'>{host}</span>
                            {lastUsed ? (
                              <span>{lastUsed.toLocaleDateString()}</span>
                            ) : null}
                          </div>
                        </div>
                        {isActive ? (
                          <span className='flex h-2 w-2 flex-shrink-0 rounded-full bg-purple-500' />
                        ) : null}
                      </button>
                      <button
                        type='button'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className='absolute right-3 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-opacity group-hover:flex'
                        aria-label='Delete session'
                      >
                        <FiTrash2 className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default BrowserAssistantPanel;
