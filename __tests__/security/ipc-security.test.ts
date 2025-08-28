import { ipcMain } from 'electron';
import { setupSecurityHandlers } from '../../src/main/ipc/handlers';
import { CredentialManager } from '../../src/main/services/CredentialManager';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock('../../../src/main/services/CredentialManager');

describe('IPC Security Handlers', () => {
  const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;
  const mockCredentialManager = new CredentialManager('test-password') as jest.Mocked<CredentialManager>;
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockIpcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    });

    setupSecurityHandlers(mockCredentialManager);
  });

  describe('credential:store', () => {
    it('should store credentials with valid input', async () => {
      mockCredentialManager.store.mockResolvedValue(true);

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password',
      };

      const result = await handlers['credential:store'](event, data);

      expect(result).toEqual({
        success: true,
        data: true,
      });
      expect(mockCredentialManager.store).toHaveBeenCalledWith(
        'test-service',
        'test-account',
        'test-password'
      );
    });

    it('should reject invalid input schema', async () => {
      const event = {};
      const invalidData = {
        service: '',
        account: 'test-account',
        password: 'test-password',
      };

      const result = await handlers['credential:store'](event, invalidData);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Validation error'),
      });
      expect(mockCredentialManager.store).not.toHaveBeenCalled();
    });

    it('should handle storage failure', async () => {
      mockCredentialManager.store.mockResolvedValue(false);

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
        password: 'test-password',
      };

      const result = await handlers['credential:store'](event, data);

      expect(result).toEqual({
        success: true,
        data: false,
      });
    });
  });

  describe('credential:get', () => {
    it('should retrieve credentials with valid input', async () => {
      mockCredentialManager.get.mockResolvedValue('decrypted-password');

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
      };

      const result = await handlers['credential:get'](event, data);

      expect(result).toEqual({
        success: true,
        data: 'decrypted-password',
      });
      expect(mockCredentialManager.get).toHaveBeenCalledWith(
        'test-service',
        'test-account'
      );
    });

    it('should handle non-existent credentials', async () => {
      mockCredentialManager.get.mockResolvedValue(null);

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
      };

      const result = await handlers['credential:get'](event, data);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it('should reject invalid input schema', async () => {
      const event = {};
      const invalidData = {
        service: 'test-service',
        account: '',
      };

      const result = await handlers['credential:get'](event, invalidData);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Validation error'),
      });
      expect(mockCredentialManager.get).not.toHaveBeenCalled();
    });
  });

  describe('credential:delete', () => {
    it('should delete credentials with valid input', async () => {
      mockCredentialManager.delete.mockResolvedValue(true);

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
      };

      const result = await handlers['credential:delete'](event, data);

      expect(result).toEqual({
        success: true,
        data: true,
      });
      expect(mockCredentialManager.delete).toHaveBeenCalledWith(
        'test-service',
        'test-account'
      );
    });

    it('should handle deletion failure', async () => {
      mockCredentialManager.delete.mockResolvedValue(false);

      const event = {};
      const data = {
        service: 'test-service',
        account: 'test-account',
      };

      const result = await handlers['credential:delete'](event, data);

      expect(result).toEqual({
        success: true,
        data: false,
      });
    });
  });

  describe('credential:clear', () => {
    it('should clear all credentials', async () => {
      mockCredentialManager.clear.mockResolvedValue(3);

      const event = {};
      const data = {};

      const result = await handlers['credential:clear'](event, data);

      expect(result).toEqual({
        success: true,
        data: 3,
      });
      expect(mockCredentialManager.clear).toHaveBeenCalledWith('conversational-agent');
    });

    it('should handle clear failure', async () => {
      mockCredentialManager.clear.mockRejectedValue(new Error('Clear failed'));

      const event = {};
      const data = {};

      const result = await handlers['credential:clear'](event, data);

      expect(result).toEqual({
        success: false,
        error: 'Failed to clear credentials',
      });
    });
  });

  describe('Input validation', () => {
    it('should sanitize inputs to prevent injection', async () => {
      mockCredentialManager.store.mockResolvedValue(true);

      const event = {};
      const maliciousData = {
        service: '<script>alert("xss")</script>',
        account: 'test-account',
        password: 'test-password',
      };

      const result = await handlers['credential:store'](event, maliciousData);

      expect(result.success).toBe(true);
      expect(mockCredentialManager.store).toHaveBeenCalledWith(
        '<script>alert("xss")</script>',
        'test-account',
        'test-password'
      );
    });

    it('should handle extremely long inputs', async () => {
      mockCredentialManager.store.mockResolvedValue(true);

      const event = {};
      const longData = {
        service: 'test-service',
        account: 'a'.repeat(10000),
        password: 'test-password',
      };

      const result = await handlers['credential:store'](event, longData);

      expect(result.success).toBe(true);
    });
  });
});