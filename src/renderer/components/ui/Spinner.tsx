import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'accent' | 'white' | 'current';
  center?: boolean;
  srText?: string;
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const colorClasses = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  white: 'text-white',
  current: 'text-current',
};

/**
 * Spinner component for loading states
 * @param props - Spinner props including size, color, and centering options
 * @returns Animated spinner with screen reader support
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  center = false,
  srText = 'Loading...',
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}) => {
  const spinner = (
    <svg
      className={cn(
        'inline-block animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      role='status'
      aria-label={ariaLabel}
      {...props}
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
      <span className='sr-only'>{srText}</span>
    </svg>
  );

  if (center) {
    return (
      <div
        className='flex justify-center items-center'
        data-testid='spinner-container'
      >
        {spinner}
      </div>
    );
  }

  return spinner;
};
