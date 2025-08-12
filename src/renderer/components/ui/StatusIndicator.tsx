import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  status?: 'online' | 'offline' | 'connecting' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
  tooltip?: string;
}

const statusClasses = {
  online: 'bg-accent',
  offline: 'bg-hedera-smoke-400',
  connecting: 'bg-primary animate-pulse',
  error: 'bg-danger',
  warning: 'bg-yellow-500',
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const labelPositionClasses = {
  left: 'flex-row-reverse',
  right: 'flex-row',
  top: 'flex-col-reverse',
  bottom: 'flex-col',
};

/**
 * Status indicator component for showing connection states
 * @param props - StatusIndicator props including status, size, label, and positioning
 * @returns Styled status indicator with optional label
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status = 'offline',
  size = 'md',
  label,
  labelPosition = 'right',
  tooltip,
  className,
  'aria-label': ariaLabel,
  ...props
}) => {
  const indicator = (
    <div
      className={cn('rounded-full', statusClasses[status], sizeClasses[size])}
      role='status'
      aria-live='polite'
      aria-label={ariaLabel || `Status: ${status}`}
      title={tooltip}
      data-testid='status-indicator'
    />
  );

  if (label) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2',
          labelPositionClasses[labelPosition],
          className
        )}
        data-testid='status-container'
        {...props}
      >
        {indicator}
        <span className='text-sm text-gray-700 dark:text-gray-300'>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className={className} data-testid='status-container' {...props}>
      {indicator}
    </div>
  );
};
