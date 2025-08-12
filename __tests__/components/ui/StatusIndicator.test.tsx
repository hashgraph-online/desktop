import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from '../../../src/renderer/components/ui/StatusIndicator';

describe('StatusIndicator', () => {
  it('renders with default status', () => {
    render(<StatusIndicator />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('bg-hedera-smoke-400');
  });

  it('renders online status', () => {
    render(<StatusIndicator status='online' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-accent');
  });

  it('renders offline status', () => {
    render(<StatusIndicator status='offline' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-hedera-smoke-400');
  });

  it('renders connecting status with animation', () => {
    render(<StatusIndicator status='connecting' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-primary', 'animate-pulse');
  });

  it('renders error status', () => {
    render(<StatusIndicator status='error' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-danger');
  });

  it('renders warning status', () => {
    render(<StatusIndicator status='warning' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-yellow-500');
  });

  it('supports different sizes', () => {
    const { rerender } = render(<StatusIndicator size='sm' />);
    let indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('w-2', 'h-2');

    rerender(<StatusIndicator size='md' />);
    indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('w-3', 'h-3');

    rerender(<StatusIndicator size='lg' />);
    indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('w-4', 'h-4');
  });

  it('displays label when provided', () => {
    render(<StatusIndicator status='online' label='Connected' />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('positions label correctly', () => {
    const { rerender } = render(
      <StatusIndicator status='online' label='Status' labelPosition='right' />
    );
    let container = screen.getByTestId('status-container');
    expect(container).toHaveClass('flex-row');

    rerender(
      <StatusIndicator status='online' label='Status' labelPosition='left' />
    );
    container = screen.getByTestId('status-container');
    expect(container).toHaveClass('flex-row-reverse');

    rerender(
      <StatusIndicator status='online' label='Status' labelPosition='top' />
    );
    container = screen.getByTestId('status-container');
    expect(container).toHaveClass('flex-col-reverse');

    rerender(
      <StatusIndicator status='online' label='Status' labelPosition='bottom' />
    );
    container = screen.getByTestId('status-container');
    expect(container).toHaveClass('flex-col');
  });

  it('has proper ARIA attributes', () => {
    render(<StatusIndicator status='online' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-label', 'Status: online');
  });

  it('supports custom aria-label', () => {
    render(
      <StatusIndicator status='online' aria-label='Server connection status' />
    );
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveAttribute('aria-label', 'Server connection status');
  });

  it('supports custom className', () => {
    render(<StatusIndicator className='custom-class' />);
    const container = screen.getByTestId('status-container');
    expect(container).toHaveClass('custom-class');
  });

  it('renders with tooltip when provided', () => {
    render(<StatusIndicator status='online' tooltip='Server is operational' />);
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveAttribute('title', 'Server is operational');
  });

  it('applies correct styles for each status', () => {
    const statuses = [
      { status: 'online', class: 'bg-accent' },
      { status: 'offline', class: 'bg-hedera-smoke-400' },
      { status: 'connecting', classes: ['bg-primary', 'animate-pulse'] },
      { status: 'error', class: 'bg-danger' },
      { status: 'warning', class: 'bg-yellow-500' },
    ];

    statuses.forEach(({ status, class: className, classes }) => {
      const { unmount } = render(<StatusIndicator status={status as any} />);
      const indicator = screen.getByTestId('status-indicator');

      if (classes) {
        classes.forEach((cls) => expect(indicator).toHaveClass(cls));
      } else {
        expect(indicator).toHaveClass(className);
      }

      unmount();
    });
  });
});
