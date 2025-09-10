import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../../ui/Button';
import Typography from '../../ui/Typography';
import { FiLoader, FiAlertTriangle, FiX, FiCheck } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { useNotificationStore } from '../../../stores/notificationStore';
import { TransactionParser } from '@hashgraphonline/standards-sdk';
import { Hbar, Transaction as SdkTransaction } from '@hashgraph/sdk';
import { type ParsedTransaction } from '../../../types/transaction';
import { type TokenAmount } from '@hashgraphonline/standards-sdk';
import { type Transaction as HederaTransaction } from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../../../stores/configStore';
import { useWalletStore } from '../../../stores/walletStore';
import { useAgentStore } from '../../../stores/agentStore';
import { telemetry } from '../../../services/telemetryService';
import { getTransactionEnrichmentHandler } from '../../../utils/transactionEnrichmentRegistry';
import { getHumanReadableTransactionType } from '../../../utils/transactionTypeHelper';
import { mergeTransactionDetails } from '../../../utils/transactionMerger';
import { TransactionContent } from './TransactionContent';
import { comparePayer } from '../../../../shared/tx/payer';
import { EntityFormat } from '@hashgraphonline/conversational-agent';
import { TransactionSuccessDisplay } from './TransactionSuccessDisplay';
import {
  isLikelyPayerOnly,
  waitForMirrorConfirmation,
  persistExecuted,
} from '../../../services/txExecution';
import { TransactionApprovedDisplay } from './TransactionApprovedDisplay';
import { isEqual } from 'lodash';

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
  onExecuted?: (args: {
    messageId: string;
    transactionId?: string;
  }) => Promise<void>;
  entityContext?: { name?: string; description?: string };
  scheduleOp?: 'sign' | 'delete';
  initialApproved?: boolean;
  initialExecuted?: boolean;
  initialTransactionId?: string;
}

/**
 * A comprehensive transaction approval component that handles scheduled transactions,
 * transaction bytes, and provides approval/rejection functionality with detailed status tracking
 */
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
  onExecuted,
  scheduleOp = 'sign',
  initialApproved,
  initialExecuted,
  initialTransactionId,
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
  const [isScheduleExpired, setIsScheduleExpired] = useState(false);
  const [scheduleAge, setScheduleAge] = useState<number | null>(null);
  const [enhancedTransactionDetails, setEnhancedTransactionDetails] =
    useState<ParsedTransaction | null>(null);
  const [isLoadingEnhancedDetails, setIsLoadingEnhancedDetails] =
    useState(false);
  const [forceRefreshTrigger, setForceRefreshTrigger] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  const transactionDetailsRef = useRef<ParsedTransaction | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const config = useConfigStore((state) => state.config);
  const network = propsNetwork || config?.hedera?.network || 'testnet';
  const {
    isConnected: walletConnected,
    accountId: walletAccountId,
    executeFromBytes,
    executeScheduleSign,
    executeScheduleDelete,
    network: walletNetwork,
  } = useWalletStore();

  /**
   * Calculate polling interval based on poll count with intelligent backoff
   */
  const getPollingInterval = useCallback((count: number): number => {
    if (count < 3) return 2000;
    if (count < 6) return 5000;
    if (count < 10) return 10000;
    return 30000;
  }, []);

  /**
   * Check if polling should stop based on transaction state
   */
  const shouldStopPolling = useCallback((): boolean => {
    return isAlreadyExecuted || isScheduleExpired || isExecuted;
  }, [isAlreadyExecuted, isScheduleExpired, isExecuted]);

  useEffect(() => {
    const getScheduleInfo = async (forceRefresh = false): Promise<void> => {
      if (shouldStopPolling() && !forceRefresh) {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        return;
      }

      if (!forceRefresh) {
        setIsLoadingDetails(true);
      }

      try {
        const statusResult =
          await window.electron.mirrorNode.getScheduledTransactionStatus(
            scheduleId!,
            network as 'mainnet' | 'testnet'
          );

        let executionStateChanged = false;
        if (statusResult.success) {
          const status = statusResult.data;
          if (status.executed && !isAlreadyExecuted) {
            executionStateChanged = true;
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(
              status.executedDate?.toISOString() || 'executed'
            );
            if (intervalIdRef.current) {
              clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
            }
          }
        }

        const result = await window.electron.mirrorNode.getScheduleInfo(
          scheduleId!,
          network as 'mainnet' | 'testnet'
        );

        if (!result.success) {
          const errorMessage = result.error || '';
          if (
            errorMessage.includes('INVALID_SCHEDULE_ID') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('does not exist')
          ) {
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(new Date().toISOString());
            setIsLoadingDetails(false);
            if (intervalIdRef.current) {
              clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
            }
            return;
          }
          throw new Error(result.error || 'Failed to fetch schedule info');
        }

        const scheduleInfo = result.data;

        if (scheduleInfo && scheduleInfo.transaction_body) {
          let dataChanged = false;

          if (scheduleInfo.consensus_timestamp) {
            const createdDate = new Date(
              parseFloat(scheduleInfo.consensus_timestamp) * 1000
            );
            const ageMinutes =
              (Date.now() - createdDate.getTime()) / (1000 * 60);
            const newScheduleAge = Math.round(ageMinutes);

            if (newScheduleAge !== scheduleAge) {
              setScheduleAge(newScheduleAge);
              dataChanged = true;
            }

            const newIsExpired = ageMinutes > 30;
            if (newIsExpired !== isScheduleExpired) {
              setIsScheduleExpired(newIsExpired);
              dataChanged = true;
            }
          }

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

          const newParsedTransaction: ParsedTransaction = {
            ...parsedTx,
            type: parsedTx.type,
            humanReadableType: parsedTx.humanReadableType || parsedTx.type,
            details: parsedTx,
            transfers: convertedTransfers,
            tokenTransfers: convertedTokenTransfers,
          };

          if (!isEqual(transactionDetailsRef.current, newParsedTransaction)) {
            setTransactionDetails(newParsedTransaction);
            transactionDetailsRef.current = newParsedTransaction;
            dataChanged = true;
          }

          if (scheduleInfo.expiration_time !== expirationTime) {
            setExpirationTime(scheduleInfo.expiration_time);
            dataChanged = true;
          }

          if (scheduleInfo.executed_timestamp && !isAlreadyExecuted) {
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(scheduleInfo.executed_timestamp);
            executionStateChanged = true;
            if (intervalIdRef.current) {
              clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
            }
          }

          if (dataChanged || executionStateChanged) {
            setPollCount(0);
          }
        }
      } catch (errCaught: unknown) {
        if (!forceRefresh) {
          addNotification({
            type: 'error',
            title: 'Failed to load transaction details',
            message: 'Could not fetch schedule information from mirror node',
          });
        }
      } finally {
        if (!forceRefresh) {
          setIsLoadingDetails(false);
        }
      }
    };

    const parseTransactionBytes = async (): Promise<void> => {
      if (!transactionBytes) {
        return;
      }

      setIsLoadingDetails(true);
      try {
        const parsedTx =
          await TransactionParser.parseTransactionBytes(transactionBytes);

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

    const setupPolling = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }

      if (shouldStopPolling()) {
        return;
      }

      const interval = getPollingInterval(pollCount);
      intervalIdRef.current = setInterval(() => {
        setPollCount((prev) => prev + 1);
        getScheduleInfo();
      }, interval);
    };

    if (scheduleId) {
      const shouldForceRefresh = forceRefreshTrigger > 0;
      getScheduleInfo(shouldForceRefresh);

      if (!shouldStopPolling()) {
        setupPolling();
      }

      return () => {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
      };
    } else if (transactionBytes) {
      parseTransactionBytes();
    }
  }, [
    scheduleId,
    transactionBytes,
    network,
    addNotification,
    forceRefreshTrigger,
    pollCount,
    shouldStopPolling,
    getPollingInterval,
    isAlreadyExecuted,
    isScheduleExpired,
    scheduleAge,
    expirationTime,
  ]);

  useEffect(() => {
    if (initialApproved) setIsApproved(true);
    if (initialExecuted) setIsExecuted(true);
    if (initialTransactionId) setExecutedTransactionId(initialTransactionId);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);

  const approveTransaction = useCallback(async () => {
    setIsApproving(true);
    setError(null);
    // Clear any stale executed transaction ID before starting a new approval flow
    setExecutedTransactionId(null);

    try {
      if (scheduleId) {
        let result: {
          success: boolean;
          transactionId?: string;
          error?: string;
          status?: string;
        };
        if (walletConnected) {
          if ((walletNetwork || 'testnet') !== (network || 'testnet')) {
            const msg = `Wallet network (${walletNetwork}) differs from app network (${network}). Open Settings → Wallet to align networks, then try again.`;
            setError(msg);
            addNotification({
              type: 'warning',
              title: 'Network Mismatch',
              message: msg,
            });
            telemetry.emit('wallet_network_mismatch', {
              appNet: network,
              walletNet: walletNetwork,
            });
            return;
          }
          const res =
            scheduleOp === 'delete'
              ? await (executeScheduleDelete?.(scheduleId) ??
                  Promise.resolve({
                    success: false,
                    error: 'Schedule delete not supported',
                  }))
              : await executeScheduleSign(scheduleId);
          result = { ...res };
        } else {
          if (
            scheduleOp === 'delete' &&
            typeof window.electron.deleteScheduledTransaction === 'function'
          ) {
            result =
              await window.electron.deleteScheduledTransaction(scheduleId);
          } else {
            result =
              await window.electron.executeScheduledTransaction(scheduleId);
          }
        }

        if (result.success) {
          setIsApproved(true);
          setIsExecuted(true);
          setExecutedTransactionId(result.transactionId || null);

          addNotification({
            type: 'success',
            title: 'Transaction Approved',
            message: `Transaction ID: ${result.transactionId}`,
            duration: 5000,
          });

          setTimeout(() => {
            setForceRefreshTrigger((prev) => prev + 1);
          }, 1000);

          setTimeout(() => {
            setForceRefreshTrigger((prev) => prev + 1);
          }, 3000);

          setTimeout(() => {
            setForceRefreshTrigger((prev) => prev + 1);
          }, 6000);

          if (result.transactionId) {
            handleEnhancedTransactionSuccess(
              result.transactionId,
              transactionDetailsRef.current
            );
          }
        } else {
          if (
            result.error === 'INVALID_SCHEDULE_ID' ||
            result.error === 'SCHEDULE_ALREADY_EXECUTED' ||
            result.error === 'SCHEDULE_DELETED' ||
            result.error === 'SCHEDULE_EXPIRED' ||
            result.status === 'INVALID_SCHEDULE_ID' ||
            result.status === 'SCHEDULE_ALREADY_EXECUTED' ||
            result.status === 'SCHEDULE_DELETED' ||
            result.status === 'SCHEDULE_EXPIRED'
          ) {
            setIsAlreadyExecuted(true);
            setExecutedTimestamp(new Date().toISOString());

            let notificationMessage = '';
            if (
              result.error === 'INVALID_SCHEDULE_ID' ||
              result.status === 'INVALID_SCHEDULE_ID'
            ) {
              notificationMessage =
                'This scheduled transaction no longer exists or is invalid. It may have expired or been deleted.';
            } else if (
              result.error === 'SCHEDULE_ALREADY_EXECUTED' ||
              result.status === 'SCHEDULE_ALREADY_EXECUTED'
            ) {
              notificationMessage =
                'This scheduled transaction has already been executed.';
            } else if (
              result.error === 'SCHEDULE_DELETED' ||
              result.status === 'SCHEDULE_DELETED'
            ) {
              notificationMessage =
                'This scheduled transaction has been deleted.';
            } else if (
              result.error === 'SCHEDULE_EXPIRED' ||
              result.status === 'SCHEDULE_EXPIRED'
            ) {
              notificationMessage =
                'This scheduled transaction has expired and can no longer be executed.';
            }

            addNotification({
              type: 'info',
              title: 'Transaction Unavailable',
              message: notificationMessage,
              duration: 5000,
            });

            setForceRefreshTrigger((prev) => prev + 1);
          } else {
            setError(result.error || 'Failed to approve transaction');
            addNotification({
              type: 'error',
              title: 'Transaction Failed',
              message: result.error || 'Failed to execute transaction',
            });
          }
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

        if (walletConnected) {
          if ((walletNetwork || 'testnet') !== (network || 'testnet')) {
            const msg = `Wallet network (${walletNetwork}) differs from app network (${network}). Open Settings → Wallet to align networks, then try again.`;
            setError(msg);
            addNotification({
              type: 'warning',
              title: 'Network Mismatch',
              message: msg,
            });
            telemetry.emit('wallet_network_mismatch', {
              appNet: network,
              walletNet: walletNetwork,
            });
            return;
          }
          try {
            const expected = walletAccountId || null;
            const { matches, payer } = comparePayer(transactionBytes, expected);
            if (expected && payer && !matches) {
              const msg = `This transaction was built for payer ${payer}, but your connected wallet is ${expected}. Ask the agent to rebuild it for your wallet or use the local path.`;
              setError(msg);
              addNotification({
                type: 'warning',
                title: 'Wallet Payer Mismatch',
                message: msg,
              });
              return;
            }
          } catch {}

          try {
            const parsed = await TransactionParser.parseTransactionBytes(
              transactionBytes,
              { includeRaw: false }
            );
            const txType = parsed.type || '';
            if (!isLikelyPayerOnly(txType)) {
              const msg = `This ${parsed.humanReadableType || txType} likely requires keys beyond the payer. Ask the agent to build bytes for your wallet or use the local path.`;
              setError(msg);
              addNotification({
                type: 'warning',
                title: 'Unsupported Transaction for Wallet',
                message: msg,
              });
              return;
            }
          } catch {}

          setExecutionStatus('signing');
          const result = await executeFromBytes(transactionBytes);
          if (result.success) {
            setExecutionStatus('confirming');

            // Confirm on mirror node before marking success
            const txId = result.transactionId || '';
            const confirm = txId
              ? await waitForMirrorConfirmation(txId, network)
              : { ok: false, error: 'Missing transactionId' };
            if (!confirm.ok) {
              setExecutionStatus(null);
              const statusMsg = confirm.status
                ? `status ${confirm.status}`
                : confirm.error || 'not confirmed';
              const msg = `Transaction was submitted but failed or not confirmed (${statusMsg}). It may have expired; please request new bytes and try again.`;
              setError(msg);
              addNotification({
                type: 'error',
                title: 'Submission Failed',
                message: msg,
              });
              return;
            }

            setExecutionStatus('completed');
            setIsApproved(true);
            setIsExecuted(true);
            setExecutedTransactionId(result.transactionId || null);

            addNotification({
              type: 'success',
              title: 'Approved in Wallet',
              message: txId
                ? `Transaction ID: ${txId}`
                : 'Transaction submitted',
              duration: 5000,
            });
            if (txId) {
              handleEnhancedTransactionSuccess(
                txId,
                transactionDetailsRef.current
              );
            }

            await persistExecuted(messageId, txId);

            if (messageId && onExecuted) {
              try {
                await onExecuted({ messageId, transactionId: txId });
              } catch {}
            }
          } else {
            setExecutionStatus(null);
            const raw = result.error || 'Wallet approval failed';
            const isPayerMismatch = raw.includes('payer_mismatch');
            const msg = isPayerMismatch
              ? 'This transaction was built for a different payer account. Ask the agent to rebuild it for your connected wallet, or switch to the local path.'
              : raw;
            setError(msg);
            addNotification({
              type: isPayerMismatch ? 'warning' : 'error',
              title: isPayerMismatch ? 'Wallet Payer Mismatch' : 'Wallet Error',
              message: msg,
            });
          }
          return;
        }

        try {
          const expected = config?.hedera?.accountId || null;
          const { matches, payer } = comparePayer(transactionBytes, expected);
          if (expected && payer && !matches) {
            const msg = `This transaction was built for payer ${payer}, but your configured signer is ${expected}. Approve in your wallet or ask the agent to rebuild it for your server signer.`;
            setError(msg);
            addNotification({
              type: 'warning',
              title: 'Payer Mismatch',
              message: msg,
            });
            return;
          }
        } catch {}

        setExecutionStatus('signing');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setExecutionStatus('submitting');

        const entityContext = {
          description: description || '',
          name:
            (transactionDetails as { tokenCreation?: { tokenName?: string } })
              ?.tokenCreation?.tokenName ||
            (
              transactionDetails as {
                details?: { tokenCreation?: { tokenName?: string } };
              }
            )?.details?.tokenCreation?.tokenName ||
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
              ? `https://hashscan.io/testnet/transaction/${transactionId}`
              : `https://hashscan.io/transaction/${transactionId}`;

          let successMessage = `Transaction ID: ${transactionId}`;
          if (
            result.entityId &&
            result.entityType === (EntityFormat.TOKEN_ID as unknown as string)
          ) {
            successMessage = `Token created with ID: ${result.entityId} (Transaction: ${transactionId})`;
          }

          addNotification({
            type: 'success',
            title: 'Transaction Executed Successfully',
            message: successMessage,
            duration: 5000,
          });

          if (transactionId) {
            handleEnhancedTransactionSuccess(
              transactionId,
              transactionDetailsRef.current
            );
          }

          await persistExecuted(messageId, transactionId);

          if (messageId && onExecuted) {
            try {
              await onExecuted({ messageId, transactionId });
            } catch {}
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
            if (match && !executedTransactionId) {
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
    } catch (err: unknown) {
      setExecutionStatus(null);
      const errorMessage =
        (err instanceof Error ? err.message : String(err)) ||
        'Failed to approve transaction';
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
  }, [
    scheduleId,
    messageId,
    onApprove,
    addNotification,
    walletConnected,
    executeFromBytes,
    executeScheduleSign,
    walletNetwork,
    network,
  ]);

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
      } catch (err: unknown) {
        addNotification({
          type: 'error',
          title: 'Rejection Error',
          message:
            (err instanceof Error ? err.message : String(err)) ||
            'Failed to reject transaction',
        });
      }
    }
  }, [messageId, onReject, addNotification]);

  const handleEnhancedTransactionSuccess = useCallback(
    async (
      transactionId: string,
      originalDetails?: ParsedTransaction | null
    ) => {
      setIsLoadingEnhancedDetails(true);

      try {
        // Format TX ID to hyphenated form for mirror node endpoint
        const toHyphenId = (id: string): string =>
          id.replace('@', '-').replace(/\.(\d+)$/, '-$1');
        const formattedId = toHyphenId(transactionId);

        // Small delay to allow mirror node to index the transaction
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const response = (await Promise.race([
          window.electron.mirrorNode.getTransaction(
            formattedId,
            (network as 'mainnet' | 'testnet') || 'testnet'
          ),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error('Mirror node request timeout')),
              15000
            )
          ),
        ])) as {
          success: boolean;
          data?: HederaTransaction;
          error?: string;
        } | null;

        const mirrorTransaction =
          response && response.success && response.data
            ? (response.data as HederaTransaction)
            : undefined;

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
            <TransactionSuccessDisplay
              executedTransactionId={executedTransactionId}
              network={network}
              isLoadingEnhancedDetails={isLoadingEnhancedDetails}
              enhancedTransactionDetails={enhancedTransactionDetails}
              transactionDetails={transactionDetails}
            />
          ) : isApproved ? (
            <TransactionApprovedDisplay />
          ) : isAlreadyExecuted ? (
            <TransactionSuccessDisplay
              executedTransactionId={executedTransactionId}
              network={network}
              isLoadingEnhancedDetails={isLoadingEnhancedDetails}
              enhancedTransactionDetails={enhancedTransactionDetails}
              transactionDetails={transactionDetails}
            />
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
                isScheduleExpired={isScheduleExpired}
                scheduleAge={scheduleAge}
              />

              {!isAlreadyExecuted && !isExecuted && !isApproved ? (
                <div className='mt-5 flex items-center justify-between'>
                  {error ? (
                    <Typography
                      variant='caption'
                      className='text-red-400 text-sm flex items-center gap-2'
                    >
                      <FiAlertTriangle className='h-4 w-4' />
                      {error}
                    </Typography>
                  ) : null}
                  {isScheduleExpired && !error ? (
                    <Typography
                      variant='caption'
                      className='text-white/60 text-sm flex items-center gap-2'
                    >
                      <FiAlertTriangle className='h-4 w-4' />
                      Cannot execute expired schedules
                    </Typography>
                  ) : null}
                  <div className='flex items-center gap-3 ml-auto'>
                    <Button
                      onClick={() => setIsDismissed(true)}
                      variant='outline'
                      className='bg-white/10 text-white border-white/20 hover:bg-white/20'
                    >
                      Dismiss
                    </Button>
                    {transactionBytes && messageId && onReject ? (
                      <Button
                        onClick={rejectTransaction}
                        variant='outline'
                        className='bg-white/10 text-white border-white/20 hover:bg-white/20'
                      >
                        <FiX className='h-4 w-4 mr-2' />
                        Decline
                      </Button>
                    ) : null}
                    {!isScheduleExpired ? (
                      <Button
                        onClick={approveTransaction}
                        disabled={isApproving || isExecuted || isApproved}
                        variant='default'
                        className='bg-white text-blue-600 hover:bg-white/95'
                      >
                        {isApproving ? (
                          <>
                            <FiLoader className='h-4 w-4 mr-2 animate-spin' />
                            {(() => {
                              if (executionStatus === 'signing')
                                return 'Signing...';
                              if (executionStatus === 'submitting')
                                return 'Submitting...';
                              if (executionStatus === 'confirming')
                                return 'Confirming...';
                              return 'Processing...';
                            })()}
                          </>
                        ) : (
                          <>
                            <FiCheck className='h-4 w-4 mr-2' />
                            {walletConnected
                              ? 'Approve in Wallet'
                              : 'Approve Transaction'}
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
