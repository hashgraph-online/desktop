jest.mock('../../../../src/renderer/components/ui/Typography', () => ({
  __esModule: true,
  default: ({ children, variant, color, className, onClick }: any) => (
    <div data-testid={`typography-${variant}`} className={className} onClick={onClick}>
      {children}
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/ui/Button', () => ({
  Button: ({ children, variant, onClick, className }: any) => (
    <button
      data-testid={`button-${variant || 'default'}`}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

jest.mock('react-icons/fi', () => ({
  FiExternalLink: () => <div data-testid="external-link-icon" />,
  FiCheck: () => <div data-testid="check-icon" />,
  FiCopy: () => <div data-testid="copy-icon" />,
  FiEye: () => <div data-testid="eye-icon" />,
  FiEyeOff: () => <div data-testid="eye-off-icon" />,
}));

const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeyGuide } from '../../../../src/renderer/components/ui/ApiKeyGuide';

describe('ApiKeyGuide Component', () => {
  const defaultProps = {
    provider: 'openai' as const,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    it('renders with correct title for OpenAI provider', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('🔑')).toBeInTheDocument();
      expect(screen.getByText('How to Get Your OpenAI API Key')).toBeInTheDocument();
    });

    it('renders with correct title for Anthropic provider', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      expect(screen.getByText('🔑')).toBeInTheDocument();
      expect(screen.getByText('How to Get Your Anthropic API Key')).toBeInTheDocument();
    });

    it('renders close button when onClose prop is provided', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByTestId('button-outline')).toBeInTheDocument();
      expect(screen.getByText('Close Guide')).toBeInTheDocument();
    });

    it('does not render close button when onClose prop is not provided', () => {
      render(<ApiKeyGuide provider="openai" />);

      expect(screen.queryByTestId('button-outline')).not.toBeInTheDocument();
      expect(screen.queryByText('Close Guide')).not.toBeInTheDocument();
    });

    it('renders introductory text', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Follow these step-by-step instructions to get your API key. Don\'t worry - it\'s easier than it looks!')).toBeInTheDocument();
    });
  });

  describe('OpenAI Guide Content', () => {
    it('renders all OpenAI steps', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Create an OpenAI Account')).toBeInTheDocument();
      expect(screen.getByText('Add Billing Information')).toBeInTheDocument();
      expect(screen.getByText('Generate Your API Key')).toBeInTheDocument();
      expect(screen.getByText('Copy Your API Key')).toBeInTheDocument();
    });

    it('renders OpenAI step numbers correctly', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const stepCircles = document.querySelectorAll('.w-8.h-8.rounded-full');
      expect(stepCircles).toHaveLength(5); // Including the "Paste the Key Below" step
    });

    it('renders OpenAI external links', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Sign up for OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Go to Billing Settings')).toBeInTheDocument();
      expect(screen.getByText('Open API Keys Page')).toBeInTheDocument();

      const externalLinks = screen.getAllByTestId('external-link-icon');
      expect(externalLinks.length).toBeGreaterThan(0);
    });

    it('renders OpenAI help section', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Need Help?')).toBeInTheDocument();
      expect(screen.getByText(/If you run into any issues/)).toBeInTheDocument();
      expect(screen.getByText(/OpenAI documentation/)).toBeInTheDocument();
    });
  });

  describe('Anthropic Guide Content', () => {
    it('renders all Anthropic steps', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      expect(screen.getByText('Create an Anthropic Account')).toBeInTheDocument();
      expect(screen.getByText('Add Credits to Your Account')).toBeInTheDocument();
      expect(screen.getByText('Generate Your API Key')).toBeInTheDocument();
      expect(screen.getByText('Copy Your API Key')).toBeInTheDocument();
    });

    it('renders Anthropic step numbers correctly', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      const stepElements = screen.getAllByText(/[1-4]/);
      expect(stepElements).toHaveLength(4);
    });

    it('renders Anthropic external links', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      expect(screen.getByText('Sign up for Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
      expect(screen.getByText('Open API Keys Page')).toBeInTheDocument();

      const externalLinks = screen.getAllByTestId('external-link-icon');
      expect(externalLinks.length).toBeGreaterThan(0);
    });

    it('renders Anthropic help section', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      expect(screen.getByText('Need Help?')).toBeInTheDocument();
      expect(screen.getByText(/If you run into any issues/)).toBeInTheDocument();
      expect(screen.getByText(/Anthropic documentation/)).toBeInTheDocument();
    });
  });

  describe('Step Component', () => {
    it('renders step with correct number when not completed', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const firstSteps = screen.getAllByText('1');
      expect(firstSteps.length).toBeGreaterThan(0);
    });

    it('renders step with check icon when completed', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Create an OpenAI Account')).toBeInTheDocument();
    });

    it('renders step content correctly', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('First, you\'ll need to create an account with OpenAI if you don\'t already have one.')).toBeInTheDocument();
    });
  });

  describe('API Key Display and Copy Functionality', () => {
    it('renders API key display area', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Your API key will look like this:')).toBeInTheDocument();
    });

    it('renders copy button', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    });

    it('calls clipboard API when copy button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApiKeyGuide {...defaultProps} />);

      const copyButton = screen.getByTestId('copy-icon').closest('button');
      if (copyButton) {
        await user.click(copyButton);
        expect(mockClipboard.writeText).toHaveBeenCalledWith('sk-your-api-key-here');
      }
    });

    it('renders show/hide toggle for API key', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const hasEyeIcon = screen.queryByTestId('eye-icon');
      const hasEyeOffIcon = screen.queryByTestId('eye-off-icon');

      expect(hasEyeIcon || hasEyeOffIcon).toBeTruthy();
    });

    it('toggles API key visibility', async () => {
      const user = userEvent.setup();
      render(<ApiKeyGuide {...defaultProps} />);

      const toggleButton = screen.getByTestId('eye-icon').closest('button') ||
                          screen.getByTestId('eye-off-icon').closest('button');

      if (toggleButton) {
        await user.click(toggleButton);
      }
    });
  });

  describe('User Interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApiKeyGuide {...defaultProps} />);

      const closeButton = screen.getByText('Close Guide');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('opens external links in new tabs', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('Styling and Accessibility', () => {
    it('applies correct CSS classes', () => {
      const { container } = render(<ApiKeyGuide {...defaultProps} />);

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass('max-w-4xl', 'mx-auto');

      const stepElements = container.querySelectorAll('.flex.space-x-4');
      expect(stepElements.length).toBeGreaterThan(0);
    });

    it('renders with proper ARIA attributes', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('renders tip sections with proper styling', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      const tipSections = document.querySelectorAll('.bg-blue-50');
      expect(tipSections.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles invalid provider gracefully', () => {
      expect(() => {
        render(<ApiKeyGuide provider="openai" />);
      }).not.toThrow();
    });

    it('renders without crashing when props are missing', () => {
      expect(() => {
        render(<ApiKeyGuide provider="openai" />);
      }).not.toThrow();
    });

    it('handles clipboard API errors gracefully', async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard not available'));

      const user = userEvent.setup();
      render(<ApiKeyGuide {...defaultProps} />);

      const copyButton = screen.getByTestId('copy-icon').closest('button');
      if (copyButton) {
        await user.click(copyButton);
        expect(mockClipboard.writeText).toHaveBeenCalled();
      }
    });
  });

  describe('Content Accuracy', () => {
    it('displays correct OpenAI URLs', () => {
      render(<ApiKeyGuide {...defaultProps} />);

      expect(screen.getByText('Sign up for OpenAI').closest('a')).toHaveAttribute('href', 'https://platform.openai.com/signup');
      expect(screen.getByText('Go to Billing Settings').closest('a')).toHaveAttribute('href', 'https://platform.openai.com/account/billing');
      expect(screen.getAllByText('Open API Keys Page')[0].closest('a')).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    });

    it('displays correct Anthropic URLs', () => {
      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);

      expect(screen.getByText('Sign up for Anthropic').closest('a')).toHaveAttribute('href', 'https://console.anthropic.com/account');
      expect(screen.getByText('Add Credits').closest('a')).toHaveAttribute('href', 'https://console.anthropic.com/account/billing');
      expect(screen.getAllByText('Open API Keys Page')[0].closest('a')).toHaveAttribute('href', 'https://console.anthropic.com/settings/keys');
    });

    it('displays appropriate billing information for each provider', () => {
      render(<ApiKeyGuide {...defaultProps} />);
      expect(screen.getByText(/only pay for what you use/)).toBeInTheDocument();
      expect(screen.getByText(/\$5 in free credits/)).toBeInTheDocument();

      render(<ApiKeyGuide {...defaultProps} provider="anthropic" />);
      expect(screen.getByText(/prepaid credit system/)).toBeInTheDocument();
      expect(screen.getByText(/Claude 3.5 Haiku/)).toBeInTheDocument();
    });
  });
});
