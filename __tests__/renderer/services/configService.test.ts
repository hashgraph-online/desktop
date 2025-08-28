import { ConfigService } from '../../../src/renderer/services/configService';
import type { AppConfig } from '../../../src/renderer/stores/configStore';

const mockElectron = {
  saveConfig: jest.fn(),
  loadConfig: jest.fn(),
  testHederaConnection: jest.fn(),
  testOpenAIConnection: jest.fn(),
  testAnthropicConnection: jest.fn(),
  setTheme: jest.fn(),
  setAutoStart: jest.fn(),
  setLogLevel: jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
  configurable: true,
});

describe('ConfigService', () => {
  let configService: ConfigService;

  const mockClassList = {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    toggle: jest.fn(),
  };

  beforeAll(() => {
    Object.defineProperty(document, 'documentElement', {
      value: {
        classList: mockClassList
      },
      configurable: true
    });
  });

  const mockConfig: AppConfig = {
    hedera: {
      accountId: '0.0.123456',
      privateKey: '302e020100300506032b6570042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      network: 'testnet'
    },
    openai: {
      apiKey: 'sk-test123456789012345678901234567890123456789012345678901234567890',
      model: 'gpt-4'
    },
    anthropic: {
      apiKey: 'sk-ant-test123456789012345678901234567890123456789012345678901234567890',
      model: 'claude-3-sonnet-20240229'
    },
    advanced: {
      theme: 'dark',
      autoStart: true,
      logLevel: 'info'
    },
    llmProvider: 'openai',
    operationalMode: 'autonomous'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClassList.add.mockClear();
    mockClassList.remove.mockClear();

    configService = new ConfigService();
  });

  describe('saveConfig', () => {
    test('should successfully save configuration', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined);

      await expect(configService.saveConfig(mockConfig)).resolves.toBeUndefined();

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(mockConfig as unknown as Record<string, unknown>);
      expect(mockElectron.saveConfig).toHaveBeenCalledTimes(1);
    });

    test('should handle save configuration errors', async () => {
      const errorMessage = 'Failed to write config file';
      mockElectron.saveConfig.mockRejectedValue(new Error(errorMessage));

      await expect(configService.saveConfig(mockConfig)).rejects.toThrow(
        `Failed to save configuration: ${errorMessage}`
      );

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(mockConfig as unknown as Record<string, unknown>);
    });

    test('should handle non-Error save configuration errors', async () => {
      mockElectron.saveConfig.mockRejectedValue('String error');

      await expect(configService.saveConfig(mockConfig)).rejects.toThrow(
        'Failed to save configuration: Unknown error'
      );
    });

    test('should save minimal configuration', async () => {
      const minimalConfig: AppConfig = {
        hedera: {
          accountId: '0.0.123456',
          privateKey: '302e020100300506032b6570042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          network: 'testnet'
        },
        openai: {
          apiKey: 'sk-test123456789012345678901234567890123456789012345678901234567890',
          model: 'gpt-4'
        },
        anthropic: {
          apiKey: 'sk-ant-test123456789012345678901234567890123456789012345678901234567890',
          model: 'claude-3-sonnet-20240229'
        },
        advanced: {
          theme: 'light',
          autoStart: false,
          logLevel: 'info'
        },
        llmProvider: 'openai',
        operationalMode: 'provideBytes'
      };

      mockElectron.saveConfig.mockResolvedValue(undefined);

      await expect(configService.saveConfig(minimalConfig)).resolves.toBeUndefined();

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(minimalConfig as unknown as Record<string, unknown>);
    });
  });

  describe('loadConfig', () => {
    test('should successfully load configuration', async () => {
      mockElectron.loadConfig.mockResolvedValue(mockConfig);

      const result = await configService.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(mockElectron.loadConfig).toHaveBeenCalledTimes(1);
    });

    test('should return null when no configuration exists', async () => {
      mockElectron.loadConfig.mockResolvedValue(null);

      const result = await configService.loadConfig();

      expect(result).toBeNull();
      expect(mockElectron.loadConfig).toHaveBeenCalledTimes(1);
    });

    test('should handle load configuration errors', async () => {
      const errorMessage = 'Config file not found';
      mockElectron.loadConfig.mockRejectedValue(new Error(errorMessage));

      await expect(configService.loadConfig()).rejects.toThrow(
        `Failed to load configuration: ${errorMessage}`
      );
    });

    test('should handle non-Error load configuration errors', async () => {
      mockElectron.loadConfig.mockRejectedValue('String error');

      await expect(configService.loadConfig()).rejects.toThrow(
        'Failed to load configuration: Unknown error'
      );
    });
  });

  describe('testHederaConnection', () => {
    const hederaCredentials = {
      accountId: '0.0.123456',
      privateKey: '302e020100300506032b6570042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      network: 'testnet' as const
    };

    test('should successfully test Hedera connection', async () => {
      const expectedResult = {
        success: true,
        balance: '1000.0 ℏ'
      };

      mockElectron.testHederaConnection.mockResolvedValue(expectedResult);

      const result = await configService.testHederaConnection(hederaCredentials);

      expect(result).toEqual(expectedResult);
      expect(mockElectron.testHederaConnection).toHaveBeenCalledWith(hederaCredentials);
      expect(mockElectron.testHederaConnection).toHaveBeenCalledTimes(1);
    });

    test('should handle Hedera connection test failure', async () => {
      const expectedResult = {
        success: false,
        error: 'Invalid credentials'
      };

      mockElectron.testHederaConnection.mockResolvedValue(expectedResult);

      const result = await configService.testHederaConnection(hederaCredentials);

      expect(result).toEqual(expectedResult);
    });

    test('should handle Hedera connection test errors', async () => {
      const errorMessage = 'Network error';
      mockElectron.testHederaConnection.mockRejectedValue(new Error(errorMessage));

      const result = await configService.testHederaConnection(hederaCredentials);

      expect(result).toEqual({
        success: false,
        error: errorMessage
      });
    });

    test('should handle non-Error Hedera connection test errors', async () => {
      mockElectron.testHederaConnection.mockRejectedValue('String error');

      const result = await configService.testHederaConnection(hederaCredentials);

      expect(result).toEqual({
        success: false,
        error: 'Connection test failed'
      });
    });

    test('should test Hedera connection with mainnet', async () => {
      const mainnetCredentials = {
        ...hederaCredentials,
        network: 'mainnet' as const
      };

      mockElectron.testHederaConnection.mockResolvedValue({ success: true });

      await configService.testHederaConnection(mainnetCredentials);

      expect(mockElectron.testHederaConnection).toHaveBeenCalledWith(mainnetCredentials);
    });
  });

  describe('testOpenAIConnection', () => {
    const openAICredentials = {
      apiKey: 'sk-test123456789012345678901234567890123456789012345678901234567890'
    };

    test('should successfully test OpenAI connection', async () => {
      const expectedResult = {
        success: true,
        model: 'gpt-4'
      };

      mockElectron.testOpenAIConnection.mockResolvedValue(expectedResult);

      const result = await configService.testOpenAIConnection(openAICredentials);

      expect(result).toEqual(expectedResult);
      expect(mockElectron.testOpenAIConnection).toHaveBeenCalledWith(openAICredentials);
    });

    test('should handle OpenAI connection test errors', async () => {
      const errorMessage = 'Invalid API key';
      mockElectron.testOpenAIConnection.mockRejectedValue(new Error(errorMessage));

      const result = await configService.testOpenAIConnection(openAICredentials);

      expect(result).toEqual({
        success: false,
        error: errorMessage
      });
    });

    test('should handle non-Error OpenAI connection test errors', async () => {
      mockElectron.testOpenAIConnection.mockRejectedValue('API error');

      const result = await configService.testOpenAIConnection(openAICredentials);

      expect(result).toEqual({
        success: false,
        error: 'Connection test failed'
      });
    });
  });

  describe('Validation Methods', () => {
    describe('validateAccountId', () => {
      test('should validate correct Hedera account ID format', () => {
        expect(configService.validateAccountId('0.0.123456')).toBe(true);
        expect(configService.validateAccountId('0.0.1')).toBe(true);
        expect(configService.validateAccountId('123.456.789')).toBe(true);
      });

      test('should reject invalid Hedera account ID format', () => {
        expect(configService.validateAccountId('')).toBe(false);
        expect(configService.validateAccountId('0.0')).toBe(false);
        expect(configService.validateAccountId('0.123456')).toBe(false);
        expect(configService.validateAccountId('123456')).toBe(false);
        expect(configService.validateAccountId('0.0.123abc')).toBe(false);
        expect(configService.validateAccountId('invalid')).toBe(false);
      });
    });

    describe('validatePrivateKey', () => {
      test('should validate correct private key length', () => {
        const validKey = 'a'.repeat(64);
        expect(configService.validatePrivateKey(validKey)).toBe(true);

        const longKey = 'a'.repeat(128);
        expect(configService.validatePrivateKey(longKey)).toBe(true);
      });

      test('should reject invalid private key length', () => {
        expect(configService.validatePrivateKey('')).toBe(false);
        expect(configService.validatePrivateKey('a'.repeat(32))).toBe(false);
        expect(configService.validatePrivateKey('a'.repeat(63))).toBe(false);
      });
    });

    describe('validateOpenAIApiKey', () => {
      test('should validate correct OpenAI API key format', () => {
        expect(configService.validateOpenAIApiKey('sk-test12345678901234567890')).toBe(true);
        expect(configService.validateOpenAIApiKey('sk-123456789012345678901234567890123456789012345678901234567890')).toBe(true);
      });

      test('should reject invalid OpenAI API key format', () => {
        expect(configService.validateOpenAIApiKey('')).toBe(false);
        expect(configService.validateOpenAIApiKey('sk-')).toBe(false);
        expect(configService.validateOpenAIApiKey('invalid-key')).toBe(false);
        expect(configService.validateOpenAIApiKey('pk-test12345678901234567890')).toBe(false);
      });
    });

    describe('validateAnthropicApiKey', () => {
      test('should validate correct Anthropic API key format', () => {
        expect(configService.validateAnthropicApiKey('sk-ant-test12345678901234567890')).toBe(true);
        expect(configService.validateAnthropicApiKey('sk-ant-123456789012345678901234567890123456789012345678901234567890')).toBe(true);
      });

      test('should reject invalid Anthropic API key format', () => {
        expect(configService.validateAnthropicApiKey('')).toBe(false);
        expect(configService.validateAnthropicApiKey('sk-ant-')).toBe(false);
        expect(configService.validateAnthropicApiKey('invalid-key')).toBe(false);
        expect(configService.validateAnthropicApiKey('sk-test12345678901234567890')).toBe(false);
      });
    });
  });

  describe('Theme Management', () => {
    test('should apply dark theme', async () => {
      mockElectron.setTheme.mockResolvedValue(undefined);

      await expect(configService.applyTheme('dark')).resolves.toBeUndefined();

      expect(mockElectron.setTheme).toHaveBeenCalledWith('dark');
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    test('should apply light theme', async () => {
      mockElectron.setTheme.mockResolvedValue(undefined);

      await expect(configService.applyTheme('light')).resolves.toBeUndefined();

      expect(mockElectron.setTheme).toHaveBeenCalledWith('light');
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
    });

    test('should handle theme application errors', async () => {
      const errorMessage = 'Theme application failed';
      mockElectron.setTheme.mockRejectedValue(new Error(errorMessage));

      await expect(configService.applyTheme('dark')).rejects.toThrow(
        `Failed to apply theme: ${errorMessage}`
      );
    });
  });

  describe('Auto-start Management', () => {
    test('should enable auto-start', async () => {
      mockElectron.setAutoStart.mockResolvedValue(undefined);

      await expect(configService.setAutoStart(true)).resolves.toBeUndefined();

      expect(mockElectron.setAutoStart).toHaveBeenCalledWith(true);
    });

    test('should disable auto-start', async () => {
      mockElectron.setAutoStart.mockResolvedValue(undefined);

      await expect(configService.setAutoStart(false)).resolves.toBeUndefined();

      expect(mockElectron.setAutoStart).toHaveBeenCalledWith(false);
    });

    test('should handle auto-start errors', async () => {
      const errorMessage = 'Auto-start setting failed';
      mockElectron.setAutoStart.mockRejectedValue(new Error(errorMessage));

      await expect(configService.setAutoStart(true)).rejects.toThrow(
        `Failed to set auto-start: ${errorMessage}`
      );
    });
  });

  describe('Log Level Management', () => {
    test.each(['debug', 'info', 'warn', 'error'] as const)(
      'should set log level to %s',
      async (level) => {
        mockElectron.setLogLevel.mockResolvedValue(undefined);

        await expect(configService.setLogLevel(level)).resolves.toBeUndefined();

        expect(mockElectron.setLogLevel).toHaveBeenCalledWith(level);
      }
    );

    test('should handle log level errors', async () => {
      const errorMessage = 'Log level setting failed';
      mockElectron.setLogLevel.mockRejectedValue(new Error(errorMessage));

      await expect(configService.setLogLevel('debug')).rejects.toThrow(
        `Failed to set log level: ${errorMessage}`
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete configuration workflow', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined);
      await configService.saveConfig(mockConfig);

      mockElectron.loadConfig.mockResolvedValue(mockConfig);
      const loadedConfig = await configService.loadConfig();

      expect(loadedConfig).toEqual(mockConfig);

      mockElectron.testHederaConnection.mockResolvedValue({ success: true, balance: '500.0 ℏ' });
      mockElectron.testOpenAIConnection.mockResolvedValue({ success: true, model: 'gpt-4' });

      const hederaResult = await configService.testHederaConnection(mockConfig.hedera);
      const openAIResult = await configService.testOpenAIConnection({ apiKey: mockConfig.openai.apiKey });

      expect(hederaResult.success).toBe(true);
      expect(openAIResult.success).toBe(true);
    });

    test('should handle configuration errors gracefully', async () => {
      mockElectron.saveConfig.mockRejectedValue(new Error('Save failed'));
      await expect(configService.saveConfig(mockConfig)).rejects.toThrow('Failed to save configuration: Save failed');

      mockElectron.loadConfig.mockRejectedValue(new Error('Load failed'));
      await expect(configService.loadConfig()).rejects.toThrow('Failed to load configuration: Load failed');

      mockElectron.testHederaConnection.mockRejectedValue(new Error('Connection failed'));
      const result = await configService.testHederaConnection(mockConfig.hedera);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle undefined errors', async () => {
      mockElectron.saveConfig.mockRejectedValue(undefined);

      await expect(configService.saveConfig(mockConfig)).rejects.toThrow(
        'Failed to save configuration: Unknown error'
      );
    });

    test('should handle null errors', async () => {
      mockElectron.loadConfig.mockRejectedValue(null);

      await expect(configService.loadConfig()).rejects.toThrow(
        'Failed to load configuration: Unknown error'
      );
    });

    test('should handle object errors', async () => {
      mockElectron.testHederaConnection.mockRejectedValue({ message: 'Object error' });

      const result = await configService.testHederaConnection(mockConfig.hedera);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection test failed');
    });
  });
});
