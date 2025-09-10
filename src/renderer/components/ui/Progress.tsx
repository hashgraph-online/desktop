import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'purple-orange' | 'hgo' | 'success' | 'warning' | 'error';
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}

/**
 * Progress bar component with multiple variants and animations
 */
export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showValue = false,
  animated = true,
  className
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    default: 'bg-blue-500',
    gradient: 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600',
    'purple-orange': 'bg-gradient-to-r from-purple-600 to-orange-500',
    hgo: 'bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green',
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    error: 'bg-red-600'
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-200',
            variantClasses[variant]
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={animated ? { duration: 0.5, ease: 'easeOut' } : { duration: 0 }}
        />
      </div>
      {showValue && (
        <div className="flex justify-between items-center mt-1 text-xs text-gray-600 dark:text-gray-400">
          <span>{Math.round(percentage)}%</span>
          <span>{value} / {max}</span>
        </div>
      )}
    </div>
  );
};
