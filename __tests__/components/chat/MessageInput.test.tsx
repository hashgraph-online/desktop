import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MessageInput from '../../../src/renderer/components/chat/MessageInput';

describe('MessageInput', () => {
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  it('should render input field and send button', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should call onSendMessage when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello, world!');
    await user.click(sendButton);
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello, world!');
  });

  it('should call onSendMessage when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    
    await user.type(input, 'Hello, world!');
    await user.keyboard('{Enter}');
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello, world!');
  });

  it('should not call onSendMessage when Shift+Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    
    await user.type(input, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should clear input after successful send', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValue(undefined);
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello, world!');
    await user.click(sendButton);
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('should show error message if send fails', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockRejectedValue(new Error('Send failed'));
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello, world!');
    await user.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Send failed')).toBeInTheDocument();
    });
  });

  it('should disable input and button when disabled prop is true', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={true} />);
    
    const input = screen.getByPlaceholderText('Connect to agent to start chatting...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should disable send button when input is empty', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has content', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello');
    
    expect(sendButton).not.toBeDisabled();
  });

  it('should show character count', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    
    await user.type(input, 'Hello');
    
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('should show submitting state during send', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Hello');
    await user.click(sendButton);
    
    expect(screen.getByRole('button', { name: /sending.../i })).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });

  it('should clear error when user starts typing', async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockRejectedValue(new Error('Send failed'));
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    
    await user.type(input, 'Hello');
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText('Send failed')).toBeInTheDocument();
    });
    
    await user.type(input, ' World');
    
    expect(screen.queryByText('Send failed')).not.toBeInTheDocument();
  });
});