import React, { useState } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/Button';
import { FiInfo, FiExternalLink, FiX } from 'react-icons/fi';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';

export const Disclaimer: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <Alert className='border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 relative'>
      <FiInfo className='h-4 w-4 text-gray-600 dark:text-gray-400' />
      <AlertDescription className='text-xs text-gray-600 dark:text-gray-400'>
        <div className='flex items-start justify-between gap-3'>
          <div className='pr-6'>
            <strong>Disclaimer:</strong> This AI assistant operates on the
            Hedera Hashgraph. Verify all details before approval — transactions
            are irreversible. This is not financial advice. Use at your own risk
            and never share private keys.
          </div>
          <div className='flex items-center gap-1'>
            <LegalDisclaimerModal>
              <Button
                variant='ghost'
                size='sm'
                className='h-auto p-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0'
              >
                Full Terms <FiExternalLink className='w-3 h-3 ml-1' />
              </Button>
            </LegalDisclaimerModal>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsVisible(false)}
              className='h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0'
              aria-label='Close disclaimer'
            >
              <FiX className='w-3.5 h-3.5' />
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
