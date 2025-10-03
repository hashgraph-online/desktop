import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Typography from '../ui/Typography';
import type { Message } from '../../stores/agentStore';
import {
  FiHash,
  FiClock,
  FiCopy,
  FiCheck,
  FiMaximize2,
  FiX,
  FiImage,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import Logo from '../ui/Logo';
import UserProfileImage from '../ui/UserProfileImage';
import AttachmentDisplay from './AttachmentDisplay';
import { TransactionApprovalButton } from './TransactionApproval';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { CodeBlock } from '../ui/CodeBlock';
import { FormMessageBubble } from './FormMessageBubble';
import HashLinkBlockRenderer from './HashLinkBlockRenderer';
import type { UserProfile } from '../../types/userProfile';
import { processMarkdown as renderMarkdown } from '../../utils/markdownProcessor';

interface MessageBubbleProps {
  message: Message;
  userProfile?: UserProfile | null;
  isHCS10?: boolean;
  agentName?: string;
  onAgentProfileClick?: (
    accountId: string,
    agentName: string,
    network: string
  ) => void;
}

interface UserIdentificationProps {
  isHCS10: boolean;
  message: Message;
  myAccountId?: string;
}

/**
 * Component to determine if a message is from the current user in HCS10 context
 * @param isHCS10 - Whether this is an HCS10 message
 * @param message - The message object containing metadata
 * @param myAccountId - The current user's account ID
 * @returns boolean indicating if the message is from the current user
 */
function UserIdentificationComponent({
  isHCS10,
  message,
  myAccountId,
}: UserIdentificationProps): boolean {
  if (!isHCS10) {
    return message.role === 'user';
  }

  const operatorId = message.metadata?.operatorId;

  const normalizeAccountId = (accountId: string) => {
    if (!accountId) return '';
    if (accountId.includes('@')) {
      const parts = accountId.split('@');
      return parts[parts.length - 1];
    }
    return accountId.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1');
  };

  const normalizedMyAccountId = normalizeAccountId(myAccountId || '');
  const normalizedOperatorId = normalizeAccountId(String(operatorId || ''));

  if (normalizedMyAccountId && normalizedOperatorId) {
    return normalizedMyAccountId === normalizedOperatorId;
  }
  return false;
}

interface TransactionButtonRendererProps {
  isHCS10: boolean;
  message: Message;
  isUser: boolean;
  config: {
    hedera?: {
      network?: string;
    };
  } | null;
}

/**
 * Component to render transaction-related buttons and status for HCS10 messages
 * @param isHCS10 - Whether this is an HCS10 message
 * @param message - The message object containing transaction metadata
 * @param isUser - Whether the message is from the current user
 * @param config - Configuration object containing network settings
 * @returns JSX element or null if no transaction button needed
 */
function TransactionButtonRenderer({
  isHCS10,
  message,
  isUser,
  config,
}: TransactionButtonRendererProps): React.JSX.Element | null {
  const shouldShowTransactionButton =
    isHCS10 &&
    message.metadata?.op === 'transaction' &&
    message.metadata?.scheduleId &&
    !isUser;

  const isMalformedTransaction =
    isHCS10 &&
    message.metadata?.op === 'transaction' &&
    !message.metadata?.scheduleId &&
    !isUser;

  const metadata = message.metadata ?? {};
  const messageMetadata = metadata;
  const scheduleId =
    typeof metadata.scheduleId === 'string'
      ? metadata.scheduleId
      : metadata.scheduleId !== undefined
        ? String(metadata.scheduleId)
        : '';
  const transactionDescription = (() => {
    if (typeof metadata.data === 'string' && metadata.data.trim().length > 0) {
      return metadata.data;
    }
    return message.content || 'Transaction requires approval';
  })();

  if (shouldShowTransactionButton) {
    try {
      return (
        <div className='mt-3'>
          <TransactionApprovalButton
            scheduleId={scheduleId}
            description={transactionDescription}
            network={config?.hedera?.network}
            className='!mt-0'
          />
        </div>
      );
    } catch (error) {
      return (
        <div className='mt-3 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800'>
          <div className='text-red-800 dark:text-red-200 text-sm'>
            ⚠️ Transaction Approval Button Error:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div className='text-xs text-red-600 dark:text-red-400 mt-1'>
            Schedule ID: {scheduleId}
          </div>
        </div>
      );
    }
  }

  if (isMalformedTransaction) {
    return (
      <div className='mt-3 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800'>
        <div className='flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm'>
          <Typography variant='caption'>⚠️</Typography>
          <Typography variant='caption' className='font-semibold'>
            Malformed Transaction Operation
          </Typography>
        </div>
        <Typography
          variant='caption'
          className='text-amber-600 dark:text-amber-400 mt-1'
        >
          This transaction operation is missing a required scheduleId field.
        </Typography>
        <Typography
          variant='caption'
          className='text-amber-600 dark:text-amber-400 mt-1'
        >
          Content: {transactionDescription}
        </Typography>
      </div>
    );
  }

  return null;
}

/**
 * Enhanced content extraction for both personal and HCS-10 messages
 */
function extractHCS10MessageContent(message: Message): string {
  const isNonEmpty = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0 && v !== '[Empty message]';

  if (isNonEmpty(message.content)) {
    return message.content;
  }

  if (message.metadata?.isHCS10Message) {
    const meta = (message.metadata || {}) as Record<string, unknown>;

    const tryParseJsonString = (s: string): string | null => {
      const str = s.trim();
      if (!str.startsWith('{')) return isNonEmpty(str) ? str : null;
      try {
        const obj = JSON.parse(str) as unknown;
        if (typeof obj === 'object' && obj !== null) {
          const rec = obj as Record<string, unknown>;
          const candidates: Array<unknown> = [
            rec.text,
            rec.content,
            rec.message,
            rec.body && typeof rec.body === 'object'
              ? (rec.body as Record<string, unknown>).text
              : undefined,
            rec.body && typeof rec.body === 'object'
              ? (rec.body as Record<string, unknown>).content
              : undefined,
            rec.payload && typeof rec.payload === 'object'
              ? (rec.payload as Record<string, unknown>).text
              : undefined,
            rec.payload && typeof rec.payload === 'object'
              ? (rec.payload as Record<string, unknown>).content
              : undefined,
            typeof rec.data === 'string' ? rec.data : undefined,
          ];
          const found = candidates.find(isNonEmpty);
          if (found) return found as string;
        }
        return str;
      } catch {
        return isNonEmpty(s) ? s : null;
      }
    };

    const primaryRaw = meta.data;
    if (isNonEmpty(primaryRaw)) {
      const parsed = tryParseJsonString(primaryRaw);
      if (parsed) return parsed;
    }
    if (typeof primaryRaw === 'object' && primaryRaw !== null) {
      const rec = primaryRaw as Record<string, unknown>;
      const nestedCandidates: Array<unknown> = [
        rec.text,
        rec.content,
        rec.message,
        rec.body && typeof rec.body === 'object'
          ? (rec.body as Record<string, unknown>).text
          : undefined,
        rec.body && typeof rec.body === 'object'
          ? (rec.body as Record<string, unknown>).content
          : undefined,
        rec.payload && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>).text
          : undefined,
        rec.payload && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>).content
          : undefined,
        typeof rec.data === 'string' ? rec.data : undefined,
      ];
      const found = nestedCandidates.find(isNonEmpty);
      if (found) return found as string;
      const asString = JSON.stringify(primaryRaw);
      if (isNonEmpty(asString)) return asString;
    }

    const fallbackMetaKeys: Array<keyof typeof meta> = [
      'content',
      'message',
      'text',
    ];
    for (const key of fallbackMetaKeys) {
      const v = meta[key];
      if (isNonEmpty(v)) return v as string;
    }
  }

  return '[Empty message]';
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
  } catch {}

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

function MessageBubbleImpl({
  message,
  userProfile,
  isHCS10 = false,
  agentName,
  onAgentProfileClick,
}: MessageBubbleProps) {
  const config = useConfigStore((state) => state.config);

  const isUser = UserIdentificationComponent({
    isHCS10,
    message,
    myAccountId: config?.hedera?.accountId,
  });

  const isSystem = message.role === 'system';

  const getDisplayName = () => {
    if (!isHCS10) {
      return isUser ? 'You' : 'Assistant';
    }

    if (isUser) {
      return userProfile?.display_name || userProfile?.alias || 'You';
    } else {
      const operatorId = message.metadata?.operatorId as string;
      if (operatorId) {
        if (agentName) {
          return agentName;
        } else {
          const accountId = operatorId.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1');
          return accountId || 'Unknown';
        }
      }
      return agentName || 'Agent';
    }
  };

  const displayName = getDisplayName();
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageModal, setImageModal] = useState<{
    imageData: string;
    imageName: string;
  } | null>(null);
  const operationalMode = config?.advanced?.operationalMode || 'autonomous';
  const messageMetadata = message.metadata ?? {};

  const approveTransaction = useAgentStore((s) => s.approveTransaction);
  const rejectTransaction = useAgentStore((s) => s.rejectTransaction);

  const contentParts = useMemo(() => {
    const rawContent = extractHCS10MessageContent(message);
    let cleanedContent = cleanMessageContent(rawContent);

    if (
      !isUser &&
      message.metadata?.transactionBytes &&
      operationalMode === 'provideBytes'
    ) {
      const transactionType =
        message.metadata?.parsedTransaction?.humanReadableType ||
        message.metadata?.parsedTransaction?.type ||
        'transaction';
      const typeText = transactionType
        .toLowerCase()
        .replace(' transaction', '');
      cleanedContent = `Your ${typeText} transaction is ready for approval!`;
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
  }, [message, isUser, operationalMode]);

  const stableKey = (...args: string[]) => {
    let h = 5381;
    for (const s of args) {
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) ^ s.charCodeAt(i);
      }
    }
    return 'k' + (h >>> 0).toString(16);
  };

  const renderedParts = useMemo(
    () =>
      contentParts.map((part) =>
        part.type === 'code'
          ? {
              type: 'code' as const,
              key: stableKey('code', part.language || '', part.content),
              language: part.language,
              content: part.content,
            }
          : {
              type: 'text' as const,
              key: stableKey('text', '', part.content),
              html: renderMarkdown(part.content),
            }
      ),
    [contentParts]
  );

  const processMarkdown = (text: string) => {
    let processed = text;

    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      const cleanMath = math
        .trim()
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\,/g, ' ')
        .replace(/\\/g, '');
      return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-white">${cleanMath}</code></div>`;
    });

    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      const cleanMath = math
        .trim()
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\,/g, ' ')
        .replace(/\\/g, '');
      return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-white">${cleanMath}</code>`;
    });

    processed = processed.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
      return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-white">${math.trim()}</code></div>`;
    });

    processed = processed.replace(/\$([^$]+)\$/g, (_, math) => {
      return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-white">${math}</code>`;
    });

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
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-white hover:text-blue-200 dark:hover:text-blue-300 font-semibold">$1</a>'
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

  const handleAgentProfileClick = () => {
    if (
      isHCS10 &&
      !isUser &&
      message.metadata?.operatorId &&
      onAgentProfileClick
    ) {
      const operatorId = message.metadata.operatorId as string;
      const accountId = operatorId.replace(/^.*?(\d+\.\d+\.\d+).*$/, '$1');
      onAgentProfileClick(
        accountId,
        agentName || 'Agent',
        config?.hedera?.network || 'testnet'
      );
    }
  };

  const handleCopyMessage = async () => {
    try {
      const rawContent = extractHCS10MessageContent(message);
      let textToCopy = cleanMessageContent(rawContent);

      if (
        !isUser &&
        message.metadata?.transactionBytes &&
        operationalMode === 'provideBytes'
      ) {
        const transactionType =
          message.metadata?.parsedTransaction?.humanReadableType ||
          message.metadata?.parsedTransaction?.type ||
          'transaction';
        const typeText = transactionType
          .toLowerCase()
          .replace(' transaction', '');
        textToCopy = `Your ${typeText} transaction is ready for approval!`;
      }

      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch {}
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

  const bubbleStyle = useMemo(() => {
    const base: CSSProperties = {
      maxWidth: isUser ? '85%' : '90%',
      width: 'fit-content',
    };
    if (!isUser) {
      base.WebkitUserSelect = 'text';
      base.userSelect = 'text';
    }
    return base;
  }, [isUser]);

  return (
    <>
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div className='relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col'>
            {/* Modal Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800'>
              <div className='flex items-center gap-3'>
                {isUser ? (
                  <UserProfileImage
                    profileImage={userProfile?.profileImage}
                    displayName={
                      userProfile?.display_name || userProfile?.alias
                    }
                    network={config?.hedera?.network}
                    size='md'
                  />
                ) : (
                  <div className='w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-white border border-gray-200 dark:border-gray-300'>
                    <Logo size='sm' variant='icon' className='w-5 h-5' />
                  </div>
                )}
                <Typography variant='h6' className='font-medium'>
                  {displayName}
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
                {renderedParts.map((part, index) => {
                  if (part.type === 'code') {
                    return (
                      <CodeBlock
                        key={part.key}
                        code={part.content}
                        language={part.language}
                        showLineNumbers
                        className='my-4'
                      />
                    );
                  }

                  return (
                    <div
                      key={part.key}
                      className='text-sm text-gray-900 dark:text-gray-100 select-text [&_.inline-code-style]:bg-gray-200 [&_.inline-code-style]:dark:bg-gray-700 [&_.inline-code-style]:px-1.5 [&_.inline-code-style]:py-0.5 [&_.inline-code-style]:rounded [&_.inline-code-style]:font-mono [&_.inline-code-style]:text-xs [&_.inline-code-style]:text-brand-ink [&_.inline-code-style]:dark:text-white [&_.inline-code]:text-brand-ink [&_.inline-code]:dark:text-white [&_.inline-code]:bg-gray-100 [&_.inline-code]:dark:bg-gray-800 [&_.inline-code]:px-1.5 [&_.inline-code]:py-0.5 [&_.inline-code]:rounded'
                      dangerouslySetInnerHTML={{
                        __html: part.html,
                      }}
                    />
                  );
                })}

                {/* Show attachments in modal for user messages */}
                {isUser && Array.isArray(message.metadata?.attachments) && (
                  <AttachmentDisplay
                    attachments={
                      message.metadata.attachments as {
                        name: string;
                        data: string;
                        type: string;
                        size: number;
                      }[]
                    }
                    onImageClick={(imageData, imageName) =>
                      setImageModal({ imageData, imageName })
                    }
                  />
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
      >
        <div
          className={cn(
            'flex w-full items-start gap-2',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <div className='flex-shrink-0'>
            {isUser ? (
              <UserProfileImage
                profileImage={userProfile?.profileImage}
                displayName={userProfile?.display_name || userProfile?.alias}
                network={config?.hedera?.network}
                size='md'
              />
            ) : isHCS10 && agentName ? (
              <div
                onClick={handleAgentProfileClick}
                className='cursor-pointer hover:opacity-80 transition-opacity'
                title='View agent profile'
              >
                <UserProfileImage
                  isAgent={true}
                  agentName={agentName}
                  size='md'
                />
              </div>
            ) : (
              <div className='w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-white border border-gray-200 dark:border-gray-300 flex-shrink-0'>
                <Logo size='sm' variant='icon' className='w-5 h-5' />
              </div>
            )}
          </div>

          <div
            className={cn(
              'flex flex-col space-y-1 flex-1',
              isUser ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'px-4 py-3 rounded-2xl shadow-xs select-text relative group break-words overflow-wrap-anywhere',
                isUser
                  ? 'bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white rounded-tr-md'
                  : 'bg-gradient-to-br from-blue-500 to-blue-500/90 dark:from-[#a679f0] dark:to-[#9568df] text-white rounded-tl-md shadow-blue-500/10'
              )}
              style={bubbleStyle}
            >
              {/* Action buttons */}
              <div
                className={cn(
                  'absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200'
                )}
              >
                {/* Expand button - only show for longer messages */}
                {contentParts.some((part) => part.content.length > 500) ? (
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
                ) : null}

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

              <TransactionButtonRenderer
                isHCS10={isHCS10}
                message={message}
                isUser={isUser}
                config={config}
              />

              <div className={contentParts.length > 1 ? 'space-y-2' : ''}>
                {isUser
                  ? contentParts.map((part, index) => {
                      if (part.type === 'code') {
                        return (
                          <CodeBlock
                            key={stableKey(
                              'ucode',
                              part.language || '',
                              part.content
                            )}
                            code={part.content}
                            language={part.language}
                            showLineNumbers
                            className='my-2'
                          />
                        );
                      }
                      return (
                        <span
                          key={stableKey(
                            'utext',
                            '',
                            `${index}-${part.content.slice(0, 16)}`
                          )}
                          className='break-words text-gray-900 dark:text-white select-text cursor-text text-sm'
                        >
                          {part.content}
                        </span>
                      );
                    })
                  : renderedParts.map((part) => {
                      if (part.type === 'code') {
                        return (
                          <CodeBlock
                            key={part.key}
                            code={part.content}
                            language={part.language}
                            showLineNumbers
                            className='my-2'
                          />
                        );
                      }
                      return (
                        <div
                          key={part.key}
                          className='prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 select-text cursor-text text-sm break-words overflow-wrap-anywhere whitespace-pre-line [&_.inline-code-style]:bg-gray-200 [&_.inline-code-style]:dark:bg-gray-700 [&_.inline-code-style]:px-1.5 [&_.inline-code-style]:py-0.5 [&_.inline-code-style]:rounded [&_.inline-code-style]:font-mono [&_.inline-code-style]:text-xs [&_.inline-code-style]:text-brand-ink [&_.inline-code-style]:dark:text-white [&_.inline-code]:text-brand-ink [&_.inline-code]:dark:text-white [&_.inline-code]:bg-gray-100 [&_.inline-code]:dark:bg-gray-800 [&_.inline-code]:px-1.5 [&_.inline-code]:py-0.5 [&_.inline-code]:rounded'
                          dangerouslySetInnerHTML={{ __html: part.html }}
                        />
                      );
                    })}
              </div>

              {/* Show attachments for user messages */}
              {isUser && Array.isArray(message.metadata?.attachments) && (
                <AttachmentDisplay
                  attachments={
                    message.metadata.attachments as {
                      name: string;
                      data: string;
                      type: string;
                      size: number;
                    }[]
                  }
                  onImageClick={(imageData, imageName) =>
                    setImageModal({ imageData, imageName })
                  }
                />
              )}

              {/* Transaction approval inside bubble for assistant messages */}
              {(() => {
                if (operationalMode === 'provideBytes' && !isUser) {
                  const hasTx = Boolean(
                    messageMetadata.scheduleId || messageMetadata.transactionBytes
                  );
                  if (hasTx) {
                    return (
                      <div className='mt-3'>
                        <TransactionApprovalButton
                          scheduleId={String(messageMetadata.scheduleId || '')}
                          transactionBytes={String(
                            messageMetadata.transactionBytes || ''
                          )}
                          description={String(messageMetadata.description || '')}
                          className='!mt-0'
                          notes={
                            Array.isArray(messageMetadata.notes)
                              ? (messageMetadata.notes as string[])
                              : []
                          }
                          messageId={message.id}
                          initialApproved={Boolean(messageMetadata.approved)}
                          initialExecuted={Boolean(messageMetadata.approved)}
                          initialTransactionId={
                            messageMetadata.transactionId
                              ? String(messageMetadata.transactionId)
                              : undefined
                          }
                          onExecuted={async ({ messageId, transactionId }) => {
                            try {
                              const sessId =
                                useAgentStore.getState().currentSession?.id ||
                                undefined;
                              await useAgentStore
                                .getState()
                                .markTransactionExecuted(
                                  messageId,
                                  transactionId,
                                  sessId
                                );
                            } catch {}
                          }}
                        />
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Show notes when not in provideBytes mode or no transaction */}
              {(() => {
                if (
                  !isUser &&
                  Array.isArray(message.metadata?.notes) &&
                  message.metadata.notes.length > 0
                ) {
                  const hasTransactionInProvideBytes =
                    operationalMode === 'provideBytes' &&
                    (message.metadata?.scheduleId ||
                      message.metadata?.transactionBytes);

                  if (!hasTransactionInProvideBytes) {
                    return (
                      <div
                        className='bg-blue-900/50 dark:bg-purple-900/50 rounded-lg p-3 mt-3'
                        role='region'
                        aria-label='Transaction notes'
                      >
                        <Typography
                          variant='caption'
                          className='font-medium text-white/90'
                        >
                          Notes:
                        </Typography>
                        <ul className='mt-1' role='list'>
                          {(message.metadata.notes as string[]).map(
                            (note: string, index: number) => (
                              <li key={index}>
                                <Typography
                                  variant='caption'
                                  className='block text-white/80'
                                >
                                  • {note}
                                </Typography>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Render form message if present */}
              {!isUser && message.metadata?.formMessage ? (
                <div className='mt-3'>
                  <FormMessageBubble
                    formMessage={message.metadata.formMessage}
                    className='!mx-0 !max-w-none'
                  />
                </div>
              ) : null}

              {!isUser && message.metadata?.hashLinkBlock
                ? ((() => {
                    try {
                      const block = message.metadata?.hashLinkBlock as any;
                      console.debug(
                        '[MessageBubble] Rendering HashLinkBlock:',
                        {
                          blockId: block?.blockId,
                          hasTemplate: !!block?.template,
                          attrKeys: block?.attributes
                            ? Object.keys(block.attributes)
                            : [],
                        }
                      );
                    } catch {}
                    return null;
                  }) as () => null,
                  (
                    <HashLinkBlockRenderer
                      hashLinkBlock={
                        message.metadata.hashLinkBlock as {
                          blockId: string;
                          hashLink: string;
                          template: string;
                          attributes: Record<string, unknown>;
                        }
                      }
                      className='mx-0 max-w-none'
                    />
                  ))
                : null}
            </div>

            <div
              className={cn(
                'flex items-center space-x-2 px-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100',
                isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
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

              {message.metadata?.transactionId ? (
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
                      {String(message.metadata.transactionId || '').slice(0, 8)}
                      ...
                    </span>
                  </Typography>
                </div>
              ) : null}

              {operationalMode === 'autonomous' &&
              message.metadata?.scheduleId ? (
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
                    <span title={`Schedule ID: ${message.metadata.scheduleId}`}>
                      {String(message.metadata.scheduleId || '').slice(0, 8)}
                    </span>
                  </Typography>
                </div>
              ) : null}
            </div>

            {(() => {
              if (
                operationalMode === 'autonomous' &&
                message.metadata?.transactionBytes &&
                !isUser
              ) {
                return (
                  <TransactionApprovalButton
                    messageId={message.id}
                    transactionBytes={String(
                      message.metadata.transactionBytes || ''
                    )}
                    description={
                      String(message.metadata.description || '') ||
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
                );
              }
              return null;
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
                <div className='w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0'>
                  <FiImage className='w-4 h-4 text-blue-500 dark:text-blue-300' />
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
}

function areEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  const pm = prev.message;
  const nm = next.message;
  if (pm === nm) return true;
  if (pm.id !== nm.id) return false;
  if (pm.role !== nm.role) return false;
  const pTime = pm.timestamp?.valueOf?.() ?? 0;
  const nTime = nm.timestamp?.valueOf?.() ?? 0;
  if (pTime !== nTime) return false;
  if (pm.content !== nm.content) return false;

  const pmd = pm.metadata ?? {};
  const nmd = nm.metadata ?? {};
  const pmdRec = pmd as Record<string, unknown>;
  const nmdRec = nmd as Record<string, unknown>;
  const fields = [
    'op',
    'scheduleId',
    'transactionBytes',
    'description',
    'data',
    'message',
    'text',
    'operatorId',
  ] as const;
  for (const f of fields) {
    if (pmdRec[f as string] !== nmdRec[f as string]) return false;
  }

  const pNotesArr = Array.isArray(pmdRec.notes)
    ? (pmdRec.notes as unknown[])
    : [];
  const nNotesArr = Array.isArray(nmdRec.notes)
    ? (nmdRec.notes as unknown[])
    : [];
  if (pNotesArr.join('|') !== nNotesArr.join('|')) return false;

  const pAtt = Array.isArray(pmdRec.attachments)
    ? (pmdRec.attachments as unknown[])
    : [];
  const nAtt = Array.isArray(nmdRec.attachments)
    ? (nmdRec.attachments as unknown[])
    : [];
  if (pAtt.length !== nAtt.length) return false;
  for (let i = 0; i < pAtt.length; i++) {
    const pa = (pAtt[i] as Record<string, unknown>) || {};
    const na = (nAtt[i] as Record<string, unknown>) || {};
    if (pa.name !== na.name) return false;
    if (pa.size !== na.size) return false;
    if (pa.type !== na.type) return false;
  }

  if (prev.isHCS10 !== next.isHCS10) return false;
  if (prev.agentName !== next.agentName) return false;

  return true;
}

const MessageBubble = React.memo(MessageBubbleImpl, areEqual);

export default MessageBubble;
