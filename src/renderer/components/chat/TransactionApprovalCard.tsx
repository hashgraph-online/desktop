import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import {
  FiClock,
  FiLoader,
  FiCheckCircle,
  FiExternalLink,
  FiCopy,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  HederaMirrorNode,
  Logger,
  TransactionParser,
} from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../../stores/configStore';
import { TransactionDetails } from './TransactionDetails';
import type { ParsedTransaction } from '../../types/transaction';

interface TransactionApprovalCardProps {
  scheduleId: string;
  description?: string;
  className?: string;
}

interface ScheduleInfo {
  memo?: string;
  expirationTime?: string;
  executedTimestamp?: string;
  transactionBody?: string;
  parsedTransaction?: ParsedTransaction;
}

/**
 * Transaction approval card that fetches details from mirror node
 */
export const TransactionApprovalCard: React.FC<
  TransactionApprovalCardProps
> = ({ scheduleId, description, className }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);
  const [isExecuted, setIsExecuted] = useState(false);
  const [copied, setCopied] = useState(false);

  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const config = useConfigStore((state) => state.config);
  const network = config?.hedera?.network || 'testnet';

  useEffect(() => {
    const fetchScheduleInfo = async () => {
      try {
        setIsLoading(true);
        const mirrorNode = new HederaMirrorNode(
          network as 'mainnet' | 'testnet',
          new Logger({ module: 'TransactionApprovalCard' })
        );

        const info = await mirrorNode.getScheduleInfo(scheduleId);

        if (info) {
          let parsedTransaction: ParsedTransaction | undefined;

          if (info.transaction_body) {
            try {
              const parsedTx = TransactionParser.parseScheduleResponse({
                transaction_body: info.transaction_body,
                memo: info.memo,
              });

              parsedTransaction = {
                type: parsedTx.type,
                humanReadableType: parsedTx.humanReadableType,
                details: parsedTx,
                transfers: parsedTx.transfers,
                tokenTransfers: parsedTx.tokenTransfers,
                memo: parsedTx.memo,
                contractCall: parsedTx.contractCall,
                tokenCreation: parsedTx.tokenCreation,
                consensusSubmitMessage: parsedTx.consensusSubmitMessage,
              };
            } catch (e) {}
          } else {
          }

          if (info.executed_timestamp) {
            setIsExecuted(true);
          }

          setScheduleInfo({
            memo: info.memo,
            expirationTime: info.expiration_time,
            executedTimestamp: info.executed_timestamp,
            transactionBody: info.transaction_body,
            parsedTransaction,
          });
        }
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Failed to load transaction details',
          message: 'Could not fetch schedule information from mirror node',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (scheduleId) {
      fetchScheduleInfo();
      const interval = setInterval(fetchScheduleInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [scheduleId, network, addNotification]);

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const result = await window.electron.executeScheduledTransaction(
        scheduleId
      );

      if (result.success) {
        setIsApproved(true);
        addNotification({
          type: 'success',
          title: 'Transaction Approved',
          message: `Transaction ID: ${result.transactionId}`,
          duration: 7000,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Transaction Failed',
          message: result.error || 'Failed to execute transaction',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Transaction Error',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleCopyScheduleId = async () => {
    await navigator.clipboard.writeText(scheduleId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div
      className={cn(
        'bg-gradient-to-br from-purple-50/90 to-purple-100/70 dark:from-purple-900/30 dark:to-purple-800/40',
        'border border-purple-200/60 dark:border-purple-700/50 rounded-xl p-4 mt-3',
        'backdrop-blur-sm shadow-sm',
        className
      )}
    >
      <div className='flex flex-col space-y-4'>
        <div className='flex items-start'>
          <div
            className={cn(
              'p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0',
              isExecuted || isApproved
                ? 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-700/40 dark:to-green-800/60'
                : 'bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-700/40 dark:to-purple-800/60'
            )}
          >
            {isExecuted || isApproved ? (
              <FiCheckCircle className='text-green-600 dark:text-green-400 h-5 w-5' />
            ) : (
              <FiClock className='text-purple-600 dark:text-purple-400 h-5 w-5' />
            )}
          </div>

          <div className='ml-4 flex-1'>
            <Typography
              variant='h6'
              className='font-semibold text-purple-800 dark:text-purple-200'
            >
              {isExecuted
                ? 'Transaction Executed'
                : isApproved
                ? 'Transaction Approved'
                : 'Transaction Requires Approval'}
            </Typography>
            <Typography variant='body2' color='secondary' className='mt-1'>
              {isExecuted && scheduleInfo?.executedTimestamp
                ? `Executed on ${formatTime(scheduleInfo.executedTimestamp)}`
                : description || 'Scheduled transaction awaiting approval'}
            </Typography>
          </div>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <FiLoader className='animate-spin h-6 w-6 text-purple-500' />
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='bg-white/50 dark:bg-gray-900/30 rounded-lg p-3'>
              <Typography
                variant='caption'
                color='secondary'
                className='block mb-1'
              >
                Schedule ID
              </Typography>
              <div className='flex items-center gap-2'>
                <code className='text-sm font-mono flex-1'>{scheduleId}</code>
                <button
                  onClick={handleCopyScheduleId}
                  className='p-1 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors'
                  title='Copy Schedule ID'
                >
                  {copied ? (
                    <FiCheckCircle className='w-4 h-4 text-green-500' />
                  ) : (
                    <FiCopy className='w-4 h-4 text-gray-500' />
                  )}
                </button>
                <a
                  href={`https://hashscan.io/${network}/schedule/${scheduleId}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='p-1 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors'
                  title='View on HashScan'
                >
                  <FiExternalLink className='w-4 h-4 text-brand-blue' />
                </a>
              </div>
            </div>

            {scheduleInfo?.memo && (
              <div className='bg-white/50 dark:bg-gray-900/30 rounded-lg p-3'>
                <Typography
                  variant='caption'
                  color='secondary'
                  className='block mb-1'
                >
                  Memo
                </Typography>
                <Typography variant='body2'>{scheduleInfo.memo}</Typography>
              </div>
            )}

            {scheduleInfo?.expirationTime && !isExecuted && (
              <div className='bg-white/50 dark:bg-gray-900/30 rounded-lg p-3'>
                <Typography
                  variant='caption'
                  color='secondary'
                  className='block mb-1'
                >
                  Expires
                </Typography>
                <Typography variant='body2'>
                  {formatTime(scheduleInfo.expirationTime)}
                </Typography>
              </div>
            )}

            {scheduleInfo?.parsedTransaction ? (
              <TransactionDetails
                type={scheduleInfo.parsedTransaction.type}
                humanReadableType={
                  scheduleInfo.parsedTransaction.humanReadableType || ''
                }
                transfers={
                  scheduleInfo.parsedTransaction.transfers?.map((t) => ({
                    accountId: t.accountId,
                    amount: parseFloat(String(t.amount)),
                  })) || []
                }
                tokenTransfers={
                  scheduleInfo.parsedTransaction.tokenTransfers || []
                }
                tokenCreation={scheduleInfo.parsedTransaction.tokenCreation}
                memo={scheduleInfo.parsedTransaction.memo}
                expirationTime={scheduleInfo.expirationTime}
                scheduleId={scheduleId}
                network={network}
                variant='embedded'
                hideHeader={
                  !!description &&
                  (description.includes(
                    scheduleInfo.parsedTransaction.humanReadableType || ''
                  ) ||
                    description.includes('Transfer'))
                }
              />
            ) : (
              scheduleInfo?.transactionBody && (
                <div className='bg-white/50 dark:bg-gray-900/30 rounded-lg p-3'>
                  <Typography
                    variant='caption'
                    color='secondary'
                    className='block mb-2'
                  >
                    Transaction Details
                  </Typography>
                  <Typography
                    variant='body2'
                    className='text-xs text-gray-600 dark:text-gray-400'
                  >
                    Unable to parse transaction details. Raw transaction body
                    available.
                  </Typography>
                </div>
              )
            )}
          </div>
        )}

        {!isExecuted && !isApproved && !isLoading && (
          <div className='flex gap-2 pt-2'>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className='flex-1'
              variant='default'
            >
              {isApproving ? (
                <div className='flex items-center gap-2'>
                  <FiLoader className='animate-spin h-4 w-4' />
                  <span>Approving...</span>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <FiCheckCircle className='h-4 w-4' />
                  <span>Approve Transaction</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
