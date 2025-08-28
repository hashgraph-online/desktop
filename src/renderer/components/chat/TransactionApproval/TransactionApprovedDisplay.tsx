import React from 'react';
import Typography from '../../ui/Typography';
import { FiCheckCircle } from 'react-icons/fi';
import { cn } from '../../../lib/utils';

/**
 * Displays the approved but not yet executed state of a transaction
 */
export const TransactionApprovedDisplay: React.FC = () => {
  return (
    <div className='relative'>
      <div className='relative bg-black/20 rounded-xl border border-white/10 p-5'>
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
              Transaction Approved
            </Typography>

            <Typography
              variant='body2'
              className='text-white/90 mt-1 leading-relaxed'
            >
              The transaction has been successfully signed and is being
              processed.
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
};