import { EncryptionService } from '../../src/main/services/EncryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const plainText = 'test-password-12345';
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainText);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertexts for same input (due to random IV)', async () => {
      const plainText = 'test-password-12345';
      const masterPassword = 'master-key-secret';

      const encrypted1 = await encryptionService.encrypt(plainText, masterPassword);
      const encrypted2 = await encryptionService.encrypt(plainText, masterPassword);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', async () => {
      const plainText = '';
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle special characters', async () => {
      const plainText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainText);
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const plainText = 'test-password-12345';
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);
      const decrypted = await encryptionService.decrypt(encrypted, masterPassword);

      expect(decrypted).toBe(plainText);
    });

    it('should fail with wrong master password', async () => {
      const plainText = 'test-password-12345';
      const masterPassword = 'master-key-secret';
      const wrongPassword = 'wrong-password';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);

      await expect(
        encryptionService.decrypt(encrypted, wrongPassword)
      ).rejects.toThrow();
    });

    it('should fail with corrupted data', async () => {
      const masterPassword = 'master-key-secret';
      const corruptedData = 'invalid-base64-data!@#$';

      await expect(
        encryptionService.decrypt(corruptedData, masterPassword)
      ).rejects.toThrow();
    });

    it('should handle empty string encryption/decryption', async () => {
      const plainText = '';
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);
      const decrypted = await encryptionService.decrypt(encrypted, masterPassword);

      expect(decrypted).toBe(plainText);
    });

    it('should handle long texts', async () => {
      const plainText = 'a'.repeat(10000);
      const masterPassword = 'master-key-secret';

      const encrypted = await encryptionService.encrypt(plainText, masterPassword);
      const decrypted = await encryptionService.decrypt(encrypted, masterPassword);

      expect(decrypted).toBe(plainText);
    });
  });

  describe('deriveKey', () => {
    it('should derive consistent keys for same password', async () => {
      const password = 'test-password';
      const salt = Buffer.from('test-salt');

      const key1 = await encryptionService.deriveKey(password, salt);
      const key2 = await encryptionService.deriveKey(password, salt);

      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('should derive different keys for different passwords', async () => {
      const password1 = 'test-password-1';
      const password2 = 'test-password-2';
      const salt = Buffer.from('test-salt');

      const key1 = await encryptionService.deriveKey(password1, salt);
      const key2 = await encryptionService.deriveKey(password2, salt);

      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should derive different keys for different salts', async () => {
      const password = 'test-password';
      const salt1 = Buffer.from('test-salt-1');
      const salt2 = Buffer.from('test-salt-2');

      const key1 = await encryptionService.deriveKey(password, salt1);
      const key2 = await encryptionService.deriveKey(password, salt2);

      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should produce 32-byte keys', async () => {
      const password = 'test-password';
      const salt = Buffer.from('test-salt');

      const key = await encryptionService.deriveKey(password, salt);

      expect(key.length).toBe(32);
    });
  });
});