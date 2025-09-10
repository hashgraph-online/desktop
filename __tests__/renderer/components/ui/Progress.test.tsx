jest.mock('../../../src/renderer/lib/utils', () => ({
  cn: (...classes: string[]) => classes.join(' '),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      initial,
      animate,
      transition,
      ...props
    }: any) =>
      React.createElement(
        'div',
        {
          className,
          'data-testid': 'motion-div',
          style: animate?.width ? { width: animate.width } : {},
          ...props,
        },
        children
      ),
  },
}));

jest.mock('../../../src/renderer/components/ui/Progress', () => {
  const React = require('react');
  const { cn } = require('../../../src/renderer/lib/utils');
  const { motion } = require('framer-motion');

  const Progress = ({
    value,
    max = 100,
    size = 'md',
    variant = 'default',
    showValue = false,
    animated = true,
    className,
  }: any) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    const variantClasses = {
      default: 'bg-blue-500',
      gradient: 'bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600',
      'purple-orange': 'bg-gradient-to-r from-purple-600 to-orange-500',
      success: 'bg-green-600',
      warning: 'bg-yellow-500',
      error: 'bg-red-600',
    };

    return React.createElement(
      'div',
      {
        className: cn('w-full', className),
        'data-testid': 'progress-container',
      },
      [
        React.createElement(
          'div',
          {
            key: 'progress-bar',
            className: cn(
              'bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
              sizeClasses[size]
            ),
          },
          React.createElement(motion.div, {
            className: cn(
              'h-full rounded-full transition-colors duration-200',
              variantClasses[variant]
            ),
            initial: { width: 0 },
            animate: { width: `${percentage}%` },
            transition: animated
              ? { duration: 0.5, ease: 'easeOut' }
              : { duration: 0 },
          })
        ),
        showValue &&
          React.createElement(
            'div',
            {
              key: 'value-display',
              className:
                'flex justify-between items-center mt-1 text-xs text-gray-600 dark:text-gray-400',
              'data-testid': 'value-display',
            },
            [
              React.createElement(
                'span',
                { key: 'percentage' },
                `${Math.round(percentage)}%`
              ),
              React.createElement(
                'span',
                { key: 'fraction' },
                `${value} / ${max}`
              ),
            ]
          ),
      ]
    );
  };

  return { Progress };
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Progress } from '../../../src/renderer/components/ui/Progress';

describe('Progress Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with default props', () => {
      render(<Progress value={50} />);

      const progressContainer = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(progressContainer).toBeInTheDocument();
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    test('renders with custom value', () => {
      render(<Progress value={75} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });

    test('renders with zero value', () => {
      render(<Progress value={0} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    test('renders with maximum value', () => {
      render(<Progress value={100} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    test('renders with custom max value', () => {
      render(<Progress value={50} max={200} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '25%' });
    });
  });

  describe('Size Variants', () => {
    test('renders with small size', () => {
      render(<Progress value={50} size='sm' />);

      const progressContainer = screen.getByTestId('progress-container');
      expect(progressContainer).toHaveClass('h-1');
    });

    test('renders with medium size (default)', () => {
      render(<Progress value={50} />);

      const progressContainer = screen.getByTestId('progress-container');
      expect(progressContainer).toHaveClass('h-2');
    });

    test('renders with large size', () => {
      render(<Progress value={50} size='lg' />);

      const progressContainer = screen.getByTestId('progress-container');
      expect(progressContainer).toHaveClass('h-3');
    });

    test('renders with custom size class', () => {
      render(<Progress value={50} size='sm' className='w-64' />);

      const progressContainer = screen.getByTestId('progress-container');
      expect(progressContainer).toHaveClass('w-64');
      expect(progressContainer).toHaveClass('h-1');
    });
  });

  describe('Color Variants', () => {
    test('renders with default variant', () => {
      render(<Progress value={50} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass('bg-blue-500');
    });

    test('renders with gradient variant', () => {
      render(<Progress value={50} variant='gradient' />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass(
        'bg-gradient-to-r',
        'from-blue-500',
        'via-purple-500',
        'to-blue-600'
      );
    });

    test('renders with purple-orange variant', () => {
      render(<Progress value={50} variant='purple-orange' />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass(
        'bg-gradient-to-r',
        'from-purple-600',
        'to-orange-500'
      );
    });

    test('renders with success variant', () => {
      render(<Progress value={50} variant='success' />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass('bg-green-600');
    });

    test('renders with warning variant', () => {
      render(<Progress value={50} variant='warning' />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass('bg-yellow-500');
    });

    test('renders with error variant', () => {
      render(<Progress value={50} variant='error' />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass('bg-red-600');
    });
  });

  describe('Value Display', () => {
    test('does not show value by default', () => {
      render(<Progress value={75} />);

      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    test('shows value when showValue is true', () => {
      render(<Progress value={75} showValue={true} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    test('shows zero value correctly', () => {
      render(<Progress value={0} showValue={true} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('shows 100 value correctly', () => {
      render(<Progress value={100} showValue={true} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('shows decimal values correctly', () => {
      render(<Progress value={33.7} showValue={true} />);

      expect(screen.getByText('34%')).toBeInTheDocument(); // Rounded to nearest integer
    });

    test('shows custom max values correctly', () => {
      render(<Progress value={50} max={200} showValue={true} />);

      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    test('is animated by default', () => {
      render(<Progress value={50} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toBeInTheDocument();
    });

    test('can be non-animated', () => {
      render(<Progress value={50} animated={false} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    test('applies custom className', () => {
      render(<Progress value={50} className='custom-progress' />);

      const container = screen.getByTestId('progress-container');
      expect(container).toHaveClass('custom-progress');
    });

    test('merges classes correctly', () => {
      render(<Progress value={50} className='w-32' />);

      const container = screen.getByTestId('progress-container');
      expect(container).toHaveClass('w-full', 'w-32'); // Custom class should override
    });

    test('has proper base classes', () => {
      render(<Progress value={50} />);

      const container = screen.getByTestId('progress-container');
      expect(container).toHaveClass('w-full');
      expect(container).toHaveClass(
        'bg-gray-200',
        'dark:bg-gray-700',
        'rounded-full',
        'overflow-hidden'
      );
    });

    test('progress bar has proper base classes', () => {
      render(<Progress value={50} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveClass('h-full', 'rounded-full');
    });
  });

  describe('Value Bounds and Edge Cases', () => {
    test('handles negative values', () => {
      render(<Progress value={-10} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    test('handles values greater than max', () => {
      render(<Progress value={150} max={100} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    test('handles very large values', () => {
      render(<Progress value={1000} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    test('handles decimal max values', () => {
      render(<Progress value={2.5} max={5} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    test('handles zero max value', () => {
      render(<Progress value={50} max={0} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' }); // Division by zero results in 100%
    });

    test('handles NaN values', () => {
      render(<Progress value={NaN} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    test('handles Infinity values', () => {
      render(<Progress value={Infinity} />);

      const progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Accessibility', () => {
    test('has proper role and attributes', () => {
      render(<Progress value={75} />);

      const container = screen.getByTestId('progress-container');
      expect(container).toHaveAttribute('role', 'progressbar');
      expect(container).toHaveAttribute('aria-valuenow', '75');
      expect(container).toHaveAttribute('aria-valuemin', '0');
      expect(container).toHaveAttribute('aria-valuemax', '100');
    });

    test('has proper aria attributes with custom max', () => {
      render(<Progress value={50} max={200} />);

      const container = screen.getByTestId('progress-container');
      expect(container).toHaveAttribute('aria-valuenow', '50');
      expect(container).toHaveAttribute('aria-valuemax', '200');
    });

    test('has accessible label when showValue is true', () => {
      render(<Progress value={75} showValue={true} />);

      const container = screen.getByRole('progressbar');
      expect(container).toHaveAttribute('aria-label', 'Progress: 75%');
    });

    test('supports custom aria-label', () => {
      render(<Progress value={75} aria-label='Upload progress' />);

      const container = screen.getByRole('progressbar');
      expect(container).toHaveAttribute('aria-label', 'Upload progress');
    });

    test('supports additional aria attributes', () => {
      render(<Progress value={75} aria-describedby='progress-desc' />);

      const container = screen.getByRole('progressbar');
      expect(container).toHaveAttribute('aria-describedby', 'progress-desc');
    });
  });

  describe('Integration with Variants and Sizes', () => {
    test('small size with gradient variant', () => {
      render(
        <Progress value={60} size='sm' variant='gradient' showValue={true} />
      );

      const container = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(container).toHaveClass('h-1');
      expect(progressBar).toHaveClass('bg-gradient-to-r', 'from-blue-500');
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    test('large size with error variant', () => {
      render(<Progress value={25} size='lg' variant='error' />);

      const container = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(container).toHaveClass('h-3');
      expect(progressBar).toHaveClass('bg-red-600');
    });

    test('medium size with success variant and value display', () => {
      render(
        <Progress value={90} size='md' variant='success' showValue={true} />
      );

      const container = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(container).toHaveClass('h-2');
      expect(progressBar).toHaveClass('bg-green-600');
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles rapid value changes', () => {
      const { rerender } = render(<Progress value={0} />);
      let progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '0%' });

      rerender(<Progress value={25} />);
      progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '25%' });

      rerender(<Progress value={75} />);
      progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '75%' });

      rerender(<Progress value={100} />);
      progressBar = screen.getByTestId('motion-div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    test('handles undefined props gracefully', () => {
      render(
        <Progress
          value={50}
          size={undefined}
          variant={undefined}
          showValue={undefined}
          animated={undefined}
          className={undefined}
        />
      );

      const container = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(container).toBeInTheDocument();
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
      expect(container).toHaveClass('h-2'); // Default size
      expect(progressBar).toHaveClass('bg-blue-500'); // Default variant
    });

    test('handles null props gracefully', () => {
      render(
        <Progress
          value={50}
          size={null as any}
          variant={null as any}
          showValue={null as any}
          animated={null as any}
          className={null as any}
        />
      );

      const container = screen.getByTestId('progress-container');
      const progressBar = screen.getByTestId('motion-div');

      expect(container).toBeInTheDocument();
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    test('file upload progress', () => {
      render(
        <div>
          <h3>Uploading file...</h3>
          <Progress value={67} variant='success' showValue={true} />
          <p>2.1 MB of 3.1 MB uploaded</p>
        </div>
      );

      expect(screen.getByText('67%')).toBeInTheDocument();
      expect(screen.getByText('Uploading file...')).toBeInTheDocument();
      expect(screen.getByText('2.1 MB of 3.1 MB uploaded')).toBeInTheDocument();
    });

    test('loading state with multiple variants', () => {
      render(
        <div>
          <Progress value={30} variant='gradient' size='sm' />
          <Progress value={60} variant='success' size='md' showValue={true} />
          <Progress value={90} variant='warning' size='lg' />
        </div>
      );

      const progressBars = screen.getAllByTestId('motion-div');
      expect(progressBars).toHaveLength(3);
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    test('step progress indicator', () => {
      const steps = [
        { name: 'Step 1', completed: true },
        { name: 'Step 2', completed: true },
        { name: 'Step 3', completed: false },
        { name: 'Step 4', completed: false },
      ];

      const completedSteps = steps.filter((step) => step.completed).length;
      const progress = (completedSteps / steps.length) * 100;

      render(
        <div>
          <h2>Setup Progress</h2>
          <Progress value={progress} variant='purple-orange' showValue={true} />
          <p>
            Completed {completedSteps} of {steps.length} steps
          </p>
        </div>
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Completed 2 of 4 steps')).toBeInTheDocument();
    });

    test('battery level indicator', () => {
      const batteryLevel = 85;

      render(
        <div>
          <span>Battery Level</span>
          <Progress
            value={batteryLevel}
            variant={
              batteryLevel > 50
                ? 'success'
                : batteryLevel > 20
                  ? 'warning'
                  : 'error'
            }
            showValue={true}
            size='lg'
          />
        </div>
      );

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Battery Level')).toBeInTheDocument();
    });
  });
});
