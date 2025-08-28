import React from 'react';
import Typography from '../../ui/Typography';
import { cn } from '../../../lib/utils';
import { TransactionTransfer } from './types';
import { getTransactionIcon } from './utils';

export const TransactionSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className='space-y-2'>
    <Typography
      variant='caption'
      className='font-medium text-gray-700 dark:text-gray-300'
    >
      {title}
    </Typography>
    <div className='bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm'>
      {children}
    </div>
  </div>
);

const formatCryptographicKey = (key: string): { formatted: string; isKey: boolean } => {
  const keyMatch = key.match(/^([A-Z0-9_]+):\s*([a-fA-F0-9]{32,})$/);
  if (keyMatch) {
    const [, algorithm, hexKey] = keyMatch;
    return {
      formatted: `${algorithm}: ${hexKey.substring(0, 8)}...${hexKey.substring(-8)}`,
      isKey: true
    };
  }
  return { formatted: key, isKey: false };
};

export const FieldRow: React.FC<{
  label: string;
  value: string | number | undefined;
  isLast?: boolean;
  isMono?: boolean;
}> = ({ label, value, isLast = false, isMono = false }) => {
  if (value === undefined || value === null || value === '') return null;

  const stringValue = typeof value === 'number' ? value.toLocaleString() : String(value);
  const { formatted, isKey } = isMono ? formatCryptographicKey(stringValue) : { formatted: stringValue, isKey: false };

  return (
    <div
      className={cn(
        'flex justify-between items-start py-2.5 px-4',
        !isLast && 'border-b border-gray-200 dark:border-gray-700'
      )}
    >
      <span className='text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0'>
        {label}
      </span>
      <div className='ml-4 text-right flex-1'>
        <span
          className={cn(
            'text-sm text-gray-600 dark:text-gray-400 break-all',
            isMono && 'font-mono text-xs',
            isKey && 'block'
          )}
          title={isKey ? stringValue : undefined}
        >
          {formatted}
        </span>
      </div>
    </div>
  );
};

export const TransactionSummary: React.FC<{
  type: string;
  humanReadableType: string;
  transfers: TransactionTransfer[];
  hideHeader?: boolean;
}> = ({ type, humanReadableType, transfers, hideHeader }) => {
  if (hideHeader) return null;

  const { icon: IconComponent, color } = getTransactionIcon(type);

  if (type === 'CRYPTOTRANSFER' && transfers.length > 0) {
    const positiveTransfers = transfers.filter((t) => t.amount > 0);
    const negativeTransfers = transfers.filter((t) => t.amount < 0);

    const sendersText = negativeTransfers
      .map((t) => `${t.accountId} (${Math.abs(t.amount)} ℏ)`)
      .join(', ');

    const receiversText = positiveTransfers
      .map((t) => `${t.accountId} (${t.amount} ℏ)`)
      .join(', ');

    return (
      <div className='flex items-start gap-2 mb-3'>
        <div
          className={`p-1.5 rounded-full bg-${color}/20 dark:bg-${color}/30 shadow-sm flex-shrink-0`}
        >
          <IconComponent className={`text-${color} h-4 w-4`} />
        </div>
        <Typography
          variant='body2'
          className='text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed'
        >
          Transfer of HBAR from {sendersText} to {receiversText}
        </Typography>
      </div>
    );
  }

  return (
    <div className='flex items-start gap-2 mb-3'>
      <div
        className={`p-1.5 rounded-full bg-${color}/20 dark:bg-${color}/30 shadow-sm flex-shrink-0`}
      >
        <IconComponent className={`text-${color} h-4 w-4`} />
      </div>
      <Typography
        variant='body2'
        className='text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed'
      >
        {humanReadableType}
      </Typography>
    </div>
  );
};