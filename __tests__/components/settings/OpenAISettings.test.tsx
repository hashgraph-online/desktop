import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenAISettings } from '../../../src/renderer/pages/settings/OpenAISettings';
import { useConfigStore } from '../../../src/renderer/stores/configStore';
import type { ConfigStore } from '../../../src/renderer/stores/configStore';

jest.mock('../../../src/renderer/stores/configStore');

const mockUseConfigStore = useConfigStore as jest.MockedFunction<
  typeof useConfigStore
>;

describe('OpenAISettings', () => {
  const mockSetOpenAIApiKey = jest.fn();
  const mockSetOpenAIModel = jest.fn();
  const mockTestOpenAIConnection = jest.fn();
  const mockIsOpenAIConfigValid = jest.fn();

  const defaultConfig = {
    openai: {
      apiKey: '',
      model: 'gpt-4o' as const,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseConfigStore.mockReturnValue({
      config: defaultConfig,
      setOpenAIApiKey: mockSetOpenAIApiKey,
      setOpenAIModel: mockSetOpenAIModel,
      testOpenAIConnection: mockTestOpenAIConnection,
      isOpenAIConfigValid: mockIsOpenAIConfigValid,
      isLoading: false,
      error: null,
      isConfigured: () => true,
      setHederaAccountId: jest.fn(),
      setHederaPrivateKey: jest.fn(),
      setHederaNetwork: jest.fn(),
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
      testHederaConnection: jest.fn().mockResolvedValue({ success: true }),
      testAnthropicConnection: jest.fn().mockResolvedValue({ success: true }),
      reset: jest.fn(),
    } as ConfigStore);

    mockIsOpenAIConfigValid.mockReturnValue(false);
  });

  it('should render all form fields', () => {
    render(<OpenAISettings />);

    expect(screen.getByText('OpenAI Configuration')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure your OpenAI API settings for the conversational agent.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('should update API key on input', async () => {
    const user = userEvent.setup();
    render(<OpenAISettings />);

    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    await user.type(apiKeyInput, 'sk-test123456789');

    await waitFor(() => {
      expect(mockSetOpenAIApiKey).toHaveBeenCalledWith('sk-test123456789');
    });
  });

  it('should update model on selection', async () => {
    const user = userEvent.setup();
    render(<OpenAISettings />);

    const modelSelect = screen.getByRole('combobox');
    await user.selectOptions(modelSelect, 'gpt-4');

    await waitFor(() => {
      expect(mockSetOpenAIModel).toHaveBeenCalledWith('gpt-4');
    });
  });

  it('should show all available models', () => {
    render(<OpenAISettings />);

    const modelSelect = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(modelSelect.options).map((opt) => opt.value);

    expect(options).toContain('gpt-4o');
    expect(options).toContain('gpt-4');
    expect(options).toContain('gpt-3.5-turbo');
  });

  it('should show validation error for invalid API key', async () => {
    render(<OpenAISettings />);

    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } });
    fireEvent.blur(apiKeyInput);

    await waitFor(() => {
      expect(
        screen.getByText("API key must start with 'sk-'")
      ).toBeInTheDocument();
    });
  });

  it('should disable test button when config is invalid', () => {
    mockIsOpenAIConfigValid.mockReturnValue(false);
    render(<OpenAISettings />);

    const testButton = screen.getByText('Test Connection');
    expect(testButton).toBeDisabled();
  });

  it('should enable test button when config is valid', () => {
    mockIsOpenAIConfigValid.mockReturnValue(true);
    render(<OpenAISettings />);

    const testButton = screen.getByText('Test Connection');
    expect(testButton).not.toBeDisabled();
  });

  it('should test connection successfully', async () => {
    const user = userEvent.setup();
    mockIsOpenAIConfigValid.mockReturnValue(true);
    mockTestOpenAIConnection.mockResolvedValue({
      success: true,
      error: undefined,
    });

    render(<OpenAISettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    expect(screen.getByText('Testing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Connection successful!')).toBeInTheDocument();
    });
  });

  it('should show error on connection test failure', async () => {
    const user = userEvent.setup();
    mockIsOpenAIConfigValid.mockReturnValue(true);
    mockTestOpenAIConnection.mockResolvedValue({
      success: false,
      error: 'Invalid API key',
    });

    render(<OpenAISettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });
  });

  it('should handle connection test exception', async () => {
    const user = userEvent.setup();
    mockIsOpenAIConfigValid.mockReturnValue(true);
    mockTestOpenAIConnection.mockRejectedValue(new Error('Network timeout'));

    render(<OpenAISettings />);

    const testButton = screen.getByText('Test Connection');
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  it('should render with pre-filled values', () => {
    mockUseConfigStore.mockReturnValue({
      config: {
        openai: {
          apiKey: 'sk-existingkey123456789',
          model: 'gpt-4',
        },
      },
      setOpenAIApiKey: mockSetOpenAIApiKey,
      setOpenAIModel: mockSetOpenAIModel,
      testOpenAIConnection: mockTestOpenAIConnection,
      isOpenAIConfigValid: mockIsOpenAIConfigValid,
      isLoading: false,
      error: null,
      isConfigured: () => true,
      setHederaAccountId: jest.fn(),
      setHederaPrivateKey: jest.fn(),
      setHederaNetwork: jest.fn(),
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
      testHederaConnection: jest.fn().mockResolvedValue({ success: true }),
      testAnthropicConnection: jest.fn().mockResolvedValue({ success: true }),
      reset: jest.fn(),
    } as ConfigStore);

    render(<OpenAISettings />);

    const apiKeyInput = screen.getByPlaceholderText(
      'sk-...'
    ) as HTMLInputElement;
    expect(apiKeyInput.value).toBe('sk-existingkey123456789');

    const modelSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(modelSelect.value).toBe('gpt-4');
  });

  it('should mask API key input', () => {
    render(<OpenAISettings />);

    const apiKeyInput = screen.getByPlaceholderText(
      'sk-...'
    ) as HTMLInputElement;
    expect(apiKeyInput.type).toBe('password');
  });

  it('should show security note for API key', () => {
    render(<OpenAISettings />);

    expect(
      screen.getByText(
        'Your API key is encrypted and stored securely using the system keychain.'
      )
    ).toBeInTheDocument();
  });

  it('should show model cost information', () => {
    render(<OpenAISettings />);

    expect(
      screen.getByText(
        'GPT-4o is the latest and most capable model. GPT-4 provides great responses but costs more per token than GPT-3.5 Turbo.'
      )
    ).toBeInTheDocument();
  });

  it('should set default model to gpt-4o when empty', async () => {
    const _user = userEvent.setup();
    render(<OpenAISettings />);

    const modelSelect = screen.getByRole('combobox');
    fireEvent.change(modelSelect, { target: { value: '' } });
    fireEvent.blur(modelSelect);

    await waitFor(() => {
      expect(mockSetOpenAIModel).toHaveBeenCalledWith('gpt-4o');
    });
  });
});
