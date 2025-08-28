import { safeStorage } from 'electron';
import { EncryptionService } from './encryption-service';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

interface StoredCredential {
  service: string;
  account: string;
  encryptedPassword: string;
  createdAt: number;
}

/**
 * Manages credentials using Electron's safeStorage API with additional encryption
 */
export class CredentialManager {
  private encryptionService: EncryptionService;
  private masterPassword: string;
  private logger: Logger;
  private credentialsFile: string;

  /**
   * Creates a new CredentialManager instance
   * @param masterPassword - The master password used for encrypting credentials
   */
  constructor(masterPassword: string) {
    this.encryptionService = new EncryptionService();
    this.masterPassword = masterPassword;
    this.logger = new Logger({ module: 'CredentialManager' });
    this.credentialsFile = path.join(
      app.getPath('userData'),
      'credentials.dat'
    );
  }

  /**
   * Loads credentials from the encrypted storage file
   */
  private async loadCredentials(): Promise<StoredCredential[]> {
    try {
      const encryptedData = await fs.readFile(this.credentialsFile);
      const decryptedData = safeStorage.decryptString(encryptedData);
      return JSON.parse(decryptedData) as StoredCredential[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Saves credentials to the encrypted storage file
   */
  private async saveCredentials(
    credentials: StoredCredential[]
  ): Promise<void> {
    const data = JSON.stringify(credentials);
    const encryptedData = safeStorage.encryptString(data);
    await fs.writeFile(this.credentialsFile, encryptedData);
  }

  /**
   * Stores a credential with encryption
   * @param service - The service name
   * @param account - The account name
   * @param password - The password to store
   * @returns True if successful, false otherwise
   */
  async store(
    service: string,
    account: string,
    password: string
  ): Promise<boolean> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      const credentials = await this.loadCredentials();
      const encryptedPassword = await this.encryptionService.encrypt(
        password,
        this.masterPassword
      );

      const filteredCredentials = credentials.filter(
        (c) => !(c.service === service && c.account === account)
      );
      filteredCredentials.push({
        service,
        account,
        encryptedPassword,
        createdAt: Date.now(),
      });

      await this.saveCredentials(filteredCredentials);
      return true;
    } catch (error) {
      this.logger.error('Failed to store credential:', error);
      return false;
    }
  }

  /**
   * Retrieves a credential and decrypts it
   * @param service - The service name
   * @param account - The account name
   * @returns The decrypted password or null if not found
   */
  async get(service: string, account: string): Promise<string | null> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      const credentials = await this.loadCredentials();
      const credential = credentials.find(
        (c) => c.service === service && c.account === account
      );

      if (!credential) {
        return null;
      }

      return await this.encryptionService.decrypt(
        credential.encryptedPassword,
        this.masterPassword
      );
    } catch (error) {
      this.logger.error('Failed to retrieve credential:', error);
      return null;
    }
  }

  /**
   * Deletes a credential from storage
   * @param service - The service name
   * @param account - The account name
   * @returns True if successful, false otherwise
   */
  async delete(service: string, account: string): Promise<boolean> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      const credentials = await this.loadCredentials();
      const initialLength = credentials.length;
      const filteredCredentials = credentials.filter(
        (c) => !(c.service === service && c.account === account)
      );

      if (filteredCredentials.length === initialLength) {
        return false;
      }

      await this.saveCredentials(filteredCredentials);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete credential:', error);
      return false;
    }
  }

  /**
   * Clears all credentials for a given service
   * @param service - The service name
   * @returns The number of credentials deleted
   */
  async clear(service: string): Promise<number> {
    if (!service) {
      throw new Error('Service must not be empty');
    }

    try {
      const credentials = await this.loadCredentials();
      const serviceCredentials = credentials.filter(
        (c) => c.service === service
      );
      const deletedCount = serviceCredentials.length;

      const remainingCredentials = credentials.filter(
        (c) => c.service !== service
      );
      await this.saveCredentials(remainingCredentials);

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to clear credentials:', error);
      return 0;
    }
  }

  /**
   * Changes the master password and re-encrypts all credentials
   * @param oldPassword - The current master password
   * @param newPassword - The new master password
   * @param service - The service name to update credentials for (optional - updates all if not specified)
   * @returns True if successful, false otherwise
   */
  async changeMasterPassword(
    oldPassword: string,
    newPassword: string,
    service?: string
  ): Promise<boolean> {
    try {
      const credentials = await this.loadCredentials();
      const targetCredentials = service 
        ? credentials.filter(c => c.service === service)
        : credentials;

      const decryptedCredentials: Array<{ 
        service: string; 
        account: string; 
        password: string;
        createdAt: number;
      }> = [];

      for (const credential of targetCredentials) {
        try {
          const decryptedPassword = await this.encryptionService.decrypt(
            credential.encryptedPassword,
            oldPassword
          );
          decryptedCredentials.push({
            service: credential.service,
            account: credential.account,
            password: decryptedPassword,
            createdAt: credential.createdAt
          });
        } catch (error) {
          this.logger.error('Failed to decrypt credential with old password:', error);
          return false;
        }
      }

      this.masterPassword = newPassword;

      const updatedCredentials = await this.loadCredentials();
      for (const decryptedCred of decryptedCredentials) {
        const encryptedPassword = await this.encryptionService.encrypt(
          decryptedCred.password,
          newPassword
        );
        
        const index = updatedCredentials.findIndex(
          c => c.service === decryptedCred.service && c.account === decryptedCred.account
        );
        if (index !== -1) {
          updatedCredentials[index].encryptedPassword = encryptedPassword;
        }
      }

      await this.saveCredentials(updatedCredentials);
      return true;
    } catch (error) {
      this.logger.error('Failed to change master password:', error);
      return false;
    }
  }

  /**
   * Lists all services that have stored credentials
   * @returns Array of service names
   */
  async listServices(): Promise<string[]> {
    try {
      const credentials = await this.loadCredentials();
      const services = [...new Set(credentials.map(c => c.service))];
      return services;
    } catch (error) {
      this.logger.error('Failed to list services:', error);
      return [];
    }
  }

  /**
   * Lists all accounts for a given service
   * @param service - The service name
   * @returns Array of account names
   */
  async listAccounts(service: string): Promise<string[]> {
    if (!service) {
      throw new Error('Service must not be empty');
    }

    try {
      const credentials = await this.loadCredentials();
      const accounts = credentials
        .filter(c => c.service === service)
        .map(c => c.account);
      return accounts;
    } catch (error) {
      this.logger.error('Failed to list accounts:', error);
      return [];
    }
  }
}
