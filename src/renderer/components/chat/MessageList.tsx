import React, { useEffect, useRef } from 'react';
import Typography from '../ui/Typography';
import MessageBubble from './MessageBubble';
import { Spinner } from '../ui/Spinner';
import type { Message } from '../../stores/agentStore';
import { FiMessageSquare } from 'react-icons/fi';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

/**
 * Display chat messages with proper styling and auto-scroll
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const EmptyState = () => (
    <div className='flex flex-col items-center justify-center h-full space-y-4 px-8'>
      <div className='w-16 h-16 bg-gradient-to-r from-brand-teal to-brand-green rounded-full flex items-center justify-center'>
        <FiMessageSquare className='w-8 h-8 text-white' />
      </div>
      <div className='text-center space-y-2'>
        <Typography variant='h5' className='font-semibold'>
          Welcome to Conversational Agent
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

  const LoadingIndicator = () => (
    <div className='flex justify-start'>
      <div className='flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm'>
        <Spinner size='sm' />
        <Typography variant='body1' color='secondary'>
          Agent is thinking...
        </Typography>
      </div>
    </div>
  );

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className='flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900'>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && <LoadingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
