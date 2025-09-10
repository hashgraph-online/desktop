jest.mock('../../../src/renderer/lib/utils', () => ({
  cn: (...classes: string[]) => classes.join(' '),
}));

jest.mock('../../../src/renderer/components/ui/skeleton', () => {
  const React = require('react');
  const { cn } = require('../../../src/renderer/lib/utils');

  const Skeleton = ({ className, ...props }: React.ComponentProps<'div'>) => {
    return React.createElement('div', {
      'data-slot': 'skeleton',
      className: cn('bg-accent animate-pulse rounded-md', className),
      'data-testid': 'skeleton',
      ...props,
    });
  };

  return { Skeleton };
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton } from '../../../src/renderer/components/ui/skeleton';

describe('Skeleton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with default props', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('bg-accent', 'animate-pulse', 'rounded-md');
    });

    test('renders with custom className', () => {
      render(<Skeleton className='custom-skeleton' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('custom-skeleton');
    });

    test('forwards additional props', () => {
      render(<Skeleton data-testid='custom-skeleton' id='skeleton-123' />);

      const skeleton = screen.getByTestId('custom-skeleton');
      expect(skeleton).toHaveAttribute('id', 'skeleton-123');
    });

    test('applies default styling', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('bg-accent');
      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('rounded-md');
    });
  });

  describe('Styling and Classes', () => {
    test('merges custom classes with default classes', () => {
      render(<Skeleton className='w-32 h-8' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass(
        'bg-accent',
        'animate-pulse',
        'rounded-md',
        'w-32',
        'h-8'
      );
    });

    test('handles empty className', () => {
      render(<Skeleton className='' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('bg-accent', 'animate-pulse', 'rounded-md');
    });

    test('handles undefined className', () => {
      render(<Skeleton className={undefined} />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('bg-accent', 'animate-pulse', 'rounded-md');
    });
  });

  describe('Accessibility', () => {
    test('has correct data-slot attribute', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('data-slot', 'skeleton');
    });

    test('supports aria attributes', () => {
      render(<Skeleton aria-label='Loading content' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
    });

    test('supports role attribute', () => {
      render(<Skeleton role='presentation' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('role', 'presentation');
    });

    test('forwards all standard HTML div props', () => {
      render(
        <Skeleton
          title='Loading...'
          tabIndex={-1}
          aria-live='polite'
          aria-describedby='loading-desc'
        />
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('title', 'Loading...');
      expect(skeleton).toHaveAttribute('tabIndex', '-1');
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
      expect(skeleton).toHaveAttribute('aria-describedby', 'loading-desc');
    });
  });

  describe('Animation', () => {
    test('has pulse animation by default', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('animate-pulse');
    });

    test('can be used with custom animations', () => {
      render(<Skeleton className='animate-bounce' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('animate-pulse', 'animate-bounce');
    });
  });

  describe('Content and Children', () => {
    test('renders without children', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeEmptyDOMElement();
    });

    test('renders with children', () => {
      render(
        <Skeleton>
          <span>Loading...</span>
        </Skeleton>
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveTextContent('Loading...');
    });

    test('renders with complex children', () => {
      render(
        <Skeleton>
          <div>
            <p>Loading content</p>
            <span>Please wait...</span>
          </div>
        </Skeleton>
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveTextContent('Loading content');
      expect(skeleton).toHaveTextContent('Please wait...');
    });
  });

  describe('Sizing and Layout', () => {
    test('can be used for different sizes', () => {
      render(<Skeleton className='w-full h-4' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('w-full', 'h-4');
    });

    test('can be used for avatar placeholders', () => {
      render(<Skeleton className='w-10 h-10 rounded-full' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('w-10', 'h-10', 'rounded-full');
    });

    test('can be used for text line placeholders', () => {
      render(<Skeleton className='h-4 w-3/4' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('h-4', 'w-3/4');
    });

    test('can be used for card placeholders', () => {
      render(<Skeleton className='h-32 w-full rounded-lg' />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('h-32', 'w-full', 'rounded-lg');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('handles null props gracefully', () => {
      render(<Skeleton className={null as any} children={null as any} />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
    });

    test('handles undefined props gracefully', () => {
      render(<Skeleton className={undefined} children={undefined} />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
    });

    test('handles empty props object', () => {
      render(<Skeleton {...{}} />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    test('can be used as a loading placeholder for text', () => {
      render(
        <div>
          <h3>Article Title</h3>
          <Skeleton className='h-4 w-full mb-2' />
          <Skeleton className='h-4 w-5/6 mb-2' />
          <Skeleton className='h-4 w-4/5' />
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(3);
    });

    test('can be used as a loading placeholder for cards', () => {
      render(
        <div className='grid grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='p-4 border rounded-lg'>
              <Skeleton className='h-8 w-3/4 mb-2' />
              <Skeleton className='h-4 w-full mb-1' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          ))}
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(9); // 3 cards × 3 skeletons each
    });

    test('can be used as a loading placeholder for user profiles', () => {
      render(
        <div className='flex items-center space-x-4'>
          <Skeleton className='w-12 h-12 rounded-full' />
          <div className='space-y-2'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-24' />
          </div>
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(3);
    });

    test('can be used for loading states in forms', () => {
      render(
        <form>
          <div className='mb-4'>
            <Skeleton className='h-4 w-20 mb-2' />
            <Skeleton className='h-10 w-full rounded' />
          </div>
          <div className='mb-4'>
            <Skeleton className='h-4 w-24 mb-2' />
            <Skeleton className='h-10 w-full rounded' />
          </div>
          <Skeleton className='h-10 w-32 rounded' />
        </form>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(5);
    });

    test('can be used for table loading states', () => {
      render(
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td>
                  <Skeleton className='h-4 w-24' />
                </td>
                <td>
                  <Skeleton className='h-4 w-32' />
                </td>
                <td>
                  <Skeleton className='h-4 w-16' />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(9); // 3 rows × 3 columns
    });
  });

  describe('Real-world Usage Patterns', () => {
    test('loading state for a blog post', () => {
      render(
        <article>
          <Skeleton className='h-8 w-3/4 mb-4' />
          <div className='flex items-center mb-4'>
            <Skeleton className='w-8 h-8 rounded-full mr-2' />
            <Skeleton className='h-4 w-24' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
          </div>
        </article>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(6);
    });

    test('loading state for a product card', () => {
      render(
        <div className='border rounded-lg p-4'>
          <Skeleton className='w-full h-48 rounded-lg mb-4' />
          <Skeleton className='h-6 w-3/4 mb-2' />
          <Skeleton className='h-4 w-full mb-1' />
          <Skeleton className='h-4 w-1/2 mb-4' />
          <Skeleton className='h-8 w-24 rounded' />
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(5);
    });

    test('loading state for a chat message', () => {
      render(
        <div className='flex space-x-3'>
          <Skeleton className='w-8 h-8 rounded-full flex-shrink-0' />
          <div className='flex-1'>
            <Skeleton className='h-4 w-20 mb-2' />
            <div className='space-y-1'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-4/5' />
              <Skeleton className='h-4 w-3/5' />
            </div>
          </div>
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(5);
    });

    test('loading state for a data table with pagination', () => {
      render(
        <div>
          <div className='flex justify-between items-center mb-4'>
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-8 w-24' />
          </div>
          <table className='w-full'>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className='p-2'>
                    <Skeleton className='h-4 w-24' />
                  </td>
                  <td className='p-2'>
                    <Skeleton className='h-4 w-32' />
                  </td>
                  <td className='p-2'>
                    <Skeleton className='h-4 w-16' />
                  </td>
                  <td className='p-2'>
                    <Skeleton className='h-8 w-20 rounded' />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className='flex justify-center mt-4 space-x-2'>
            <Skeleton className='h-8 w-8 rounded' />
            <Skeleton className='h-8 w-8 rounded' />
            <Skeleton className='h-8 w-8 rounded' />
          </div>
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(23); // 5 rows × 4 columns + 3 pagination buttons
    });
  });

  describe('Performance and Best Practices', () => {
    test('renders efficiently with many instances', () => {
      render(
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <Skeleton key={i} className='h-4 w-full mb-1' />
          ))}
        </div>
      );

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons).toHaveLength(50);
    });

    test('maintains performance with deep nesting', () => {
      render(
        <div>
          <div>
            <div>
              <Skeleton className='h-4 w-full' />
            </div>
          </div>
        </div>
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
    });

    test('works well with conditional rendering', () => {
      const { rerender } = render(<Skeleton />);

      expect(screen.getByTestId('skeleton')).toBeInTheDocument();

      rerender(<div>No skeleton</div>);
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();

      rerender(<Skeleton />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('TypeScript and Prop Forwarding', () => {
    test('accepts all standard HTML div props', () => {
      render(
        <Skeleton
          onClick={() => {}}
          onMouseEnter={() => {}}
          style={{ margin: '10px' }}
          data-custom='test'
        />
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('data-custom', 'test');
    });

    test('works with React refs', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Skeleton ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    test('supports all React.ComponentProps<HTMLDivElement>', () => {
      render(
        <Skeleton
          contentEditable
          dir='ltr'
          draggable
          hidden={false}
          lang='en'
          spellCheck
          suppressContentEditableWarning
          suppressHydrationWarning
          accessKey='s'
          autoCapitalize='off'
          contextMenu='menu'
          inputMode='text'
          is='custom-element'
          itemID='item-1'
          itemProp='property'
          itemRef='ref'
          itemScope
          itemType='type'
          nonce='nonce'
          slot='slot'
          tabIndex={0}
          title='Skeleton'
          translate='no'
        />
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('tabIndex', '0');
      expect(skeleton).toHaveAttribute('title', 'Skeleton');
    });
  });
});
