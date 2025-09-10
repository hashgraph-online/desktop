jest.mock('../../../src/renderer/lib/utils', () => ({
  cn: (...classes: string[]) => classes.join(' '),
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
  Alert,
  AlertTitle,
  AlertDescription,
} from '../../../src/renderer/components/ui/alert';

describe('Alert Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Alert Root Component', () => {
    test('renders with default variant', () => {
      render(<Alert>Default Alert Content</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-slot', 'alert');
      expect(alert).toHaveClass('relative', 'w-full', 'rounded-lg');
      expect(alert).toHaveTextContent('Default Alert Content');
    });

    test('renders with destructive variant', () => {
      render(<Alert variant='destructive'>Destructive Alert Content</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('variant-destructive');
      expect(alert).toHaveTextContent('Destructive Alert Content');
    });

    test('applies custom className', () => {
      render(<Alert className='custom-class'>Custom Alert</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });

    test('forwards additional props', () => {
      render(
        <Alert data-testid='custom-alert' id='alert-123'>
          Custom Props
        </Alert>
      );

      const alert = screen.getByTestId('custom-alert');
      expect(alert).toHaveAttribute('id', 'alert-123');
    });

    test('has proper accessibility attributes', () => {
      render(<Alert aria-label='Status alert'>Accessible Alert</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Status alert');
    });

    test('renders with complex content', () => {
      render(
        <Alert>
          <div>
            <p>Paragraph content</p>
            <span>Span content</span>
          </div>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Paragraph content');
      expect(alert).toHaveTextContent('Span content');
    });

    test('renders with icon', () => {
      render(
        <Alert>
          <svg data-testid='alert-icon' />
          Alert with icon
        </Alert>
      );

      const icon = screen.getByTestId('alert-icon');
      const alert = screen.getByRole('alert');

      expect(icon).toBeInTheDocument();
      expect(alert).toHaveTextContent('Alert with icon');
    });

    test('handles empty content', () => {
      render(<Alert></Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveClass('relative');
    });

    test('renders with undefined variant', () => {
      render(<Alert variant={undefined}>Undefined Variant Alert</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Undefined Variant Alert');
    });

    test('renders with null className', () => {
      render(<Alert className={null}>Null Class Alert</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('AlertTitle Component', () => {
    test('renders with text content', () => {
      render(<AlertTitle>Alert Title</AlertTitle>);

      const title = screen.getByText('Alert Title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveAttribute('data-slot', 'alert-title');
      expect(title).toHaveClass('col-start-2', 'line-clamp-1', 'min-h-4');
    });

    test('applies custom className', () => {
      render(<AlertTitle className='custom-title'>Custom Title</AlertTitle>);

      const title = screen.getByText('Custom Title');
      expect(title).toHaveClass('custom-title');
    });

    test('forwards additional props', () => {
      render(
        <AlertTitle data-testid='custom-title' id='title-123'>
          Forwarded Props
        </AlertTitle>
      );

      const title = screen.getByTestId('custom-title');
      expect(title).toHaveAttribute('id', 'title-123');
    });

    test('renders with complex content', () => {
      render(
        <AlertTitle>
          <strong>Bold Title</strong> with <em>emphasis</em>
        </AlertTitle>
      );

      const title = screen.getByText('Bold Title with emphasis');
      expect(title).toBeInTheDocument();
    });

    test('handles empty content', () => {
      render(<AlertTitle></AlertTitle>);

      const title = screen.getByTestId('alert-title');
      expect(title).toBeInTheDocument();
    });
  });

  describe('AlertDescription Component', () => {
    test('renders with text content', () => {
      render(<AlertDescription>Alert Description</AlertDescription>);

      const description = screen.getByText('Alert Description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute('data-slot', 'alert-description');
      expect(description).toHaveClass('col-start-2', 'text-sm');
    });

    test('applies custom className', () => {
      render(
        <AlertDescription className='custom-description'>
          Custom Description
        </AlertDescription>
      );

      const description = screen.getByText('Custom Description');
      expect(description).toHaveClass('custom-description');
    });

    test('forwards additional props', () => {
      render(
        <AlertDescription data-testid='custom-description' aria-live='polite'>
          Forwarded Props
        </AlertDescription>
      );

      const description = screen.getByTestId('custom-description');
      expect(description).toHaveAttribute('aria-live', 'polite');
    });

    test('renders with multiline content', () => {
      render(
        <AlertDescription>
          Line 1<br />
          Line 2
        </AlertDescription>
      );

      const description = screen.getByText('Line 1');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent('Line 1Line 2');
    });

    test('handles empty content', () => {
      render(<AlertDescription></AlertDescription>);

      const description = screen.getByTestId('alert-description');
      expect(description).toBeInTheDocument();
    });
  });

  describe('Complete Alert Composition', () => {
    test('renders complete alert with all components', () => {
      render(
        <Alert>
          <AlertTitle>Important Notice</AlertTitle>
          <AlertDescription>
            This is a detailed description of the alert.
          </AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Important Notice');
      const description = screen.getByText(
        'This is a detailed description of the alert.'
      );

      expect(alert).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('renders alert with icon, title, and description', () => {
      render(
        <Alert>
          <svg data-testid='warning-icon' />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>This action cannot be undone.</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const icon = screen.getByTestId('warning-icon');
      const title = screen.getByText('Warning');
      const description = screen.getByText('This action cannot be undone.');

      expect(alert).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('renders destructive alert with all components', () => {
      render(
        <Alert variant='destructive'>
          <svg data-testid='error-icon' />
          <AlertTitle>Error Occurred</AlertTitle>
          <AlertDescription>
            An unexpected error has occurred. Please try again.
          </AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const icon = screen.getByTestId('error-icon');
      const title = screen.getByText('Error Occurred');
      const description = screen.getByText(
        'An unexpected error has occurred. Please try again.'
      );

      expect(alert).toHaveClass('variant-destructive');
      expect(icon).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('renders alert with only title', () => {
      render(
        <Alert>
          <AlertTitle>Just a Title</AlertTitle>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Just a Title');

      expect(alert).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(screen.queryByTestId('alert-description')).not.toBeInTheDocument();
    });

    test('renders alert with only description', () => {
      render(
        <Alert>
          <AlertDescription>Just a description</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const description = screen.getByText('Just a description');

      expect(alert).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(screen.queryByTestId('alert-title')).not.toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    test('Alert applies base classes correctly', () => {
      render(<Alert>Base Classes</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(
        'relative',
        'w-full',
        'rounded-lg',
        'border',
        'px-4',
        'py-3',
        'text-sm'
      );
    });

    test('AlertTitle applies base classes correctly', () => {
      render(<AlertTitle>Title Classes</AlertTitle>);

      const title = screen.getByText('Title Classes');
      expect(title).toHaveClass(
        'col-start-2',
        'line-clamp-1',
        'min-h-4',
        'font-medium',
        'tracking-tight'
      );
    });

    test('AlertDescription applies base classes correctly', () => {
      render(<AlertDescription>Description Classes</AlertDescription>);

      const description = screen.getByText('Description Classes');
      expect(description).toHaveClass(
        'col-start-2',
        'text-sm',
        'text-muted-foreground'
      );
    });

    test('custom classes are merged correctly', () => {
      render(
        <Alert className='custom-alert'>
          <AlertTitle className='custom-title'>Title</AlertTitle>
          <AlertDescription className='custom-description'>
            Description
          </AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Title');
      const description = screen.getByText('Description');

      expect(alert).toHaveClass('custom-alert');
      expect(title).toHaveClass('custom-title');
      expect(description).toHaveClass('custom-description');
    });

    test('grid layout classes are applied', () => {
      render(<Alert>Grid Layout</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('grid');
      expect(alert).toHaveClass('items-start');
    });
  });

  describe('Data Attributes', () => {
    test('Alert has correct data-slot', () => {
      render(<Alert>Alert Slot</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-slot', 'alert');
    });

    test('AlertTitle has correct data-slot', () => {
      render(<AlertTitle>Title Slot</AlertTitle>);

      const title = screen.getByText('Title Slot');
      expect(title).toHaveAttribute('data-slot', 'alert-title');
    });

    test('AlertDescription has correct data-slot', () => {
      render(<AlertDescription>Description Slot</AlertDescription>);

      const description = screen.getByText('Description Slot');
      expect(description).toHaveAttribute('data-slot', 'alert-description');
    });
  });

  describe('Accessibility', () => {
    test('Alert has correct role', () => {
      render(<Alert>Accessible Alert</Alert>);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    test('supports aria attributes', () => {
      render(
        <Alert aria-live='assertive' aria-describedby='desc'>
          Aria Support
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      expect(alert).toHaveAttribute('aria-describedby', 'desc');
    });

    test('AlertTitle supports aria attributes', () => {
      render(
        <AlertTitle id='title' aria-level='2'>
          Aria Title
        </AlertTitle>
      );

      const title = screen.getByText('Aria Title');
      expect(title).toHaveAttribute('id', 'title');
      expect(title).toHaveAttribute('aria-level', '2');
    });

    test('AlertDescription supports aria attributes', () => {
      render(
        <AlertDescription aria-live='polite'>Aria Description</AlertDescription>
      );

      const description = screen.getByText('Aria Description');
      expect(description).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('handles undefined props gracefully', () => {
      render(
        <Alert className={undefined} variant={undefined}>
          <AlertTitle className={undefined}>Title</AlertTitle>
          <AlertDescription className={undefined}>Description</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Title');
      const description = screen.getByText('Description');

      expect(alert).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('handles null props gracefully', () => {
      render(
        <Alert className={null} variant={null}>
          <AlertTitle className={null}>Title</AlertTitle>
          <AlertDescription className={null}>Description</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Title');
      const description = screen.getByText('Description');

      expect(alert).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('renders with nested components in wrong order', () => {
      render(
        <Alert>
          <AlertDescription>First Description</AlertDescription>
          <AlertTitle>Second Title</AlertTitle>
          <AlertDescription>Third Description</AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      const titles = screen.getAllByText(/Title|Description/);

      expect(alert).toBeInTheDocument();
      expect(titles).toHaveLength(3);
    });

    test('handles multiple instances correctly', () => {
      render(
        <div>
          <Alert>First Alert</Alert>
          <Alert variant='destructive'>Second Alert</Alert>
        </div>
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toHaveTextContent('First Alert');
      expect(alerts[1]).toHaveTextContent('Second Alert');
    });
  });

  describe('Integration Scenarios', () => {
    test('alert used in form validation context', () => {
      render(
        <div role='form'>
          <Alert variant='destructive'>
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>
              Please fill in all required fields.
            </AlertDescription>
          </Alert>
        </div>
      );

      const alert = screen.getByRole('alert');
      const title = screen.getByText('Validation Error');
      const description = screen.getByText(
        'Please fill in all required fields.'
      );

      expect(alert).toHaveClass('variant-destructive');
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    test('alert used in notification system', () => {
      render(
        <div>
          <Alert>
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Your changes have been saved successfully.
            </AlertDescription>
          </Alert>
          <Alert variant='destructive'>
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This action will delete all data.
            </AlertDescription>
          </Alert>
        </div>
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);

      const successAlert = screen.getByText('Success!');
      const warningAlert = screen.getByText('Warning');

      expect(successAlert).toBeInTheDocument();
      expect(warningAlert).toBeInTheDocument();
    });

    test('alert with complex nested content', () => {
      render(
        <Alert>
          <AlertTitle>
            <strong>Important:</strong> System Update
          </AlertTitle>
          <AlertDescription>
            <p>
              The system will be updated tonight from <time>2:00 AM</time> to{' '}
              <time>4:00 AM</time>.
            </p>
            <p>Please save your work before this time.</p>
          </AlertDescription>
        </Alert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Important: System Update');
      expect(alert).toHaveTextContent(
        'The system will be updated tonight from 2:00 AM to 4:00 AM.'
      );
      expect(alert).toHaveTextContent(
        'Please save your work before this time.'
      );
    });
  });
});


