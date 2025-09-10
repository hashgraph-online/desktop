jest.mock('../../../../src/renderer/lib/utils', () => ({
  cn: (...classes: string[]) => classes.join(' '),
}));

jest.mock('@radix-ui/react-slot', () => ({
  Slot: ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': 'slot', ...props }, children),
}));

jest.mock('class-variance-authority', () => ({
  cva: jest.fn((base, options) => {
    const mockFn = jest.fn((props: any) => {
      const classes = [base];
      if (options?.variants?.variant && props?.variant) {
        classes.push(`variant-${props.variant}`);
      }
      return classes.join(' ');
    });
    return mockFn;
  }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Badge,
  badgeVariants,
} from '../../../../src/renderer/components/ui/badge';

describe('Badge Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with default variant', () => {
      render(<Badge>Default Badge</Badge>);

      const badge = screen.getByText('Default Badge');
      expect(badge).toBeInTheDocument();
      expect(badge.tagName).toBe('SPAN');
      expect(badge).toHaveAttribute('data-slot', 'badge');
    });

    test('renders with custom content', () => {
      render(<Badge>Custom Content</Badge>);

      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    test('renders with emoji content', () => {
      render(<Badge>🚀</Badge>);

      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    test('renders with empty content', () => {
      render(<Badge></Badge>);

      const badge = screen.getByTestId('badge');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    test('renders with secondary variant', () => {
      render(<Badge variant='secondary'>Secondary Badge</Badge>);

      const badge = screen.getByText('Secondary Badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('variant-secondary');
    });

    test('renders with destructive variant', () => {
      render(<Badge variant='destructive'>Destructive Badge</Badge>);

      const badge = screen.getByText('Destructive Badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('variant-destructive');
    });

    test('renders with outline variant', () => {
      render(<Badge variant='outline'>Outline Badge</Badge>);

      const badge = screen.getByText('Outline Badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('variant-outline');
    });

    test('renders with default variant when no variant specified', () => {
      render(<Badge>Default Badge</Badge>);

      const badge = screen.getByText('Default Badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('inline-flex');
    });
  });

  describe('Styling and Classes', () => {
    test('applies custom className', () => {
      render(<Badge className='custom-class'>Custom Class Badge</Badge>);

      const badge = screen.getByText('Custom Class Badge');
      expect(badge).toHaveClass('custom-class');
    });

    test('merges custom className with variant classes', () => {
      render(
        <Badge variant='secondary' className='custom-class'>
          Merged Classes Badge
        </Badge>
      );

      const badge = screen.getByText('Merged Classes Badge');
      expect(badge).toHaveClass('variant-secondary');
      expect(badge).toHaveClass('custom-class');
    });

    test('includes base classes', () => {
      render(<Badge>Base Classes Badge</Badge>);

      const badge = screen.getByText('Base Classes Badge');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('justify-center');
      expect(badge).toHaveClass('rounded-lg');
    });

    test('includes responsive classes', () => {
      render(<Badge>Responsive Badge</Badge>);

      const badge = screen.getByText('Responsive Badge');
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('py-1');
      expect(badge).toHaveClass('text-xs');
    });
  });

  describe('Slot Functionality', () => {
    test('renders as span by default', () => {
      render(<Badge>Default Span</Badge>);

      const badge = screen.getByText('Default Span');
      expect(badge.tagName).toBe('SPAN');
    });

    test('renders as Slot when asChild is true', () => {
      render(<Badge asChild>Slot Content</Badge>);

      const slot = screen.getByTestId('slot');
      expect(slot).toBeInTheDocument();
      expect(slot).toHaveTextContent('Slot Content');
    });

    test('passes through props to Slot', () => {
      render(
        <Badge asChild data-custom='test-value'>
          Slot Props
        </Badge>
      );

      const slot = screen.getByTestId('slot');
      expect(slot).toHaveAttribute('data-custom', 'test-value');
    });
  });

  describe('Accessibility', () => {
    test('has proper data attribute', () => {
      render(<Badge>Accessible Badge</Badge>);

      const badge = screen.getByText('Accessible Badge');
      expect(badge).toHaveAttribute('data-slot', 'badge');
    });

    test('supports aria attributes', () => {
      render(<Badge aria-label='Status badge'>Status</Badge>);

      const badge = screen.getByLabelText('Status badge');
      expect(badge).toBeInTheDocument();
    });

    test('supports role attribute', () => {
      render(<Badge role='status'>Status Badge</Badge>);

      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Content Types', () => {
    test('renders with icon content', () => {
      render(<Badge>⭐ Star Badge</Badge>);

      expect(screen.getByText('⭐ Star Badge')).toBeInTheDocument();
    });

    test('renders with numeric content', () => {
      render(<Badge>42</Badge>);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    test('renders with special characters', () => {
      render(<Badge>Status: ✓</Badge>);

      expect(screen.getByText('Status: ✓')).toBeInTheDocument();
    });

    test('renders with HTML entities', () => {
      render(<Badge>&amp; Badge</Badge>);

      expect(screen.getByText('& Badge')).toBeInTheDocument();
    });
  });

  describe('Props Forwarding', () => {
    test('forwards HTML span props', () => {
      render(<Badge title='Tooltip text'>Tooltip Badge</Badge>);

      const badge = screen.getByTitle('Tooltip text');
      expect(badge).toBeInTheDocument();
    });

    test('forwards id prop', () => {
      render(<Badge id='test-badge'>ID Badge</Badge>);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('id', 'test-badge');
    });

    test('forwards data attributes', () => {
      render(<Badge data-testid='custom-badge'>Data Attribute Badge</Badge>);

      expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined variant', () => {
      render(<Badge variant={undefined}>Undefined Variant</Badge>);

      const badge = screen.getByText('Undefined Variant');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('inline-flex');
    });

    test('handles null className', () => {
      render(<Badge className={null}>Null ClassName</Badge>);

      const badge = screen.getByText('Null ClassName');
      expect(badge).toBeInTheDocument();
    });

    test('handles undefined className', () => {
      render(<Badge className={undefined}>Undefined ClassName</Badge>);

      const badge = screen.getByText('Undefined ClassName');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('badgeVariants Function', () => {
    test('badgeVariants is exported', () => {
      expect(badgeVariants).toBeDefined();
      expect(typeof badgeVariants).toBe('function');
    });

    test('badgeVariants returns class string', () => {
      const result = badgeVariants({ variant: 'default' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('badgeVariants handles different variants', () => {
      const defaultResult = badgeVariants({ variant: 'default' });
      const secondaryResult = badgeVariants({ variant: 'secondary' });
      const destructiveResult = badgeVariants({ variant: 'destructive' });
      const outlineResult = badgeVariants({ variant: 'outline' });

      expect(defaultResult).not.toBe(secondaryResult);
      expect(secondaryResult).not.toBe(destructiveResult);
      expect(destructiveResult).not.toBe(outlineResult);
    });
  });

  describe('Integration Scenarios', () => {
    test('renders badge in complex layout', () => {
      render(
        <div>
          <h1>Title</h1>
          <Badge variant='secondary'>New</Badge>
          <p>Content</p>
          <Badge variant='destructive'>Error</Badge>
        </div>
      );

      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('renders multiple badges with different variants', () => {
      render(
        <div>
          <Badge variant='default'>Default</Badge>
          <Badge variant='secondary'>Secondary</Badge>
          <Badge variant='destructive'>Destructive</Badge>
          <Badge variant='outline'>Outline</Badge>
        </div>
      );

      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByText('Destructive')).toBeInTheDocument();
      expect(screen.getByText('Outline')).toBeInTheDocument();
    });

    test('badge with asChild renders children correctly', () => {
      render(
        <Badge asChild>
          <button>Button Badge</button>
        </Badge>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Button Badge');
    });
  });
});
