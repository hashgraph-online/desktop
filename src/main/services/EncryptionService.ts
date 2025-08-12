import { randomBytes, scrypt, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Service for encrypting and decrypting sensitive data using AES-256-GCM
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly keyLength = 32;
  /**
   * Derives a key from a password using scrypt
   * @param password - The password to derive the key from
   * @param salt - The salt to use for key derivation
   * @returns The derived key as a Buffer
   */
  async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return await scryptAsync(password, salt, this.keyLength) as Buffer;
  }

  /**
   * Encrypts data using AES-256-GCM
   * @param plainText - The text to encrypt
   * @param masterPassword - The master password to derive the encryption key from
   * @returns The encrypted data as a base64 string containing salt, iv, tag, and ciphertext
   */
  async encrypt(plainText: string, masterPassword: string): Promise<string> {
    const salt = randomBytes(this.saltLength);
    const iv = randomBytes(this.ivLength);
    
    const key = await this.deriveKey(masterPassword, salt);
    
    const cipher = createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypts data encrypted with encrypt()
   * @param encryptedData - The base64 string containing the encrypted data
   * @param masterPassword - The master password to derive the decryption key from
   * @returns The decrypted plaintext
   */
  async decrypt(encryptedData: string, masterPassword: string): Promise<string> {
    let combined: Buffer;
    
    try {
      combined = Buffer.from(encryptedData, 'base64');
    } catch (error) {
      throw new Error('Invalid encrypted data format');
    }
    
    if (combined.length < this.saltLength + this.ivLength + this.tagLength) {
      throw new Error('Encrypted data is too short');
    }
    
    const salt = combined.subarray(0, this.saltLength);
    const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
    const tag = combined.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength
    );
    const encrypted = combined.subarray(this.saltLength + this.ivLength + this.tagLength);
    
    const key = await this.deriveKey(masterPassword, salt);
    
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Failed to decrypt: Invalid password or corrupted data');
    }
  }
}