import { clsx } from 'clsx';
import { type FC, type ReactNode } from 'react';

const elementByVariant = {
  display: 'h1',
  title: 'h2',
  subtitle: 'h3',
  body: 'p'
} as const;

const variantClasses: Record<keyof typeof elementByVariant, string> = {
  display: 'text-4xl font-semibold tracking-tight text-hol-text-inverse',
  title: 'text-2xl font-semibold text-hol-text-inverse',
  subtitle: 'text-xl font-medium text-hol-text-muted',
  body: 'text-base font-normal text-hol-text-muted'
};

export interface TypographyProps {
  readonly variant: keyof typeof elementByVariant;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Renders semantic typography elements with consistent Tailwind typography tokens.
 */
export const Typography: FC<TypographyProps> = ({ variant, children, className }) => {
  const Element = elementByVariant[variant];

  return <Element className={clsx(variantClasses[variant], className)}>{children}</Element>;
};
