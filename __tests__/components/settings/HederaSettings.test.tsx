;(window as any).electron = {
  getEnvironmentConfig: jest.fn(() => Promise.resolve({ enableMainnet: false })),
  testHederaConnection: jest.fn(() => Promise.resolve({ success: true })),
  saveConfig: jest.fn(() => Promise.resolve(undefined)),
  loadConfig: jest.fn(() => Promise.resolve({})),
  reset: jest.fn(),
};

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HederaSettings } from '../../../src/renderer/pages/settings/HederaSettings';
import { useConfigStore } from '../../../src/renderer/stores/configStore';
import type { ConfigStore } from '../../../src/renderer/stores/configStore';

jest.mock('../../../src/renderer/stores/configStore');

const mockUseConfigStore = useConfigStore as jest.MockedFunction<
  typeof useConfigStore
>;

describe('HederaSettings', () => {
  const mockSetHederaAccountId = jest.fn();
  const mockSetHederaPrivateKey = jest.fn();
  const mockSetHederaNetwork = jest.fn();
  const mockTestHederaConnection = jest.fn();
  const mockIsHederaConfigValid = jest.fn();

  const defaultConfig = {
    hedera: {
      accountId: '',
      privateKey: '',
      network: 'testnet' as const,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseConfigStore.mockReturnValue({
      config: defaultConfig,
      setHederaAccountId: mockSetHederaAccountId,
      setHederaPrivateKey: mockSetHederaPrivateKey,
      setHederaNetwork: mockSetHederaNetwork,
      testHederaConnection: mockTestHederaConnection,
      isHederaConfigValid: mockIsHederaConfigValid,
      isLoading: false,
      error: null,
      isConfigured: () => true,
      setOpenAIApiKey: jest.fn(),
      setOpenAIModel: jest.fn(),
      setAnthropicApiKey: jest.fn(),
      setAnthropicModel: jest.fn(),
      setLLMProvider: jest.fn(),
      setTheme: jest.fn().mockResolvedValue(void 0),
      setAutoStart: jest.fn(),
      setLogLevel: jest.fn(),
      setOperationalMode: jest.fn(),
      setAutonomousMode: jest.fn(),
      saveConfig: jest.fn().mockResolvedValue(void 0),
      loadConfig: jest.fn().mockResolvedValue(void 0),
      testOpenAIConnection: jest.fn().mockResolvedValue({ success: true }),
      testAnthropicConnection: jest.fn().mockResolvedValue({ success: true }),
      reset: jest.fn(),
    } as ConfigStore);

    mockIsHederaConfigValid.mockReturnValue(false);
  });

  it('should render all form fields', () => {
    render(<HederaSettings />);

    expect(screen.getByText('Hedera Configuration')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure your Hedera account credentials and network settings.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Account ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.0.12345')).toBeInTheDocument();

    expect(screen.getByText('Private Key')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter your private key')
    ).toBeInTheDocument();

    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('should update account ID on input', async () => {
    const user = userEvent.setup();
    render(<HederaSettings />);

    const accountIdInput = screen.getByPlaceholderText('0.0.12345');
    await user.type(accountIdInput, '0.0.99999');

    await waitFor(() => {
      expect(mockSetHederaAccountId).toHaveBeenCalledWith('0.0.99999');
    });
  });

  it('should update private key on input', async () => {
    const user = userEvent.setup();
    render(<HederaSettings />);

    const privateKeyInput = screen.getByPlaceholderText(
      'Enter your private key'
    );
    const testKey = '0x' + '0'.repeat(64);
    await user.type(privateKeyInput, testKey);

    await waitFor(() => {
      expect(mockSetHederaPrivateKey).toHaveBeenCalledWith(testKey);
    });
  });

  it('should update network on selection', async () => {
    const user = userEvent.setup();
    render(<HederaSettings />);

    const networkSelect = screen.getByRole('combobox');
    await user.selectOptions(networkSelect, 'mainnet');

    await waitFor(() => {
      expect(mockSetHederaNetwork).toHaveBeenCalledWith('mainnet');
    });
  });

  it('should show validation error for invalid account ID', async () => {
    render(<HederaSettings />);

    const accountIdInput = screen.getByPlaceholderText('0.0.12345');
    fireEvent.change(accountIdInput, { target: { value: 'invalid' } });
    fireEvent.blur(accountIdInput);

    await waitFor(() => {
      expect(
        screen.getByText('Invalid account ID format (e.g., 0.0.12345)')
      ).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid private key', async () => {
    render(<HederaSettings />);

    const privateKeyInput = screen.getByPlaceholderText(
      'Enter your private key'
    );
    fireEvent.change(privateKeyInput, { target: { value: 'too-short' } });
    fireEvent.blur(privateKeyInput);

    await waitFor(() => {
      expect(
        screen.getByText('Invalid private key format')
      ).toBeInTheDocument();
    });
  });

  it('should disable test button when config is invalid', () => {
    mockIsHederaConfigValid.mockReturnValue(false);
    render(<HederaSettings />);

    const testButton = screen.getByText('Test Connection');
    expect(testButton).toBeDisabled();
  });

  it('should enable test button when config is valid', () => {
    mockIsHederaConfigValid.mockReturnValue(true);
    render(<HederaSettings />);

    const testButton = screen.getByText('Test Connection');
    expect(testButton).not.toBeDisabled();
  });

  it('should test connection successfully', async () => {
    const user = userEvent.setup();
    mockIsHederaConfigValid.mockReturnValue(true);
    mockTestHederaConnection.mockResolvedValue({
      success: true,
      error: undefined,
    });

    render(<HederaSettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    expect(screen.getByText('Testing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Connection successful!')).toBeInTheDocument();
    });
  });

  it('should show error on connection test failure', async () => {
    const user = userEvent.setup();
    mockIsHederaConfigValid.mockReturnValue(true);
    mockTestHederaConnection.mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    render(<HederaSettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should handle connection test exception', async () => {
    const user = userEvent.setup();
    mockIsHederaConfigValid.mockReturnValue(true);
    mockTestHederaConnection.mockRejectedValue(new Error('Network error'));

    render(<HederaSettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should render with pre-filled values', () => {
    mockUseConfigStore.mockReturnValue({
      config: {
        hedera: {
          accountId: '0.0.12345',
          privateKey: '0x' + '0'.repeat(64),
          network: 'mainnet',
        },
      },
      setHederaAccountId: mockSetHederaAccountId,
      setHederaPrivateKey: mockSetHederaPrivateKey,
      setHederaNetwork: mockSetHederaNetwork,
      testHederaConnection: mockTestHederaConnection,
      isHederaConfigValid: mockIsHederaConfigValid,
      isLoading: false,
      error: null,
      isConfigured: () => true,
      setOpenAIApiKey: jest.fn(),
      setOpenAIModel: jest.fn(),
      setAnthropicApiKey: jest.fn(),
      setAnthropicModel: jest.fn(),
      setLLMProvider: jest.fn(),
      setTheme: jest.fn().mockResolvedValue(void 0),
      setAutoStart: jest.fn(),
      setLogLevel: jest.fn(),
      setOperationalMode: jest.fn(),
      setAutonomousMode: jest.fn(),
      saveConfig: jest.fn().mockResolvedValue(void 0),
      loadConfig: jest.fn().mockResolvedValue(void 0),
      testOpenAIConnection: jest.fn().mockResolvedValue({ success: true }),
      testAnthropicConnection: jest.fn().mockResolvedValue({ success: true }),
      reset: jest.fn(),
    } as ConfigStore);

    render(<HederaSettings />);

    const accountIdInput = screen.getByPlaceholderText(
      '0.0.12345'
    ) as HTMLInputElement;
    expect(accountIdInput.value).toBe('0.0.12345');

    const privateKeyInput = screen.getByPlaceholderText(
      'Enter your private key'
    ) as HTMLInputElement;
    expect(privateKeyInput.value).toBe('0x' + '0'.repeat(64));

    const networkSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(networkSelect.value).toBe('mainnet');
  });

  it('should mask private key input', () => {
    render(<HederaSettings />);

    const privateKeyInput = screen.getByPlaceholderText(
      'Enter your private key'
    ) as HTMLInputElement;
    expect(privateKeyInput.type).toBe('password');
  });

  it('should show security note for private key', () => {
    render(<HederaSettings />);

    expect(
      screen.getByText(
        'Your private key is encrypted and stored securely using the system keychain.'
      )
    ).toBeInTheDocument();
  });
});
