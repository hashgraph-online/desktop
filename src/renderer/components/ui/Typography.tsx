import React from 'react';
import { cn } from '../../lib/utils';
import { gradients } from '../../lib/styles';

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline';

export type TypographyProps = {
  variant: TypographyVariant;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  gradient?: boolean;
  color?:
    | 'default'
    | 'muted'
    | 'purple'
    | 'blue'
    | 'green'
    | 'secondary'
    | 'white';
  noMargin?: boolean;
};

const Typography: React.FC<
  TypographyProps & React.HTMLAttributes<HTMLElement>
> = ({
  variant,
  children,
  className = '',
  as,
  gradient = false,
  color = 'default',
  noMargin = false,
  ...rest
}) => {
  const Component = as || getComponent(variant);

  const variantClasses: Record<TypographyVariant, string> = {
    h1: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight',
    h2: 'text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight',
    h3: 'text-base sm:text-lg md:text-xl font-bold',
    h4: 'text-sm sm:text-base md:text-lg font-bold',
    h5: 'text-base sm:text-lg md:text-xl font-medium',
    h6: 'text-sm sm:text-base md:text-lg font-medium',
    subtitle1: 'text-sm sm:text-base md:text-lg font-semibold',
    subtitle2: 'text-xs sm:text-sm md:text-base font-semibold',
    body1: 'text-xs sm:text-sm md:text-base font-normal',
    body2: 'text-xs sm:text-sm font-normal',
    caption: 'text-xs font-medium',
    overline: 'text-xs font-medium uppercase tracking-widest font-mono',
  };

  const colorClasses = gradient
    ? gradients.text
    : {
        default: 'text-gray-900 dark:text-white',
        muted: 'text-gray-600 dark:text-gray-400',
        purple: 'text-[#a679f0]',
        blue: 'text-[#5599fe]',
        green: 'text-[#48df7b]',
        secondary: 'text-gray-600 dark:text-gray-400',
        white: 'text-white',
      }[color];

  return (
    <Component
      className={cn(
        variantClasses[variant],
        gradient ? colorClasses : colorClasses,
        noMargin && 'm-0',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};

/**
 * Maps typography variants to their corresponding HTML element types.
 * Ensures semantic HTML usage based on the content type.
 *
 * @param variant - The typography variant to map to an HTML element
 * @returns The appropriate React element type for the given variant
 */
function getComponent(variant: TypographyVariant): React.ElementType {
  switch (variant) {
    case 'h1':
      return 'h1';
    case 'h2':
      return 'h2';
    case 'h3':
      return 'h3';
    case 'h4':
      return 'h4';
    case 'h5':
      return 'h5';
    case 'h6':
      return 'h6';
    case 'subtitle1':
    case 'subtitle2':
      return 'p';
    case 'body1':
    case 'body2':
      return 'p';
    case 'caption':
      return 'span';
    case 'overline':
      return 'span';
    default:
      return 'span';
  }
}

export default Typography;
