import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../../../src/renderer/components/ui/input';

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder='Enter text' />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('accepts value and onChange props', async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();

    render(<Input value='' onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'Hello');
    expect(handleChange).toHaveBeenCalledTimes(5);
  });

  it('can be disabled', () => {
    render(<Input disabled placeholder='Disabled input' />);
    const input = screen.getByPlaceholderText('Disabled input');

    expect(input).toBeDisabled();
    expect(input).toHaveClass(
      'disabled:opacity-50',
      'disabled:cursor-not-allowed'
    );
  });

  it('supports different types', () => {
    const { rerender, container } = render(<Input type='email' />);
    let input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');

    rerender(<Input type='password' />);
    input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'password');

    rerender(<Input type='number' />);
    input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('applies default styles', () => {
    render(<Input data-testid='input' />);
    const input = screen.getByTestId('input');
    expect(input).toHaveClass(
      'h-10',
      'w-full',
      'rounded-xl',
      'border',
      'px-4',
      'py-2'
    );
  });

  it('supports custom className', () => {
    render(<Input className='custom-class' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('supports required attribute', () => {
    render(<Input required />);
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
  });

  it('supports autoComplete attribute', () => {
    render(<Input autoComplete='email' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('autoComplete', 'email');
  });

  it('supports maxLength attribute', async () => {
    const user = userEvent.setup();
    render(<Input maxLength={5} />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'Hello World');
    expect(input).toHaveValue('Hello');
  });

  it('supports pattern attribute', () => {
    render(<Input pattern='[0-9]*' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('pattern', '[0-9]*');
  });

  it('has proper ARIA attributes', () => {
    render(
      <Input
        aria-label='Email address'
        aria-describedby='email-help'
        aria-invalid='true'
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Email address');
    expect(input).toHaveAttribute('aria-describedby', 'email-help');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('supports keyboard navigation', async () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();
    const user = userEvent.setup();

    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    expect(input).toHaveFocus();
    expect(handleFocus).toHaveBeenCalled();

    await user.tab();
    expect(input).not.toHaveFocus();
    expect(handleBlur).toHaveBeenCalled();
  });

  it('supports focus ring styles', () => {
    render(<Input data-testid='input' />);
    const input = screen.getByTestId('input');
    expect(input).toHaveClass('focus:ring-2');
  });
});
