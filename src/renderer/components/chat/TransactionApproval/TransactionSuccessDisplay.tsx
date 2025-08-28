import React from 'react';
import Typography from '../../ui/Typography';
import { FiCheckCircle } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { type ParsedTransaction } from '../../../types/transaction';
import { TransactionDetails } from '../TransactionDetails';

interface TransactionSuccessDisplayProps {
  executedTransactionId: string | null;
  network: string;
  isLoadingEnhancedDetails: boolean;
  enhancedTransactionDetails: ParsedTransaction | null;
  transactionDetails: ParsedTransaction | null;
}

/**
 * Displays the success state of an executed transaction with details and link to explorer
 */
export const TransactionSuccessDisplay: React.FC<TransactionSuccessDisplayProps> = ({
  executedTransactionId,
  network,
  isLoadingEnhancedDetails,
  enhancedTransactionDetails,
  transactionDetails,
}) => {
  return (
    <div className='relative'>
      <div className='relative bg-black/20 rounded-xl border border-white/10 p-5'>
        {/* Header Section */}
        <div className='flex items-start gap-3'>
          <div
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-lg',
              'bg-white/10'
            )}
          >
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
                          ? `https://hashscan.io/testnet/transaction/${executedTransactionId}`
                          : `https://hashscan.io/transaction/${executedTransactionId}`
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

        {isLoadingEnhancedDetails ? (
          <div className='mt-5 flex items-center justify-center py-6'>
            <div className='flex flex-col items-center gap-3'>
              <div className='relative'>
                <div className='w-10 h-10 border-3 border-white/20 rounded-full' />
                <div className='absolute top-0 w-10 h-10 border-3 border-white rounded-full border-t-transparent animate-spin' />
              </div>
              <Typography
                variant='caption'
                className='text-white text-sm'
              >
                Loading transaction details...
              </Typography>
            </div>
          </div>
        ) : null}

        {(enhancedTransactionDetails || transactionDetails) ? (
          <div className='mt-4'>
            {(() => {
              const detailsToShow = enhancedTransactionDetails || transactionDetails;
              const entityId =
                (detailsToShow.details as any)?.createdTokenId ||
                (detailsToShow.details as any)?.entityId;

              const formattedTransfers = Array.isArray(
                detailsToShow.transfers
              )
                ? detailsToShow.transfers.map(
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
                detailsToShow.tokenTransfers
              )
                ? detailsToShow.tokenTransfers.map(
                    (tokenTransfer) => ({
                      tokenId: tokenTransfer.tokenId,
                      accountId: tokenTransfer.accountId,
                      amount: tokenTransfer.amount,
                    })
                  )
                : [];

              return (
                <TransactionDetails
                  {...detailsToShow}
                  humanReadableType={
                    detailsToShow.humanReadableType || ''
                  }
                  transfers={formattedTransfers}
                  tokenTransfers={formattedTokenTransfers}
                  executedTransactionEntityId={entityId}
                  executedTransactionType={
                    detailsToShow.type
                  }
                  network={network}
                  hideHeader={true}
                  variant='embedded'
                  className='[&>div]:!bg-transparent [&>div]:!border-0 [&>div]:!shadow-none [&>div]:!p-0 [&_table]:!bg-transparent [&_table]:!border-0 [&_thead]:!border-b [&_thead]:!border-white/20 [&_th]:!bg-transparent [&_th]:!text-white/90 [&_th]:!font-medium [&_th]:!text-xs [&_th]:!uppercase [&_th]:!tracking-wider [&_th]:!border-0 [&_th]:!pb-2 [&_td]:!text-white [&_td]:!text-sm [&_td]:!border-0 [&_td]:!py-2 [&_tr]:!border-0 [&_tbody_tr]:!border-b [&_tbody_tr]:!border-white/10 [&_tbody_tr:last-child]:!border-0 [&_tr:hover]:!bg-white/5 [&_.text-gray-500]:!text-white/90 [&_.text-gray-600]:!text-white [&_.text-gray-700]:!text-white [&_.bg-gray-50]:!bg-transparent [&_.bg-gray-100]:!bg-transparent [&_.bg-white]:!bg-transparent [&_.border-gray-200]:!border-white/20 [&_.shadow-sm]:!shadow-none'
                />
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
};