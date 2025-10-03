import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-medium font-mono w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-[#5599fe]/20 bg-[#5599fe]/10 text-[#5599fe] dark:bg-[#5599fe]/20 dark:text-[#5599fe] [a&]:hover:bg-[#5599fe]/20 dark:[a&]:hover:bg-[#5599fe]/30',
        secondary:
          'border-white/10 bg-white/5 backdrop-blur-sm text-gray-700 dark:text-gray-300 [a&]:hover:bg-white/10',
        destructive:
          'border-red-500/20 bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 [a&]:hover:bg-red-500/20',
        outline: 'border-current/20 text-foreground [a&]:hover:bg-white/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      data-slot='badge'
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
