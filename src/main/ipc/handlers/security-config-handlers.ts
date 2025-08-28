import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  CredentialSchema,
  CredentialRequestSchema,
  IPCResponse,
} from '../../../shared/schemas';
import { ConfigService } from '../../services/config-service';
import { Logger } from '../../utils/logger';
import { getEnvironmentConfig } from '../../config/environment';
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';

const DEFAULT_SERVICE = 'conversational-agent';

/**
 * Sets up secure IPC handlers for credential management
 * @param credentialManager - The credential manager instance to use
 */
export function setupSecurityHandlers(credentialManager: any): void {
  ipcMain.handle(
    'credential:store',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialSchema.parse(data);
        const result = await credentialManager.store(
          validated.service,
          validated.account,
          validated.password
        );
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to store credential');
      }
    }
  );

  ipcMain.handle(
    'credential:get',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialRequestSchema.parse(data);
        const result = await credentialManager.get(
          validated.service,
          validated.account
        );
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to retrieve credential');
      }
    }
  );

  ipcMain.handle(
    'credential:delete',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const validated = CredentialRequestSchema.parse(data);
        const result = await credentialManager.delete(
          validated.service,
          validated.account
        );
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to delete credential');
      }
    }
  );

  ipcMain.handle(
    'credential:clear',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const result = await credentialManager.clear(DEFAULT_SERVICE);
        return createSuccessResponse(result);
      } catch (error) {
        return handleIPCError(error, 'Failed to clear credentials');
      }
    }
  );
}

/**
 * Sets up config-related IPC handlers
 */
export function setupConfigHandlers(): void {
  const configService = ConfigService.getInstance();
  const logger = new Logger({ module: 'ConfigHandlers' });

  ipcMain.handle('config:load', async (): Promise<any> => {
    try {
      const config = await configService.load();
      logger.info('Config loaded via ConfigService');
      return config;
    } catch (error) {
      logger.error('Failed to load config:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'config:save',
    async (event: IpcMainInvokeEvent, config: any): Promise<void> => {
      try {
        logger.info('Saving config via ConfigService');
        await configService.save(config);
        logger.info('Config saved successfully');
      } catch (error) {
        logger.error('Failed to save config:', error);
        throw error;
      }
    }
  );

  ipcMain.handle('config:getEnvironment', async (): Promise<any> => {
    try {
      const envConfig = getEnvironmentConfig();
      logger.info('Environment config loaded', {
        hasHedera: !!envConfig.hedera,
        hasHederaAccountId: !!envConfig.hedera?.accountId,
        hederaAccountId: envConfig.hedera?.accountId || 'not set',
        hasOpenAI: !!envConfig.openai,
        hasOpenAIKey: !!envConfig.openai?.apiKey,
        fullConfig: envConfig,
      });
      return envConfig;
    } catch (error) {
      logger.error('Failed to load environment config:', error);
      throw error;
    }
  });
}