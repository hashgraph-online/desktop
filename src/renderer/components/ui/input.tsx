import * as React from 'react';

import { cn } from '../../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'flex h-10 w-full min-w-0 rounded-xl border bg-white/50 dark:bg-white/5 backdrop-blur-sm',
        'border-gray-200/50 dark:border-white/[0.06] px-4 py-2 text-sm shadow-sm transition-all outline-none',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-gray-300/50 dark:hover:border-white/10',
        'focus:border-[#5599fe]/50 focus:ring-2 focus:ring-[#5599fe]/20 focus:shadow-[#5599fe]/10',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'min-h-[44px] touch-manipulation font-mono',
        className
      )}
      {...props}
    />
  );
}

export { Input };
