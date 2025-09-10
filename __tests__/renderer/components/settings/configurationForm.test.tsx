;(window as any).electron = {
  getEnvironmentConfig: jest.fn(() => Promise.resolve({ enableMainnet: false })),
  testHederaConnection: jest.fn(() => Promise.resolve({ success: true })),
  testOpenAIConnection: jest.fn(() => Promise.resolve({ success: true })),
  testAnthropicConnection: jest.fn(() => Promise.resolve({ success: true })),
  saveConfig: jest.fn(() => Promise.resolve(undefined)),
  loadConfig: jest.fn(() => Promise.resolve({})),
  reset: jest.fn(),
};

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HederaSettings } from '../../../../src/renderer/pages/settings/HederaSettings';
import { OpenAISettings } from '../../../../src/renderer/pages/settings/OpenAISettings';
import { AdvancedSettings } from '../../../../src/renderer/pages/settings/AdvancedSettings';
import { useConfigStore } from '../../../../src/renderer/stores/configStore';
import type { ConfigStore } from '../../../../src/renderer/stores/configStore';

jest.mock('../../../../src/renderer/stores/configStore');

describe('Configuration Form Validation', () => {
  const mockUseConfigStore = useConfigStore as jest.MockedFunction<
    typeof useConfigStore
  >;

  beforeEach(() => {
    mockUseConfigStore.mockReturnValue({
      config: {
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet',
        },
        openai: {
          apiKey: '',
          model: 'gpt-4',
        },
        advanced: {
          theme: 'light',
          autoStart: false,
        },
      },
      isLoading: false,
      error: null,
      setHederaAccountId: jest.fn(),
      setHederaPrivateKey: jest.fn(),
      setHederaNetwork: jest.fn(),
      setOpenAIApiKey: jest.fn(),
      setOpenAIModel: jest.fn(),
      setTheme: jest.fn(),
      setAutoStart: jest.fn(),
      saveConfig: jest.fn(),
      loadConfig: jest.fn(),
      testHederaConnection: jest.fn(),
      testOpenAIConnection: jest.fn(),
      isHederaConfigValid: jest.fn(),
      isOpenAIConfigValid: jest.fn(),
      setAnthropicApiKey: jest.fn(),
      setAnthropicModel: jest.fn(),
      setLLMProvider: jest.fn(),
      setLogLevel: jest.fn(),
      setOperationalMode: jest.fn(),
      setAutonomousMode: jest.fn(),
      testAnthropicConnection: jest.fn(),
      isAnthropicConfigValid: jest.fn(),
      isLLMConfigValid: jest.fn(),
      clearError: jest.fn(),
      isConfigured: jest.fn(),
    } as ConfigStore);
  });

  describe('Hedera Settings Validation', () => {
    it('should validate account ID format', async () => {
      const user = userEvent.setup();
      render(<HederaSettings />);

      const accountIdInput = screen.getByLabelText(/account id/i);

      await user.type(accountIdInput, 'invalid-format');

      await waitFor(() => {
        expect(
          screen.getByText(/invalid account id format/i)
        ).toBeInTheDocument();
      });

      await user.clear(accountIdInput);
      await user.type(accountIdInput, '0.0.12345');

      await waitFor(() => {
        expect(
          screen.queryByText(/invalid account id format/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should validate private key format', async () => {
      const user = userEvent.setup();
      render(<HederaSettings />);

      const privateKeyInput = screen.getByLabelText(/private key/i);

      await user.type(privateKeyInput, 'short-key');

      await waitFor(() => {
        expect(
          screen.getByText(/invalid private key format/i)
        ).toBeInTheDocument();
      });

      await user.clear(privateKeyInput);
      await user.type(
        privateKeyInput,
        '302e020100300506032b657004220420' + '0'.repeat(64)
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/invalid private key format/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should test Hedera connection', async () => {
      const testConnection = jest.fn().mockResolvedValue({ success: true });
      mockUseConfigStore.mockReturnValue({
        ...mockUseConfigStore(),
        config: {
          hedera: {
            accountId: '0.0.12345',
            privateKey: 'valid-key',
            network: 'testnet',
          },
          openai: { apiKey: '', model: 'gpt-4' },
          advanced: { theme: 'light', autoStart: false },
        },
        isHederaConfigValid: jest.fn().mockReturnValue(true),
        testHederaConnection: testConnection,
        setAnthropicApiKey: jest.fn(),
        setAnthropicModel: jest.fn(),
        setLLMProvider: jest.fn(),
        setLogLevel: jest.fn(),
        setOperationalMode: jest.fn(),
        setAutonomousMode: jest.fn(),
        testAnthropicConnection: jest.fn(),
        isAnthropicConfigValid: jest.fn(),
        isLLMConfigValid: jest.fn(),
        clearError: jest.fn(),
        isConfigured: jest.fn(),
      } as ConfigStore);

      render(<HederaSettings />);

      const testButton = screen.getByText(/test connection/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(testConnection).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
      });
    });

    it('should handle connection test failure', async () => {
      const testConnection = jest
        .fn()
        .mockResolvedValue({ success: false, error: 'Invalid credentials' });
      mockUseConfigStore.mockReturnValue({
        ...mockUseConfigStore(),
        config: {
          hedera: {
            accountId: '0.0.12345',
            privateKey: 'valid-key',
            network: 'testnet',
          },
          openai: { apiKey: '', model: 'gpt-4' },
          advanced: { theme: 'light', autoStart: false },
        },
        isHederaConfigValid: jest.fn().mockReturnValue(true),
        testHederaConnection: testConnection,
        setAnthropicApiKey: jest.fn(),
        setAnthropicModel: jest.fn(),
        setLLMProvider: jest.fn(),
        setLogLevel: jest.fn(),
        setOperationalMode: jest.fn(),
        setAutonomousMode: jest.fn(),
        testAnthropicConnection: jest.fn(),
        isAnthropicConfigValid: jest.fn(),
        isLLMConfigValid: jest.fn(),
        clearError: jest.fn(),
        isConfigured: jest.fn(),
      } as ConfigStore);

      render(<HederaSettings />);

      const testButton = screen.getByText(/test connection/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('OpenAI Settings Validation', () => {
    it('should validate API key format', async () => {
      const user = userEvent.setup();
      render(<OpenAISettings />);

      const apiKeyInput = screen.getByLabelText(/api key/i);

      await user.type(apiKeyInput, 'invalid-key');

      await waitFor(() => {
        expect(
          screen.getByText(/api key must start with 'sk-'/i)
        ).toBeInTheDocument();
      });

      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'sk-valid-api-key');

      await waitFor(() => {
        expect(
          screen.queryByText(/api key must start with 'sk-'/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should test OpenAI connection', async () => {
      const testConnection = jest.fn().mockResolvedValue({ success: true });
      mockUseConfigStore.mockReturnValue({
        ...mockUseConfigStore(),
        config: {
          hedera: { accountId: '', privateKey: '', network: 'testnet' },
          openai: {
            apiKey: 'sk-test-key',
            model: 'gpt-4',
          },
          advanced: { theme: 'light', autoStart: false },
        },
        isOpenAIConfigValid: jest.fn().mockReturnValue(true),
        testOpenAIConnection: testConnection,
        setAnthropicApiKey: jest.fn(),
        setAnthropicModel: jest.fn(),
        setLLMProvider: jest.fn(),
        setLogLevel: jest.fn(),
        setOperationalMode: jest.fn(),
        setAutonomousMode: jest.fn(),
        testAnthropicConnection: jest.fn(),
        isAnthropicConfigValid: jest.fn(),
        isLLMConfigValid: jest.fn(),
        clearError: jest.fn(),
        isConfigured: jest.fn(),
      } as ConfigStore);

      render(<OpenAISettings />);

      const testButton = screen.getByText(/test connection/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(testConnection).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Settings', () => {
    it('should update theme setting', async () => {
      const setTheme = jest.fn();
      mockUseConfigStore.mockReturnValue({
        ...mockUseConfigStore(),
        setTheme,
        setAnthropicApiKey: jest.fn(),
        setAnthropicModel: jest.fn(),
        setLLMProvider: jest.fn(),
        setLogLevel: jest.fn(),
        setOperationalMode: jest.fn(),
        setAutonomousMode: jest.fn(),
        testAnthropicConnection: jest.fn(),
        isAnthropicConfigValid: jest.fn(),
        isLLMConfigValid: jest.fn(),
        clearError: jest.fn(),
        isConfigured: jest.fn(),
      } as ConfigStore);

      render(<AdvancedSettings />);

      const themeSelect = screen.getByLabelText(/theme/i);
      fireEvent.change(themeSelect, { target: { value: 'dark' } });

      expect(setTheme).toHaveBeenCalledWith('dark');
    });

    it('should update auto-start setting', async () => {
      const setAutoStart = jest.fn();
      mockUseConfigStore.mockReturnValue({
        ...mockUseConfigStore(),
        setAutoStart,
        setAnthropicApiKey: jest.fn(),
        setAnthropicModel: jest.fn(),
        setLLMProvider: jest.fn(),
        setLogLevel: jest.fn(),
        setOperationalMode: jest.fn(),
        setAutonomousMode: jest.fn(),
        testAnthropicConnection: jest.fn(),
        isAnthropicConfigValid: jest.fn(),
        isLLMConfigValid: jest.fn(),
        clearError: jest.fn(),
        isConfigured: jest.fn(),
      } as ConfigStore);

      render(<AdvancedSettings />);

      const autoStartCheckbox = screen.getByLabelText(/start on system boot/i);
      fireEvent.click(autoStartCheckbox);

      expect(setAutoStart).toHaveBeenCalledWith(true);
    });
  });
});
