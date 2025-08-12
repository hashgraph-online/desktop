import React from 'react';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../../../src/renderer/components/ui/Spinner';

describe('Spinner', () => {
  it('renders correctly', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('supports custom aria-label', () => {
    render(<Spinner aria-label='Processing request' />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Processing request');
  });

  it('applies default size', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('supports different sizes', () => {
    const { rerender } = render(<Spinner size='sm' />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-3', 'h-3');

    rerender(<Spinner size='md' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-4', 'h-4');

    rerender(<Spinner size='lg' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-6', 'h-6');

    rerender(<Spinner size='xl' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('applies default color', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-primary');
  });

  it('supports different colors', () => {
    const { rerender } = render(<Spinner color='primary' />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-primary');

    rerender(<Spinner color='secondary' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-secondary');

    rerender(<Spinner color='accent' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-accent');

    rerender(<Spinner color='white' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-white');

    rerender(<Spinner color='current' />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-current');
  });

  it('has animation class', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('supports custom className', () => {
    render(<Spinner className='custom-class' />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-class');
  });

  it('renders with screen reader only text', () => {
    render(<Spinner />);
    const srText = screen.getByText('Loading...');
    expect(srText).toHaveClass('sr-only');
  });

  it('supports custom screen reader text', () => {
    render(<Spinner srText='Please wait' />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('renders inline by default', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('inline-block');
  });

  it('can be centered', () => {
    render(<Spinner center />);
    const container = screen.getByTestId('spinner-container');
    expect(container).toHaveClass('flex', 'justify-center', 'items-center');
  });
});
