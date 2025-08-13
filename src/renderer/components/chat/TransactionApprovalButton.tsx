import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import {
  FiClock,
  FiLoader,
  FiCheckCircle,
  FiAlertTriangle,
  FiX,
  FiCheck,
  FiInfo,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  TransactionParser,
  HederaMirrorNode,
} from '@hashgraphonline/standards-sdk';
import { Hbar } from '@hashgraph/sdk';
import { type ParsedTransaction } from '../../types/transaction';
import { type TokenAmount } from '@hashgraphonline/standards-sdk';
import { type Transaction as HederaTransaction } from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../../stores/configStore';
import { TransactionDetails } from './TransactionDetails';
import { getTransactionEnrichmentHandler } from '../../utils/transactionEnrichmentRegistry';
import { getHumanReadableTransactionType } from '../../utils/transactionTypeHelper';
import { mergeTransactionDetails } from '../../utils/transactionMerger';

const getValidAmount = (amount: string | number | unknown): number => {
  if (typeof amount === 'string') {
    return parseFloat(amount.replace(/[^\d.-]/g, ''));
  }
  if (typeof amount === 'number') {
    return amount;
  }
  return 0;
};

interface TransactionApprovalButtonProps {
  scheduleId?: string;
  transactionBytes?: string;
  messageId?: string;
  description?: string;
  network?: string;
  className?: string;
  notes?: string[];
  onApprove?: (messageId: string) => Promise<void>;
  onReject?: (messageId: string) => Promise<void>;
}

const TransactionContent = ({
  isLoadingDetails,
  transactionDetails,
  expirationTime,
  description,
  scheduleId,
  network,
  isAlreadyExecuted,
  executedTimestamp,
  notes,
}: {
  isLoadingDetails: boolean;
  transactionDetails: ParsedTransaction | null;
  expirationTime: string | null;
  description: string;
  scheduleId: string;
  network: string;
  isAlreadyExecuted?: boolean;
  executedTimestamp?: string | null;
  notes?: string[];
}): React.ReactNode => {
  const formatExecutedAt = (timestamp: string): string => {
    if (!timestamp) return '';
    try {
      const asSeconds = Number(timestamp);
      const date = isNaN(asSeconds)
        ? new Date(timestamp)
        : new Date(asSeconds * 1000);
      return format(date, 'PPpp');
    } catch {
      return timestamp;
    }
  };

  return (
    <div className='relative'>
      <div className='relative bg-black/20 rounded-xl border border-white/10 p-5'>
        {/* Header Section */}
        <div className='flex items-start gap-3'>
          <div className={cn(
            'relative flex items-center justify-center w-10 h-10 rounded-lg',
            'bg-white/10'
          )}>
            {isAlreadyExecuted ? (
              <FiCheckCircle className='text-white h-5 w-5' />
            ) : (
              <FiClock className='text-white h-5 w-5' />
            )}
            {!isAlreadyExecuted && !isLoadingDetails && (
              <span className='absolute -top-1 -right-1 h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75'></span>
                <span className='relative inline-flex rounded-full h-2 w-2 bg-yellow-400'></span>
              </span>
            )}
          </div>
          
          <div className='flex-1'>
            <Typography
              variant='h6'
              className='font-semibold text-white leading-tight'
            >
              {isAlreadyExecuted
                ? 'Transaction Executed'
                : 'Transaction Approval Required'}
            </Typography>
            
            <Typography
              variant='body2'
              className='text-white/90 mt-1 leading-relaxed'
            >
              {isAlreadyExecuted
                ? `Executed ${executedTimestamp ? formatExecutedAt(executedTimestamp) : 'successfully'}`
                : description ||
                  transactionDetails?.humanReadableType ||
                  'Review and approve the transaction details below'}
            </Typography>
            
            {/* Notes Section */}
            {notes && notes.length > 0 && (
              <div className='mt-3 pl-4 border-l-2 border-white/30'>
                {notes.map((note: string, index: number) => (
                  <Typography
                    key={index}
                    variant='body2'
                    className='text-white/90 leading-relaxed mb-1 last:mb-0'
                  >
                    {note}
                  </Typography>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transaction Details Section */}
        {isLoadingDetails ? (
          <div className='mt-5 flex items-center justify-center py-6'>
            <div className='flex flex-col items-center gap-3'>
              <div className='relative'>
                <div className='w-10 h-10 border-3 border-white/20 rounded-full' />
                <div className='absolute top-0 w-10 h-10 border-3 border-white rounded-full border-t-transparent animate-spin' />
              </div>
              <Typography variant='caption' className='text-white text-sm'>
                Loading transaction details...
              </Typography>
            </div>
          </div>
        ) : transactionDetails ? (
          (() => {
            const hideHeader = true;
            const transfers = Array.isArray(transactionDetails.transfers)
              ? transactionDetails.transfers
              : [];

            const hbarTransfersForDisplay = transfers.map((t) => ({
              ...t,
              amount: getValidAmount(t.amount),
            }));

            const tokenTransfers = Array.isArray(transactionDetails.tokenTransfers)
              ? transactionDetails.tokenTransfers
              : [];

            const tokenTransfersForDisplay = tokenTransfers.map((tokenTransfer) => ({
              tokenId: tokenTransfer.tokenId,
              accountId: tokenTransfer.accountId,
              amount: getValidAmount(tokenTransfer.amount),
            }));

            return (
              <div className='mt-4'>
                <TransactionDetails
                  {...transactionDetails}
                  humanReadableType={transactionDetails.humanReadableType || ''}
                  transfers={hbarTransfersForDisplay}
                  tokenTransfers={tokenTransfersForDisplay}
                  expirationTime={expirationTime || undefined}
                  scheduleId={scheduleId || ''}
                  hideHeader={hideHeader}
                  network={network}
                  variant='embedded'
                  className='[&>div]:!bg-transparent [&>div]:!border-0 [&>div]:!shadow-none [&>div]:!p-0 [&_table]:!bg-transparent [&_table]:!border-0 [&_thead]:!border-b [&_thead]:!border-white/20 [&_th]:!bg-transparent [&_th]:!text-white/90 [&_th]:!font-medium [&_th]:!text-xs [&_th]:!uppercase [&_th]:!tracking-wider [&_th]:!border-0 [&_th]:!pb-2 [&_td]:!text-white [&_td]:!text-sm [&_td]:!border-0 [&_td]:!py-2 [&_tr]:!border-0 [&_tbody_tr]:!border-b [&_tbody_tr]:!border-white/10 [&_tbody_tr:last-child]:!border-0 [&_tr:hover]:!bg-white/5 [&_.text-gray-500]:!text-white/90 [&_.text-gray-600]:!text-white [&_.text-gray-700]:!text-white [&_.bg-gray-50]:!bg-transparent [&_.bg-gray-100]:!bg-transparent [&_.bg-white]:!bg-transparent [&_.border-gray-200]:!border-white/20 [&_.shadow-sm]:!shadow-none'
                />
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
};

export const TransactionApprovalButton: React.FC<
  TransactionApprovalButtonProps
> = ({
  scheduleId,
  transactionBytes,
  messageId,
  description = '',
  network: propsNetwork,
  className,
  notes,
  onApprove,
  onReject,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [executedTransactionId, setExecutedTransactionId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<
    'signing' | 'submitting' | 'confirming' | 'completed' | null
  >(null);
  const [transactionDetails, setTransactionDetails] =
    useState<ParsedTransaction | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [expirationTime, setExpirationTime] = useState<string | null>(null);
  const [isAlreadyExecuted, setIsAlreadyExecuted] = useState(false);
  const [executedTimestamp, setExecutedTimestamp] = useState<string | null>(
    null
  );
  const [enhancedTransactionDetails, setEnhancedTransactionDetails] =
    useState<ParsedTransaction | null>(null);
  const [isLoadingEnhancedDetails, setIsLoadingEnhancedDetails] =
    useState(false);

  const transactionDetailsRef = useRef<ParsedTransaction | null>(null);

  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const config = useConfigStore((state) => state.config);
  const network = propsNetwork || config?.hedera?.network || 'testnet';

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const getScheduleInfo = async (): Promise<void> => {
      if (isAlreadyExecuted) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const result = await window.electron.mirrorNode.getScheduleInfo(
          scheduleId!,
          network as 'mainnet' | 'testnet'
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch schedule info');
        }

        const scheduleInfo = result.data;

        if (scheduleInfo && scheduleInfo.transaction_body) {
          const parsedTx = TransactionParser.parseScheduleResponse({
            transaction_body: scheduleInfo.transaction_body,
            memo: scheduleInfo.memo,
          });

          const convertedTransfers = Array.isArray(parsedTx.transfers)
            ? parsedTx.transfers.map((transfer: any) => ({
                accountId: transfer.accountId || transfer.account,
                amount: transfer.amount,
                isDecimal: transfer.isDecimal,
              }))
            : [];

          const convertedTokenTransfers = parsedTx.tokenTransfers
            ? parsedTx.tokenTransfers.map((token: TokenAmount) => ({
                tokenId: token.tokenId,
                accountId: token.accountId,
                amount: token.amount,
              }))
            : [];

          const parsedTransaction: ParsedTransaction = {
            ...parsedTx,
            type: parsedTx.type,
            humanReadableType: parsedTx.humanReadableType || parsedTx.type,
            details: parsedTx,
            transfers: convertedTransfers,
            tokenTransfers: convertedTokenTransfers,
          };

          setTransactionDetails(parsedTransaction);
          transactionDetailsRef.current = parsedTransaction;

          if (scheduleInfo.expiration_time) {
            setExpirationTime(scheduleInfo.expiration_time);
          }

          if (scheduleInfo.executed_timestamp) {
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(scheduleInfo.executed_timestamp);
          }
        }
      } catch (errCaught: unknown) {
        addNotification({
          type: 'error',
          title: 'Failed to load transaction details',
          message: 'Could not fetch schedule information from mirror node',
        });
      } finally {
        setIsLoadingDetails(false);
      }
    };

    const parseTransactionBytes = async (): Promise<void> => {
      if (!transactionBytes) {
        return;
      }

      setIsLoadingDetails(true);
      try {
        const parsedTx = await TransactionParser.parseTransactionBytes(
          transactionBytes
        );

        const convertedTransfers = Array.isArray(parsedTx.transfers)
          ? parsedTx.transfers.map((transfer: any) => ({
              accountId: transfer.accountId || transfer.account,
              amount: transfer.amount,
              isDecimal: transfer.isDecimal,
            }))
          : [];

        const convertedTokenTransfers = parsedTx.tokenTransfers
          ? parsedTx.tokenTransfers.map((token: TokenAmount) => ({
              tokenId: token.tokenId,
              accountId: token.accountId,
              amount: token.amount,
            }))
          : [];

        const parsedTransaction: ParsedTransaction = {
          ...parsedTx,
          type: parsedTx.type,
          humanReadableType: parsedTx.humanReadableType || parsedTx.type,
          details: parsedTx,
          transfers: convertedTransfers,
          tokenTransfers: convertedTokenTransfers,
        };

        setTransactionDetails(parsedTransaction);
        transactionDetailsRef.current = parsedTransaction;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to parse transaction bytes';
        addNotification({
          type: 'error',
          title: 'Failed to parse transaction',
          message: errorMessage,
        });
      } finally {
        setIsLoadingDetails(false);
      }
    };

    if (scheduleId) {
      getScheduleInfo();
      if (!isAlreadyExecuted) {
        intervalId = setInterval(getScheduleInfo, 5000);
      }

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    } else if (transactionBytes) {
      parseTransactionBytes();
    }
  }, [
    scheduleId,
    transactionBytes,
    network,
    isAlreadyExecuted,
    addNotification,
  ]);

  const approveTransaction = useCallback(async () => {
    setIsApproving(true);
    setError(null);

    try {
      if (scheduleId) {
        const result = await window.electron.executeScheduledTransaction(
          scheduleId
        );

        if (result.success) {
          setIsApproved(true);

          addNotification({
            type: 'success',
            title: 'Transaction Approved',
            message: `Transaction ID: ${result.transactionId}`,
            duration: 5000,
          });

          if (result.transactionId) {
            handleEnhancedTransactionSuccess(
              result.transactionId,
              transactionDetailsRef.current
            );
          }
        } else {
          setError(result.error || 'Failed to approve transaction');
          addNotification({
            type: 'error',
            title: 'Transaction Failed',
            message: result.error || 'Failed to execute transaction',
          });
        }
      } else if (messageId && onApprove) {
        await onApprove(messageId);
        setIsApproved(true);
        addNotification({
          type: 'success',
          title: 'Transaction Approved',
          message: 'Transaction has been approved successfully',
          duration: 7000,
        });
      } else if (transactionBytes && !scheduleId) {
        if (isExecuted || isApproved) {
          addNotification({
            type: 'warning',
            title: 'Transaction Already Executed',
            message: `Transaction was already executed${
              executedTransactionId ? ` with ID: ${executedTransactionId}` : ''
            }`,
            duration: 5000,
          });
          return;
        }

        setExecutionStatus('signing');

        await new Promise((resolve) => setTimeout(resolve, 500));
        setExecutionStatus('submitting');

        const entityContext = {
          description: description || '',
          name:
            transactionDetails?.tokenCreation?.tokenName ||
            transactionDetails?.details?.tokenCreation?.tokenName ||
            undefined,
        };

        const result = await window.electron.executeTransactionBytes(
          transactionBytes,
          entityContext
        );

        if (result.success) {
          setExecutionStatus('confirming');

          await new Promise((resolve) => setTimeout(resolve, 1000));

          setExecutionStatus('completed');
          setIsApproved(true);
          setIsExecuted(true);
          setExecutedTransactionId(result.transactionId || null);

          const transactionId = result.transactionId;
          const explorerUrl =
            network === 'mainnet'
              ? `https://hashscan.io/mainnet/transaction/${transactionId}`
              : `https://hashscan.io/testnet/transaction/${transactionId}`;

          addNotification({
            type: 'success',
            title: 'Transaction Executed Successfully',
            message: `Transaction ID: ${transactionId}`,
            duration: 5000,
          });

          if (transactionId) {
            handleEnhancedTransactionSuccess(
              transactionId,
              transactionDetailsRef.current
            );
          }
        } else {
          setExecutionStatus(null);

          let errorTitle = 'Transaction Failed';
          let errorMessage = result.error || 'Failed to execute transaction';

          if (result.error?.includes('already executed')) {
            errorTitle = 'Transaction Already Executed';
            setIsExecuted(true);
            setIsApproved(true);
            const match = result.error.match(/ID:\s*([^\s,)]+)/);
            if (match) {
              setExecutedTransactionId(match[1]);
            }
          } else if (result.error?.includes('insufficient balance')) {
            errorTitle = 'Insufficient Balance';
            errorMessage =
              'Your account does not have sufficient HBAR balance to execute this transaction.';
          } else if (result.error?.includes('expired')) {
            errorTitle = 'Transaction Expired';
            errorMessage =
              'This transaction has expired. Please request a new transaction from the agent.';
          } else if (
            result.error?.includes('invalid') &&
            result.error?.includes('format')
          ) {
            errorTitle = 'Invalid Transaction';
            errorMessage = 'The transaction bytes are malformed or corrupted.';
          } else if (
            result.error?.includes('network') ||
            result.error?.includes('timeout')
          ) {
            errorTitle = 'Network Error';
            errorMessage =
              'Unable to connect to the Hedera Hashgraph. Please check your connection and try again.';
          } else if (result.error?.includes('credentials')) {
            errorTitle = 'Configuration Error';
            errorMessage =
              'Hedera credentials are not configured properly. Please check your settings.';
          }

          setError(errorMessage);
          addNotification({
            type: 'error',
            title: errorTitle,
            message: errorMessage,
            duration: result.error?.includes('already executed') ? 5000 : 8000,
          });
        }
      }
    } catch (err: any) {
      setExecutionStatus(null);
      const errorMessage = err.message || 'Failed to approve transaction';
      setError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Transaction Error',
        message: errorMessage,
      });
    } finally {
      setIsApproving(false);
      if (executionStatus === 'completed') {
        setExecutionStatus(null);
      }
    }
  }, [scheduleId, messageId, onApprove, addNotification]);

  const rejectTransaction = useCallback(async () => {
    if (messageId && onReject) {
      try {
        await onReject(messageId);
        addNotification({
          type: 'info',
          title: 'Transaction Rejected',
          message: 'Transaction has been rejected',
          duration: 5000,
        });
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: 'Rejection Error',
          message: err.message || 'Failed to reject transaction',
        });
      }
    }
  }, [messageId, onReject, addNotification]);

  const formatExecutedAt = (timestamp: string): string => {
    if (!timestamp) return '';
    try {
      const asSeconds = Number(timestamp);
      const date = isNaN(asSeconds)
        ? new Date(timestamp)
        : new Date(asSeconds * 1000);
      return format(date, 'PPpp');
    } catch {
      return timestamp;
    }
  };

  const handleEnhancedTransactionSuccess = useCallback(
    async (
      transactionId: string,
      originalDetails?: ParsedTransaction | null
    ) => {
      setIsLoadingEnhancedDetails(true);

      try {
        const mirrorNode = new HederaMirrorNode(
          network === 'mainnet' ? 'mainnet' : 'testnet'
        );

        const formattedTransactionId = transactionId
          .replace('@', '-')
          .replace(/\.(\d+)$/, '-$1');

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const mirrorTransaction = (await Promise.race([
          mirrorNode.getTransaction(formattedTransactionId),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error('Mirror node request timeout')),
              15000
            )
          ),
        ])) as HederaTransaction | null;

        if (mirrorTransaction) {
          const parsedEnhancedDetails = await parseMirrorNodeTransaction(
            mirrorTransaction,
            originalDetails || transactionDetails
          );

          if (parsedEnhancedDetails) {
            const mergedDetails = mergeTransactionDetails(
              parsedEnhancedDetails,
              originalDetails || transactionDetails
            );

            setEnhancedTransactionDetails(mergedDetails);

            const enhancedMessage = generateEnhancedSuccessMessage(
              mergedDetails,
              transactionId
            );

            addNotification({
              type: 'success',
              title: 'Transaction Completed Successfully',
              message: enhancedMessage,
              duration: 12000,
            });
          }
        }
      } catch (error) {
      } finally {
        setIsLoadingEnhancedDetails(false);
      }
    },
    [network, addNotification]
  );

  useEffect(() => {
    if (
      executedTransactionId &&
      isExecuted &&
      !enhancedTransactionDetails &&
      !isLoadingEnhancedDetails
    ) {
      handleEnhancedTransactionSuccess(
        executedTransactionId,
        transactionDetailsRef.current
      );
    }
  }, [
    executedTransactionId,
    isExecuted,
    enhancedTransactionDetails,
    isLoadingEnhancedDetails,
    handleEnhancedTransactionSuccess,
    transactionDetails,
  ]);

  const parseMirrorNodeTransaction = useCallback(
    async (
      mirrorTransaction: HederaTransaction,
      originalTransactionDetails?: ParsedTransaction | null
    ): Promise<ParsedTransaction | null> => {
      try {
        const parsedTransaction: ParsedTransaction = {
          type: mirrorTransaction.name || 'UNKNOWN',
          humanReadableType: getHumanReadableTransactionType(
            mirrorTransaction.name
          ),
          details: {},
          memo: mirrorTransaction.memo_base64
            ? atob(mirrorTransaction.memo_base64)
            : undefined,
        };

        if (
          mirrorTransaction.transfers &&
          mirrorTransaction.transfers.length > 0
        ) {
          parsedTransaction.transfers = mirrorTransaction.transfers.map(
            (transfer) => ({
              accountId: transfer.account,
              amount: parseFloat(Hbar.fromTinybars(transfer.amount).toString()),
            })
          );
        }

        if (
          mirrorTransaction.token_transfers &&
          mirrorTransaction.token_transfers.length > 0
        ) {
          parsedTransaction.tokenTransfers =
            mirrorTransaction.token_transfers.map((tokenTransfer) => ({
              tokenId: tokenTransfer.token_id,
              accountId: tokenTransfer.account,
              amount: parseInt(tokenTransfer.amount),
            }));
        }

        await enrichTransactionDetails(
          parsedTransaction,
          mirrorTransaction,
          originalTransactionDetails
        );

        return parsedTransaction;
      } catch (error) {
        return null;
      }
    },
    []
  );

  const enrichTransactionDetails = useCallback(
    async (
      parsedTransaction: ParsedTransaction,
      mirrorTransaction: HederaTransaction,
      originalTransactionDetails?: ParsedTransaction | null
    ): Promise<void> => {
      const transactionType =
        mirrorTransaction.name?.toUpperCase() || 'UNKNOWN';
      const enrichmentHandler =
        getTransactionEnrichmentHandler(transactionType);

      enrichmentHandler.enrich(
        parsedTransaction,
        mirrorTransaction,
        originalTransactionDetails
      );

      parsedTransaction.details.transactionFee =
        mirrorTransaction.charged_tx_fee;
      parsedTransaction.details.consensusTimestamp =
        mirrorTransaction.consensus_timestamp;
      parsedTransaction.details.result = mirrorTransaction.result;
    },
    []
  );

  const generateEnhancedSuccessMessage = useCallback(
    (transaction: ParsedTransaction, transactionId: string): string => {
      const transactionType = transaction.type.toUpperCase();
      const enrichmentHandler =
        getTransactionEnrichmentHandler(transactionType);

      return enrichmentHandler.generateSuccessMessage(
        transaction,
        transactionId
      );
    },
    []
  );

  if (isDismissed) {
    return null;
  }

  return (
    <div className={cn('mt-4 flex flex-col items-start w-full', className)}>
      <div className='w-full'>
        <div className='flex flex-col space-y-4 md:space-y-5'>
          {isApproved && isExecuted ? (
            <div className='relative'>
              <div className='relative bg-black/20 rounded-xl border border-white/10 p-5'>
                {/* Header Section */}
                <div className='flex items-start gap-3'>
                  <div className={cn(
                    'relative flex items-center justify-center w-10 h-10 rounded-lg',
                    'bg-white/10'
                  )}>
                    <FiCheckCircle className='text-white h-5 w-5' />
                  </div>
                  
                  <div className='flex-1'>
                    <Typography
                      variant='h6'
                      className='font-semibold text-white leading-tight'
                    >
                      Transaction Executed Successfully
                    </Typography>
                    
                    <Typography
                      variant='body2'
                      className='text-white/90 mt-1 leading-relaxed'
                    >
                      {executedTransactionId ? (
                        <>
                          Transaction ID: {executedTransactionId}
                          <br />
                          <button
                            onClick={() => {
                              const explorerUrl =
                                network === 'mainnet'
                                  ? `https://hashscan.io/mainnet/transaction/${executedTransactionId}`
                                  : `https://hashscan.io/testnet/transaction/${executedTransactionId}`;
                              window.electron.openExternal(explorerUrl);
                            }}
                            className='text-white underline hover:text-white/80 mt-1 inline-block'
                          >
                            View on HashScan →
                          </button>
                        </>
                      ) : (
                        'The transaction has been successfully executed.'
                      )}
                    </Typography>
                  </div>
                </div>

                {isLoadingEnhancedDetails && (
                  <div className='mt-5 flex items-center justify-center py-6'>
                    <div className='flex flex-col items-center gap-3'>
                      <div className='relative'>
                        <div className='w-10 h-10 border-3 border-white/20 rounded-full' />
                        <div className='absolute top-0 w-10 h-10 border-3 border-white rounded-full border-t-transparent animate-spin' />
                      </div>
                      <Typography variant='caption' className='text-white text-sm'>
                        Loading transaction details...
                      </Typography>
                    </div>
                  </div>
                )}

                {enhancedTransactionDetails && (
                  <div className='mt-4'>
                    {(() => {
                      const entityId =
                        enhancedTransactionDetails.details?.createdTokenId ||
                        enhancedTransactionDetails.details?.entityId;

                      const formattedTransfers = Array.isArray(
                        enhancedTransactionDetails.transfers
                      )
                        ? enhancedTransactionDetails.transfers.map(
                            (transfer) => ({
                              accountId: transfer.accountId,
                              amount:
                                typeof transfer.amount === 'string'
                                  ? parseFloat(transfer.amount)
                                  : transfer.amount,
                            })
                          )
                        : [];

                      const formattedTokenTransfers = Array.isArray(
                        enhancedTransactionDetails.tokenTransfers
                      )
                        ? enhancedTransactionDetails.tokenTransfers.map(
                            (tokenTransfer) => ({
                              tokenId: tokenTransfer.tokenId,
                              accountId: tokenTransfer.accountId,
                              amount: tokenTransfer.amount,
                            })
                          )
                        : [];

                      return (
                        <TransactionDetails
                          {...enhancedTransactionDetails}
                          humanReadableType={
                            enhancedTransactionDetails.humanReadableType || ''
                          }
                          transfers={formattedTransfers}
                          tokenTransfers={formattedTokenTransfers}
                          executedTransactionEntityId={entityId}
                          executedTransactionType={
                            enhancedTransactionDetails.type
                          }
                          network={network}
                          hideHeader={true}
                          variant='embedded'
                          className='[&>div]:!bg-transparent [&>div]:!border-0 [&>div]:!shadow-none [&>div]:!p-0 [&_table]:!bg-transparent [&_table]:!border-0 [&_thead]:!border-b [&_thead]:!border-white/20 [&_th]:!bg-transparent [&_th]:!text-white/90 [&_th]:!font-medium [&_th]:!text-xs [&_th]:!uppercase [&_th]:!tracking-wider [&_th]:!border-0 [&_th]:!pb-2 [&_td]:!text-white [&_td]:!text-sm [&_td]:!border-0 [&_td]:!py-2 [&_tr]:!border-0 [&_tbody_tr]:!border-b [&_tbody_tr]:!border-white/10 [&_tbody_tr:last-child]:!border-0 [&_tr:hover]:!bg-white/5 [&_.text-gray-500]:!text-white/90 [&_.text-gray-600]:!text-white [&_.text-gray-700]:!text-white [&_.bg-gray-50]:!bg-transparent [&_.bg-gray-100]:!bg-transparent [&_.bg-white]:!bg-transparent [&_.border-gray-200]:!border-white/20 [&_.shadow-sm]:!shadow-none'
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : isApproved ? (
            <div className='relative'>
              <div className='relative bg-black/20 rounded-xl border border-white/10 p-5'>
                <div className='flex items-start gap-3'>
                  <div className={cn(
                    'relative flex items-center justify-center w-10 h-10 rounded-lg',
                    'bg-white/10'
                  )}>
                    <FiCheckCircle className='text-white h-5 w-5' />
                  </div>
                  
                  <div className='flex-1'>
                    <Typography
                      variant='h6'
                      className='font-semibold text-white leading-tight'
                    >
                      Transaction Approved
                    </Typography>
                    
                    <Typography
                      variant='body2'
                      className='text-white/90 mt-1 leading-relaxed'
                    >
                      The transaction has been successfully signed and is being processed.
                    </Typography>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <TransactionContent
                  isLoadingDetails={isLoadingDetails}
                  transactionDetails={transactionDetails}
                  expirationTime={expirationTime}
                  description={description}
                  scheduleId={scheduleId || ''}
                  network={network}
                  isAlreadyExecuted={isAlreadyExecuted}
                  executedTimestamp={executedTimestamp}
                  notes={notes}
                />

                {!isAlreadyExecuted && !isExecuted && !isApproved && (
                  <div className='mt-5 flex items-center justify-between'>
                    {error && (
                      <Typography
                        variant='caption'
                        className='text-red-400 text-sm flex items-center gap-2'
                      >
                        <FiAlertTriangle className='h-4 w-4' />
                        {error}
                      </Typography>
                    )}
                    <div className='flex items-center gap-3 ml-auto'>
                      <button
                        onClick={() => setIsDismissed(true)}
                        type='button'
                        className={cn(
                          'px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                          'bg-white/10 text-white/90 hover:bg-white/15 hover:text-white',
                          'border border-white/10 hover:border-white/20'
                        )}
                      >
                        Dismiss
                      </button>
                      {transactionBytes && messageId && onReject && (
                        <button
                          onClick={rejectTransaction}
                          type='button'
                          className={cn(
                            'px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                            'bg-white/10 text-white/90 hover:bg-white/15 hover:text-white',
                            'border border-white/10 hover:border-white/20'
                          )}
                        >
                          Decline
                        </button>
                      )}
                      <button
                        onClick={approveTransaction}
                        disabled={isApproving || isExecuted || isApproved}
                        type='button'
                        className={cn(
                          'relative px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                          'bg-white text-blue-600 hover:bg-white/95 disabled:opacity-50 disabled:cursor-not-allowed',
                          'shadow-lg shadow-white/10 hover:shadow-white/20',
                          !isApproving && 'transform hover:scale-[1.02] active:scale-[0.98]'
                        )}
                      >
                        {isApproving ? (
                          <span className='flex items-center gap-2'>
                            <FiLoader className='h-4 w-4 animate-spin' />
                            <span>
                              {executionStatus === 'signing' && 'Signing...'}
                              {executionStatus === 'submitting' && 'Submitting...'}
                              {executionStatus === 'confirming' && 'Confirming...'}
                              {!executionStatus && 'Processing...'}
                            </span>
                          </span>
                        ) : (
                          <span className='flex items-center gap-2'>
                            <FiCheck className='h-4 w-4' />
                            Approve Transaction
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionApprovalButton;
