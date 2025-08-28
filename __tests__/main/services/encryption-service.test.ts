import { EncryptionService } from '../../../src/main/services/encryption-service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('Constructor', () => {
    test('should create EncryptionService instance', () => {
      expect(encryptionService).toBeDefined();
    });
  });

  describe('deriveKey', () => {
    test('should derive key from password and salt', async () => {
      const password = 'test-password';
      const salt = Buffer.from('test-salt-32-bytes-long-string!!');

      const key = await encryptionService['deriveKey'](password, salt);

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // AES-256 requires 32 bytes
    });

    test('should derive different keys for different passwords', async () => {
      const salt = Buffer.from('same-salt-32-bytes-long-string!!');
      const key1 = await encryptionService['deriveKey']('password1', salt);
      const key2 = await encryptionService['deriveKey']('password2', salt);

      expect(key1).not.toEqual(key2);
    });

    test('should derive different keys for different salts', async () => {
      const password = 'test-password';
      const salt1 = Buffer.from('salt1-32-bytes-long-string!!!!!!');
      const salt2 = Buffer.from('salt2-32-bytes-long-string!!!!!!');

      const key1 = await encryptionService['deriveKey'](password, salt1);
      const key2 = await encryptionService['deriveKey'](password, salt2);

      expect(key1).not.toEqual(key2);
    });

    test('should derive same key for same password and salt', async () => {
      const password = 'test-password';
      const salt = Buffer.from('test-salt-32-bytes-long-string!!');

      const key1 = await encryptionService['deriveKey'](password, salt);
      const key2 = await encryptionService['deriveKey'](password, salt);

      expect(key1).toEqual(key2);
    });
  });

  describe('encrypt', () => {
    test('should encrypt plaintext successfully', async () => {
      const plaintext = 'Hello, World!';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(plaintext, password);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toContain(plaintext);
    });

    test('should encrypt different data with same password', async () => {
      const password = 'test-password';
      const plaintext1 = 'First message';
      const plaintext2 = 'Second message';

      const encrypted1 = await encryptionService.encrypt(plaintext1, password);
      const encrypted2 = await encryptionService.encrypt(plaintext2, password);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted1).not.toContain(plaintext1);
      expect(encrypted2).not.toContain(plaintext2);
    });

    test('should encrypt same data with different passwords', async () => {
      const plaintext = 'Same message';
      const password1 = 'password1';
      const password2 = 'password2';

      const encrypted1 = await encryptionService.encrypt(plaintext, password1);
      const encrypted2 = await encryptionService.encrypt(plaintext, password2);

      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should encrypt empty string', async () => {
      const plaintext = '';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(plaintext, password);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    test('should encrypt long text', async () => {
      const plaintext = 'A'.repeat(10000); // 10KB of data
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(plaintext, password);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
    });

    test('should encrypt unicode text', async () => {
      const plaintext = 'Hello 🌍 こんにちは 您好 🚀';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(plaintext, password);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toContain(plaintext);
    });
  });

  describe('decrypt', () => {
    test('should decrypt encrypted data correctly', async () => {
      const originalText = 'Hello, World!';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(originalText, password);
      const decrypted = await encryptionService.decrypt(encrypted, password);

      expect(decrypted).toBe(originalText);
    });

    test('should decrypt empty string', async () => {
      const originalText = '';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(originalText, password);
      const decrypted = await encryptionService.decrypt(encrypted, password);

      expect(decrypted).toBe(originalText);
    });

    test('should decrypt long text', async () => {
      const originalText = 'A'.repeat(5000);
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(originalText, password);
      const decrypted = await encryptionService.decrypt(encrypted, password);

      expect(decrypted).toBe(originalText);
    });

    test('should decrypt unicode text', async () => {
      const originalText = 'Hello 🌍 こんにちは 您好 🚀';
      const password = 'test-password';

      const encrypted = await encryptionService.encrypt(originalText, password);
      const decrypted = await encryptionService.decrypt(encrypted, password);

      expect(decrypted).toBe(originalText);
    });

    test('should fail to decrypt with wrong password', async () => {
      const originalText = 'Secret message';
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = await encryptionService.encrypt(originalText, correctPassword);

      await expect(encryptionService.decrypt(encrypted, wrongPassword))
        .rejects.toThrow('Failed to decrypt: Invalid password or corrupted data');
    });

    test('should fail to decrypt corrupted data', async () => {
      const password = 'test-password';
      const corruptedData = 'corrupted-base64-data!';

      await expect(encryptionService.decrypt(corruptedData, password))
        .rejects.toThrow('Encrypted data is too short');
    });

    test('should fail to decrypt with invalid base64', async () => {
      const password = 'test-password';
      const invalidBase64 = 'invalid!@#$%^&*()';

      await expect(encryptionService.decrypt(invalidBase64, password))
        .rejects.toThrow('Encrypted data is too short');
    });

    test('should fail to decrypt with too short data', async () => {
      const password = 'test-password';
      const tooShortData = Buffer.from('short').toString('base64');

      await expect(encryptionService.decrypt(tooShortData, password))
        .rejects.toThrow('Encrypted data is too short');
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    test('should handle various data types correctly', async () => {
      const testCases = [
        'Simple text',
        'Text with numbers: 12345',
        'Text with special chars: !@#$%^&*()',
        'Multiline\ntext\nwith\nnewlines',
        'Tab\tseparated\ttext',
        JSON.stringify({ key: 'value', number: 42 }),
        'Very long text '.repeat(100),
        '',
        'A',
        '🚀 Unicode emoji test 🌍'
      ];

      const password = 'test-password-123';

      for (const testCase of testCases) {
        const encrypted = await encryptionService.encrypt(testCase, password);
        const decrypted = await encryptionService.decrypt(encrypted, password);

        expect(decrypted).toBe(testCase);
      }
    });

    test('should produce different encrypted outputs for same input', async () => {
      const plaintext = 'Same input text';
      const password = 'test-password';

      const encrypted1 = await encryptionService.encrypt(plaintext, password);
      const encrypted2 = await encryptionService.encrypt(plaintext, password);

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = await encryptionService.decrypt(encrypted1, password);
      const decrypted2 = await encryptionService.decrypt(encrypted2, password);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    test('should handle concurrent encryption/decryption operations', async () => {
      const password = 'test-password';
      const testData = Array.from({ length: 10 }, (_, i) => `Test data ${i}`);

      const operations = testData.map(async (data) => {
        const encrypted = await encryptionService.encrypt(data, password);
        const decrypted = await encryptionService.decrypt(encrypted, password);
        return { original: data, decrypted };
      });

      const results = await Promise.all(operations);

      results.forEach(({ original, decrypted }) => {
        expect(decrypted).toBe(original);
      });
    });
  });

  describe('Security Properties', () => {
    test('should use proper encryption parameters', () => {
      expect(encryptionService['algorithm']).toBe('aes-256-gcm');
      expect(encryptionService['saltLength']).toBe(32);
      expect(encryptionService['ivLength']).toBe(16);
      expect(encryptionService['tagLength']).toBe(16);
      expect(encryptionService['keyLength']).toBe(32);
    });

    test('should generate different encrypted outputs for same input (avalanche effect)', async () => {
      const plaintext = 'Sensitive data that needs protection';
      const password = 'strong-password-123';

      const encrypted1 = await encryptionService.encrypt(plaintext, password);
      const encrypted2 = await encryptionService.encrypt(plaintext, password);

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = await encryptionService.decrypt(encrypted1, password);
      const decrypted2 = await encryptionService.decrypt(encrypted2, password);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    test('should handle password changes correctly', async () => {
      const plaintext = 'Secret information';
      const oldPassword = 'old-password';
      const newPassword = 'new-password';

      const encryptedWithOld = await encryptionService.encrypt(plaintext, oldPassword);

      await expect(encryptionService.decrypt(encryptedWithOld, newPassword))
        .rejects.toThrow();

      const decrypted = await encryptionService.decrypt(encryptedWithOld, oldPassword);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid encrypted data gracefully', async () => {
      const password = 'test-password';

      await expect(encryptionService.decrypt('', password))
        .rejects.toThrow('Encrypted data is too short');

      await expect(encryptionService.decrypt('invalid', password))
        .rejects.toThrow('Encrypted data is too short');

      await expect(encryptionService.decrypt('!!!', password))
        .rejects.toThrow('Encrypted data is too short');
    });

    test('should handle malformed base64 data', async () => {
      const password = 'test-password';
      const malformedBase64 = 'not-valid-base64!@#$%';

      await expect(encryptionService.decrypt(malformedBase64, password))
        .rejects.toThrow('Encrypted data is too short');
    });

    test('should handle truncated encrypted data', async () => {
      const password = 'test-password';
      const shortData = Buffer.from('short').toString('base64');

      await expect(encryptionService.decrypt(shortData, password))
        .rejects.toThrow('Encrypted data is too short');
    });

    test('should handle empty password', async () => {
      const plaintext = 'test data';

      const encrypted = await encryptionService.encrypt(plaintext, '');
      const decrypted = await encryptionService.decrypt(encrypted, '');

      expect(decrypted).toBe(plaintext);
    });

    test('should handle very long passwords', async () => {
      const plaintext = 'test data';
      const longPassword = 'A'.repeat(10000); // 10KB password

      const encrypted = await encryptionService.encrypt(plaintext, longPassword);
      const decrypted = await encryptionService.decrypt(encrypted, longPassword);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle typical credential encryption use case', async () => {
      const credentials = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'sk-1234567890abcdef',
        privateKey: '302e020100300506032b6570042204201234567890abcdef...'
      };

      const password = 'master-password-123';
      const credentialString = JSON.stringify(credentials);

      const encryptedCredentials = await encryptionService.encrypt(credentialString, password);

      const decryptedCredentialString = await encryptionService.decrypt(encryptedCredentials, password);
      const decryptedCredentials = JSON.parse(decryptedCredentialString);

      expect(decryptedCredentials).toEqual(credentials);
    });

    test('should handle configuration data encryption', async () => {
      const config = {
        database: {
          host: 'localhost',
          port: 5432,
          username: 'admin',
          password: 'db-password-123'
        },
        api: {
          baseUrl: 'https://api.example.com',
          apiKey: 'api-key-abcdef123456',
          secret: 'very-secret-key'
        },
        features: {
          enableEncryption: true,
          enableLogging: false
        }
      };

      const password = 'config-encryption-key';
      const configString = JSON.stringify(config, null, 2);

      const encryptedConfig = await encryptionService.encrypt(configString, password);
      const decryptedConfigString = await encryptionService.decrypt(encryptedConfig, password);
      const decryptedConfig = JSON.parse(decryptedConfigString);

      expect(decryptedConfig).toEqual(config);
    });

    test('should handle multiple encryption operations efficiently', async () => {
      const password = 'bulk-encryption-password';
      const dataItems = Array.from({ length: 50 }, (_, i) => `Data item ${i}: ${'x'.repeat(i * 10)}`);

      const startTime = Date.now();

      const encryptedItems = await Promise.all(
        dataItems.map(item => encryptionService.encrypt(item, password))
      );

      const decryptedItems = await Promise.all(
        encryptedItems.map(encrypted => encryptionService.decrypt(encrypted, password))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);

      decryptedItems.forEach((decrypted, index) => {
        expect(decrypted).toBe(dataItems[index]);
      });
    });
  });
});
