import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { HiCheck, HiClipboard } from 'react-icons/hi2';
import Typography from './Typography';

interface CopyFieldProps {
  label?: string;
  value: string;
  className?: string;
}

/**
 * Copy field component with integrated copy-to-clipboard functionality
 */
export const CopyField: React.FC<CopyFieldProps> = ({
  label,
  value,
  className = '',
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {}
  };

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Typography variant='caption' className='text-muted-foreground' noMargin>
          {label}
        </Typography>
      )}
      <div className='flex items-center gap-2'>
        <code className='flex-1 px-3 py-2 bg-muted rounded text-sm font-mono'>
          {value}
        </code>
        <button
          type='button'
          onClick={copyToClipboard}
          className={cn(
            'p-2 rounded transition-all duration-200',
            isCopied
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground'
          )}
        >
          {isCopied ? (
            <HiCheck className='h-4 w-4' />
          ) : (
            <HiClipboard className='h-4 w-4' />
          )}
        </button>
      </div>
    </div>
  );
};

export default CopyField;