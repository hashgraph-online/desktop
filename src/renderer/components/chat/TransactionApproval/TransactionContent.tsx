import React from 'react';
import { format } from 'date-fns';
import Typography from '../../ui/Typography';
import {
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
} from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { type ParsedTransaction } from '../../../types/transaction';
import { TransactionDetails } from '../TransactionDetails';

interface TransactionContentProps {
  isLoadingDetails: boolean;
  transactionDetails: ParsedTransaction | null;
  expirationTime: string | null;
  description: string;
  scheduleId: string;
  network: string;
  isAlreadyExecuted?: boolean;
  executedTimestamp?: string | null;
  notes?: string[];
  isScheduleExpired?: boolean;
  scheduleAge?: number | null;
}

const getValidAmount = (amount: string | number | unknown): number => {
  if (typeof amount === 'string') {
    return parseFloat(amount.replace(/[^\d.-]/g, ''));
  }
  if (typeof amount === 'number') {
    return amount;
  }
  return 0;
};

/**
 * Displays the main content of a transaction approval, including header, details, and transaction information
 */
export const TransactionContent: React.FC<TransactionContentProps> = ({
  isLoadingDetails,
  transactionDetails,
  expirationTime,
  description,
  scheduleId,
  network,
  isAlreadyExecuted,
  executedTimestamp,
  notes,
  isScheduleExpired,
  scheduleAge,
}) => {
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
          <div
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-lg',
              isScheduleExpired
                ? 'bg-white/5 border border-white/20'
                : 'bg-white/10'
            )}
          >
            {(() => {
              if (isAlreadyExecuted) {
                return <FiCheckCircle className='text-white h-5 w-5' />;
              }
              if (isScheduleExpired) {
                return <FiAlertTriangle className='text-white/60 h-5 w-5' />;
              }
              return <FiClock className='text-white h-5 w-5' />;
            })()}
            {!isAlreadyExecuted && !isScheduleExpired && !isLoadingDetails ? (
              <span className='absolute -top-1 -right-1 h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75'></span>
                <span className='relative inline-flex rounded-full h-2 w-2 bg-yellow-400'></span>
              </span>
            ) : null}
          </div>

          <div className='flex-1'>
            <Typography
              variant='h6'
              className='font-semibold text-white leading-tight'
            >
              {(() => {
                if (isAlreadyExecuted) return 'Transaction Executed';
                if (isScheduleExpired) return 'Transaction Expired';
                return 'Transaction Approval Required';
              })()}
            </Typography>

            <Typography
              variant='body2'
              className='text-white/90 mt-1 leading-relaxed'
            >
              {(() => {
                if (isAlreadyExecuted) {
                  return `Executed ${
                    executedTimestamp
                      ? formatExecutedAt(executedTimestamp)
                      : 'successfully'
                  }`;
                }
                if (isScheduleExpired) {
                  return `This scheduled transaction expired after ${scheduleAge}`;
                }
                return description ||
                  transactionDetails?.humanReadableType ||
                  'Review and approve the transaction details below';
              })()}
            </Typography>

            {isScheduleExpired && scheduleId ? (
              <Typography
                variant='caption'
                className='text-white/60 mt-2 block'
              >
                <FiInfo className='inline-block mr-1 h-3 w-3' />
                Schedule ID {scheduleId} exists on the network but can no longer
                be executed
              </Typography>
            ) : null}

            {/* Notes Section */}
            {notes && notes.length > 0 ? (
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
            ) : null}
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

            const tokenTransfers = Array.isArray(
              transactionDetails.tokenTransfers
            )
              ? transactionDetails.tokenTransfers
              : [];

            const tokenTransfersForDisplay = tokenTransfers.map(
              (tokenTransfer) => ({
                tokenId: tokenTransfer.tokenId,
                accountId: tokenTransfer.accountId,
                amount: getValidAmount(tokenTransfer.amount),
              })
            );

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