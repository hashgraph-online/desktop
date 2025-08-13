import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { promisify } from 'util';
import * as crypto from 'crypto';

import type { StoredHCS10Profile } from '../../shared/schemas/hcs10';

export interface AppConfig {
  hedera: {
    accountId: string;
    privateKey: string;
    network: 'mainnet' | 'testnet';
  };
  openai: {
    apiKey: string;
    model: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
  };
  advanced: {
    theme: 'light' | 'dark';
    autoStart: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  llmProvider: 'openai' | 'anthropic';
  hcs10Profiles?: StoredHCS10Profile[];
  legalAcceptance?: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    termsAcceptedAt?: string;
    privacyAcceptedAt?: string;
  };
}

/**
 * Service for managing application configuration with encrypted storage
 */
export class ConfigService {
  private static instance: ConfigService;
  private configPath: string;
  private logger: Logger;
  private writeLock: Promise<void> | null = null;
  private transactionLogPath: string;

  private constructor() {
    this.logger = new Logger({ module: 'ConfigService' });
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.transactionLogPath = path.join(userDataPath, '.config-transaction.log');
    this.logger.info('ConfigService initialized', { configPath: this.configPath });
    
    this.recoverFromTransactionLog();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<AppConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.logger.info('No config file found, returning defaults');
        return this.getDefaultConfig();
      }

      const encryptedData = await fs.promises.readFile(this.configPath, 'utf8');
      const configData = JSON.parse(encryptedData);

      if (safeStorage.isEncryptionAvailable()) {
        if (configData.hedera?.privateKey) {
          try {
            if (this.isEncryptedValue(configData.hedera.privateKey)) {
              try {
                const encryptedBuffer = Buffer.from(configData.hedera.privateKey, 'base64');
                const decrypted = safeStorage.decryptString(encryptedBuffer);
                configData.hedera.privateKey = decrypted;
              } catch (decryptError) {
                this.logger.warn('Failed to decrypt Hedera private key, keeping encrypted value');
              }
            }
          } catch (error) {
            this.logger.error('Error processing Hedera private key:', error);
          }
        }
        
        if (configData.openai?.apiKey) {
          try {
            if (this.isEncryptedValue(configData.openai.apiKey)) {
              const encryptedBuffer = Buffer.from(configData.openai.apiKey, 'base64');
              const decrypted = safeStorage.decryptString(encryptedBuffer);
              configData.openai.apiKey = decrypted;
            }
          } catch (error) {
            this.logger.error('Failed to decrypt OpenAI API key', error);
          }
        }
        
        if (configData.anthropic?.apiKey) {
          try {
            if (this.isEncryptedValue(configData.anthropic.apiKey)) {
              const encryptedBuffer = Buffer.from(configData.anthropic.apiKey, 'base64');
              configData.anthropic.apiKey = safeStorage.decryptString(encryptedBuffer);
            }
          } catch (error) {
            this.logger.error('Failed to decrypt Anthropic API key', error);
          }
        }
      } else {
        this.logger.warn('Encryption not available, returning encrypted values');
      }

      
      return this.deepMergeWithDefaults(configData);
    } catch (error) {
      this.logger.error('Failed to load config', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to disk with atomic write operations
   */
  async save(config: AppConfig): Promise<void> {
    if (this.writeLock) {
      this.logger.info('Waiting for existing write operation to complete');
      await this.writeLock;
    }

    this.writeLock = this.performAtomicSave(config);
    
    try {
      await this.writeLock;
    } finally {
      this.writeLock = null;
    }
  }

  /**
   * Perform atomic save operation with transaction logging
   */
  private async performAtomicSave(config: AppConfig): Promise<void> {
    const transactionId = crypto.randomBytes(16).toString('hex');
    const tempPath = `${this.configPath}.tmp.${transactionId}`;
    const backupPath = `${this.configPath}.backup.${transactionId}`;
    
    try {
      await this.logTransaction(transactionId, 'start', { tempPath, backupPath });
      
      const configToSave = JSON.parse(JSON.stringify(config));

      if (safeStorage.isEncryptionAvailable()) {
        if (configToSave.hedera?.privateKey && configToSave.hedera.privateKey.trim() !== '') {
          if (!this.isEncryptedValue(configToSave.hedera.privateKey)) {
            const encrypted = safeStorage.encryptString(configToSave.hedera.privateKey);
            configToSave.hedera.privateKey = encrypted.toString('base64');
          }
        }
        if (configToSave.openai?.apiKey && configToSave.openai.apiKey.trim() !== '') {
          if (!this.isEncryptedValue(configToSave.openai.apiKey)) {
            const encrypted = safeStorage.encryptString(configToSave.openai.apiKey);
            configToSave.openai.apiKey = encrypted.toString('base64');
          }
        }
        if (configToSave.anthropic?.apiKey && configToSave.anthropic.apiKey.trim() !== '') {
          if (!this.isEncryptedValue(configToSave.anthropic.apiKey)) {
            const encrypted = safeStorage.encryptString(configToSave.anthropic.apiKey);
            configToSave.anthropic.apiKey = encrypted.toString('base64');
          }
        }
      } else {
        this.logger.warn('Encryption not available, saving config in plain text');
      }

      const userDataPath = app.getPath('userData');
      await fs.promises.mkdir(userDataPath, { recursive: true });
      
      const dataToWrite = JSON.stringify(configToSave, null, 2);
      await fs.promises.writeFile(tempPath, dataToWrite, 'utf8');
      await this.logTransaction(transactionId, 'write_temp', { size: dataToWrite.length });
      
      const writtenData = await fs.promises.readFile(tempPath, 'utf8');
      try {
        const parsedData = JSON.parse(writtenData);
        if (!parsedData.hedera || !parsedData.openai || !parsedData.anthropic || !parsedData.advanced) {
          throw new Error('Invalid config structure after write');
        }
      } catch (error) {
        await this.logTransaction(transactionId, 'validation_failed', { error: String(error) });
        throw new Error(`Config validation failed: ${error}`);
      }
      await this.logTransaction(transactionId, 'validated');
      
      if (fs.existsSync(this.configPath)) {
        await fs.promises.copyFile(this.configPath, backupPath);
        await this.logTransaction(transactionId, 'backup_created');
      }
      
      await fs.promises.rename(tempPath, this.configPath);
      await this.logTransaction(transactionId, 'renamed');
      
      if (fs.existsSync(backupPath)) {
        await fs.promises.unlink(backupPath);
      }
      
      await this.logTransaction(transactionId, 'complete');
      await this.clearTransactionLog();
      
      this.logger.info('Config saved successfully with atomic write', { transactionId });
    } catch (error) {
      this.logger.error('Failed to save config, attempting rollback', { transactionId, error });
      
      await this.rollbackTransaction(transactionId, tempPath, backupPath);
      
      throw error;
    }
  }

  /**
   * Log transaction state for recovery
   */
  private async logTransaction(transactionId: string, state: string, data?: any): Promise<void> {
    const logEntry = {
      transactionId,
      state,
      timestamp: new Date().toISOString(),
      data: data || {}
    };
    
    try {
      await fs.promises.writeFile(
        this.transactionLogPath,
        JSON.stringify(logEntry) + '\n',
        { flag: 'a' }
      );
    } catch (error) {
      this.logger.error('Failed to write transaction log', error);
    }
  }

  /**
   * Clear transaction log after successful operation
   */
  private async clearTransactionLog(): Promise<void> {
    try {
      if (fs.existsSync(this.transactionLogPath)) {
        await fs.promises.unlink(this.transactionLogPath);
      }
    } catch (error) {
      this.logger.error('Failed to clear transaction log', error);
    }
  }

  /**
   * Rollback failed transaction
   */
  private async rollbackTransaction(transactionId: string, tempPath: string, backupPath: string): Promise<void> {
    try {
      await this.logTransaction(transactionId, 'rollback_start');
      
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
        this.logger.info('Removed temporary file', { tempPath });
      }
      
      if (fs.existsSync(backupPath)) {
        await fs.promises.rename(backupPath, this.configPath);
        this.logger.info('Restored config from backup', { backupPath });
        await this.logTransaction(transactionId, 'restored_backup');
      }
      
      await this.logTransaction(transactionId, 'rollback_complete');
      await this.clearTransactionLog();
    } catch (rollbackError) {
      this.logger.error('Failed to rollback transaction', { transactionId, error: rollbackError });
      await this.logTransaction(transactionId, 'rollback_failed', { error: String(rollbackError) });
    }
  }

  /**
   * Recover from incomplete transactions on startup
   */
  private async recoverFromTransactionLog(): Promise<void> {
    try {
      if (!fs.existsSync(this.transactionLogPath)) {
        return;
      }
      
      const logContent = await fs.promises.readFile(this.transactionLogPath, 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line);
      
      if (logLines.length === 0) {
        await this.clearTransactionLog();
        return;
      }
      
      const lastEntry = JSON.parse(logLines[logLines.length - 1]);
      const { transactionId, state, data } = lastEntry;
      
      this.logger.warn('Found incomplete transaction, attempting recovery', { transactionId, state });
      
      switch (state) {
        case 'start':
        case 'write_temp':
        case 'validation_failed':
          if (data?.tempPath && fs.existsSync(data.tempPath)) {
            await fs.promises.unlink(data.tempPath);
            this.logger.info('Cleaned up temporary file from incomplete transaction');
          }
          break;
          
        case 'validated':
        case 'backup_created':
          if (data?.backupPath && fs.existsSync(data.backupPath)) {
            await fs.promises.rename(data.backupPath, this.configPath);
            this.logger.info('Restored config from backup after incomplete transaction');
          }
          if (data?.tempPath && fs.existsSync(data.tempPath)) {
            await fs.promises.unlink(data.tempPath);
          }
          break;
          
        case 'renamed':
          if (data?.backupPath && fs.existsSync(data.backupPath)) {
            await fs.promises.unlink(data.backupPath);
            this.logger.info('Cleaned up backup file from successful transaction');
          }
          break;
          
        case 'complete':
          break;
          
        case 'rollback_start':
        case 'rollback_failed':
          this.logger.error('Transaction rollback was incomplete, manual recovery may be needed', { transactionId });
          break;
      }
      
      await this.clearTransactionLog();
      this.logger.info('Transaction recovery complete');
    } catch (error) {
      this.logger.error('Failed to recover from transaction log', error);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      hedera: {
        accountId: '',
        privateKey: '',
        network: 'testnet'
      },
      openai: {
        apiKey: '',
        model: 'gpt-4o-mini'
      },
      anthropic: {
        apiKey: '',
        model: 'claude-3-5-sonnet-20241022'
      },
      advanced: {
        theme: 'light',
        autoStart: false,
        logLevel: 'info'
      },
      llmProvider: 'openai',
      legalAcceptance: {
        termsAccepted: false,
        privacyAccepted: false
      }
    };
  }

  /**
   * Check if a value is encrypted (base64 encoded)
   */
  private isEncryptedValue(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    
    if (value.startsWith('sk-') || value.startsWith('sk-ant-')) {
      return false;
    }
    
    if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 64) {
      return false;
    }
    
    return true;
  }

  /**
   * Deep merge configuration with defaults
   */
  private deepMergeWithDefaults(config: any): AppConfig {
    const defaults = this.getDefaultConfig();
    
    const merged: any = { ...config };
    
    merged.hedera = { ...defaults.hedera, ...(config.hedera || {}) };
    merged.openai = { ...defaults.openai, ...(config.openai || {}) };
    merged.anthropic = { ...defaults.anthropic, ...(config.anthropic || {}) };
    merged.advanced = { ...defaults.advanced, ...(config.advanced || {}) };
    merged.llmProvider = config.llmProvider || defaults.llmProvider;

    if (merged.hedera.accountId === undefined) merged.hedera.accountId = defaults.hedera.accountId;
    if (merged.hedera.privateKey === undefined) merged.hedera.privateKey = defaults.hedera.privateKey;
    if (merged.hedera.network === undefined) merged.hedera.network = defaults.hedera.network;
    
    if (merged.openai.apiKey === undefined) merged.openai.apiKey = defaults.openai.apiKey;
    if (merged.openai.model === undefined) merged.openai.model = defaults.openai.model;
    
    if (merged.anthropic.apiKey === undefined) merged.anthropic.apiKey = defaults.anthropic.apiKey;
    if (merged.anthropic.model === undefined) merged.anthropic.model = defaults.anthropic.model;
    
    if (merged.advanced.theme === undefined) merged.advanced.theme = defaults.advanced.theme;
    if (merged.advanced.autoStart === undefined) merged.advanced.autoStart = defaults.advanced.autoStart;
    if (merged.advanced.logLevel === undefined) merged.advanced.logLevel = defaults.advanced.logLevel;
    
    return merged as AppConfig;
  }
}