import { ipcMain, IpcMainInvokeEvent, app, shell } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { MirrorNodeService } from '../../services/mirror-node-service';
import { TransactionParserService } from '../../services/transaction-parser-service';
import { UpdateService } from '../../services/update-service';
import { OpenRouterService } from '../../services/open-router-service';
import { Logger } from '../../utils/logger';
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';
import { setCurrentWallet, type WalletBridgeInfo } from '../../services/wallet-context';

/**
 * Sets up IPC handlers for mirror node requests
 */
export function setupMirrorNodeHandlers(): void {
  const mirrorNodeService = MirrorNodeService.getInstance();
  const transactionParserService = TransactionParserService.getInstance();
  const logger = new Logger({ module: 'MirrorNodeHandlers' });

  ipcMain.handle(
    'mirrorNode:getScheduleInfo',
    async (
      event: IpcMainInvokeEvent,
      scheduleId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const info = await mirrorNodeService.getScheduleInfo(
          scheduleId,
          network
        );
        return createSuccessResponse(info);
      } catch (error) {
        return handleIPCError(error, 'Failed to fetch schedule info');
      }
    }
  );

  ipcMain.handle(
    'mirrorNode:getScheduledTransactionStatus',
    async (
      event: IpcMainInvokeEvent,
      scheduleId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const status = await mirrorNodeService.getScheduledTransactionStatus(
          scheduleId,
          network
        );
        return createSuccessResponse(status);
      } catch (error) {
        return handleIPCError(error, 'Failed to fetch scheduled transaction status');
      }
    }
  );

  ipcMain.handle(
    'mirrorNode:getTransactionByTimestamp',
    async (
      event: IpcMainInvokeEvent,
      timestamp: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        logger.info(`IPC mirrorNode:getTransactionByTimestamp`, { timestamp, network });
        const transactions = await mirrorNodeService.getTransactionByTimestamp(
          timestamp,
          network
        );
        const count = Array.isArray(transactions) ? transactions.length : 0;
        logger.info(`Mirror timestamp query returned ${count} tx(s)`);
        return createSuccessResponse(transactions);
      } catch (error) {
        logger.error('Mirror timestamp query failed', error);
        return handleIPCError(error, 'Failed to fetch transaction');
      }
    }
  );

  ipcMain.handle(
    'mirrorNode:getTransaction',
    async (
      event: IpcMainInvokeEvent,
      transactionId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        logger.info(`IPC mirrorNode:getTransaction`, { transactionId, network });
        const tx = await mirrorNodeService.getTransaction(
          transactionId,
          network
        );
        const hasTx = tx ? true : false;
        logger.info(`Mirror getTransaction returned: ${hasTx ? 'found' : 'not found'}`);
        return createSuccessResponse(tx);
      } catch (error) {
        logger.error('Mirror getTransaction failed', error);
        return handleIPCError(error, 'Failed to fetch transaction by ID');
      }
    }
  );

  ipcMain.handle(
    'mirrorNode:getTokenInfo',
    async (
      event: IpcMainInvokeEvent,
      tokenId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        const tokenInfo = await mirrorNodeService.getTokenInfo(
          tokenId,
          network
        );
        return createSuccessResponse(tokenInfo);
      } catch (error) {
        return handleIPCError(error, 'Failed to fetch token info');
      }
    }
  );

  ipcMain.handle(
    'transactionParser:validate',
    async (
      event: IpcMainInvokeEvent,
      transactionBytes: string
    ): Promise<IPCResponse> => {
      try {
        const validation =
          transactionParserService.validateTransactionBytes(transactionBytes);
        return createSuccessResponse(validation);
      } catch (error) {
        return handleIPCError(error, 'Failed to validate transaction bytes');
      }
    }
  );

  ipcMain.handle(
    'transactionParser:parse',
    async (
      event: IpcMainInvokeEvent,
      transactionBytes: string
    ): Promise<IPCResponse> => {
      try {
        const parsed =
          await transactionParserService.parseTransactionBytes(
            transactionBytes
          );
        return createSuccessResponse(parsed);
      } catch (error) {
        return handleIPCError(error, 'Failed to parse transaction bytes');
      }
    }
  );
}

/**
 * Sets up theme-related IPC handlers
 */
export function setupThemeHandlers(): void {
  const logger = new Logger({ module: 'ThemeHandlers' });

  ipcMain.handle(
    'theme:set',
    async (
      event: IpcMainInvokeEvent,
      theme: 'light' | 'dark'
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Setting theme to: ${theme}`);
        return createSuccessResponse({ theme });
      } catch (error) {
        logger.error('Theme set error:', error);
        return handleIPCError(error, 'Failed to set theme');
      }
    }
  );

  ipcMain.handle(
    'app:setAutoStart',
    async (
      event: IpcMainInvokeEvent,
      enabled: boolean
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Setting auto start to: ${enabled}`);
        return createSuccessResponse({ autoStart: enabled });
      } catch (error) {
        logger.error('Auto start set error:', error);
        return handleIPCError(error, 'Failed to set auto start');
      }
    }
  );

  ipcMain.handle(
    'app:setLogLevel',
    async (event: IpcMainInvokeEvent, level: string): Promise<IPCResponse> => {
      try {
        logger.info(`Setting log level to: ${level}`);
        return createSuccessResponse({ logLevel: level });
      } catch (error) {
        logger.error('Log level set error:', error);
        return handleIPCError(error, 'Failed to set log level');
      }
    }
  );

  ipcMain.handle(
    'open-external',
    async (event: IpcMainInvokeEvent, url: string): Promise<IPCResponse> => {
      try {
        logger.info(`Opening external URL: ${url}`);
        await shell.openExternal(url);
        return createSuccessResponse();
      } catch (error) {
        logger.error('Open external error:', error);
        return handleIPCError(error, 'Failed to open external URL');
      }
    }
  );

  ipcMain.handle(
    'wallet:set-current',
    async (
      event: IpcMainInvokeEvent,
      info: WalletBridgeInfo
    ): Promise<IPCResponse> => {
      try {
        setCurrentWallet(info);
        return createSuccessResponse();
      } catch (error) {
        return handleIPCError(error, 'Failed to set current wallet');
      }
    }
  );
}

/**
 * Sets up update-related IPC handlers
 */
export function setupUpdateHandlers(): void {
  const updateService = UpdateService.getInstance();
  const logger = new Logger({ module: 'UpdateHandlers' });

  ipcMain.handle('get-app-version', async (): Promise<string> => {
    return app.getVersion();
  });

  ipcMain.handle('check-for-updates', async (): Promise<void> => {
    try {
      logger.info('Checking for updates via IPC');
      await updateService.checkForUpdates();
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      throw error;
    }
  });

  ipcMain.handle('download-update', async (): Promise<void> => {
    try {
      logger.info('Downloading update via IPC');
      await updateService.downloadUpdate();
    } catch (error) {
      logger.error('Failed to download update:', error);
      throw error;
    }
  });

  ipcMain.handle('install-update', async (): Promise<void> => {
    try {
      logger.info('Installing update via IPC');
      await updateService.installUpdate();
    } catch (error) {
      logger.error('Failed to install update:', error);
      throw error;
    }
  });

  ipcMain.handle('open-repository-url', async (): Promise<void> => {
    try {
      const repositoryUrl = updateService.getRepositoryUrl();
      logger.info(`Opening repository URL: ${repositoryUrl}`);
      await shell.openExternal(repositoryUrl);
    } catch (error) {
      logger.error('Failed to open repository URL:', error);
      throw error;
    }
  });

  ipcMain.handle('get-update-info', async (): Promise<any> => {
    try {
      return {
        currentVersion: updateService.getCurrentVersion(),
        updateInfo: updateService.getUpdateInfo(),
        isUpdateSupported: updateService.isUpdateSupported(),
      };
    } catch (error) {
      logger.error('Failed to get update info:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'set-update-channel',
    async (
      event: IpcMainInvokeEvent,
      channel: 'stable' | 'beta'
    ): Promise<void> => {
      try {
        logger.info(`Setting update channel to: ${channel}`);
        updateService.setUpdateChannel(channel);
      } catch (error) {
        logger.error('Failed to set update channel:', error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    'set-auto-download',
    async (event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      try {
        logger.info(`Setting auto download to: ${enabled}`);
        updateService.setAutoDownload(enabled);
      } catch (error) {
        logger.error('Failed to set auto download:', error);
        throw error;
      }
    }
  );
}

/**
 * Sets up OpenRouter-related IPC handlers
 */
export function setupOpenRouterHandlers(): void {
  const openRouterService = OpenRouterService.getInstance();
  const logger = new Logger({ module: 'OpenRouterHandlers' });

  ipcMain.handle(
    'openrouter:getModels',
    async (
      event: IpcMainInvokeEvent,
      forceRefresh = false
    ): Promise<IPCResponse> => {
      try {
        logger.info('Fetching models from OpenRouter');
        const models = await openRouterService.getModels(forceRefresh);
        return createSuccessResponse(models);
      } catch (error) {
        logger.error('Failed to fetch OpenRouter models:', error);
        return handleIPCError(error, 'Failed to fetch models');
      }
    }
  );

  ipcMain.handle(
    'openrouter:getModelsByProvider',
    async (
      event: IpcMainInvokeEvent,
      provider: string
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Fetching ${provider} models from OpenRouter`);
        const models = await openRouterService.getModelsByProvider(provider);
        const convertedModels = models.map((model) =>
          openRouterService.convertToInternalFormat(
            model,
            provider as 'openai' | 'anthropic'
          )
        );
        return createSuccessResponse(convertedModels);
      } catch (error) {
        logger.error(`Failed to fetch ${provider} models:`, error);
        return handleIPCError(error, 'Failed to fetch models');
      }
    }
  );

  ipcMain.handle(
    'openrouter:getModel',
    async (
      event: IpcMainInvokeEvent,
      modelId: string
    ): Promise<IPCResponse> => {
      try {
        logger.info(`Fetching model ${modelId} from OpenRouter`);
        const model = await openRouterService.getModel(modelId);
        if (!model) {
          return {
            success: false,
            error: 'Model not found',
          };
        }
        return createSuccessResponse(model);
      } catch (error) {
        logger.error(`Failed to fetch model ${modelId}:`, error);
        return handleIPCError(error, 'Failed to fetch model');
      }
    }
  );
}
