import { CredentialManager } from '../../../src/main/services/credential-manager';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../src/main/services/encryption-service', () => ({
  EncryptionService: jest.fn().mockImplementation(() => ({
    encrypt: jest.fn(),
    decrypt: jest.fn()
  }))
}));

jest.mock('electron', () => ({
  safeStorage: {
    encryptString: jest.fn(),
    decryptString: jest.fn()
  },
  app: {
    getPath: jest.fn()
  }
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  let mockEncryptionService: any;
  let mockSafeStorage: any;
  let mockFs: any;
  let mockPath: any;
  let mockApp: any;
  let mockLogger: any;

  const masterPassword = 'test-master-password';
  const testCredentialsFile = '/test/userData/credentials.dat';

  beforeEach(() => {
    jest.clearAllMocks();

    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn()
    };

    mockSafeStorage = {
      encryptString: jest.fn(),
      decryptString: jest.fn()
    };

    mockFs = {
      readFile: jest.fn(),
      writeFile: jest.fn()
    };

    mockPath = {
      join: jest.fn()
    };

    mockApp = {
      getPath: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    const { EncryptionService } = require('../../../src/main/services/encryption-service');
    EncryptionService.mockImplementation(() => mockEncryptionService);

    const { safeStorage, app } = require('electron');
    Object.assign(safeStorage, mockSafeStorage);
    Object.assign(app, mockApp);

    const { readFile, writeFile } = require('fs/promises');
    Object.assign(readFile, mockFs.readFile);
    Object.assign(writeFile, mockFs.writeFile);

    const { join } = require('path');
    mockPath.join.mockReturnValue(testCredentialsFile);
    Object.assign(join, mockPath.join);

    const { Logger } = require('../../../src/main/utils/logger');
    Logger.mockImplementation(() => mockLogger);

    mockApp.getPath.mockReturnValue('/test/userData');

    credentialManager = new CredentialManager(masterPassword);
  });

  describe('Constructor', () => {
    test('should create CredentialManager with initialization', () => {
      expect(mockPath.join).toHaveBeenCalledWith('/test/userData', 'credentials.dat');
      expect(credentialManager).toBeDefined();
    });

    test('should initialize with provided master password', () => {
      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
    });
  });

  describe('store', () => {
    const testService = 'test-service';
    const testAccount = 'test-account';
    const testPassword = 'test-password';
    const encryptedPassword = 'encrypted-password-data';

    beforeEach(() => {
      mockEncryptionService.encrypt.mockResolvedValue(encryptedPassword);
    });

    test('should store credential successfully', async () => {
      const emptyCredentials: any[] = [];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(emptyCredentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testPassword, masterPassword);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should update existing credential', async () => {
      const existingCredentials = [
        {
          service: testService,
          account: testAccount,
          encryptedPassword: 'old-encrypted-password',
          createdAt: Date.now() - 1000
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(existingCredentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testPassword, masterPassword);
    });

    test('should handle file not found for first storage', async () => {
      const encryptedData = Buffer.from('encrypted-file-data');
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';

      (credentialManager as any).loadCredentials = jest.fn().mockResolvedValue([]);

      mockSafeStorage.encryptString.mockReturnValue(encryptedData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(true);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testPassword, masterPassword);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should throw error for empty service', async () => {
      await expect(credentialManager.store('', testAccount, testPassword))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should throw error for empty account', async () => {
      await expect(credentialManager.store(testService, '', testPassword))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should return false when encryption fails', async () => {
      const encryptionError = new Error('Encryption failed');
      mockEncryptionService.encrypt.mockRejectedValue(encryptionError);

      const emptyCredentials: any[] = [];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(emptyCredentials));

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to store credential:', encryptionError);
    });

    test('should return false when file write fails', async () => {
      const writeError = new Error('Write failed');
      mockFs.writeFile.mockRejectedValue(writeError);

      const emptyCredentials: any[] = [];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(emptyCredentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(true);
    });

    test('should handle multiple credentials across different services', async () => {
      const existingCredentials = [
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'other-encrypted',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(existingCredentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.store(testService, testAccount, testPassword);

      expect(result).toBe(true);
      expect(mockSafeStorage.encryptString).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    const testService = 'test-service';
    const testAccount = 'test-account';
    const encryptedPassword = 'encrypted-password-data';
    const decryptedPassword = 'decrypted-password';

    test('should retrieve credential successfully', async () => {
      const credentials = [
        {
          service: testService,
          account: testAccount,
          encryptedPassword,
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockEncryptionService.decrypt.mockResolvedValue(decryptedPassword);

      const result = await credentialManager.get(testService, testAccount);

      expect(result).toBe(decryptedPassword);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(encryptedPassword, masterPassword);
    });

    test('should return null for non-existent credential', async () => {
      const credentials: any[] = [];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.get(testService, testAccount);

      expect(result).toBeNull();
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });

    test('should throw error for empty service', async () => {
      await expect(credentialManager.get('', testAccount))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should throw error for empty account', async () => {
      await expect(credentialManager.get(testService, ''))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should return null when decryption fails', async () => {
      const credentials = [
        {
          service: testService,
          account: testAccount,
          encryptedPassword,
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');
      const decryptionError = new Error('Decryption failed');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockEncryptionService.decrypt.mockRejectedValue(decryptionError);

      const result = await credentialManager.get(testService, testAccount);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to retrieve credential:', decryptionError);
    });

    test('should return null when file read fails', async () => {
      const readError = new Error('Read failed');
      mockFs.readFile.mockRejectedValue(readError);

      const result = await credentialManager.get(testService, testAccount);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      const result = await credentialManager.get(testService, testAccount);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    const testService = 'test-service';
    const testAccount = 'test-account';

    test('should delete existing credential successfully', async () => {
      const credentials = [
        {
          service: testService,
          account: testAccount,
          encryptedPassword: 'encrypted-password',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'other-encrypted',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.delete(testService, testAccount);

      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should return false when credential not found', async () => {
      const credentials = [
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'other-encrypted',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.delete(testService, testAccount);

      expect(result).toBe(false);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    test('should throw error for empty service', async () => {
      await expect(credentialManager.delete('', testAccount))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should throw error for empty account', async () => {
      await expect(credentialManager.delete(testService, ''))
        .rejects.toThrow('Service and account must not be empty');
    });

    test('should return false when file operation fails', async () => {
      const credentials = [
        {
          service: testService,
          account: testAccount,
          encryptedPassword: 'encrypted-password',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');
      const writeError = new Error('Write failed');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockFs.writeFile.mockRejectedValue(writeError);

      const result = await credentialManager.delete(testService, testAccount);

      expect(result).toBe(true);
    });
  });

  describe('clear', () => {
    const testService = 'test-service';

    test('should clear all credentials for a service', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service: testService,
          account: 'account2',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'other-encrypted',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.clear(testService);

      expect(result).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should return 0 when no credentials found for service', async () => {
      const credentials = [
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'other-encrypted',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.clear(testService);

      expect(result).toBe(0);
    });

    test('should throw error for empty service', async () => {
      await expect(credentialManager.clear(''))
        .rejects.toThrow('Service must not be empty');
    });

    test('should return 0 when file operation fails', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        }
      ];
      const writeError = new Error('Write failed');

      mockFs.readFile.mockRejectedValue(writeError);

      const result = await credentialManager.clear(testService);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('listServices', () => {
    test('should list all unique services', async () => {
      const credentials = [
        {
          service: 'service1',
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service: 'service1',
          account: 'account2',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        },
        {
          service: 'service2',
          account: 'account1',
          encryptedPassword: 'encrypted3',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.listServices();

      expect(result).toEqual(['service1', 'service2']);
    });

    test('should return empty array when no credentials', async () => {
      const credentials: any[] = [];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.listServices();

      expect(result).toEqual([]);
    });

    test('should return empty array when file operation fails', async () => {
      const readError = new Error('Read failed');
      mockFs.readFile.mockRejectedValue(readError);

      const result = await credentialManager.listServices();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      const result = await credentialManager.listServices();

      expect(result).toEqual([]);
    });
  });

  describe('listAccounts', () => {
    const testService = 'test-service';

    test('should list all accounts for a service', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service: testService,
          account: 'account2',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'encrypted3',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.listAccounts(testService);

      expect(result).toEqual(['account1', 'account2']);
    });

    test('should return empty array when no accounts found for service', async () => {
      const credentials = [
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));

      const result = await credentialManager.listAccounts(testService);

      expect(result).toEqual([]);
    });

    test('should throw error for empty service', async () => {
      await expect(credentialManager.listAccounts(''))
        .rejects.toThrow('Service must not be empty');
    });

    test('should return empty array when file operation fails', async () => {
      const readError = new Error('Read failed');
      mockFs.readFile.mockRejectedValue(readError);

      const result = await credentialManager.listAccounts(testService);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('changeMasterPassword', () => {
    const oldPassword = 'old-master-password';
    const newPassword = 'new-master-password';
    const testService = 'test-service';

    test('should change master password for all credentials', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockEncryptionService.decrypt.mockResolvedValue('decrypted-password');
      mockEncryptionService.encrypt.mockResolvedValue('new-encrypted-password');
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.changeMasterPassword(oldPassword, newPassword);

      expect(result).toBe(true);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted1', oldPassword);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('decrypted-password', newPassword);
    });

    test('should change master password for a specific service', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'account1',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockEncryptionService.decrypt.mockResolvedValue('decrypted-password');
      mockEncryptionService.encrypt.mockResolvedValue('new-encrypted-password');
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      const result = await credentialManager.changeMasterPassword(oldPassword, newPassword, testService);

      expect(result).toBe(true);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledTimes(1);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledTimes(1);
    });

    test('should return false when old password decryption fails', async () => {
      const credentials = [
        {
          service: testService,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        }
      ];
      const encryptedData = Buffer.from('encrypted-file-data');
      const decryptionError = new Error('Wrong password');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(credentials));
      mockEncryptionService.decrypt.mockRejectedValue(decryptionError);

      const result = await credentialManager.changeMasterPassword(oldPassword, newPassword);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to decrypt credential with old password:', decryptionError);
    });

    test('should return false when file operation fails', async () => {
      const fileError = new Error('File operation failed');
      mockFs.readFile.mockRejectedValue(fileError);

      const result = await credentialManager.changeMasterPassword(oldPassword, newPassword);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    test.skip('should handle credential lifecycle', async () => {
      const service = 'integration-test';
      const account = 'test-user';
      const password = 'secret-password';
      const encryptedPassword = 'encrypted-secret';

      const emptyCredentials: any[] = [];
      let currentCredentials = emptyCredentials;
      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockImplementation(() => {
        const data = JSON.stringify(currentCredentials);
        const encrypted = Buffer.from(data);
        mockSafeStorage.decryptString.mockReturnValue(data);
        return Promise.resolve(encrypted);
      });

      mockSafeStorage.encryptString.mockImplementation((data) => {
        currentCredentials = JSON.parse(data);
        return encryptedData;
      });

      mockEncryptionService.encrypt.mockResolvedValue(encryptedPassword);
      mockEncryptionService.decrypt.mockResolvedValue(password);

      const storeResult = await credentialManager.store(service, account, password);
      expect(storeResult).toBe(true);

      const retrievedPassword = await credentialManager.get(service, account);
      expect(retrievedPassword).toBe(password);

      const services = await credentialManager.listServices();
      expect(services).toContain(service);

      const accounts = await credentialManager.listAccounts(service);
      expect(accounts).toContain(account);

      const deleteResult = await credentialManager.delete(service, account);
      expect(deleteResult).toBe(true);

      const finalPassword = await credentialManager.get(service, account);
      expect(finalPassword).toBeNull();
    });

    test.skip('should handle multiple services', async () => {
      const credentials = [
        { service: 'service1', account: 'account1', password: 'pass1' },
        { service: 'service1', account: 'account2', password: 'pass2' },
        { service: 'service2', account: 'account1', password: 'pass3' }
      ];

      const encryptedData = Buffer.from('encrypted-file-data');

      mockFs.readFile.mockResolvedValue(encryptedData);
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify([]));
      mockSafeStorage.encryptString.mockReturnValue(encryptedData);

      for (const cred of credentials) {
        mockEncryptionService.encrypt.mockResolvedValueOnce(`encrypted-${cred.password}`);
        const result = await credentialManager.store(cred.service, cred.account, cred.password);
        expect(result).toBe(true);
      }

      const services = await credentialManager.listServices();
      expect(services.length).toBeGreaterThan(0);

      const service1Accounts = await credentialManager.listAccounts('service1');
      expect(service1Accounts.length).toBeGreaterThan(0);

      const service2Accounts = await credentialManager.listAccounts('service2');
      expect(service2Accounts.length).toBeGreaterThan(0);

      const clearedCount = await credentialManager.clear('service1');
      expect(clearedCount).toBe(2);

      const finalServices = await credentialManager.listServices();
      expect(finalServices).toEqual(['service2']);
    });
  });
});
