import React from 'react';
import { FiArrowRight, FiHash } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { TransactionSection } from './CommonFields';
import { TransactionTransfer, TokenTransfer, AirdropData } from './types';
import { formatTokenAmount } from '../../../hooks/useTokenInfo';

interface HbarTransfersSectionProps {
  transfers: TransactionTransfer[];
}

export const HbarTransfersSection: React.FC<HbarTransfersSectionProps> = ({
  transfers,
}) => (
  <TransactionSection title={`HBAR Transfers (${transfers.length})`}>
    {transfers.map((transfer, idx) => (
      <div
        key={`transfer-${idx}`}
        className={cn(
          'flex justify-between items-center py-2.5 px-4 transition-colors',
          idx !== transfers.length - 1 &&
            'border-b border-gray-200 dark:border-gray-700',
          idx % 2 === 0 && 'bg-gray-50 dark:bg-gray-800'
        )}
      >
        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          {transfer.accountId}
        </span>
        <span
          className={cn(
            'text-sm font-semibold px-2 py-0.5 rounded',
            transfer.amount >= 0
              ? 'text-white bg-white/10'
              : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          )}
        >
          {transfer.amount >= 0 ? '+' : ''}
          {transfer.amount} ℏ
        </span>
      </div>
    ))}
  </TransactionSection>
);

interface TokenTransfersSectionProps {
  tokenTransfers: TokenTransfer[];
  tokenInfoMap: Map<string, any>;
}

export const TokenTransfersSection: React.FC<TokenTransfersSectionProps> = ({
  tokenTransfers,
  tokenInfoMap,
}) => (
  <TransactionSection title={`Token Transfers (${tokenTransfers.length})`}>
    {tokenTransfers.map((transfer, idx) => {
      const tokenInfo = tokenInfoMap.get(transfer.tokenId);
      const formattedAmount =
        tokenInfo && !tokenInfo.loading
          ? formatTokenAmount(transfer.amount, tokenInfo.decimals)
          : transfer.amount.toString();
      const symbol = tokenInfo?.symbol || '';

      return (
        <div
          key={`token-${idx}`}
          className={cn(
            'flex justify-between items-center py-2.5 px-4 transition-colors',
            idx !== tokenTransfers.length - 1 &&
              'border-b border-gray-200 dark:border-gray-700',
            idx % 2 === 0 && 'bg-gray-50 dark:bg-gray-800'
          )}
        >
          <div className='flex items-center gap-2 text-sm'>
            <span className='font-medium text-gray-700 dark:text-gray-300'>
              {transfer.tokenId}
              {symbol && <span className='text-gray-500 ml-1'>({symbol})</span>}
            </span>
            <FiArrowRight className='h-3 w-3 text-gray-400' />
            <span className='text-gray-600 dark:text-gray-400'>
              {transfer.accountId}
            </span>
          </div>
          <span
            className={cn(
              'text-sm font-semibold px-2 py-0.5 rounded',
              transfer.amount >= 0
                ? 'text-white bg-white/10'
                : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
            )}
          >
            {transfer.amount >= 0 ? '+' : ''}
            {formattedAmount} {symbol}
          </span>
        </div>
      );
    })}
  </TransactionSection>
);

interface AirdropSectionProps {
  airdropData: AirdropData;
  tokenInfoMap: Map<string, any>;
}

export const AirdropSection: React.FC<AirdropSectionProps> = ({
  airdropData,
  tokenInfoMap,
}) => (
  <TransactionSection title='Token Airdrop Details'>
    {airdropData.tokenTransfers?.map((tokenTransfer, idx) => {
      const tokenInfo = tokenInfoMap.get(tokenTransfer.tokenId);
      const symbol = tokenInfo?.symbol || '';
      const tokenName = tokenInfo?.name || '';

      return (
        <div
          key={`airdrop-${idx}`}
          className='border-b border-gray-200 dark:border-gray-700 last:border-b-0'
        >
          <div className='p-3 bg-gray-50 dark:bg-gray-900/50'>
            <div className='flex items-center gap-2'>
              <FiHash className='h-3.5 w-3.5 text-brand-blue' />
              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                Token: {tokenTransfer.tokenId}
                {(tokenName || symbol) && (
                  <span className='text-gray-500 ml-1'>
                    ({tokenName}
                    {tokenName && symbol ? ' - ' : ''}
                    {symbol})
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className='divide-y divide-gray-200 dark:divide-gray-700'>
            {tokenTransfer.transfers.map((transfer, transferIdx) => {
              const formattedAmount =
                tokenInfo && !tokenInfo.loading
                  ? formatTokenAmount(transfer.amount, tokenInfo.decimals)
                  : transfer.amount;

              return (
                <div
                  key={`transfer-${transferIdx}`}
                  className='flex justify-between items-center py-2.5 px-4'
                >
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    {transfer.accountId}
                  </span>
                  <span className='text-sm font-semibold text-white bg-white/10 px-2 py-0.5 rounded'>
                    +{formattedAmount} {symbol || 'tokens'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </TransactionSection>
);
