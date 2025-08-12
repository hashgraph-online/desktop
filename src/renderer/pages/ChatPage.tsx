import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Typography from '../components/ui/Typography';
import Logo from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAgentStore } from '../stores/agentStore';
import { useConfigStore } from '../stores/configStore';
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import {
  FiSettings,
  FiRefreshCw,
  FiSend,
  FiMessageSquare,
  FiZap,
  FiWifi,
  FiWifiOff,
  FiShield,
  FiCpu,
  FiCode,
  FiAlertCircle,
  FiPaperclip,
  FiFile,
  FiX,
  FiTrash2,
} from 'react-icons/fi';
import { cn } from '../lib/utils';
import type { Message } from '../stores/agentStore';
import { ModeToggle } from '../components/chat/ModeToggle';
import MessageBubble from '../components/chat/MessageBubble';
import { Disclaimer } from '../components/chat/Disclaimer';

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

// Animated suggestion card component
const AnimatedSuggestionCard: React.FC<{
  setInputValue: (value: string) => void;
}> = ({ setInputValue }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const suggestions = [
    {
      icon: FiCpu,
      text: 'Inscribe this poem...',
      color: 'from-purple-500/70 to-purple-600/70',
    },
    {
      icon: FiCode,
      text: "What's the price of HBAR?",
      color: 'from-blue-500/70 to-blue-600/70',
    },
    {
      icon: FiShield,
      text: 'Send 1 HBAR to 0.0.800',
      color: 'from-green-500/70 to-green-600/70',
    },
    {
      icon: FiMessageSquare,
      text: 'Create an NFT collection',
      color: 'from-indigo-500/70 to-indigo-600/70',
    },
  ];

  const currentSuggestion = suggestions[currentIndex];
  const Icon = currentSuggestion.icon;

  // Typing animation effect
  useEffect(() => {
    const targetText = currentSuggestion.text;
    let currentText = '';
    let charIndex = 0;

    setIsTyping(true);
    setDisplayText('');

    const typingInterval = setInterval(() => {
      if (charIndex < targetText.length) {
        currentText += targetText[charIndex];
        setDisplayText(currentText);
        charIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [currentIndex, currentSuggestion.text]);

  // Auto-advance to next suggestion
  useEffect(() => {
    if (!isTyping) {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % suggestions.length);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isTyping, suggestions.length]);

  return (
    <div className='mt-8 flex flex-col items-center gap-4'>
      <Typography
        variant='caption'
        color='muted'
        className='text-xs uppercase tracking-wider'
      >
        Try asking
      </Typography>

      <motion.button
        key={currentIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setInputValue(currentSuggestion.text)}
        className='relative px-6 py-5 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl transition-all min-w-[320px] max-w-md group'
      >
        <div className='flex items-center gap-4'>
          {/* Animated icon container with fade in/out */}
          <AnimatePresence mode='wait'>
            <motion.div
              key={`icon-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className={cn(
                'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg flex-shrink-0',
                currentSuggestion.color
              )}
            >
              <Icon className='w-5 h-5 text-white' />
            </motion.div>
          </AnimatePresence>

          {/* Text with typing animation - properly centered */}
          <div className='flex-1 text-left'>
            <Typography
              variant='body1'
              className='text-gray-900 dark:text-white font-medium leading-tight'
            >
              {displayText}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className='inline-block w-0.5 h-4 bg-gray-600 dark:bg-gray-400 ml-0.5 align-middle'
                />
              )}
            </Typography>
          </div>
        </div>
      </motion.button>
    </div>
  );
};

const ChatPage: React.FC<ChatPageProps> = () => {
  const navigate = useNavigate();
  const {
    status,
    isConnected,
    connectionError,
    messages,
    operationalMode,
    setOperationalMode,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  } = useAgentStore();

  const { config, isConfigured } = useConfigStore();
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConfigComplete = isConfigured();

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
          setUserProfile(profileResult.profile);
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

  useEffect(() => {
    const initializeAgent = async () => {
      if (config && isConfigComplete && !isConnected && status === 'idle') {
        try {
          await connect();
        } catch (error) {}
      }
    };

    const timer = setTimeout(() => {
      initializeAgent();
    }, 100);

    return () => clearTimeout(timer);
  }, [config, isConfigComplete, isConnected, status, connect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    setFileError(null);

    if (files) {
      const oversizedFiles: string[] = [];
      const newFiles = Array.from(files).filter((file) => {
        if (file.size > 10 * 1024 * 1024) {
          oversizedFiles.push(file.name);
          return false;
        }
        return true;
      });

      if (oversizedFiles.length > 0) {
        setFileError(
          `File${
            oversizedFiles.length > 1 ? 's' : ''
          } too large (max 10MB): ${oversizedFiles.join(', ')}`
        );
        setTimeout(() => setFileError(null), 5000);
      }

      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;

    if (!target.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const newFiles: File[] = [];
      let errorMessages: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSize = file.size / (1024 * 1024);

        if (fileSize > 10) {
          errorMessages.push(`${file.name} exceeds 10MB limit`);
        } else if (selectedFiles.length + newFiles.length >= 5) {
          errorMessages.push('Maximum 5 files allowed');
          break;
        } else {
          newFiles.push(file);
        }
      }

      if (errorMessages.length > 0) {
        setFileError(errorMessages.join(', '));
        setTimeout(() => setFileError(null), 3000);
      }

      if (newFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (
      (!message && selectedFiles.length === 0) ||
      isSubmitting ||
      !isConnected
    )
      return;

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      let attachments: Array<{
        name: string;
        data: string;
        type: string;
        size: number;
      }> = [];

      if (selectedFiles.length > 0) {
        // Process files for attachment (no longer embedding in message content)
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
            console.error(`Failed to process file ${file.name}:`, error);
          }
        }
      }

      await sendMessage(message, attachments);
      setInputValue('');
      setSelectedFiles([]);
    } catch (error) {
    } finally {
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

  if (!isConfigComplete) {
    return (
      <div className='flex flex-col h-full bg-gray-50 dark:bg-gray-950'>
        <header className='h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center'>
              <FiMessageSquare className='w-5 h-5 text-white' />
            </div>
            <Typography variant='h5' className='font-bold'>
              AI Agent Chat
            </Typography>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center p-8'>
          <div className='text-center space-y-6 max-w-lg animate-fade-in'>
            <div className='w-20 h-20 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto animate-float'>
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
            <div className='w-10 h-10 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-xl flex items-center justify-center'>
              <FiMessageSquare className='w-5 h-5 text-white' />
            </div>
            <Typography variant='h5' className='font-bold'>
              AI Agent Chat
            </Typography>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center p-8'>
          {status === ('connecting' as any) ||
          status === ('disconnecting' as any) ? (
            <div className='text-center space-y-6 max-w-lg animate-fade-in'>
              <div className='w-20 h-20 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <FiRefreshCw className='w-10 h-10 text-white' />
                </motion.div>
              </div>
              <div className='space-y-3'>
                <Typography variant='h3' gradient className='font-bold'>
                  {status === ('disconnecting' as any)
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
                      className='w-2 h-2 bg-[#5599fe] rounded-full'
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Loading extensions...
                  </div>
                  <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                    <motion.div
                      className='w-2 h-2 bg-[#a679f0] rounded-full'
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
                      className='w-2 h-2 bg-[#48df7b] rounded-full'
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
              <div className='w-20 h-20 bg-gradient-to-br from-[#48df7b] to-[#5599fe] rounded-2xl flex items-center justify-center mx-auto animate-float'>
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
                  disabled={status === 'connecting'}
                >
                  <FiRefreshCw
                    className={cn(
                      'w-5 h-5',
                      status === ('connecting' as any) && 'animate-spin'
                    )}
                  />
                  {status === ('connecting' as any)
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
      {/* Enhanced luxurious animated background */}
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

      {/* Premium gradient overlay with depth */}
      <div className='absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-gray-50/20 dark:from-gray-950/40 dark:via-transparent dark:to-gray-900/30 pointer-events-none' />
      <div className='absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent dark:from-transparent dark:via-gray-900/10 dark:to-transparent pointer-events-none' />
      <header className='h-14 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/30 dark:border-gray-800/30 flex items-center justify-between px-8 lg:px-16 xl:px-24 2xl:px-32 relative z-10 gap-6 shadow-sm shadow-gray-200/10 dark:shadow-gray-900/20'>
        <div className='max-w-6xl mx-auto w-full flex items-center justify-between gap-6'>
          <div className='flex items-center gap-2 sm:gap-4 flex-shrink-0'>
            <div className='flex items-center gap-2'>
              <motion.div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isConnected ? 'bg-[#48df7b]' : 'bg-gray-400'
                )}
                animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Typography
                variant='caption'
                color='muted'
                className='font-medium'
              >
                {status === 'connected' ? 'Online' : status}
              </Typography>
            </div>
          </div>

          <div className='flex items-center gap-3 sm:gap-4 flex-shrink-0'>
            <div className='hidden lg:block'>
              <ModeToggle
                mode={operationalMode}
                onChange={() => {}}
                disabled={true}
              />
            </div>

            <div className='hidden lg:block h-8 w-px bg-gray-300/60 dark:bg-gray-700/60' />

            {config && (
              <>
                <div className='flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm text-sm'>
                  {isConnected ? (
                    <FiWifi className='w-4 h-4 text-[#48df7b]' />
                  ) : (
                    <FiWifiOff className='w-4 h-4 text-gray-400' />
                  )}
                  <Typography
                    variant='caption'
                    className='font-semibold hidden sm:inline'
                  >
                    {config.hedera?.network?.toUpperCase() || 'TESTNET'}
                  </Typography>
                </div>

                <div className='hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm text-sm'>
                  <FiShield className='w-4 h-4 text-[#a679f0]' />
                  <Typography variant='caption' className='font-semibold'>
                    {config.hedera?.accountId?.slice(-6) || 'Not configured'}
                  </Typography>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className='flex-1 overflow-y-auto relative min-h-0'>
        {messages.length === 0 ? (
          <div className='h-full flex items-center justify-center p-12 lg:p-16'>
            <div className='text-center space-y-8 max-w-3xl relative z-10 pt-12'>
              {/* Enhanced floating orbs */}
              <motion.div
                className='absolute -top-16 -right-24 w-80 h-80 bg-gradient-to-br from-[#a679f0]/8 to-[#5599fe]/6 rounded-full blur-3xl'
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.06, 0.12, 0.06],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                className='absolute -bottom-16 -left-24 w-80 h-80 bg-gradient-to-br from-[#48df7b]/8 to-[#5eef81]/6 rounded-full blur-3xl'
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.06, 0.12, 0.06],
                  rotate: [360, 180, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 4,
                }}
              />
              <motion.div
                className='absolute top-1/3 -right-32 w-64 h-64 bg-gradient-to-br from-[#7eb9ff]/6 to-[#5599fe]/4 rounded-full blur-3xl'
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.04, 0.08, 0.04],
                  x: [0, 30, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 2,
                }}
              />

              <motion.div
                className='w-20 h-20 bg-gradient-to-br from-[#a679f0]/90 to-[#5599fe]/90 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/20 ring-1 ring-white/10'
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                whileHover={{
                  scale: 1.1,
                  boxShadow: '0 25px 50px rgba(166, 121, 240, 0.4)',
                  transition: { duration: 0.3 },
                }}
              >
                <FiMessageSquare className='w-10 h-10 text-white' />
              </motion.div>
              <div className='space-y-4'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  <Typography
                    variant='body1'
                    color='muted'
                    className='text-lg leading-relaxed max-w-2xl mx-auto'
                  >
                    I can help you with Hedera Hashgraph operations, HCS-1
                    inscriptions, HCS-20 ticks, account management, NFT minting,
                    smart contracts, and more.
                  </Typography>
                </motion.div>
              </div>

              <AnimatedSuggestionCard setInputValue={setInputValue} />
            </div>
          </div>
        ) : (
          <div className='py-12 px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-8 max-w-6xl mx-auto w-full'>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                userProfile={userProfile}
              />
            ))}

            {isLoading && (
              <motion.div
                className='flex justify-start'
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className='bg-white/90 dark:bg-gray-900/70 backdrop-blur-md border border-gray-200/60 dark:border-gray-800/60 rounded-3xl px-6 py-4 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/30'>
                  <div className='flex items-center gap-4'>
                    <div className='flex gap-1.5'>
                      <motion.div
                        className='w-2.5 h-2.5 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-full'
                        animate={{ y: [-4, 0, -4] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: 0,
                          ease: 'easeInOut',
                        }}
                      />
                      <motion.div
                        className='w-2.5 h-2.5 bg-gradient-to-br from-[#5599fe] to-[#48df7b] rounded-full'
                        animate={{ y: [-4, 0, -4] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: 0.2,
                          ease: 'easeInOut',
                        }}
                      />
                      <motion.div
                        className='w-2.5 h-2.5 bg-gradient-to-br from-[#48df7b] to-[#a679f0] rounded-full'
                        animate={{ y: [-4, 0, -4] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: 0.4,
                          ease: 'easeInOut',
                        }}
                      />
                    </div>
                    <Typography
                      variant='caption'
                      className='text-gray-700 dark:text-gray-300 font-semibold tracking-wide'
                    >
                      Assistant is thinking...
                    </Typography>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area fixed at bottom */}
      <div className='border-t border-gray-200/30 dark:border-gray-800/30 bg-white/98 dark:bg-gray-900/98 backdrop-blur-2xl flex-shrink-0 shadow-2xl shadow-gray-200/10 dark:shadow-gray-900/30'>
        {/* Disclaimer */}
        <div className='px-8 lg:px-16 xl:px-24 2xl:px-32 pt-4'>
          <div className='max-w-6xl mx-auto'>
            <Disclaimer />
          </div>
        </div>

        <div className='px-8 lg:px-16 xl:px-24 2xl:px-32 pb-8 pt-3'>
          <div className='max-w-6xl mx-auto'>
            {fileError && (
              <Alert className='mb-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'>
                <FiAlertCircle className='h-4 w-4 text-orange-600 dark:text-orange-400' />
                <AlertDescription className='text-orange-800 dark:text-orange-200'>
                  {fileError}
                </AlertDescription>
              </Alert>
            )}

            {selectedFiles.length > 0 && (
              <div className='mb-3 flex flex-wrap gap-2'>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className='inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm'
                  >
                    <FiFile className='w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0' />
                    <span className='truncate max-w-[200px] text-gray-900 dark:text-gray-100 font-medium'>
                      {file.name}
                    </span>
                    <span className='text-xs text-gray-600 dark:text-gray-400'>
                      (
                      {file.size > 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                        : `${(file.size / 1024).toFixed(1)}KB`}
                      )
                    </span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className='ml-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                      aria-label={`Remove ${file.name}`}
                    >
                      <FiX className='w-4 h-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className='flex gap-4 items-start'>
              <div className='flex-1 relative'>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    isConnected
                      ? 'Type a message...'
                      : 'Connect to start chatting...'
                  }
                  disabled={!isConnected || isSubmitting}
                  rows={1}
                  className={cn(
                    'w-full px-6 py-4 pr-14 rounded-2xl resize-none',
                    'min-h-[56px] max-h-[200px]',
                    'bg-gray-50/80 dark:bg-gray-800/60 backdrop-blur-md',
                    'border border-gray-200/60 dark:border-gray-700/60',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500/10 focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800',
                    'placeholder:text-gray-500 dark:placeholder:text-gray-400',
                    'text-gray-900 dark:text-white text-base',
                    'transition-all duration-300 ease-out',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'shadow-lg shadow-gray-200/20 dark:shadow-gray-900/20'
                  )}
                  style={{
                    height: 'auto',
                    overflowY:
                      inputValue.split('\n').length > 4 ? 'auto' : 'hidden',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height =
                      Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
                <Button
                  onClick={handleFileButtonClick}
                  disabled={!isConnected || isSubmitting}
                  variant='ghost'
                  size='icon'
                  className='absolute right-3 top-3 h-9 w-9 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 rounded-xl transition-colors duration-200'
                >
                  <FiPaperclip className='w-4 h-4' />
                </Button>

                {/* Character count */}
                <div
                  className={cn(
                    'absolute bottom-3 right-14 text-xs tabular-nums pointer-events-none font-medium',
                    inputValue.length > 1800 && 'text-orange-500',
                    inputValue.length > 1950 && 'text-red-500',
                    inputValue.length <= 1800 &&
                      'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {inputValue.length}/2000
                </div>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={
                  !isConnected ||
                  isSubmitting ||
                  (!inputValue.trim() && selectedFiles.length === 0)
                }
                variant='default'
                size='default'
                className='px-6 py-4 bg-[#5599fe] hover:bg-[#4488ee] text-white border-0 h-[56px] w-[56px] rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 ease-out flex items-center justify-center'
              >
                <FiSend className='w-11 h-11' />
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type='file'
            multiple
            onChange={handleFileSelect}
            className='hidden'
            accept='*/*'
          />
        </div>
      </div>
      
      {/* Clear Chat Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <Typography variant="h6" className="font-semibold text-gray-900 dark:text-white mb-2">
                  Clear Chat History?
                </Typography>
                <Typography variant="body2" color="muted" className="mb-6">
                  Are you sure you want to clear the chat? This action cannot be reversed and all messages will be permanently deleted.
                </Typography>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setShowClearDialog(false)}
                    className="px-4 py-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      clearMessages();
                      setShowClearDialog(false);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Clear Chat
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
