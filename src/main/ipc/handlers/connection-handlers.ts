import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { HederaMirrorNode } from '@hashgraphonline/standards-sdk';
import { Logger } from '../../utils/logger';

/**
 * Sets up connection test handlers
 */
export function setupConnectionHandlers(): void {
  ipcMain.handle(
    'hedera:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaTest' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'hedera:testConnection',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaTestConnection' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test connection error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'openai:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-')) {
          return { success: false, error: 'Invalid OpenAI API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'OpenAI connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'anthropic:test',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-ant-')) {
          return { success: false, error: 'Invalid Anthropic API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Anthropic connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-hedera',
    async (
      event: IpcMainInvokeEvent,
      credentials: {
        accountId: string;
        privateKey: string;
        network: 'mainnet' | 'testnet';
      }
    ): Promise<{ success: boolean; balance?: string; error?: string }> => {
      const logger = new Logger({ module: 'HederaConnectionTest' });

      try {
        if (!credentials.accountId || !credentials.privateKey) {
          return {
            success: false,
            error: 'Account ID and private key are required',
          };
        }

        const mirrorNode = new HederaMirrorNode(credentials.network);

        try {
          const accountInfo = await mirrorNode.requestAccount(
            credentials.accountId
          );

          if (!accountInfo) {
            return {
              success: false,
              error:
                'Account not found. Please verify the account ID exists on the selected network.',
            };
          }

          const balanceInHbar = (
            Number(accountInfo.balance) / 100000000
          ).toFixed(2);

          return {
            success: true,
            balance: `${balanceInHbar} HBAR`,
          };
        } catch (mirrorError) {
          logger.error('Mirror node error:', mirrorError);
          return {
            success: false,
            error: 'Network error. Please check your connection and try again.',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Hedera connection failed';
        logger.error('Hedera test error:', error);
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-openai',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-')) {
          return { success: false, error: 'Invalid OpenAI API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'OpenAI connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );

  ipcMain.handle(
    'connection:test-anthropic',
    async (
      event: IpcMainInvokeEvent,
      credentials: { apiKey: string; model: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-ant-')) {
          return { success: false, error: 'Invalid Anthropic API key format' };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Anthropic connection failed';
        return { success: false, error: errorMessage };
      }
    }
  );
}