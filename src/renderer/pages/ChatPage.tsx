import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { useAgentStore } from '../stores/agentStore';
import { useConfigStore } from '../stores/configStore';
import { Logger } from '@hashgraphonline/standards-sdk';
import { fetchUserProfile as fetchProfileViaFactory } from '../services/hcs10ClientFactory';
import { useWalletStore } from '../stores/walletStore';
import {
  FiSettings,
  FiRefreshCw,
  FiMessageSquare,
  FiWifi,
  FiWifiOff,
  FiShield,
  FiAlertCircle,
  FiHash,
  FiUser,
} from 'react-icons/fi';
import { cn } from '../lib/utils';
import type { Message, AgentStatus } from '../stores/agentStore';
import type { ChatSession } from '../../main/db/schema';
import MessageList from '../components/chat/MessageList';
import ChatComposer from '../components/chat/ChatComposer';
import ModeBadge from '../components/chat/status/ModeBadge';
import LoadingConversation from '../components/chat/status/LoadingConversation';
import EmptyChatState from '../components/chat/status/EmptyChatState';
import ChatHeader from '../components/chat/headers/ChatHeader';
import { Disclaimer } from '../components/chat/Disclaimer';
import { AgentSelectorModal } from '../components/chat/AgentSelectorModal';
import { SessionCreationModal } from '../components/chat/SessionCreationModal';
import { AgentProfileModal } from '../components/AgentProfileModal';
import { toast } from 'sonner';
import { useNotificationStore } from '../stores/notificationStore';
import { useHCS10 } from '../contexts/HCS10Context';
import type { Agent } from '../contexts/HCS10Context';
import ClearChatDialog from '../components/chat/modals/ClearChatDialog';
import DeleteSessionDialog from '../components/chat/modals/DeleteSessionDialog';
import useAssistantMessageController from '../hooks/useAssistantMessageController';
import useAgentInit from '../hooks/useAgentInit';
import useHcs10Polling from '../hooks/useHcs10Polling';
import useChatSessions from '../hooks/useChatSessions';
import useChatContextInit from '../hooks/useChatContextInit';
import useWalletOperationalMode from '../hooks/useWalletOperationalMode';

interface ChatPageProps {}

interface UserProfile {
  display_name?: string;
  alias?: string;
  bio?: string;
  profileImage?: string;
  type?: number;
  aiAgent?: {
    type: number;
    capabilities?: number[];
    model?: string;
    creator?: string;
  };
}

const logger = new Logger({ module: 'ChatPage' });

const ChatPage: React.FC<ChatPageProps> = () => {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();
  const { walletReady } = useWalletOperationalMode();
  const operationalMode = useAgentStore((state) => state.operationalMode);
  const setOperationalMode = useAgentStore((state) => state.setOperationalMode);
  const {
    status,
    isConnected,
    connectionError,
    connect,
    sendMessage,
    clearMessages,
    getMessages,
    loadConversationMessages,
    refreshConversationMessages,
    chatContext,
    setChatContext,
    hcs10LoadingMessages,
    sessions,
    currentSession,
    createSession,
    loadSession,
    saveSession,
    deleteSession,
    isTyping,
    processingContext,
  } = useAgentStore();

  let derivedTopicId: string | undefined;
  if (currentSession?.mode === 'hcs10' && currentSession.topicId) {
    derivedTopicId = currentSession.topicId;
  } else if (chatContext.mode === 'hcs10' && chatContext.topicId) {
    derivedTopicId = chatContext.topicId;
  } else {
    derivedTopicId = undefined;
  }

  const messages = getMessages(derivedTopicId);

  const { config, isConfigured } = useConfigStore();
  const { addNotification } = useNotificationStore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { agents: hcs10Agents } = useHCS10();

  const agents = hcs10Agents;
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [agentProfileModal, setAgentProfileModal] = useState<{
    accountId: string;
    agentName: string;
    network: string;
  } | null>(null);
  const {
    isLoadingSessions,
    showSessionCreationModal,
    sessionDeleteConfirm,
    setSessionDeleteConfirm,
    openCreateSession: openCreateSessionHook,
    closeCreateSession,
    handleSessionSelect: handleSessionSelectHook,
    handleSessionCreated: handleSessionCreatedHook,
    handleDeleteSession: handleDeleteSessionHook,
  } = useChatSessions({
    loadSession,
    createSession,
    deleteSession,
    setChatContext,
    currentSession,
  });
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const isManuallySelectingSession = useRef(false);
  const manualSelectionReleaseRef = useRef<number | null>(null);

  const armManualSelection = useCallback(() => {
    isManuallySelectingSession.current = true;
    if (manualSelectionReleaseRef.current !== null) {
      window.clearTimeout(manualSelectionReleaseRef.current);
      manualSelectionReleaseRef.current = null;
    }
  }, []);

  const scheduleManualSelectionRelease = useCallback(() => {
    if (!isManuallySelectingSession.current) {
      return;
    }
    if (manualSelectionReleaseRef.current !== null) {
      window.clearTimeout(manualSelectionReleaseRef.current);
    }
    manualSelectionReleaseRef.current = window.setTimeout(() => {
      isManuallySelectingSession.current = false;
      manualSelectionReleaseRef.current = null;
    }, 1500);
  }, []);

  const handleControllerSessionCreated = useCallback(
    (_: string) => {
      scheduleManualSelectionRelease();
    },
    [scheduleManualSelectionRelease]
  );

  const handleControllerSessionActivated = useCallback(
    (_: ChatSession) => {
      scheduleManualSelectionRelease();
    },
    [scheduleManualSelectionRelease]
  );

  useEffect(() => {
    return () => {
      if (manualSelectionReleaseRef.current !== null) {
        window.clearTimeout(manualSelectionReleaseRef.current);
        manualSelectionReleaseRef.current = null;
      }
    };
  }, []);

  const toggleSessionSelector = useCallback(() => {
    setShowSessionSelector((prev) => !prev);
  }, []);

  const openCreateSession = useCallback(() => {
    setShowSessionSelector(false);
    openCreateSessionHook();
  }, [openCreateSessionHook]);

  const requestDeleteSession = useCallback((id: string) => {
    setSessionDeleteConfirm(id);
  }, []);

  const isConfigComplete = isConfigured();
  let currentTopicId: string | undefined;
  if (currentSession?.mode === 'hcs10' && currentSession.topicId) {
    currentTopicId = currentSession.topicId;
  } else if (chatContext.mode === 'hcs10' && chatContext.topicId) {
    currentTopicId = chatContext.topicId;
  } else {
    currentTopicId = undefined;
  }

  let isLoadingHCS10Messages = false;
  if (currentTopicId) {
    isLoadingHCS10Messages = Boolean(hcs10LoadingMessages[currentTopicId]);
  }

  const wallet = useWalletStore();
  const fetchUserProfile = React.useCallback(async () => {
    const effectiveAccountId = wallet.isConnected ? wallet.accountId : config?.hedera?.accountId;
    const effectiveNetwork = (wallet.isConnected ? wallet.network : config?.hedera?.network) as ('mainnet' | 'testnet' | undefined);
    if (effectiveAccountId && effectiveNetwork && !isLoadingProfile) {
      setIsLoadingProfile(true);
      try {
        const resp = await fetchProfileViaFactory(
          effectiveAccountId,
          effectiveNetwork,
          {
            walletConnected: wallet.isConnected,
            operatorId: config?.hedera?.accountId,
            privateKey: config?.hedera?.privateKey,
          }
        );
        if (resp.success) {
          setUserProfile(resp.profile as unknown as UserProfile);
        } else if (wallet.isConnected) {
          setUserProfile({ display_name: 'Wallet Account' });
        }
      } catch (error) {
      } finally {
        setIsLoadingProfile(false);
      }
    }
  }, [wallet.isConnected, wallet.accountId, wallet.network, config?.hedera?.accountId, config?.hedera?.network, config?.hedera?.privateKey]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    const handleFocus = () => {
      fetchUserProfile();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUserProfile]);

  useAgentInit({ isConfigured, config, isConnected, status, connect, ready: walletReady });

  useEffect(() => {
    if (!walletReady) {
      return;
    }
    void setOperationalMode('provideBytes');
  }, [walletReady, setOperationalMode]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useChatContextInit({
    agentId,
    agents,
    sessions,
    currentSession,
    currentContext: chatContext,
    setChatContext,
    loadSession,
    createSession,
    isManualSelecting: () => isManuallySelectingSession.current === true,
    clearManualSelecting: () => {
      isManuallySelectingSession.current = false;
    },
  });

  useHcs10Polling({
    topicId: currentTopicId,
    isConnected,
    hasMessages: messages.length > 0,
  });

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
  } = useAssistantMessageController({
    buildSessionName: ({ message, chatContext, defaultName }) => {
      if (chatContext.mode === 'personal') {
        if (message.length > 50) {
          return `${message.substring(0, 47)}...`;
        }
        return message || defaultName;
      }
      return chatContext.agentName || defaultName;
    },
    onBeforeSessionCreate: armManualSelection,
    onSessionCreated: handleControllerSessionCreated,
    onSessionActivated: handleControllerSessionActivated,
  });

  const isLoading = isSending;
  const handleAddFiles = handleFileAdd;
  const handleRemoveFile = handleFileRemove;

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {}
  };

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleConnectToAgent = useCallback(async (agent: Agent) => {
    try {
      const result = await window.electron.invoke(
        'hcs10:send-connection-request',
        {
          targetAccountId: agent.accountId,
        }
      );

      if (result.success) {
        toast.success('Connection Request Sent', {
          description: 'Your connection request has been sent to the agent',
        });
      } else {
        toast.error('Connection Failed', {
          description: result.error || 'Failed to send connection request',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to send connection request',
      });
    }
  }, []);

  const handleSessionSelect = useCallback(
    async (session: ChatSession) => {
      setShowSessionSelector(false);
      isManuallySelectingSession.current = true;
      await handleSessionSelectHook(session);
      setTimeout(() => {
        isManuallySelectingSession.current = false;
      }, 1500);
    },
    [handleSessionSelectHook]
  );

  const handleSessionCreated = useCallback(
    async (session: ChatSession) => {
      isManuallySelectingSession.current = true;
      await handleSessionCreatedHook(session);
      setTimeout(() => {
        isManuallySelectingSession.current = false;
      }, 1500);
    },
    [handleSessionCreatedHook]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await handleDeleteSessionHook(sessionId);
    },
    [handleDeleteSessionHook]
  );

  const handleAgentProfileClick = useCallback((accountId: string, agentName: string, network: string) => {
    setAgentProfileModal({ accountId, agentName, network });
  }, []);

  const handleAgentConnect = useCallback(async (accountId: string) => {
    try {
      const result = await window.electron.invoke(
        'hcs10:send-connection-request',
        {
          targetAccountId: accountId,
        }
      );

      if (result.success) {
        toast.success('Connection Request Sent', {
          description: 'Your connection request has been sent to the agent',
        });
      } else {
        toast.error('Connection Failed', {
          description: result.error || 'Failed to send connection request',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to send connection request',
      });
    }
    setAgentProfileModal(null);
  }, []);

  if (!isConfigComplete) {
    return (
      <div className='flex flex-col h-full bg-gray-50 dark:bg-gray-950'>
        <header className='h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-hgo-purple to-hgo-blue rounded-xl flex items-center justify-center'>
              <FiMessageSquare className='w-5 h-5 text-white' />
            </div>
            <Typography variant='h5' className='font-bold'>
              AI Agent Chat
            </Typography>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center p-8'>
          <div className='text-center space-y-6 max-w-lg animate-fade-in'>
            <div className='w-20 h-20 bg-gradient-to-br from-hgo-purple to-hgo-blue rounded-2xl flex items-center justify-center mx-auto animate-float'>
              <FiSettings className='w-10 h-10 text-white' />
            </div>
            <div className='space-y-3'>
              <Typography variant='h3' gradient className='font-bold'>
                Welcome to Agent Chat
              </Typography>
              <Typography
                variant='body1'
                color='muted'
                className='max-w-md mx-auto'
              >
                To start chatting, you'll need to set up your account and API
                credentials. This ensures your conversations are secure and
                private.
              </Typography>
            </div>
            <Button onClick={handleGoToSettings} variant='gradient' size='lg'>
              <FiSettings className='w-5 h-5' />
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className='flex flex-col h-full bg-gray-50 dark:bg-gray-950'>
        <header className='h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-hgo-purple to-hgo-blue rounded-2xl flex items-center justify-center'>
              <FiMessageSquare className='w-5 h-5 text-white' />
            </div>
            <Typography variant='h5' className='font-bold'>
              AI Agent Chat
            </Typography>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center p-8'>
          {status === 'connecting' ||
          status === 'disconnecting' ? (
            <div className='text-center space-y-6 max-w-lg animate-fade-in'>
              <div className='w-20 h-20 bg-gradient-to-br from-hgo-purple to-hgo-blue rounded-2xl flex items-center justify-center mx-auto'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <FiRefreshCw className='w-10 h-10 text-white' />
                </motion.div>
              </div>
              <div className='space-y-3'>
                <Typography variant='h3' gradient className='font-bold'>
                  {status === 'disconnecting'
                    ? 'Switching Mode'
                    : 'Connecting to Agent'}
                </Typography>
                <Typography
                  variant='body1'
                  color='muted'
                  className='max-w-md mx-auto'
                >
                  {status === 'disconnecting'
                    ? 'Reconfiguring your assistant for the new operational mode...'
                    : 'Getting your assistant ready. This may take a moment...'}
                </Typography>
                <div className='flex flex-col gap-2 mt-4'>
                  <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                    <motion.div
                      className='w-2 h-2 bg-hgo-blue rounded-full'
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Loading extensions...
                  </div>
                  <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                    <motion.div
                      className='w-2 h-2 bg-hgo-purple rounded-full'
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: 0.5,
                      }}
                    />
                    Connecting to network...
                  </div>
                  <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                    <motion.div
                      className='w-2 h-2 bg-hgo-green rounded-full'
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                    />
                    Setting up your assistant...
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className='text-center space-y-6 max-w-lg animate-fade-in'>
              <div className='w-20 h-20 bg-gradient-to-br from-hgo-green to-hgo-blue rounded-2xl flex items-center justify-center mx-auto animate-float'>
                <FiRefreshCw className='w-10 h-10 text-white' />
              </div>
              <div className='space-y-3'>
                <Typography variant='h3' gradient className='font-bold'>
                  Ready to Connect
                </Typography>
                <Typography
                  variant='body1'
                  color='muted'
                  className='max-w-md mx-auto'
                >
                  {connectionError
                    ? `Connection failed: ${connectionError}. Please check your settings and try again.`
                    : 'Your assistant is ready to start. Click below to connect and begin chatting.'}
                </Typography>
              </div>
              <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                <Button
                  onClick={handleConnect}
                  variant='default'
                  size='lg'
                  disabled={useAgentStore.getState().status === 'connecting'}
                >
                  <FiRefreshCw
                    className={cn(
                      'w-5 h-5',
                      useAgentStore.getState().status === 'connecting' && 'animate-spin'
                    )}
                  />
                  {useAgentStore.getState().status === 'connecting'
                    ? 'Connecting...'
                    : 'Connect to Assistant'}
                </Button>
                <Button
                  onClick={handleGoToSettings}
                  variant='secondary'
                  size='lg'
                >
                  <FiSettings className='w-5 h-5' />
                  Settings
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col bg-gradient-to-br from-gray-50/95 via-white/90 to-gray-100/95 dark:from-gray-950/98 dark:via-gray-900/95 dark:to-gray-800/98 relative h-full'>
      <div className='absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none'>
        <motion.div
          className='absolute inset-0'
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 50,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          style={{
            backgroundImage: `
              repeating-linear-gradient(45deg, transparent, transparent 80px, rgba(166, 121, 240, 0.08) 80px, rgba(166, 121, 240, 0.08) 160px),
              repeating-linear-gradient(-45deg, transparent, transparent 100px, rgba(85, 153, 254, 0.06) 100px, rgba(85, 153, 254, 0.06) 200px),
              repeating-linear-gradient(135deg, transparent, transparent 120px, rgba(94, 239, 129, 0.04) 120px, rgba(94, 239, 129, 0.04) 240px)
            `,
            backgroundSize: '500% 500%',
          }}
        />
      </div>

      <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-gray-50/20 dark:from-gray-950/40 dark:via-transparent dark:to-gray-900/30 pointer-events-none' />
      <div className='absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent dark:from-transparent dark:via-gray-900/10 dark:to-transparent pointer-events-none' />
      <ChatHeader
        mode={chatContext.mode}
        isConnected={isConnected}
        statusText={status === 'connected' ? 'Online' : status}
        networkLabel={(wallet.isConnected ? wallet.network : (config?.hedera?.network || 'testnet')).toUpperCase()}
        accountSuffix={(wallet.isConnected ? wallet.accountId : config?.hedera?.accountId)?.slice(-6) || 'Not configured'}
        sessions={sessions}
        currentSession={currentSession}
        isLoadingSessions={isLoadingSessions}
        isSelectorOpen={showSessionSelector}
        onToggleSelector={toggleSessionSelector}
        onCreateSession={openCreateSession}
        onSelectSession={handleSessionSelect}
        onRequestDeleteSession={requestDeleteSession}
      />

      <div className='flex-1 overflow-y-auto relative min-h-0'>
        {(() => {
          let content;
          if (messages.length === 0 && !isLoadingHCS10Messages) {
            content = <EmptyChatState onSelectSuggestion={setInputValue} />;
          } else if (isLoadingHCS10Messages) {
            content = <LoadingConversation />;
          } else {
            content = (
              <div className="relative">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  userProfile={userProfile}
                  isHCS10={chatContext.mode === 'hcs10'}
                  agentName={chatContext.agentName}
                  onAgentProfileClick={handleAgentProfileClick}
                />
                {isTyping && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-10 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-sm font-medium">
                        {processingContext === 'form' ? 'Processing your form...' : 'Processing your message...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          return content;
        })()}
      </div>

      <div className='border-t border-gray-200/30 dark:border-gray-800/30 bg-white/98 dark:bg-gray-900/98 backdrop-blur-2xl flex-shrink-0 shadow-2xl shadow-gray-200/10 dark:shadow-gray-900/30'>
        <div className='px-3 sm:px-4 lg:px-6 pt-4'>
          <Disclaimer />
        </div>

        <div className='px-3 sm:px-4 lg:px-6 pb-6 pt-3'>
            <div className='mb-3 flex items-center justify-center'>
              <ModeBadge
                mode={chatContext.mode}
                agentName={chatContext.agentName}
              />
            </div>

            <ChatComposer
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSendMessage}
              connected={isConnected}
              submitting={isSubmitting}
              fileError={fileError}
              files={selectedFiles}
              onFileAdd={handleAddFiles}
              onFileRemove={handleRemoveFile}
            />
        </div>
      </div>

      <ClearChatDialog
        isOpen={showClearDialog}
        onCancel={() => setShowClearDialog(false)}
        onConfirm={() => {
          clearMessages();
          setShowClearDialog(false);
        }}
      />

      <AgentSelectorModal
        isOpen={showAgentSelector}
        onClose={() => setShowAgentSelector(false)}
        onConnect={handleConnectToAgent}
        currentNetwork={config?.hedera?.network || 'testnet'}
      />

      <SessionCreationModal
        isOpen={showSessionCreationModal}
        onClose={closeCreateSession}
        onSessionCreated={handleSessionCreated}
      />

      <DeleteSessionDialog
        sessionId={sessionDeleteConfirm}
        onCancel={() => setSessionDeleteConfirm(null)}
        onConfirm={handleDeleteSession}
      />

      <AgentProfileModal
        agent={agentProfileModal ? {
          accountId: agentProfileModal.accountId,
          metadata: {
            display_name: agentProfileModal.agentName,
            alias: agentProfileModal.agentName,
            accountId: agentProfileModal.accountId,
          },
          network: agentProfileModal.network,
        } : null}
        isOpen={!!agentProfileModal}
        onClose={() => setAgentProfileModal(null)}
        onConnect={handleAgentConnect}
      />
    </div>
  );
};

export default ChatPage;
