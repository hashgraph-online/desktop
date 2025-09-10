const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.doMock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger)
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn()
  },
  rmSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn()
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn()
  }
}));

import { ConfigService } from '../../../src/main/services/config-service';
import * as fs from 'fs';
import * as path from 'path';
import { app, safeStorage } from 'electron';

const currentDir = '/mock/test/dir';

/**
 * Tests for atomic write operations in ConfigService
 */
describe('ConfigService Atomic Write Operations', () => {
  let configService: ConfigService;
  let userDataPath: string;
  let configPath: string;
  let transactionLogPath: string;

  beforeEach(() => {
    jest.clearAllMocks();

    userDataPath = path.join(currentDir, 'test-user-data');
    (app.getPath as jest.Mock).mockReturnValue(userDataPath);
    (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false);

    const fileSystem = new Map<string, string>();

    (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
      return fileSystem.has(path);
    });
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as jest.Mock).mockImplementation((path: string) => {
      fileSystem.delete(path);
    });
    (fs.rmSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockImplementation((path: string) => fileSystem.get(path) || '{}');
    (fs.writeFileSync as jest.Mock).mockImplementation((path: string, data: string) => {
      fileSystem.set(path, data);
    });

    (fs.promises.writeFile as jest.Mock).mockImplementation(async (path: string, data: string) => {
      fileSystem.set(path, data);
    });
    (fs.promises.readFile as jest.Mock).mockImplementation(async (path: string) => {
      return fileSystem.get(path) || '{}';
    });
    (fs.promises.rename as jest.Mock).mockImplementation(async (oldPath: string, newPath: string) => {
      const data = fileSystem.get(oldPath);
      if (data) {
        fileSystem.delete(oldPath);
        fileSystem.set(newPath, data);
      }
    });
    (fs.promises.unlink as jest.Mock).mockImplementation(async (path: string) => {
      fileSystem.delete(path);
    });
    (fs.promises.copyFile as jest.Mock).mockImplementation(async (src: string, dest: string) => {
      const data = fileSystem.get(src);
      if (data) {
        fileSystem.set(dest, data);
      }
    });

    configService = ConfigService.getInstance();
    configPath = path.join(userDataPath, 'config.json');
    transactionLogPath = path.join(userDataPath, '.config-transaction.log');
  });

  afterEach(() => {
  });

  describe('Atomic Write Operations', () => {
    it('should write config atomically using temp file and rename', async () => {
      const testConfig = {
        hedera: { accountId: '0.0.1234', privateKey: 'test', network: 'testnet' as const },
        openai: { apiKey: 'test-key', model: 'gpt-4o-mini' },
        anthropic: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' },
        advanced: { theme: 'light' as const, autoStart: false, logLevel: 'info' as const },
        llmProvider: 'openai' as const
      };

      await configService.save(testConfig);

      expect(fs.existsSync(configPath)).toBe(true);
      
      expect(fs.existsSync(transactionLogPath)).toBe(false);
      
      const savedContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedContent.hedera.accountId).toBe('0.0.1234');
    });

    it('should handle concurrent write operations with locking', async () => {
      const config1 = {
        hedera: { accountId: '0.0.1111', privateKey: 'test1', network: 'testnet' as const },
        openai: { apiKey: 'key1', model: 'gpt-4o-mini' },
        anthropic: { apiKey: 'key1', model: 'claude-3-5-sonnet-20241022' },
        advanced: { theme: 'light' as const, autoStart: false, logLevel: 'info' as const },
        llmProvider: 'openai' as const
      };

      const config2 = {
        hedera: { accountId: '0.0.2222', privateKey: 'test2', network: 'testnet' as const },
        openai: { apiKey: 'key2', model: 'gpt-4o-mini' },
        anthropic: { apiKey: 'key2', model: 'claude-3-5-sonnet-20241022' },
        advanced: { theme: 'dark' as const, autoStart: true, logLevel: 'debug' as const },
        llmProvider: 'anthropic' as const
      };

      const save1 = configService.save(config1);
      const save2 = configService.save(config2);

      await Promise.all([save1, save2]);

      const savedContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedContent.hedera.accountId).toBe('0.0.2222');
      expect(savedContent.advanced.theme).toBe('dark');
    });

    it('should rollback on write failure', async () => {
      const testConfig = {
        hedera: { accountId: '0.0.1234', privateKey: 'test', network: 'testnet' as const },
        openai: { apiKey: 'test-key', model: 'gpt-4o-mini' },
        anthropic: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' },
        advanced: { theme: 'light' as const, autoStart: false, logLevel: 'info' as const },
        llmProvider: 'openai' as const
      };

      await configService.save(testConfig);
      const originalContent = fs.readFileSync(configPath, 'utf8');

      const _originalRename = fs.promises.rename;
      jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('Rename failed'));

      const newConfig = { ...testConfig, hedera: { ...testConfig.hedera, accountId: '0.0.9999' } };
      
      await expect(configService.save(newConfig)).rejects.toThrow('Rename failed');

      const afterFailureContent = fs.readFileSync(configPath, 'utf8');
      expect(afterFailureContent).toBe(originalContent);
      
      expect(fs.existsSync(transactionLogPath)).toBe(false);
    });


    it('should recover from incomplete transaction on startup', async () => {
      const incompleteLog = {
        transactionId: 'test-transaction',
        state: 'backup_created',
        timestamp: new Date().toISOString(),
        data: {
          tempPath: path.join(userDataPath, 'config.json.tmp.test-transaction'),
          backupPath: path.join(userDataPath, 'config.json.backup.test-transaction')
        }
      };

      fs.writeFileSync(transactionLogPath, JSON.stringify(incompleteLog) + '\n');
      
      const backupConfig = { hedera: { accountId: '0.0.backup' } };
      fs.writeFileSync(incompleteLog.data.backupPath, JSON.stringify(backupConfig));
      
      fs.writeFileSync(incompleteLog.data.tempPath, JSON.stringify({ hedera: { accountId: '0.0.temp' } }));

      jest.spyOn(app, 'getPath').mockReturnValue(userDataPath);
      const _newConfigService = new (ConfigService as unknown as new () => ConfigService)();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fs.existsSync(configPath)).toBe(true);
      const restoredContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(restoredContent.hedera.accountId).toBe('0.0.backup');
      
      expect(fs.existsSync(incompleteLog.data.tempPath)).toBe(false);
      
      expect(fs.existsSync(transactionLogPath)).toBe(false);
    });
  });
});