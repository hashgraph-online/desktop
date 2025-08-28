import { ConfigService } from '../../../src/main/services/ConfigService';
import * as fs from 'fs';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

/**
 * Tests for atomic write operations in ConfigService
 */
describe('ConfigService Atomic Write Operations', () => {
  let configService: ConfigService;
  let userDataPath: string;
  let configPath: string;
  let transactionLogPath: string;

  beforeEach(() => {
    userDataPath = path.join(currentDir, 'test-user-data');
    jest.spyOn(app, 'getPath').mockReturnValue(userDataPath);
    jest.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(false);
    
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    configService = ConfigService.getInstance();
    configPath = path.join(userDataPath, 'config.json');
    transactionLogPath = path.join(userDataPath, '.config-transaction.log');
    
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    if (fs.existsSync(transactionLogPath)) {
      fs.unlinkSync(transactionLogPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(userDataPath)) {
      fs.rmSync(userDataPath, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
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