import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageList from '../../../src/renderer/components/chat/MessageList';
import type { Message } from '../../../src/renderer/stores/agentStore';

jest.mock('../../../src/renderer/components/chat/MessageBubble', () => {
  return function MockMessageBubble({ message }: { message: Message }) {
    return <div data-testid={`message-${message.id}`}>{message.content}</div>;
  };
});

// Mock scrollIntoView for tests
Object.defineProperty(global, 'scrollIntoView', {
  value: jest.fn(),
  writable: true,
});

// Mock Element.scrollIntoView
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true,
});

describe('MessageList', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: new Date(),
    },
  ];

  it('should render empty state when no messages', () => {
    render(<MessageList messages={[]} />);

    expect(
      screen.getByText('Welcome to Conversational Agent')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I can help you with Hedera Hashgraph operations/)
    ).toBeInTheDocument();
  });

  it('should show example questions in empty state', () => {
    render(<MessageList messages={[]} />);

    expect(screen.getByText('Try asking me:')).toBeInTheDocument();
    expect(
      screen.getByText('• "What\'s my account balance?"')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• "Transfer 5 HBAR to 0.0.123456"')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• "Help me create a new account"')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• "Send a message to HCS topic"')
    ).toBeInTheDocument();
  });

  it('should render messages when provided', () => {
    render(<MessageList messages={mockMessages} />);

    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
  });

  it('should show loading indicator when isLoading is true', () => {
    render(<MessageList messages={mockMessages} isLoading={true} />);

    expect(screen.getByText('Agent is thinking...')).toBeInTheDocument();
  });

  it('should not show loading indicator when isLoading is false', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);

    expect(screen.queryByText('Agent is thinking...')).not.toBeInTheDocument();
  });

  it('should not show empty state when messages are present', () => {
    render(<MessageList messages={mockMessages} />);

    expect(
      screen.queryByText('Welcome to Conversational Agent')
    ).not.toBeInTheDocument();
  });

  it('should render messages in correct order', () => {
    const orderedMessages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'First message',
        timestamp: new Date('2023-01-01T10:00:00Z'),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date('2023-01-01T10:01:00Z'),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Third message',
        timestamp: new Date('2023-01-01T10:02:00Z'),
      },
    ];

    render(<MessageList messages={orderedMessages} />);

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements).toHaveLength(3);
    expect(messageElements[0]).toHaveTextContent('First message');
    expect(messageElements[1]).toHaveTextContent('Second message');
    expect(messageElements[2]).toHaveTextContent('Third message');
  });

  it('should handle single message', () => {
    const singleMessage: Message[] = [mockMessages[0]];

    render(<MessageList messages={singleMessage} />);

    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(
      screen.queryByText('Welcome to Conversational Agent')
    ).not.toBeInTheDocument();
  });
});
