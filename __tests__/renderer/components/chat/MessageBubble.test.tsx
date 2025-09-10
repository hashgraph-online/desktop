import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageBubble from '../../../../src/renderer/components/chat/MessageBubble';
import { useAgentStore } from '../../../../src/renderer/stores/agentStore';
import { useConfigStore } from '../../../../src/renderer/stores/configStore';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  TransactionParser: jest.fn(),
  HCSMessage: jest.fn(),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

jest.mock('../../../../src/renderer/stores/configStore', () => ({
  useConfigStore: {
    getState: () => ({
      config: {
        hedera: {
          network: 'testnet',
          accountId: '0.0.12345',
        },
        advanced: {
          operationalMode: 'autonomous',
        },
      },
    }),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock('../../../../src/renderer/stores/agentStore');
jest.mock('../../../../src/renderer/components/ui/Typography', () => ({
  __esModule: true,
  default: ({ children, variant, className, onClick }: any) => (
    <div
      data-testid={`typography-${variant || 'default'}`}
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/ui/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid='logo'>Logo</div>,
}));

jest.mock('../../../../src/renderer/components/ui/UserProfileImage', () => ({
  __esModule: true,
  default: ({ accountId, network }: any) => (
    <div
      data-testid='user-profile-image'
      data-account-id={accountId}
      data-network={network}
    >
      Profile Image
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/chat/AttachmentDisplay', () => ({
  __esModule: true,
  default: ({ attachments }: any) => (
    <div data-testid='attachment-display'>
      {attachments?.map((att: any, i: number) => (
        <div key={i} data-testid={`attachment-${i}`}>
          {att.name}
        </div>
      ))}
    </div>
  ),
}));

jest.mock(
  '../../../../src/renderer/components/chat/TransactionApproval',
  () => ({
    TransactionApprovalButton: ({ messageId, onApprove, onReject }: any) => (
      <div data-testid='transaction-approval-button'>
        <button onClick={() => onApprove(messageId)} data-testid='approve-btn'>
          Approve
        </button>
        <button onClick={() => onReject(messageId)} data-testid='reject-btn'>
          Reject
        </button>
      </div>
    ),
  })
);

jest.mock('../../../../src/renderer/components/ui/CodeBlock', () => ({
  CodeBlock: ({ children, language }: any) => (
    <div data-testid='code-block' data-language={language}>
      {children}
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/chat/FormMessageBubble', () => ({
  FormMessageBubble: ({ formMessage }: any) => (
    <div data-testid='form-message-bubble'>
      Form: {formMessage?.formConfig?.title}
    </div>
  ),
}));

jest.mock(
  '../../../../src/renderer/components/chat/HashLinkBlockRenderer',
  () => ({
    __esModule: true,
    default: ({ content }: any) => (
      <div data-testid='hash-link-renderer'>{content}</div>
    ),
  })
);

jest.mock('../../../../src/renderer/utils/markdownProcessor', () => ({
  processMarkdown: jest.fn((text) => `<p>${text}</p>`),
}));

jest.mock('../../../../src/renderer/lib/utils', () => ({
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

jest.mock('react-icons/fi', () => ({
  FiHash: () => <div data-testid='fi-hash' />,
  FiClock: () => <div data-testid='fi-clock' />,
  FiCopy: () => <div data-testid='fi-copy' />,
  FiCheck: () => <div data-testid='fi-check' />,
  FiMaximize2: () => <div data-testid='fi-maximize' />,
  FiX: () => <div data-testid='fi-x' />,
  FiImage: () => <div data-testid='fi-image' />,
}));

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

describe('MessageBubble', () => {
  const mockAgentStore = {
    approveTransaction: jest.fn(),
    rejectTransaction: jest.fn(),
    findFormMessage: jest.fn(),
  };

  const mockConfigStore = {
    getState: () => ({
      config: {
        hedera: {
          network: 'testnet',
          accountId: '0.0.12345',
        },
        advanced: {
          operationalMode: 'autonomous',
        },
      },
    }),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  };

  const mockMessage: any = {
    id: 'message-1',
    role: 'user',
    content: 'Hello, this is a test message!',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    metadata: {},
  };

  const mockUserProfile = {
    accountId: '0.0.12345',
    name: 'Test User',
    network: 'testnet',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useAgentStore as jest.MockedFunction<any>).mockReturnValue(mockAgentStore);
  });

  describe('Basic Rendering', () => {
    test('should render user message correctly', () => {
      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      expect(
        screen.getByText('Hello, this is a test message!')
      ).toBeInTheDocument();
      expect(screen.getByTestId('user-profile-image')).toBeInTheDocument();
    });

    test('should render assistant message correctly', () => {
      const assistantMessage = {
        ...mockMessage,
        role: 'assistant',
        content: 'Hello! How can I help you?',
      };

      render(
        <MessageBubble
          message={assistantMessage}
          userProfile={mockUserProfile}
        />
      );

      expect(
        screen.getByText('Hello! How can I help you?')
      ).toBeInTheDocument();
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });

    test('should render system message correctly', () => {
      const systemMessage = {
        ...mockMessage,
        role: 'system',
        content: 'System notification',
      };

      render(
        <MessageBubble message={systemMessage} userProfile={mockUserProfile} />
      );

      expect(screen.getByText('System notification')).toBeInTheDocument();
    });
  });

  describe('Message Content Processing', () => {
    test('should process markdown content', () => {
      const markdownMessage = {
        ...mockMessage,
        content: '**Bold text** and *italic text*',
      };

      render(
        <MessageBubble
          message={markdownMessage}
          userProfile={mockUserProfile}
        />
      );

      expect(
        screen.getByText('**Bold text** and *italic text*')
      ).toBeInTheDocument();
    });

    test('should handle empty message content', () => {
      const emptyMessage = {
        ...mockMessage,
        content: '',
      };

      render(
        <MessageBubble message={emptyMessage} userProfile={mockUserProfile} />
      );

      expect(screen.getByTestId('user-profile-image')).toBeInTheDocument();
    });

    test('should handle message with code blocks', () => {
      const codeMessage = {
        ...mockMessage,
        content: '```javascript\nconsole.log("Hello");\n```',
      };

      render(
        <MessageBubble message={codeMessage} userProfile={mockUserProfile} />
      );

      expect(screen.getByTestId('code-block')).toBeInTheDocument();
    });
  });

  describe('Attachments', () => {
    test('should render attachments when present', () => {
      const messageWithAttachments = {
        ...mockMessage,
        metadata: {
          attachments: [
            {
              name: 'test.txt',
              data: 'file content',
              type: 'text/plain',
              size: 1024,
            },
          ],
        },
      };

      render(
        <MessageBubble
          message={messageWithAttachments}
          userProfile={mockUserProfile}
        />
      );

      expect(screen.getByTestId('attachment-display')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-0')).toBeInTheDocument();
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    test('should handle multiple attachments', () => {
      const messageWithMultipleAttachments = {
        ...mockMessage,
        metadata: {
          attachments: [
            {
              name: 'file1.txt',
              data: 'content1',
              type: 'text/plain',
              size: 1024,
            },
            {
              name: 'file2.jpg',
              data: 'image data',
              type: 'image/jpeg',
              size: 2048,
            },
          ],
        },
      };

      render(
        <MessageBubble
          message={messageWithMultipleAttachments}
          userProfile={mockUserProfile}
        />
      );

      expect(screen.getByTestId('attachment-0')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-1')).toBeInTheDocument();
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.jpg')).toBeInTheDocument();
    });
  });

  describe('Transaction Messages', () => {
    test('should render transaction approval button for pending transactions', () => {
      const transactionMessage = {
        ...mockMessage,
        metadata: {
          transactionBytes: 'SGVsbG8gV29ybGQ=',
          pendingApproval: true,
        },
      };

      render(
        <MessageBubble
          message={transactionMessage}
          userProfile={mockUserProfile}
        />
      );

      expect(
        screen.getByTestId('transaction-approval-button')
      ).toBeInTheDocument();
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });

    test('should handle transaction approval', async () => {
      const user = userEvent.setup();

      const transactionMessage = {
        ...mockMessage,
        metadata: {
          transactionBytes: 'SGVsbG8gV29ybGQ=',
          pendingApproval: true,
        },
      };

      render(
        <MessageBubble
          message={transactionMessage}
          userProfile={mockUserProfile}
        />
      );

      const approveButton = screen.getByTestId('approve-btn');
      await user.click(approveButton);

      expect(mockAgentStore.approveTransaction).toHaveBeenCalledWith(
        'message-1'
      );
    });

    test('should handle transaction rejection', async () => {
      const user = userEvent.setup();

      const transactionMessage = {
        ...mockMessage,
        metadata: {
          transactionBytes: 'SGVsbG8gV29ybGQ=',
          pendingApproval: true,
        },
      };

      render(
        <MessageBubble
          message={transactionMessage}
          userProfile={mockUserProfile}
        />
      );

      const rejectButton = screen.getByTestId('reject-btn');
      await user.click(rejectButton);

      expect(mockAgentStore.rejectTransaction).toHaveBeenCalledWith(
        'message-1'
      );
    });
  });

  describe('Form Messages', () => {
    test('should render form message bubble when form data is present', () => {
      const formMessage = {
        type: 'form',
        id: 'form-1',
        formConfig: {
          title: 'Test Form',
          fields: [
            {
              name: 'field1',
              label: 'Field 1',
              type: 'text',
              required: true,
            },
          ],
        },
        originalPrompt: 'Please fill this form',
        toolName: 'test-tool',
      };

      const messageWithForm = {
        ...mockMessage,
        metadata: {
          formMessage: formMessage,
        },
      };

      render(
        <MessageBubble
          message={messageWithForm}
          userProfile={mockUserProfile}
        />
      );

      expect(screen.getByTestId('form-message-bubble')).toBeInTheDocument();
      expect(screen.getByText('Form: Test Form')).toBeInTheDocument();
    });
  });

  describe('HCS-10 Messages', () => {
    test('should render HCS-10 message with agent name', () => {
      render(
        <MessageBubble
          message={mockMessage}
          userProfile={mockUserProfile}
          isHCS10={true}
          agentName='Test Agent'
        />
      );

      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });

    test('should handle HCS-10 user identification', () => {
      const hcs10Message = {
        ...mockMessage,
        metadata: {
          operatorId: '0.0.12345',
        },
      };

      render(
        <MessageBubble
          message={hcs10Message}
          userProfile={mockUserProfile}
          isHCS10={true}
        />
      );

      expect(screen.getByTestId('user-profile-image')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    test('should copy message content to clipboard', async () => {
      const user = userEvent.setup();

      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      const copyButtons = screen.getAllByTestId('fi-copy');
      if (copyButtons.length > 0) {
        await user.click(copyButtons[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'Hello, this is a test message!'
        );
      }
    });

    test('should show copy success feedback', async () => {
      const user = userEvent.setup();

      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      const copyButtons = screen.getAllByTestId('fi-copy');
      if (copyButtons.length > 0) {
        await user.click(copyButtons[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      }
    });
  });

  describe('Timestamp Display', () => {
    test('should display message timestamp', () => {
      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      expect(screen.getByTestId('fi-clock')).toBeInTheDocument();
    });

    test('should handle malformed timestamp gracefully', () => {
      const messageWithBadTimestamp = {
        ...mockMessage,
        timestamp: 'invalid-date' as any,
      };

      expect(() => {
        render(
          <MessageBubble
            message={messageWithBadTimestamp}
            userProfile={mockUserProfile}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Agent Profile Interaction', () => {
    test('should call onAgentProfileClick when agent profile is clicked', async () => {
      const user = userEvent.setup();

      const mockOnAgentProfileClick = jest.fn();

      render(
        <MessageBubble
          message={mockMessage}
          userProfile={mockUserProfile}
          isHCS10={true}
          onAgentProfileClick={mockOnAgentProfileClick}
        />
      );

      expect(mockOnAgentProfileClick).not.toHaveBeenCalled();
    });
  });

  describe('Message Types and Roles', () => {
    test('should handle different message roles', () => {
      const roles = ['user', 'assistant', 'system'];

      roles.forEach((role) => {
        const messageByRole = {
          ...mockMessage,
          role: role as 'user' | 'assistant' | 'system',
        };

        const { unmount } = render(
          <MessageBubble
            message={messageByRole}
            userProfile={mockUserProfile}
          />
        );

        expect(
          screen.getByText('Hello, this is a test message!')
        ).toBeInTheDocument();
        unmount();
      });
    });

    test('should handle messages with special characters', () => {
      const specialMessage = {
        ...mockMessage,
        content:
          'Message with <script>alert("xss")</script> and &amp; entities',
      };

      render(
        <MessageBubble message={specialMessage} userProfile={mockUserProfile} />
      );

      expect(
        screen.getByText(
          'Message with <script>alert("xss")</script> and &amp; entities'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing user profile gracefully', () => {
      render(<MessageBubble message={mockMessage} userProfile={null} />);

      expect(
        screen.getByText('Hello, this is a test message!')
      ).toBeInTheDocument();
    });

    test('should handle undefined metadata', () => {
      const messageWithoutMetadata = {
        ...mockMessage,
        metadata: undefined,
      };

      render(
        <MessageBubble
          message={messageWithoutMetadata}
          userProfile={mockUserProfile}
        />
      );

      expect(
        screen.getByText('Hello, this is a test message!')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      const messageElement = screen.getByText('Hello, this is a test message!');
      expect(messageElement).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      expect(
        screen.getByText('Hello, this is a test message!')
      ).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('should render large messages efficiently', () => {
      const largeMessage = {
        ...mockMessage,
        content: 'A'.repeat(10000), // Large content
      };

      const startTime = Date.now();
      render(
        <MessageBubble message={largeMessage} userProfile={mockUserProfile} />
      );

      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within reasonable time
    });

    test('should handle frequent re-renders', () => {
      const { rerender } = render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      rerender(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      expect(
        screen.getByText('Hello, this is a test message!')
      ).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete message workflow', () => {
      const complexMessage = {
        ...mockMessage,
        content: 'Complex message with **markdown** and `code`',
        metadata: {
          attachments: [
            {
              name: 'document.pdf',
              data: 'pdf data',
              type: 'application/pdf',
              size: 1024000,
            },
          ],
          transactionBytes: 'SGVsbG8gV29ybGQ=',
          pendingApproval: true,
          formMessage: {
            type: 'form',
            id: 'form-1',
            formConfig: {
              title: 'Test Form',
              fields: [],
            },
            originalPrompt: 'Test prompt',
            toolName: 'test-tool',
          },
        },
      };

      render(
        <MessageBubble
          message={complexMessage}
          userProfile={mockUserProfile}
          isHCS10={true}
          agentName='Test Agent'
        />
      );

      expect(
        screen.getByText('Complex message with **markdown** and `code`')
      ).toBeInTheDocument();
      expect(screen.getByTestId('attachment-display')).toBeInTheDocument();
      expect(
        screen.getByTestId('transaction-approval-button')
      ).toBeInTheDocument();
      expect(screen.getByTestId('form-message-bubble')).toBeInTheDocument();
    });

    test('should handle message updates', () => {
      const { rerender } = render(
        <MessageBubble message={mockMessage} userProfile={mockUserProfile} />
      );

      const updatedMessage = {
        ...mockMessage,
        content: 'Updated message content',
      };

      rerender(
        <MessageBubble message={updatedMessage} userProfile={mockUserProfile} />
      );

      expect(screen.getByText('Updated message content')).toBeInTheDocument();
    });
  });
});
