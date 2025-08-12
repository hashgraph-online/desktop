import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiDollarSign,
  FiCheck,
  FiX,
  FiClock,
  FiAlertCircle,
} from 'react-icons/fi';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface QuoteProps {
  totalCostHbar: string;
  networkFee: string;
  serviceFee: string;
  validUntil: string;
  breakdown?: {
    transfers?: Array<{
      from: string;
      to: string;
      amount: string;
    }>;
  };
}

interface QuoteDisplayProps {
  quote: QuoteProps;
  onApprove?: () => void;
  onDecline?: () => void;
  isProcessing?: boolean;
}

/**
 * Displays a breakdown of costs for inscription quotes
 *
 * @param totalCostHbar - Total cost in HBAR
 * @param networkFee - Network fee portion
 * @param serviceFee - Service fee portion
 * @param className - Additional CSS classes
 */
const CostBreakdown: React.FC<{
  totalCostHbar: string;
  networkFee: string;
  serviceFee: string;
  className?: string;
}> = React.memo(({ totalCostHbar, networkFee, serviceFee, className }) => {
  return (
    <div
      className={cn('space-y-2', className)}
      role='table'
      aria-label='Cost breakdown'
    >
      <div className='flex items-center justify-between py-1' role='row'>
        <Typography variant='caption' color='muted' role='cell'>
          Network Fee
        </Typography>
        <Typography
          variant='caption'
          color='default'
          className='font-mono'
          role='cell'
        >
          {networkFee} HBAR
        </Typography>
      </div>

      <div className='flex items-center justify-between py-1' role='row'>
        <Typography variant='caption' color='muted' role='cell'>
          Service Fee
        </Typography>
        <Typography
          variant='caption'
          color='default'
          className='font-mono'
          role='cell'
        >
          {serviceFee} HBAR
        </Typography>
      </div>

      <div
        className='border-t border-white/20 dark:border-gray-700 pt-2'
        role='row'
      >
        <div className='flex items-center justify-between'>
          <Typography variant='body2' className='font-semibold' role='cell'>
            Total
          </Typography>
          <Typography
            variant='body2'
            className='font-bold font-mono text-green-400'
            role='cell'
            aria-label={`Total cost: ${totalCostHbar} HBAR`}
          >
            {totalCostHbar} HBAR
          </Typography>
        </div>
      </div>
    </div>
  );
});

/**
 * Main quote display component for inscription operations
 * Shows cost breakdown, countdown timer, and approval/decline actions
 *
 * @param quote - Quote object with cost and validity information
 * @param onApprove - Callback function when quote is approved
 * @param onDecline - Callback function when quote is declined
 * @param isProcessing - Whether the quote is currently being processed
 */
const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  onApprove,
  onDecline,
  isProcessing = false,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // Memoize the valid until timestamp to avoid recalculating
  const validUntilTimestamp = useMemo(
    () => new Date(quote.validUntil).getTime(),
    [quote.validUntil]
  );

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const remaining = validUntilTimestamp - now;

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
      } else {
        setIsExpired(false);
        setTimeRemaining(Math.ceil(remaining / 1000));
      }
    };

    calculateTimeRemaining();

    // Only update every second when not expired, reduce frequency when expired
    const interval = setInterval(
      calculateTimeRemaining,
      isExpired ? 5000 : 1000
    );

    return () => clearInterval(interval);
  }, [validUntilTimestamp, isExpired]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !isExpired && !isProcessing) {
        event.preventDefault();
        onApprove?.();
      } else if (event.key === 'Escape' && !isProcessing) {
        event.preventDefault();
        onDecline?.();
      }
    },
    [isExpired, isProcessing, onApprove, onDecline]
  );

  // Memoize formatted time to avoid recalculating on every render
  const formattedTime = useMemo(() => {
    if (isExpired) return 'Expired';
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [timeRemaining, isExpired]);

  // Memoize timer color class to avoid recalculating
  const timerColorClass = useMemo(() => {
    if (isExpired) return 'text-red-400';
    if (timeRemaining < 60) return 'text-orange-400';
    return 'text-gray-400';
  }, [isExpired, timeRemaining]);

  return (
    <div
      className='bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-4 mt-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/50'
      role='region'
      aria-label='Inscription quote'
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className='flex items-center gap-2 mb-3 flex-wrap'>
        <div className='flex items-center gap-2'>
          <FiDollarSign className='w-4 h-4 text-green-400' aria-hidden='true' />
          <Typography variant='subtitle2' className='font-semibold'>
            Inscription Quote
          </Typography>
        </div>

        <div className='flex items-center gap-1 ml-auto'>
          <FiClock
            className={cn('w-3 h-3', timerColorClass)}
            aria-hidden='true'
          />
          <Typography
            variant='caption'
            className={cn('font-mono min-w-[3rem]', timerColorClass)}
            aria-label={
              isExpired ? 'Quote expired' : `Time remaining: ${formattedTime}`
            }
            aria-live='polite'
          >
            {formattedTime}
          </Typography>
        </div>
      </div>

      <CostBreakdown
        totalCostHbar={quote.totalCostHbar}
        networkFee={quote.networkFee}
        serviceFee={quote.serviceFee}
        className='mb-4'
      />

      {isExpired && (
        <div
          className='flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md mb-3'
          role='alert'
          aria-live='assertive'
        >
          <FiAlertCircle
            className='w-4 h-4 text-red-400 flex-shrink-0'
            aria-hidden='true'
          />
          <Typography variant='caption' color='muted'>
            This quote has expired. Please request a new quote to proceed.
          </Typography>
        </div>
      )}

      <div className='flex flex-col sm:flex-row gap-2 mt-4'>
        <Button
          variant='default'
          size='sm'
          onClick={onApprove}
          disabled={isExpired || isProcessing}
          className='flex-1 min-h-[2.5rem] transition-all duration-200'
          aria-describedby={isExpired ? 'quote-expired' : undefined}
        >
          <FiCheck className='w-4 h-4' aria-hidden='true' />
          {isProcessing ? 'Processing...' : 'Approve Quote'}
        </Button>

        <Button
          variant='outline'
          size='sm'
          onClick={onDecline}
          disabled={isProcessing}
          className='flex-1 min-h-[2.5rem] transition-all duration-200'
        >
          <FiX className='w-4 h-4' aria-hidden='true' />
          Decline
        </Button>
      </div>

      {isExpired && (
        <div id='quote-expired' className='sr-only'>
          Quote has expired and cannot be approved
        </div>
      )}
    </div>
  );
};

export { QuoteDisplay, CostBreakdown };
export type { QuoteProps, QuoteDisplayProps };
