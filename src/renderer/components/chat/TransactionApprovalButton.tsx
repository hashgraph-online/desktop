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
}: {
  isLoadingDetails: boolean;
  transactionDetails: ParsedTransaction | null;
  expirationTime: string | null;
  description: string;
  scheduleId: string;
  network: string;
}): React.ReactNode => {
  if (isLoadingDetails) {
    return (
      <div className='flex items-center gap-2 py-4'>
        <FiLoader className='h-4 w-4 animate-spin text-brand-blue' />
        <Typography
          variant='caption'
          className='text-gray-600 dark:text-gray-400'
        >
          Loading transaction details...
        </Typography>
      </div>
    );
  }

  if (transactionDetails) {
    const hideHeader = true;

    // Ensure transfers is always an array
    const transfers = Array.isArray(transactionDetails.transfers)
      ? transactionDetails.transfers
      : [];

    const hbarTransfersForDisplay = transfers.map((t) => ({
      ...t,
      amount: getValidAmount(t.amount),
    }));

    // Ensure tokenTransfers is always an array
    const tokenTransfers = Array.isArray(transactionDetails.tokenTransfers)
      ? transactionDetails.tokenTransfers
      : [];

    const tokenTransfersForDisplay = tokenTransfers.map((tokenTransfer) => ({
      tokenId: tokenTransfer.tokenId,
      accountId: tokenTransfer.accountId,
      amount: getValidAmount(tokenTransfer.amount),
    }));

    return (
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
      />
    );
  }

  return (
    <div className='flex items-center gap-2 py-2'>
      <FiInfo className='h-4 w-4 text-yellow-500' />
      <Typography
        variant='caption'
        className='text-gray-600 dark:text-gray-400'
      >
        Transaction details not available
      </Typography>
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
  onApprove,
  onReject,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
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

  return (
    <div className={cn('mt-4 flex flex-col items-start w-full', className)}>
      <div className='bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4 w-full backdrop-blur-sm shadow-sm'>
        <div className='flex flex-col space-y-4 md:space-y-5'>
          {isApproved && isExecuted ? (
            <div className='flex flex-col animate-fadeIn py-4 space-y-4'>
              <div className='flex items-center'>
                <div className='bg-brand-green/20 dark:bg-brand-green/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                  <FiCheckCircle className='text-brand-green h-4 sm:h-5 w-4 sm:w-5' />
                </div>
                <div className='ml-3 sm:ml-4'>
                  <Typography
                    variant='body1'
                    className='font-medium text-green-700 dark:text-green-300 text-sm sm:text-base'
                  >
                    Transaction Executed Successfully
                  </Typography>
                  <Typography
                    variant='caption'
                    className='text-xs sm:text-sm text-green-600/80 dark:text-green-400/80 mt-0.5'
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
                          className='text-green-600 dark:text-green-400 underline hover:text-green-700 dark:hover:text-green-300'
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
                <div className='flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
                  <FiLoader className='h-4 w-4 animate-spin text-blue-600 dark:text-blue-400' />
                  <Typography
                    variant='caption'
                    className='text-blue-700 dark:text-blue-300'
                  >
                    Loading enhanced transaction details...
                  </Typography>
                </div>
              )}

              {enhancedTransactionDetails && (
                <div className='border-t border-gray-200 dark:border-gray-700 pt-4'>
                  <Typography
                    variant='caption'
                    className='text-gray-600 dark:text-gray-400 mb-3 block'
                  >
                    Transaction Details:
                  </Typography>
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
                        className='bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3'
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          ) : isApproved ? (
            <div className='flex items-center animate-fadeIn py-4'>
              <div className='bg-brand-green/20 dark:bg-brand-green/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                <FiCheckCircle className='text-brand-green h-4 sm:h-5 w-4 sm:w-5' />
              </div>
              <div className='ml-3 sm:ml-4'>
                <Typography
                  variant='body1'
                  className='font-medium text-green-700 dark:text-green-300 text-sm sm:text-base'
                >
                  Transaction Approved
                </Typography>
                <Typography
                  variant='caption'
                  className='text-xs sm:text-sm text-green-600/80 dark:text-green-400/80 mt-0.5'
                >
                  The transaction has been successfully signed.
                </Typography>
              </div>
            </div>
          ) : (
            <>
              <div className='flex items-start'>
                <div className='bg-brand-blue/20 dark:bg-brand-blue/30 p-2 sm:p-2.5 rounded-full shadow-sm flex items-center justify-center flex-shrink-0'>
                  {isAlreadyExecuted ? (
                    <FiCheckCircle className='text-gray-500 dark:text-gray-400 h-4 sm:h-5 w-4 sm:w-5' />
                  ) : (
                    <FiClock className='text-brand-blue h-4 sm:h-5 w-4 sm:w-5' />
                  )}
                </div>

                <div className='ml-3 sm:ml-4 overflow-hidden'>
                  <Typography
                    variant='body1'
                    className={cn(
                      'font-medium truncate text-sm sm:text-base',
                      isAlreadyExecuted
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-purple-800 dark:text-purple-200'
                    )}
                  >
                    {isAlreadyExecuted
                      ? 'Transaction Already Executed'
                      : 'Transaction Requires Approval'}
                  </Typography>
                  <Typography
                    variant='caption'
                    className={cn(
                      'text-xs sm:text-sm mt-1 sm:mt-1.5 break-words',
                      isAlreadyExecuted
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-purple-700/80 dark:text-purple-300/80'
                    )}
                  >
                    {isAlreadyExecuted
                      ? `This scheduled transaction has already been executed${
                          executedTimestamp
                            ? ` on ${formatExecutedAt(executedTimestamp)}`
                            : ''
                        }`
                      : description ||
                        (transactionDetails?.humanReadableType &&
                        transactionDetails.humanReadableType !==
                          'Unknown Transaction'
                          ? transactionDetails.humanReadableType
                          : 'Transaction requires approval')}
                  </Typography>
                </div>
              </div>

              <TransactionContent
                isLoadingDetails={isLoadingDetails}
                transactionDetails={transactionDetails}
                expirationTime={expirationTime}
                description={description}
                scheduleId={scheduleId || ''}
                network={network}
              />

              {!isAlreadyExecuted && !isExecuted && !isApproved && (
                <div className='flex flex-wrap items-center pt-3 sm:pt-4 gap-2'>
                  <Button
                    onClick={approveTransaction}
                    disabled={isApproving || isExecuted || isApproved}
                    className={cn(
                      'transition-all duration-300 bg-gradient-to-r from-brand-blue to-brand-purple hover:from-brand-purple hover:to-brand-blue text-white border-0 shadow-md hover:shadow-lg relative overflow-hidden group',
                      (isApproving || isExecuted || isApproved) && 'opacity-70'
                    )}
                  >
                    <span className='absolute inset-0 w-full h-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)] group-hover:translate-x-full transition-transform duration-700 ease-in-out'></span>
                    {isApproving ? (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiLoader className='h-4 w-4 animate-spin' />
                        <span>
                          {executionStatus === 'signing' &&
                            'Signing transaction...'}
                          {executionStatus === 'submitting' &&
                            'Submitting to network...'}
                          {executionStatus === 'confirming' &&
                            'Confirming execution...'}
                          {!executionStatus && 'Approving...'}
                        </span>
                      </div>
                    ) : (
                      <div className='flex items-center space-x-2 relative z-10'>
                        <FiCheck className='h-4 w-4' />
                        <span>Approve</span>
                      </div>
                    )}
                  </Button>
                  {transactionBytes && messageId && onReject && (
                    <Button
                      onClick={rejectTransaction}
                      variant='outline'
                      className='border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    >
                      <div className='flex items-center space-x-2'>
                        <FiX className='h-4 w-4' />
                        <span>Reject</span>
                      </div>
                    </Button>
                  )}
                  {error && (
                    <Typography
                      variant='caption'
                      className='text-red-500 dark:text-red-400 text-sm'
                    >
                      {error}
                    </Typography>
                  )}
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
