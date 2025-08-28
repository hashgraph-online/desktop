import { CredentialManager } from '../../src/main/services/credential-manager';
import { safeStorage, app } from 'electron';
import * as fs from 'fs/promises';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../src/main/services/encryption-service', () => ({
  EncryptionService: jest.fn().mockImplementation(() => ({
    encrypt: jest.fn().mockImplementation(async (data, password) => `encrypted-${data}-${password}`),
    decrypt: jest.fn().mockImplementation(async (data, password) => {
      const match = data.match(/^encrypted-(.+)-(.+)$/);
      if (match && match[2] === password) {
        return match[1];
      }
      throw new Error('Invalid encryption data or password');
    })
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

jest.mock('fs/promises');

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  const mockSafeStorage = safeStorage as jest.Mocked<typeof safeStorage>;
  const mockApp = app as jest.Mocked<typeof app>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  const testCredentialsPath = '/test/userData/credentials.dat';

  beforeEach(() => {
    jest.clearAllMocks();
    mockApp.getPath.mockReturnValue('/test/userData');

    credentialManager = new CredentialManager('test-master-password');

    (credentialManager as any).loadCredentials = jest.fn();
    (credentialManager as any).saveCredentials = jest.fn();
    (credentialManager as any).encryptionService = {
      encrypt: jest.fn().mockImplementation(async (data, password) => `encrypted-${data}-${password}`),
      decrypt: jest.fn().mockImplementation(async (data, password) => {
        const match = data.match(/^encrypted-(.+)-(.+)$/);
        if (match && match[2] === password) {
          return match[1];
        }
        throw new Error('Invalid encryption data or password');
      })
    };
    (credentialManager as any).logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    (credentialManager as any).credentialsFile = testCredentialsPath;
  });

  describe('store', () => {
    it('should store encrypted credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = 'test-password';

      (credentialManager as any).loadCredentials.mockResolvedValue([]);
      (credentialManager as any).saveCredentials.mockResolvedValue(undefined);

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(true);
      expect((credentialManager as any).encryptionService.encrypt).toHaveBeenCalledWith(password, 'test-master-password');
      expect((credentialManager as any).saveCredentials).toHaveBeenCalled();
    });

    it('should update existing credential', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = 'new-password';

      const existingCredentials = [
        {
          service: 'test-service',
          account: 'test-account',
          encryptedPassword: 'old-encrypted',
          createdAt: Date.now() - 1000
        }
      ];

      (credentialManager as any).loadCredentials.mockResolvedValue(existingCredentials);
      (credentialManager as any).saveCredentials.mockResolvedValue(undefined);

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(true);
      expect((credentialManager as any).encryptionService.encrypt).toHaveBeenCalledWith(password, 'test-master-password');
      expect((credentialManager as any).saveCredentials).toHaveBeenCalled();
    });

    it('should handle storage failure', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = 'test-password';

      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockRejectedValue(new Error('Storage failed'));

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(false);
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.store('', 'account', 'password')).rejects.toThrow();
      await expect(credentialManager.store('service', '', 'password')).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve and decrypt credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const originalPassword = 'test-password';

      const tempManager = new CredentialManager('test-master-password');
      const encryptionService = (tempManager as unknown as { encryptionService: { encrypt: (data: string, key: string) => Promise<string>; decrypt: (data: string, key: string) => Promise<string> } }).encryptionService;
      const encryptedPassword = await encryptionService.encrypt(originalPassword, 'test-master-password');

      const storedCredentials = JSON.stringify([
        {
          service,
          account,
          encryptedPassword,
          createdAt: Date.now()
        }
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);

      const result = await credentialManager.get(service, account);

      expect(result).toBe(originalPassword);
      expect(mockFs.readFile).toHaveBeenCalledWith(testCredentialsPath);
    });

    it('should return null for non-existent credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue('[]');

      const result = await credentialManager.get(service, account);

      expect(result).toBeNull();
    });

    it('should handle empty storage file', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await credentialManager.get(service, account);

      expect(result).toBeNull();
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.get('', 'account')).rejects.toThrow();
      await expect(credentialManager.get('service', '')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';

      const storedCredentials = JSON.stringify([
        {
          service,
          account,
          encryptedPassword: 'encrypted',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'other-account',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        }
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);
      mockSafeStorage.encryptString.mockReturnValue(Buffer.from('updated-encrypted'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await credentialManager.delete(service, account);

      expect(result).toBe(true);
      const savedData = JSON.parse(mockSafeStorage.encryptString.mock.calls[0][0]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].service).toBe('other-service');
    });

    it('should return false when credential not found', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue('[]');

      const result = await credentialManager.delete(service, account);

      expect(result).toBe(false);
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.delete('', 'account')).rejects.toThrow();
      await expect(credentialManager.delete('service', '')).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all credentials for a service', async () => {
      const service = 'test-service';

      const storedCredentials = JSON.stringify([
        {
          service,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service,
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
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);
      mockSafeStorage.encryptString.mockReturnValue(Buffer.from('updated-encrypted'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await credentialManager.clear(service);

      expect(result).toBe(2);
      const savedData = JSON.parse(mockSafeStorage.encryptString.mock.calls[0][0]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].service).toBe('other-service');
    });

    it('should handle empty service', async () => {
      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue('[]');

      const result = await credentialManager.clear('empty-service');

      expect(result).toBe(0);
    });

    it('should validate service parameter', async () => {
      await expect(credentialManager.clear('')).rejects.toThrow();
    });
  });

  describe('changeMasterPassword', () => {
    it('should re-encrypt all credentials with new master password', async () => {
      const service = 'test-service';
      const oldPassword = 'old-password';
      const newPassword = 'new-password';

      const tempManager = new CredentialManager(oldPassword);
      const encryptionService = (tempManager as unknown as { encryptionService: { encrypt: (data: string, key: string) => Promise<string>; decrypt: (data: string, key: string) => Promise<string> } }).encryptionService;
      
      const encryptedPass1 = await encryptionService.encrypt('pass1', oldPassword);
      const encryptedPass2 = await encryptionService.encrypt('pass2', oldPassword);

      const storedCredentials = JSON.stringify([
        {
          service,
          account: 'account1',
          encryptedPassword: encryptedPass1,
          createdAt: Date.now()
        },
        {
          service,
          account: 'account2',
          encryptedPassword: encryptedPass2,
          createdAt: Date.now()
        }
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);
      mockSafeStorage.encryptString.mockReturnValue(Buffer.from('updated-encrypted'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await credentialManager.changeMasterPassword(
        oldPassword,
        newPassword,
        service
      );

      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should return false if old password is incorrect', async () => {
      const service = 'test-service';

      const storedCredentials = JSON.stringify([
        {
          service,
          account: 'account1',
          encryptedPassword: 'invalid-encrypted-data',
          createdAt: Date.now()
        }
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);

      const result = await credentialManager.changeMasterPassword(
        'wrong-old-password',
        'new-password',
        service
      );

      expect(result).toBe(false);
    });
  });

  describe('listServices', () => {
    it('should return unique list of services', async () => {
      const storedCredentials = JSON.stringify([
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
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);

      const result = await credentialManager.listServices();

      expect(result).toEqual(['service1', 'service2']);
    });

    it('should return empty array when no credentials exist', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await credentialManager.listServices();

      expect(result).toEqual([]);
    });
  });

  describe('listAccounts', () => {
    it('should return list of accounts for a service', async () => {
      const service = 'test-service';

      const storedCredentials = JSON.stringify([
        {
          service,
          account: 'account1',
          encryptedPassword: 'encrypted1',
          createdAt: Date.now()
        },
        {
          service,
          account: 'account2',
          encryptedPassword: 'encrypted2',
          createdAt: Date.now()
        },
        {
          service: 'other-service',
          account: 'account3',
          encryptedPassword: 'encrypted3',
          createdAt: Date.now()
        }
      ]);

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue(storedCredentials);

      const result = await credentialManager.listAccounts(service);

      expect(result).toEqual(['account1', 'account2']);
    });

    it('should return empty array when service has no accounts', async () => {
      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted-storage'));
      mockSafeStorage.decryptString.mockReturnValue('[]');

      const result = await credentialManager.listAccounts('empty-service');

      expect(result).toEqual([]);
    });

    it('should validate service parameter', async () => {
      await expect(credentialManager.listAccounts('')).rejects.toThrow();
    });
  });
});