import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  buttonVariants,
} from '../../../../src/renderer/components/ui/Button';

jest.mock('../../../../src/renderer/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('class-variance-authority', () => ({
  cva: jest.fn((base, config) => {
    return (props: any) => {
      const classes = [base];

      if (props.variant && config.variants.variant[props.variant]) {
        classes.push(config.variants.variant[props.variant]);
      } else if (config.defaultVariants?.variant) {
        classes.push(config.variants.variant[config.defaultVariants.variant]);
      }

      if (props.size && config.variants.size[props.size]) {
        classes.push(config.variants.size[props.size]);
      } else if (config.defaultVariants?.size) {
        classes.push(config.variants.size[config.defaultVariants.size]);
      }

      if (props.className) {
        classes.push(props.className);
      }

      return classes.join(' ');
    };
  }),
}));

jest.mock('@radix-ui/react-slot', () => ({
  Slot: React.forwardRef(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='slot' {...props}>
      {children}
    </div>
  )),
}));

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('should render button with default props', () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-slot', 'button');
    });

    test('should render with custom className', () => {
      render(<Button className='custom-class'>Click me</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    test('should render with custom props', () => {
      render(
        <Button type='submit' disabled>
          Submit
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toBeDisabled();
    });

    test('should render children correctly', () => {
      render(
        <Button>
          <span>Icon</span>
          Button Text
        </Button>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Button Text')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    test('should render default variant', () => {
      render(<Button variant='default'>Default</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'bg-gradient-to-r',
        'from-hgo-blue',
        'to-hgo-blue'
      );
    });

    test('should render gradient variant', () => {
      render(<Button variant='gradient'>Gradient</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'bg-gradient-to-r',
        'from-hgo-purple',
        'via-hgo-blue',
        'to-hgo-green'
      );
    });

    test('should render destructive variant', () => {
      render(<Button variant='destructive'>Delete</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-600', 'text-white');
    });

    test('should render outline variant', () => {
      render(<Button variant='outline'>Outline</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'border-white/10', 'bg-white/5');
    });

    test('should render secondary variant', () => {
      render(<Button variant='secondary'>Secondary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-white/10', 'backdrop-blur-sm');
    });

    test('should render ghost variant', () => {
      render(<Button variant='ghost'>Ghost</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-white/10');
    });

    test('should render link variant', () => {
      render(<Button variant='link'>Link</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-hgo-blue', 'underline-offset-4');
    });
  });

  describe('Sizes', () => {
    test('should render small size', () => {
      render(<Button size='sm'>Small</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs');
    });

    test('should render default size', () => {
      render(<Button size='default'>Default</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-xs');
    });

    test('should render large size', () => {
      render(<Button size='lg'>Large</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3.5', 'py-2', 'text-sm');
    });

    test('should render extra large size', () => {
      render(<Button size='xl'>XL</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-14', 'px-10', 'py-4', 'text-xl');
    });

    test('should render icon size', () => {
      render(<Button size='icon'>🎵</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('size-10');
    });
  });

  describe('Button Element', () => {
    test('should render as button when asChild is false', () => {
      render(<Button asChild={false}>Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-slot', 'button');
    });

    test('should render as button by default', () => {
      render(<Button>Default Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-slot', 'button');
    });
  });

  describe('Event Handling', () => {
    test('should handle click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('should not handle click when disabled', () => {
      const handleClick = jest.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });

    test('should handle keyboard events', () => {
      const handleKeyDown = jest.fn();
      render(<Button onKeyDown={handleKeyDown}>Keyboard</Button>);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(handleKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Enter' })
      );
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(<Button aria-label='Custom label'>Button</Button>);

      const button = screen.getByRole('button', { name: /custom label/i });
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    test('should support aria-expanded', () => {
      render(<Button aria-expanded='true'>Expanded Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('should support aria-controls', () => {
      render(<Button aria-controls='menu'>Menu Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', 'menu');
    });
  });

  describe('buttonVariants', () => {
    test('should return base classes when no props provided', () => {
      const classes = buttonVariants({});
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('items-center');
      expect(classes).toContain('justify-center');
    });

    test('should include variant classes', () => {
      const classes = buttonVariants({ variant: 'destructive' });
      expect(classes).toContain('bg-red-600');
      expect(classes).toContain('text-white');
    });

    test('should include size classes', () => {
      const classes = buttonVariants({ size: 'lg' });
      expect(classes).toContain('px-3.5');
      expect(classes).toContain('py-2');
    });

    test('should include custom className', () => {
      const classes = buttonVariants({ className: 'custom-class' });
      expect(classes).toContain('custom-class');
    });

    test('should combine all variant options', () => {
      const classes = buttonVariants({
        variant: 'gradient',
        size: 'xl',
        className: 'additional-class',
      });

      expect(classes).toContain('bg-gradient-to-r');
      expect(classes).toContain('from-hgo-purple');
      expect(classes).toContain('h-14');
      expect(classes).toContain('px-10');
      expect(classes).toContain('additional-class');
    });
  });

  describe('Integration Scenarios', () => {
    test('should render complete button with all features', () => {
      const handleClick = jest.fn();
      render(
        <Button
          variant='gradient'
          size='lg'
          className='test-class'
          onClick={handleClick}
          aria-label='Test button'
        >
          <svg data-testid='icon' />
          Complete Button
        </Button>
      );

      const button = screen.getByRole('button', { name: /test button/i });
      const icon = screen.getByTestId('icon');

      expect(button).toHaveClass('test-class');
      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(icon).toBeInTheDocument();
      expect(screen.getByText('Complete Button')).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('should handle form submission', () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());
      render(
        <form onSubmit={handleSubmit}>
          <Button type='submit'>Submit Form</Button>
        </form>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    test('should work with React.forwardRef', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Ref Button</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.textContent).toBe('Ref Button');
    });
  });
});
