import React from 'react';
import Typography from '../ui/Typography';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Progress } from '../ui/Progress';

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

  const getProgressVariant = () => {
    if (percent === 100) return 'success';
    if (stage === 'failed' || stage === 'error') return 'error';
    return 'purple-orange';
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

        <Progress
          value={percent}
          variant={getProgressVariant()}
          size="md"
          animated={true}
        />

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
