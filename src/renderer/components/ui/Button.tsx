import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transform active:scale-[0.98] touch-manipulation",
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-hgo-blue to-hgo-blue text-white shadow-lg shadow-hgo-blue/20 hover:shadow-xl hover:shadow-hgo-blue/30 hover:scale-[1.02] focus-visible:ring-hgo-blue/50',
        gradient:
          'bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green text-white shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] focus-visible:ring-hgo-purple/50',
        destructive:
          'bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg focus-visible:ring-red-500/50',
        outline:
          'border border-white/10 bg-white/5 dark:bg-white/5 backdrop-blur-sm shadow-sm hover:bg-white/10 dark:hover:bg-white/10 hover:border-white/20 text-gray-700 dark:text-gray-300',
        secondary:
          'bg-white/10 dark:bg-white/5 backdrop-blur-sm text-gray-700 dark:text-gray-300 shadow-sm hover:bg-white/20 dark:hover:bg-white/10 border border-white/10',
        ghost:
          'hover:bg-white/10 dark:hover:bg-white/10 hover:backdrop-blur-sm text-gray-600 dark:text-gray-400',
        link: 'text-hgo-blue underline-offset-4 hover:underline hover:text-hgo-purple',
      },
      size: {
        sm: 'px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-xs',
        default: 'px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm',
        lg: 'px-3.5 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base',
        xl: 'h-14 px-10 py-4 text-xl',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * A flexible button component with multiple variants and sizes.
 * Supports both button elements and polymorphic rendering via Slot for composition.
 *
 * @param className - Additional CSS classes to apply to the button
 * @param variant - Button style variant (default, gradient, destructive, outline, secondary, ghost, link)
 * @param size - Button size (default, sm, lg, xl, icon)
 * @param asChild - When true, renders as Slot component for polymorphic composition
 * @param props - Additional HTML button element props
 * @returns React button component with applied styles and behaviors
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
