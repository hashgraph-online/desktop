import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { useAgentStore } from '../stores/agentStore';
import { useConfigStore } from '../stores/configStore';
import { HCS10Client, Logger } from '@hashgraphonline/standards-sdk';
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
import useFileAttachments from '../hooks/useFileAttachments';
import useAgentInit from '../hooks/useAgentInit';
import useHcs10Polling from '../hooks/useHcs10Polling';
import useChatSessions from '../hooks/useChatSessions';
import useChatContextInit from '../hooks/useChatContextInit';

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
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    files: selectedFiles,
    fileError,
    addFiles,
    removeFile,
    reset,
    toBase64,
  } = useFileAttachments(5, 10);
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

  const fetchUserProfile = React.useCallback(async () => {
    if (
      config?.hedera?.accountId &&
      config?.hedera?.network &&
      !isLoadingProfile
    ) {
      setIsLoadingProfile(true);
      try {
        const client = new HCS10Client({
          network: config.hedera.network as 'mainnet' | 'testnet',
          operatorId: config.hedera.accountId,
          operatorPrivateKey: config.hedera.privateKey,
          logLevel: 'info',
        });

        const profileResult = await client.retrieveProfile(
          config.hedera.accountId,
          true
        );

        if (profileResult.success && profileResult.profile) {
          const profile = profileResult.profile;

          const mappedProfile: UserProfile = {
            ...profile,
            profileImage: profile.profileImage || profile.logo,
          };
          setUserProfile(mappedProfile);
        }
      } catch (error) {
      } finally {
        setIsLoadingProfile(false);
      }
    }
  }, [
    config?.hedera?.accountId,
    config?.hedera?.network,
    config?.hedera?.privateKey,
  ]);

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

  useAgentInit({ isConfigured, config, isConnected, status, connect });

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

  const handleAddFiles = (files: FileList) => addFiles(files);
  const handleRemoveFile = (index: number) => removeFile(index);
  const fileToBase64 = toBase64;

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (
      (!message && selectedFiles.length === 0) ||
      isSubmitting ||
      isTyping ||
      !isConnected
    )
      return;

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      if (!currentSession) {
        let sessionName: string;

        if (chatContext.mode === 'personal') {
          sessionName =
            message.length > 50
              ? `${message.substring(0, 47)}...`
              : message || `Personal Chat - ${new Date().toLocaleDateString()}`;
        } else {
          sessionName =
            chatContext.agentName || `HCS-10 Chat - ${chatContext.topicId}`;
        }

        isManuallySelectingSession.current = true;

        const newSession = await createSession(
          sessionName,
          chatContext.mode,
          chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
        );

        await loadSession(newSession.id);

        setTimeout(() => {
          isManuallySelectingSession.current = false;
        }, 1500);

        const { currentSession: verifiedSession } = useAgentStore.getState();
        if (!verifiedSession) {
          throw new Error('Failed to create active session for sending message');
        }
      }

      const { currentSession: activeSession } = useAgentStore.getState();
      if (!activeSession) {
        throw new Error('No active session available for sending message');
      }

      const attachments: Array<{
        name: string;
        data: string;
        type: string;
        size: number;
      }> = [];

      if (selectedFiles.length > 0) {
        const failedFiles: string[] = [];
        
        for (const file of selectedFiles) {
          try {
            const base64Content = await fileToBase64(file);
            attachments.push({
              name: file.name,
              data: base64Content,
              type: file.type || 'application/octet-stream',
              size: file.size,
            });
          } catch (error) {
            logger.error('File conversion failed:', error);
            failedFiles.push(file.name);
          }
        }
        
        if (failedFiles.length > 0) {
          const allFilesFailed = failedFiles.length === selectedFiles.length;
          const someFilesFailed = failedFiles.length > 0 && failedFiles.length < selectedFiles.length;
          
          if (allFilesFailed) {
            addNotification({
              type: 'error',
              title: 'File Attachment Failed',
              message: failedFiles.length === 1 
                ? `Failed to process file: ${failedFiles[0]}` 
                : `Failed to process ${failedFiles.length} files: ${failedFiles.join(', ')}`,
              duration: 8000
            });
            return;
          } else if (someFilesFailed) {
            addNotification({
              type: 'warning',
              title: 'Some Files Failed to Attach',
              message: failedFiles.length === 1 
                ? `Failed to attach: ${failedFiles[0]}` 
                : `Failed to attach ${failedFiles.length} files: ${failedFiles.join(', ')}`,
              duration: 6000
            });
          }
        }
      }

      let sendTopicId: string | undefined;
      if (activeSession?.mode === 'hcs10') {
        sendTopicId = activeSession.topicId;
      } else {
        sendTopicId = undefined;
      }
      await sendMessage(message, attachments, sendTopicId);

      if (activeSession) {
        let nextSessionName = activeSession.name;
        const isPersonalDefault =
          activeSession.name.includes('Personal Chat -');
        const isHcsDefault = activeSession.name.includes('HCS-10 Chat -');
        const canUseMessageAsName = message.length > 0 && message.length <= 50;

        if (isPersonalDefault && canUseMessageAsName) {
          nextSessionName = message;
        } else if (
          isHcsDefault &&
          Boolean(chatContext.agentName) &&
          activeSession.name !== chatContext.agentName
        ) {
          nextSessionName = chatContext.agentName as string;
        }

        const updatedSession = {
          ...activeSession,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
          name: nextSessionName,
        } as ChatSession;

        try {
          await saveSession(updatedSession);
        } catch (error) {
          logger.error('Failed to save session:', error);
        }
      }

      setInputValue('');
    } catch (error) {
      logger.error('Failed to send message:', error);
      addNotification({
        type: 'error',
        title: 'Message Send Failed',
        message: 'Unable to send your message. Please check your connection and try again.',
        duration: 6000
      });
    } finally {
      reset();
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

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
        networkLabel={(config?.hedera?.network || 'testnet').toUpperCase()}
        accountSuffix={config?.hedera?.accountId?.slice(-6) || 'Not configured'}
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
          <div className='max-w-5xl mx-auto'>
            <Disclaimer />
          </div>
        </div>

        <div className='px-3 sm:px-4 lg:px-6 pb-6 pt-3'>
          <div className='max-w-5xl mx-auto'>
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
