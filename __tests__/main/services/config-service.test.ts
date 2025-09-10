import { ConfigService, AppConfig } from '../../../src/main/services/config-service';
import { Logger } from '../../../src/main/utils/logger';
import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock('path', () => ({
  join: jest.fn(),
}));

jest.mock('../../../src/main/utils/logger');

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockLogger: jest.Mocked<Logger>;
  let mockApp: jest.Mocked<typeof app>;
  let mockSafeStorage: jest.Mocked<typeof safeStorage>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsPromises: jest.Mocked<typeof fs.promises>;
  let mockPath: jest.Mocked<typeof path>;

  const mockUserDataPath = '/mock/user/data';
  const mockConfigPath = '/mock/user/data/config.json';
  const mockTransactionLogPath = '/mock/user/data/.config-transaction.log';

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockApp = app as jest.Mocked<typeof app>;
    mockSafeStorage = safeStorage as jest.Mocked<typeof safeStorage>;
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;
    mockPath = path as jest.Mocked<typeof path>;

    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);

    mockApp.getPath.mockReturnValue(mockUserDataPath);
    mockPath.join
      .mockReturnValueOnce(mockConfigPath) // configPath
      .mockReturnValueOnce(mockTransactionLogPath); // transactionLogPath

    (ConfigService as any).instance = null;

    configService = ConfigService.getInstance();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with correct paths', () => {
      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
      expect(mockPath.join).toHaveBeenCalledWith(mockUserDataPath, 'config.json');
      expect(mockPath.join).toHaveBeenCalledWith(mockUserDataPath, '.config-transaction.log');
      expect(mockLogger.info).toHaveBeenCalledWith('ConfigService initialized', {
        configPath: mockConfigPath,
      });
    });
  });

  describe('load', () => {
    const mockDefaultConfig = {
      hedera: { accountId: '', privateKey: '', network: 'testnet' as const },
      openai: { apiKey: '', model: 'gpt-3.5-turbo' },
      anthropic: { apiKey: '', model: 'claude-3-haiku' },
      advanced: { theme: 'light' as const, autoStart: false, logLevel: 'info' as const },
      llmProvider: 'openai' as const,
      operationalMode: 'development' as any,
    };

    beforeEach(() => {
      jest.spyOn(configService as any, 'getDefaultConfig').mockReturnValue(mockDefaultConfig);
    });

    test('should return defaults when config file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await configService.load();

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigPath);
      expect(result).toBe(mockDefaultConfig);
      expect(mockLogger.info).toHaveBeenCalledWith('No config file found, returning defaults');
    });

    test('should load and decrypt encrypted config successfully', async () => {
      const encryptedConfig = {
        hedera: {
          accountId: '0.0.12345',
          privateKey: Buffer.from('encrypted-private-key').toString('base64'),
          network: 'testnet' as const,
        },
        openai: {
          apiKey: Buffer.from('encrypted-openai-key').toString('base64'),
          model: 'gpt-4',
        },
        anthropic: {
          apiKey: Buffer.from('encrypted-anthropic-key').toString('base64'),
          model: 'claude-3-opus',
        },
        advanced: { theme: 'dark' as const, autoStart: true, logLevel: 'debug' as const },
        llmProvider: 'anthropic' as const,
        operationalMode: 'production' as any,
      };

      const fileContent = JSON.stringify(encryptedConfig);

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(fileContent);
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);

      mockSafeStorage.decryptString
        .mockReturnValueOnce('decrypted-private-key')
        .mockReturnValueOnce('decrypted-openai-key')
        .mockReturnValueOnce('decrypted-anthropic-key');

      jest.spyOn(configService as any, 'isEncryptedValue')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      jest.spyOn(configService as any, 'deepMergeWithDefaults').mockReturnValue(encryptedConfig);

      const result = await configService.load();

      expect(mockFsPromises.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(mockSafeStorage.decryptString).toHaveBeenCalledTimes(3);
      expect(result).toBe(encryptedConfig);
    });

    test('should handle decryption failures gracefully', async () => {
      const configWithEncryptedKeys = {
        hedera: {
          accountId: '0.0.12345',
          privateKey: Buffer.from('encrypted-key').toString('base64'),
          network: 'testnet' as const,
        },
        openai: { apiKey: '', model: 'gpt-4' },
        anthropic: { apiKey: '', model: 'claude-3-opus' },
        advanced: { theme: 'dark' as const, autoStart: true, logLevel: 'debug' as const },
        llmProvider: 'openai' as const,
        operationalMode: 'production' as any,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(configWithEncryptedKeys));
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      jest.spyOn(configService as any, 'isEncryptedValue').mockReturnValue(true);
      jest.spyOn(configService as any, 'deepMergeWithDefaults').mockReturnValue(configWithEncryptedKeys);

      const result = await configService.load();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to decrypt Hedera private key, keeping encrypted value'
      );
      expect(result.hedera.privateKey).toBe(Buffer.from('encrypted-key').toString('base64'));
    });

    test('should handle encryption not available', async () => {
      const plainConfig = {
        hedera: { accountId: '0.0.12345', privateKey: 'plain-private-key', network: 'testnet' as const },
        openai: { apiKey: 'plain-openai-key', model: 'gpt-4' },
        anthropic: { apiKey: 'plain-anthropic-key', model: 'claude-3-opus' },
        advanced: { theme: 'dark' as const, autoStart: true, logLevel: 'debug' as const },
        llmProvider: 'openai' as const,
        operationalMode: 'production' as any,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(plainConfig));
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      jest.spyOn(configService as any, 'deepMergeWithDefaults').mockReturnValue(plainConfig);

      const result = await configService.load();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Encryption not available, returning encrypted values'
      );
      expect(result).toBe(plainConfig);
    });

    test('should handle file read errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockRejectedValue(new Error('File read error'));

      const result = await configService.load();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load config', expect.any(Error));
      expect(result).toBe(mockDefaultConfig);
    });

    test('should handle JSON parse errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue('invalid json');

      const result = await configService.load();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load config', expect.any(Error));
      expect(result).toBe(mockDefaultConfig);
    });
  });

  describe('save', () => {
    const testConfig: AppConfig = {
      hedera: { accountId: '0.0.12345', privateKey: 'test-private-key', network: 'testnet' },
      openai: { apiKey: 'test-openai-key', model: 'gpt-4' },
      anthropic: { apiKey: 'test-anthropic-key', model: 'claude-3-opus' },
      advanced: { theme: 'dark', autoStart: true, logLevel: 'debug' },
      llmProvider: 'openai',
      operationalMode: 'production' as any,
    };

    beforeEach(() => {
      jest.spyOn(configService as any, 'performAtomicSave').mockResolvedValue(undefined);
    });

    test('should save config successfully', async () => {
      await configService.save(testConfig);

      expect((configService as any).performAtomicSave).toHaveBeenCalledWith(testConfig);
    });

    test('should handle save errors', async () => {
      const error = new Error('Save failed');
      jest.spyOn(configService as any, 'performAtomicSave').mockRejectedValue(error);

      await expect(configService.save(testConfig)).rejects.toThrow('Save failed');
    });

    test('should handle concurrent saves with write lock', async () => {
      let firstSaveCompleted = false;
      let secondSaveStarted = false;

      jest.spyOn(configService as any, 'performAtomicSave')
        .mockImplementation(async () => {
          firstSaveCompleted = true;
          await new Promise(resolve => setTimeout(resolve, 10));
        })
        .mockImplementationOnce(async () => {
          secondSaveStarted = true;
          await new Promise(resolve => setTimeout(resolve, 5));
        });

      const save1 = configService.save(testConfig);
      const save2 = configService.save(testConfig);

      await Promise.all([save1, save2]);

      expect(mockLogger.info).toHaveBeenCalledWith('Waiting for existing write operation to complete');
    });
  });

  describe('isEncryptedValue', () => {
    test('should return false for OpenAI API keys', () => {
      expect((configService as any).isEncryptedValue('sk-1234567890abcdef')).toBe(false);
    });

    test('should return false for Anthropic API keys', () => {
      expect((configService as any).isEncryptedValue('sk-ant-1234567890abcdef')).toBe(false);
    });

    test('should return false for hex values over 64 characters', () => {
      const longHex = 'a'.repeat(65);
      expect((configService as any).isEncryptedValue(longHex)).toBe(false);
    });

    test('should return true for other base64-like strings', () => {
      expect((configService as any).isEncryptedValue('SGVsbG8gV29ybGQ=')).toBe(true);
    });

    test('should return false for non-strings', () => {
      expect((configService as any).isEncryptedValue(null)).toBe(false);
      expect((configService as any).isEncryptedValue(undefined)).toBe(false);
      expect((configService as any).isEncryptedValue(123)).toBe(false);
    });

    test('should return false for empty strings', () => {
      expect((configService as any).isEncryptedValue('')).toBe(false);
    });
  });

  describe('getDefaultConfig', () => {
    test('should return default configuration', () => {
      const defaults = (configService as any).getDefaultConfig();

      expect(defaults).toEqual({
        hedera: { accountId: '', privateKey: '', network: 'testnet' },
        openai: { apiKey: '', model: 'gpt-4o-mini' },
        anthropic: { apiKey: '', model: 'claude-3-7-sonnet-latest' },
        advanced: { theme: 'light', autoStart: false, logLevel: 'info' },
        llmProvider: 'openai',
        legalAcceptance: {
          termsAccepted: false,
          privacyAccepted: false,
        },
      });
    });

    test('should use environment variables when available', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        HEDERA_OPERATOR_ID: '0.0.12345',
        HEDERA_OPERATOR_KEY: 'test-private-key',
        HEDERA_NETWORK: 'mainnet',
        OPENAI_API_KEY: 'sk-test-key',
        ANTHROPIC_API_KEY: 'sk-ant-test-key',
      };

      const defaults = (configService as any).getDefaultConfig();

      expect(defaults.hedera.accountId).toBe('0.0.12345');
      expect(defaults.hedera.privateKey).toBe('test-private-key');
      expect(defaults.hedera.network).toBe('mainnet');
      expect(defaults.openai.apiKey).toBe('sk-test-key');
      expect(defaults.anthropic.apiKey).toBe('sk-ant-test-key');

      expect(mockLogger.info).toHaveBeenCalledWith('Using environment variables for configuration', {
        variables: ['HEDERA_OPERATOR_ID', 'HEDERA_OPERATOR_KEY', 'HEDERA_NETWORK', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
      });

      process.env = originalEnv;
    });
  });

  describe('deepMergeWithDefaults', () => {
    test('should merge config with defaults', () => {
      const partialConfig = {
        hedera: { accountId: '0.0.12345' },
        advanced: { theme: 'dark' as const },
      };

      const result = (configService as any).deepMergeWithDefaults(partialConfig, false);

      expect(result.hedera.accountId).toBe('0.0.12345');
      expect(result.hedera.network).toBe('testnet'); // from defaults
      expect(result.advanced.theme).toBe('dark');
      expect(result.advanced.autoStart).toBe(false); // from defaults
    });

    test('should include environment variables when requested', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: 'env-openai-key',
      };

      const partialConfig = {
        openai: { model: 'gpt-4' },
      };

      const result = (configService as any).deepMergeWithDefaults(partialConfig, true);

      expect(result.openai.apiKey).toBe('env-openai-key');
      expect(result.openai.model).toBe('gpt-4');

      process.env = originalEnv;
    });
  });

  describe('recoverFromTransactionLog', () => {
    test('should not attempt recovery when log does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await (configService as any).recoverFromTransactionLog();

      expect(mockFsPromises.readFile).not.toHaveBeenCalled();
    });

    test('should clear empty transaction log', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue('');
      mockFsPromises.unlink.mockResolvedValue(undefined);

      await (configService as any).recoverFromTransactionLog();

      expect(mockFsPromises.unlink).toHaveBeenCalledWith(mockTransactionLogPath);
    });

    test('should handle transaction recovery for write_temp state', async () => {
      const logEntry = {
        transactionId: 'test-tx',
        state: 'write_temp',
        timestamp: new Date().toISOString(),
        data: { tempPath: '/tmp/test.tmp' },
      };

      mockFs.existsSync
        .mockReturnValueOnce(true) // log exists
        .mockReturnValueOnce(true); // temp file exists

      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(logEntry));
      mockFsPromises.unlink.mockResolvedValue(undefined);

      await (configService as any).recoverFromTransactionLog();

      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/tmp/test.tmp');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up temporary file from incomplete transaction'
      );
    });

    test('should handle transaction recovery errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockRejectedValue(new Error('Read failed'));

      await (configService as any).recoverFromTransactionLog();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to recover from transaction log', expect.any(Error));
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete config lifecycle', async () => {
      const newConfig: AppConfig = {
        hedera: { accountId: '0.0.12345', privateKey: 'new-private-key', network: 'mainnet' },
        openai: { apiKey: 'new-openai-key', model: 'gpt-4-turbo' },
        anthropic: { apiKey: 'new-anthropic-key', model: 'claude-3-opus' },
        advanced: { theme: 'dark', autoStart: true, logLevel: 'debug' },
        llmProvider: 'anthropic',
        operationalMode: 'production' as any,
      };

      jest.spyOn(configService as any, 'performAtomicSave').mockResolvedValue(undefined);

      await configService.save(newConfig);
      expect((configService as any).performAtomicSave).toHaveBeenCalled();

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(newConfig));
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      jest.spyOn(configService as any, 'deepMergeWithDefaults').mockReturnValue(newConfig);

      const loadedConfig = await configService.load();
      expect(loadedConfig).toEqual(newConfig);
    });

    test('should handle concurrent save operations', async () => {
      const config1: AppConfig = {
        hedera: { accountId: '0.0.111', privateKey: 'key1', network: 'testnet' },
        openai: { apiKey: 'api1', model: 'gpt-4' },
        anthropic: { apiKey: 'api1', model: 'claude-3-haiku' },
        advanced: { theme: 'light', autoStart: false, logLevel: 'info' },
        llmProvider: 'openai',
        operationalMode: 'development' as any,
      };

      const config2: AppConfig = {
        hedera: { accountId: '0.0.222', privateKey: 'key2', network: 'mainnet' },
        openai: { apiKey: 'api2', model: 'gpt-3.5-turbo' },
        anthropic: { apiKey: 'api2', model: 'claude-3-sonnet' },
        advanced: { theme: 'dark', autoStart: true, logLevel: 'debug' },
        llmProvider: 'anthropic',
        operationalMode: 'production' as any,
      };

      let saveOrder: string[] = [];
      jest.spyOn(configService as any, 'performAtomicSave')
        .mockImplementation(async () => {
          saveOrder.push('save');
          await new Promise(resolve => setTimeout(resolve, 10));
          saveOrder.push('complete');
        });

      const save1 = configService.save(config1);
      const save2 = configService.save(config2);

      await Promise.all([save1, save2]);

      expect(saveOrder).toEqual(['save', 'complete', 'save', 'complete']);
    });

    test('should handle config validation and sanitization', async () => {
      const invalidConfig = {
        hedera: { accountId: '', privateKey: '', network: 'invalid' as any },
        openai: { apiKey: 'valid-key', model: '' },
        anthropic: { apiKey: '', model: 'claude-3-haiku' },
        advanced: { theme: 'invalid' as any, autoStart: 'yes' as any, logLevel: 'trace' as any },
        llmProvider: 'invalid' as any,
        operationalMode: 'invalid' as any,
      };

      const sanitizedConfig = {
        hedera: { accountId: '', privateKey: '', network: 'testnet' }, // sanitized
        openai: { apiKey: 'valid-key', model: 'gpt-3.5-turbo' }, // sanitized
        anthropic: { apiKey: '', model: 'claude-3-haiku' },
        advanced: { theme: 'light', autoStart: false, logLevel: 'info' }, // sanitized
        llmProvider: 'openai', // sanitized
        operationalMode: 'development', // sanitized
      };

      jest.spyOn(configService as any, 'deepMergeWithDefaults').mockReturnValue(sanitizedConfig);

      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      const result = await configService.load();

      expect(result.hedera.network).toBe('testnet');
      expect(result.openai.model).toBe('gpt-3.5-turbo');
      expect(result.advanced.theme).toBe('light');
      expect(result.llmProvider).toBe('openai');
    });
  });
});