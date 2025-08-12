import React from 'react';
import Typography from '../ui/Typography';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  message: string;
  percent: number;
  stage?: string;
}

/**
 * ProgressBar component for profile registration progress
 * Follows the moonscape pattern for progress tracking
 */
export function ProgressBar({ message, percent, stage }: ProgressBarProps) {
  if (!message && percent === 0) {
    return null;
  }

  const getStageIcon = () => {
    if (percent === 100) {
      return <CheckCircle className='h-4 w-4 text-green-600' />;
    } else if (stage === 'failed' || stage === 'error') {
      return <AlertCircle className='h-4 w-4 text-red-600' />;
    } else {
      return <Clock className='h-4 w-4 text-blue-600' />;
    }
  };

  const getProgressColor = () => {
    if (percent === 100) return 'bg-green-600';
    if (stage === 'failed' || stage === 'error') return 'bg-red-600';
    return 'bg-gradient-to-r from-purple-600 to-orange-500';
  };

  return (
    <div className='space-y-3 p-4 bg-muted/20 rounded-lg border'>
      <div className='flex items-center gap-2'>
        {getStageIcon()}
        <Typography variant='h3' className='text-sm font-medium'>
          Registration Progress
        </Typography>
      </div>

      <div className='space-y-2'>
        <div className='flex justify-between items-center'>
          <Typography variant='body2' className='text-sm text-muted-foreground'>
            {message}
          </Typography>
          <Typography variant='body2' className='text-sm font-medium'>
            {percent}%
          </Typography>
        </div>

        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-300 ease-in-out',
              getProgressColor()
            )}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>

        {stage && (
          <Typography
            variant='caption'
            className='text-xs text-muted-foreground capitalize'
          >
            Stage: {stage.replace('_', ' ')}
          </Typography>
        )}
      </div>
    </div>
  );
}
