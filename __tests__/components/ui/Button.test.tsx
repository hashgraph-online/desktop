import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../../src/renderer/components/ui/Button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole('button', { name: 'Click me' })
    ).toBeInTheDocument();
  });

  it('applies default variant styles by default', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gradient-to-r');
    expect(button).toHaveClass('from-[#5599fe]');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant='secondary'>Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-white/10');
    expect(button).toHaveClass('backdrop-blur-sm');
  });

  it('applies ghost variant styles', () => {
    render(<Button variant='ghost'>Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-white/10');
    expect(button).toHaveClass('text-gray-600');
  });

  it('applies destructive variant styles', () => {
    render(<Button variant='destructive'>Destructive</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('supports different sizes', () => {
    const { rerender } = render(<Button size='sm'>Small</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('px-2', 'py-1', 'text-xs');

    rerender(<Button size='default'>Default</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-xs');

    rerender(<Button size='lg'>Large</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('px-3.5', 'py-2', 'text-sm');
  });

  it('supports gradient variant', () => {
    render(<Button variant='gradient'>Gradient</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gradient-to-r');
  });

  it('supports outline variant', () => {
    render(<Button variant='outline'>Outline</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'bg-white/5');
  });

  it('supports custom className', () => {
    render(<Button className='custom-class'>Custom</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('supports type prop', () => {
    render(<Button type='submit'>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('has proper ARIA attributes', () => {
    render(
      <Button aria-label='Custom label' aria-pressed='true'>
        Button
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Custom label');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports keyboard navigation', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Keyboard</Button>);
    const button = screen.getByRole('button');

    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('does not trigger click when disabled', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const button = screen.getByRole('button');

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
