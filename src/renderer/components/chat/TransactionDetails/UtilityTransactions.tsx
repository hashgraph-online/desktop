import React from 'react';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  UtilPrngData,
  FreezeData,
} from './types';

export const UtilPrngSection: React.FC<{ utilPrng: UtilPrngData }> = ({
  utilPrng,
}) => (
  <TransactionSection title='Random Number Generation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Range' value={utilPrng.range} />
      {utilPrng.prngBytes && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            PRNG Bytes
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
            {utilPrng.prngBytes}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const FreezeSection: React.FC<{ freeze: FreezeData }> = ({ freeze }) => (
  <TransactionSection title='Network Freeze Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Start Time' value={freeze.startTime} />
      <FieldRow label='File ID' value={freeze.fileId} isMono />
      <FieldRow label='File Hash' value={freeze.fileHash} isMono />
    </div>
  </TransactionSection>
);