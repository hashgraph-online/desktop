import React, { ReactNode, useEffect, useRef } from 'react';
import Typography from '../ui/Typography';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '../ui/scroll-area';
import { motion } from 'framer-motion';
import type { Message } from '../../stores/agentStore';
import type { UserProfile } from '../../types/userProfile';
import { FiMessageSquare } from 'react-icons/fi';
import { cn } from '../../lib/utils';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  userProfile?: UserProfile | null;
  isHCS10?: boolean;
  agentName?: string;
  onAgentProfileClick?: (
    accountId: string,
    agentName: string,
    network: string
  ) => void;
  emptyState?: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Renders the default empty state for chat conversations in the desktop shell.
 */
const DefaultEmptyState: React.FC = () => (
  <div className='flex flex-col items-center justify-center h-full space-y-4 px-8'>
    <div className='w-16 h-16 bg-gradient-to-r from-brand-teal to-brand-green rounded-full flex items-center justify-center'>
      <FiMessageSquare className='w-8 h-8 text-white' />
    </div>
    <div className='text-center space-y-2'>
      <Typography variant='h5' className='font-semibold'>
        Welcome to HOL Desktop
      </Typography>
      <Typography variant='body1' color='secondary' className='max-w-md'>
        I can help you with Hedera Hashgraph operations, account management,
        token transfers, smart contracts, and more. Start by asking me a
        question or requesting help with a task.
      </Typography>
    </div>
    <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-w-md'>
      <div className='mb-2'>
        <Typography
          variant='caption'
          color='secondary'
          className='font-medium block'
        >
          Try asking me:
        </Typography>
      </div>
      <ul className='space-y-1'>
        <li>
          <Typography variant='caption' color='secondary'>
            • "What's my account balance?"
          </Typography>
        </li>
        <li>
          <Typography variant='caption' color='secondary'>
            • "Transfer 5 HBAR to 0.0.123456"
          </Typography>
        </li>
        <li>
          <Typography variant='caption' color='secondary'>
            • "Help me create a new account"
          </Typography>
        </li>
        <li>
          <Typography variant='caption' color='secondary'>
            • "Send a message to HCS topic"
          </Typography>
        </li>
      </ul>
    </div>
  </div>
);

/**
 * Display chat messages with proper styling and auto-scroll
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
  userProfile,
  isHCS10,
  agentName,
  onAgentProfileClick,
  emptyState,
  className,
  contentClassName,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  return (
    <ScrollArea className={cn('flex-1 bg-gray-50 dark:bg-gray-900', className)}>
      <div className={cn('p-6 space-y-4', contentClassName)}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userProfile={userProfile}
            isHCS10={isHCS10}
            agentName={agentName}
            onAgentProfileClick={onAgentProfileClick}
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
    </ScrollArea>
  );
};

export default MessageList;
