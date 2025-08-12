import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Typography from '../ui/Typography';
import type { Message } from '../../stores/agentStore';
import {
  FiUser,
  FiCpu,
  FiHash,
  FiClock,
  FiCopy,
  FiCheck,
  FiMaximize2,
  FiX,
  FiFile,
  FiImage,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import Logo from '../ui/Logo';
import { TransactionApprovalButton } from './TransactionApprovalButton';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { CodeBlock } from '../ui/CodeBlock';

const getProfileImageUrl = (profileImage: string, network?: string): string => {
  if (profileImage.startsWith('hcs://')) {
    const baseUrl = profileImage.replace(
      'hcs://1/',
      'https://kiloscribe.com/api/inscription-cdn/'
    );
    return `${baseUrl}?network=${network || 'testnet'}`;
  }
  if (profileImage.startsWith('ipfs://')) {
    return profileImage.replace(
      'ipfs://',
      'https://gateway.pinata.cloud/ipfs/'
    );
  }
  return profileImage;
};

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

interface MessageBubbleProps {
  message: Message;
  userProfile?: UserProfile | null;
}

function parseScheduleMessage(content: string, isUser: boolean): string {
  if (
    isUser ||
    !content.trim().startsWith('{') ||
    !content.includes('scheduleId')
  ) {
    return content;
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed.success && parsed.scheduleId) {
      return `Transaction scheduled successfully! Schedule ID: ${parsed.scheduleId}`;
    }
  } catch (e) {}

  return content;
}

function cleanMessageContent(content: string): string {
  const cleanedContent = content.replace(
    /\n\n<!-- HIDDEN_FILE_CONTENT -->[\s\S]*?<!-- END_HIDDEN_FILE_CONTENT -->/g,
    ''
  );

  return cleanedContent.replace(
    /\n<!-- FILE_START:.*? -->[\s\S]*?<!-- FILE_END:.*? -->/g,
    ''
  );
}

function renderAttachments(
  attachments: Array<{
    name: string;
    data: string;
    type: string;
    size: number;
  }>,
  onImageClick?: (imageData: string, imageName: string) => void
) {
  return (
    <div className='mt-3 space-y-2'>
      {attachments.map((attachment, index) => {
        const sizeStr =
          attachment.size > 1024 * 1024
            ? `${(attachment.size / (1024 * 1024)).toFixed(1)}MB`
            : `${(attachment.size / 1024).toFixed(1)}KB`;

        const isImage = attachment.type.startsWith('image/');

        return (
          <div
            key={index}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/30',
              isImage &&
                onImageClick &&
                'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50'
            )}
            onClick={
              isImage && onImageClick
                ? () =>
                    onImageClick(
                      `data:${attachment.type};base64,${attachment.data}`,
                      attachment.name
                    )
                : undefined
            }
          >
            <div className='flex-shrink-0'>
              {isImage ? (
                <FiImage className='w-4 h-4 text-blue-500' />
              ) : (
                <FiFile className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <Typography
                variant='caption'
                className='font-medium text-blue-600 dark:text-blue-400 truncate block'
              >
                {attachment.name}
              </Typography>
              <Typography
                variant='caption'
                className='text-gray-500 dark:text-gray-400 text-xs'
              >
                {sizeStr} • {attachment.type}
              </Typography>
            </div>
            {isImage && (
              <div className='flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700'>
                <img
                  src={`data:${attachment.type};base64,${attachment.data}`}
                  alt={attachment.name}
                  className='w-full h-full object-cover'
                  loading='lazy'
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  userProfile,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageModal, setImageModal] = useState<{
    imageData: string;
    imageName: string;
  } | null>(null);

  const config = useConfigStore((state) => state.config);
  const operationalMode = config?.advanced?.operationalMode || 'autonomous';

  const { approveTransaction, rejectTransaction } = useAgentStore();

  const contentParts = useMemo(() => {
    let cleanedContent = cleanMessageContent(message.content);

    if (
      !isUser &&
      message.metadata?.transactionBytes &&
      operationalMode === 'provideBytes'
    ) {
      cleanedContent = cleanedContent
        .replace(/```[a-z]*\n[A-Za-z0-9+/=]+\n```/g, '')
        .replace(
          /\n\nPlease sign and submit this transaction to complete the transfer\./g,
          ''
        )
        .replace(/\n\nPlease sign the transaction with your account\./g, '')
        .trim();
    }

    const parsedContent = parseScheduleMessage(cleanedContent, isUser);

    const codePattern = /```([a-z]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    const results = [];
    let match;

    while ((match = codePattern.exec(parsedContent)) !== null) {
      if (match.index > lastIndex) {
        results.push({
          type: 'text',
          content: parsedContent.slice(lastIndex, match.index),
        });
      }

      results.push({
        type: 'code',
        language: match[1] || 'typescript',
        content: match[2].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < parsedContent.length) {
      results.push({
        type: 'text',
        content: parsedContent.slice(lastIndex),
      });
    }

    return results;
  }, [message.content, isUser]);

  const processMarkdown = (text: string) => {
    let processed = text;

    // Process math equations first (before other markdown)
    // LaTeX display math blocks \[...\]
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      const cleanMath = math
        .trim()
        .replace(/\\text\{([^}]+)\}/g, '$1') // Convert \text{} to plain text
        .replace(/\\,/g, ' ') // Replace \, with space
        .replace(/\\/g, ''); // Remove remaining backslashes
      return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-white">${cleanMath}</code></div>`;
    });

    // LaTeX inline math \(...\)
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      const cleanMath = math
        .trim()
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\,/g, ' ')
        .replace(/\\/g, '');
      return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-white">${cleanMath}</code>`;
    });

    // Display math ($$...$$)
    processed = processed.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
      return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-white">${math.trim()}</code></div>`;
    });

    // Inline math ($...$)
    processed = processed.replace(/\$([^$]+)\$/g, (_, math) => {
      return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-white">${math}</code>`;
    });

    // Code blocks
    processed = processed.replace(/`([^`]+)`/g, (_, code) => {
      return `<code class="inline-code-style">${code}</code>`;
    });

    processed = processed.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-semibold">$1</strong>'
    );
    processed = processed.replace(
      /__([^_]+)__/g,
      '<strong class="font-semibold">$1</strong>'
    );

    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-white hover:text-blue-100 font-semibold">$1</a>'
    );

    processed = processed.replace(
      /^#### (.*$)/gm,
      '<h4 class="text-base font-bold mt-3 mb-2">$1</h4>'
    );
    processed = processed.replace(
      /^### (.*$)/gm,
      '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>'
    );
    processed = processed.replace(
      /^## (.*$)/gm,
      '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>'
    );
    processed = processed.replace(
      /^# (.*$)/gm,
      '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>'
    );

    processed = processed.replace(
      /^\s*[-*] (.+)$/gm,
      '<li class="ml-4">• $1</li>'
    );
    processed = processed.replace(/(<li.*<\/li>)/s, '<ul class="my-2">$1</ul>');

    processed = processed.replace(/\n/g, '<br />');

    return processed;
  };

  useEffect(() => {}, [
    message.metadata?.scheduleId,
    operationalMode,
    config?.advanced,
  ]);

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(timestamp);
  };

  const handleCopyMessage = async () => {
    try {
      // Get clean text content without markdown/HTML
      const cleanContent = cleanMessageContent(message.content);
      await navigator.clipboard.writeText(cleanContent);
      setIsCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  if (isSystem) {
    return (
      <div
        className='flex justify-center py-2'
        role='log'
        aria-label='System message'
      >
        <div className='bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full'>
          <Typography variant='caption' color='secondary'>
            {message.content}
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col'>
            {/* Modal Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800'>
              <div className='flex items-center gap-3'>
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isUser
                      ? 'bg-gray-300 dark:bg-gray-600'
                      : 'bg-white dark:bg-white border border-gray-200 dark:border-gray-300'
                  )}
                >
                  {isUser ? (
                    <FiUser className='w-4 h-4 text-gray-700 dark:text-white' />
                  ) : (
                    <Logo size='sm' variant='icon' className='w-5 h-5' />
                  )}
                </div>
                <Typography variant='h6' className='font-medium'>
                  {isUser ? 'You' : 'Assistant'}
                </Typography>
                <Typography variant='caption' color='muted'>
                  {formatTime(message.timestamp)}
                </Typography>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300'
                aria-label='Close fullscreen'
              >
                <FiX className='w-5 h-5' />
              </button>
            </div>

            {/* Modal Content */}
            <div className='flex-1 overflow-y-auto p-6'>
              <div className='prose prose-sm dark:prose-invert max-w-none'>
                {contentParts.map((part, index) => {
                  if (part.type === 'code') {
                    return (
                      <CodeBlock
                        key={`code-${index}`}
                        code={part.content}
                        language={part.language}
                        showLineNumbers
                        className='my-4'
                      />
                    );
                  }

                  return (
                    <div
                      key={`text-${index}`}
                      className='text-sm text-gray-900 dark:text-gray-100 select-text [&_.inline-code-style]:bg-gray-200 [&_.inline-code-style]:dark:bg-gray-700 [&_.inline-code-style]:px-1.5 [&_.inline-code-style]:py-0.5 [&_.inline-code-style]:rounded [&_.inline-code-style]:font-mono [&_.inline-code-style]:text-xs'
                      dangerouslySetInnerHTML={{
                        __html: processMarkdown(part.content),
                      }}
                    />
                  );
                })}

                {/* Show attachments in modal for user messages */}
                {isUser &&
                  message.metadata?.attachments &&
                  renderAttachments(
                    message.metadata.attachments,
                    (imageData, imageName) =>
                      setImageModal({ imageData, imageName })
                  )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className='flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-800'>
              <button
                onClick={handleCopyMessage}
                className='px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2'
              >
                {isCopied ? (
                  <>
                    <FiCheck className='w-4 h-4' />
                    Copied
                  </>
                ) : (
                  <>
                    <FiCopy className='w-4 h-4' />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
        role='log'
        aria-label={`${isUser ? 'User' : 'Assistant'} message at ${formatTime(
          message.timestamp
        )}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            'flex max-w-[min(85%,600px)] md:max-w-[min(75%,700px)] lg:max-w-[min(70%,800px)] space-x-2',
            isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
          )}
        >
          <div className='flex-shrink-0'>
            {isUser && userProfile?.profileImage ? (
              <img
                src={getProfileImageUrl(
                  userProfile.profileImage,
                  config?.hedera?.network
                )}
                alt={userProfile.display_name || userProfile.alias || 'User'}
                className='w-8 h-8 rounded-full object-cover border-2 border-blue-500/20'
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.parentElement
                    ?.querySelector('.avatar-fallback')
                    ?.classList.remove('hidden');
                  target.style.display = 'none';
                }}
              />
            ) : null}
            <div
              className={cn(
                'avatar-fallback flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                isUser
                  ? 'bg-gray-300 dark:bg-gray-600'
                  : 'bg-white dark:bg-white border border-gray-200 dark:border-gray-300',
                isUser && userProfile?.profileImage ? 'hidden' : ''
              )}
              aria-hidden='true'
            >
              {isUser ? (
                userProfile?.display_name || userProfile?.alias ? (
                  <span className='text-gray-700 dark:text-white text-sm font-semibold'>
                    {(userProfile.display_name ||
                      userProfile.alias ||
                      'U')[0].toUpperCase()}
                  </span>
                ) : (
                  <FiUser className='w-4 h-4 text-gray-700 dark:text-white' />
                )
              ) : (
                <Logo size='sm' variant='icon' className='w-5 h-5' />
              )}
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col space-y-1 max-w-full',
              isUser ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'px-4 py-3 rounded-2xl shadow-xs select-text relative group break-words overflow-wrap-anywhere max-w-full',
                isUser
                  ? 'bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white rounded-tr-md'
                  : 'bg-gradient-to-br from-blue-500 to-blue-500/90 dark:from-[#a679f0] dark:to-[#9568df] text-white rounded-tl-md shadow-blue-500/10'
              )}
              style={
                !isUser
                  ? {
                      WebkitUserSelect: 'text',
                      userSelect: 'text',
                    }
                  : undefined
              }
            >
              {/* Action buttons */}
              <div
                className={cn(
                  'absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200'
                )}
              >
                {/* Expand button - only show for longer messages */}
                {contentParts.some((part) => part.content.length > 500) && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className={cn(
                      'p-1.5 rounded-md transition-all duration-200',
                      isUser
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                    )}
                    title='Expand message'
                  >
                    <FiMaximize2 className='w-3.5 h-3.5' />
                  </button>
                )}

                {/* Copy button */}
                <button
                  onClick={handleCopyMessage}
                  className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    isUser
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  )}
                  title={isCopied ? 'Copied!' : 'Copy message'}
                >
                  {isCopied ? (
                    <FiCheck className='w-3.5 h-3.5' />
                  ) : (
                    <FiCopy className='w-3.5 h-3.5' />
                  )}
                </button>
              </div>

              <div className={contentParts.length > 1 ? 'space-y-2' : ''}>
                {contentParts.map((part, index) => {
                  if (part.type === 'code') {
                    return (
                      <CodeBlock
                        key={`code-${index}`}
                        code={part.content}
                        language={part.language}
                        showLineNumbers
                        className='my-2'
                      />
                    );
                  }

                  if (isUser) {
                    return (
                      <span
                        key={`text-${index}`}
                        className='whitespace-pre-wrap break-words text-gray-900 dark:text-white select-text cursor-text text-sm'
                      >
                        {part.content}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={`text-${index}`}
                      className='prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 select-text cursor-text text-sm break-words overflow-wrap-anywhere [&_.inline-code-style]:bg-gray-200 [&_.inline-code-style]:dark:bg-gray-700 [&_.inline-code-style]:px-1.5 [&_.inline-code-style]:py-0.5 [&_.inline-code-style]:rounded [&_.inline-code-style]:font-mono [&_.inline-code-style]:text-xs'
                      dangerouslySetInnerHTML={{
                        __html: processMarkdown(part.content),
                      }}
                    />
                  );
                })}
              </div>

              {/* Show attachments for user messages */}
              {isUser &&
                message.metadata?.attachments &&
                renderAttachments(
                  message.metadata.attachments,
                  (imageData, imageName) =>
                    setImageModal({ imageData, imageName })
                )}
            </div>

            <div
              className={cn(
                'flex items-center space-x-2 px-2 transition-opacity duration-200',
                isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row',
                isHovered ? 'opacity-100' : 'opacity-0'
              )}
            >
              <div className='flex items-center space-x-1'>
                <FiClock className='w-3 h-3 text-gray-400' aria-hidden='true' />
                <Typography variant='caption' color='secondary'>
                  <time dateTime={message.timestamp.toISOString()}>
                    {formatTime(message.timestamp)}
                  </time>
                </Typography>
              </div>

              {message.metadata?.transactionId && (
                <div className='flex items-center space-x-1'>
                  <FiHash
                    className='w-3 h-3 text-teal-500'
                    aria-hidden='true'
                  />
                  <Typography
                    variant='caption'
                    color='secondary'
                    className='font-mono'
                  >
                    <span
                      title={`Transaction ID: ${message.metadata.transactionId}`}
                    >
                      {message.metadata.transactionId.slice(0, 8)}...
                    </span>
                  </Typography>
                </div>
              )}

              {operationalMode === 'autonomous' &&
                message.metadata?.scheduleId && (
                  <div className='flex items-center space-x-1'>
                    <FiClock
                      className='w-3 h-3 text-purple-500'
                      aria-hidden='true'
                    />
                    <Typography
                      variant='caption'
                      color='secondary'
                      className='font-mono'
                    >
                      <span
                        title={`Schedule ID: ${message.metadata.scheduleId}`}
                      >
                        {message.metadata.scheduleId.slice(0, 8)}...
                      </span>
                    </Typography>
                  </div>
                )}
            </div>

            {message.metadata?.notes && message.metadata.notes.length > 0 && (
              <div
                className={cn(
                  'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2',
                  isUser ? 'ml-2 sm:ml-8' : 'mr-2 sm:mr-8'
                )}
                role='region'
                aria-label='Transaction details'
              >
                <Typography
                  variant='caption'
                  color='secondary'
                  className='font-medium'
                >
                  Transaction Details:
                </Typography>
                <ul className='mt-1' role='list'>
                  {message.metadata.notes.map((note: string, index: number) => (
                    <li key={index}>
                      <Typography
                        variant='caption'
                        color='secondary'
                        className='block'
                      >
                        • {note}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {operationalMode === 'provideBytes' &&
              (message.metadata?.scheduleId ||
                message.metadata?.transactionBytes) &&
              !isUser && (
                <>
                  <TransactionApprovalButton
                    scheduleId={message.metadata.scheduleId}
                    transactionBytes={message.metadata.transactionBytes}
                    description={message.metadata.description || ''}
                    className='mt-3'
                  />
                </>
              )}

            {(() => {
              return (
                operationalMode === 'autonomous' &&
                message.metadata?.transactionBytes &&
                !isUser && (
                  <TransactionApprovalButton
                    messageId={message.id}
                    transactionBytes={message.metadata.transactionBytes}
                    description={
                      message.metadata.description ||
                      (message.metadata?.pendingApproval
                        ? 'Transaction requires approval'
                        : 'Transaction Details')
                    }
                    onApprove={
                      message.metadata?.pendingApproval
                        ? approveTransaction
                        : undefined
                    }
                    onReject={
                      message.metadata?.pendingApproval
                        ? rejectTransaction
                        : undefined
                    }
                    className='mt-3'
                  />
                )
              );
            })()}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {imageModal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'
          onClick={() => setImageModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className='relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800'>
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0'>
                  <FiImage className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                </div>
                <Typography
                  variant='h6'
                  className='font-medium text-gray-900 dark:text-white truncate'
                >
                  {imageModal.imageName}
                </Typography>
              </div>
              <button
                onClick={() => setImageModal(null)}
                className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300'
                aria-label='Close image'
              >
                <FiX className='w-5 h-5' />
              </button>
            </div>

            {/* Modal Content */}
            <div className='flex-1 overflow-hidden p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50'>
              <img
                src={imageModal.imageData}
                alt={imageModal.imageName}
                className='max-w-full max-h-full object-contain rounded-lg shadow-lg'
                onClick={() => setImageModal(null)}
              />
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default MessageBubble;
