import { ipcMain } from 'electron';
import { AgentService } from '../services/AgentService';
import { HederaService } from '../services/HederaService';
import { ConfigService } from '../services/ConfigService';
import { Logger } from '../utils/logger';
import type { ChatHistory } from '../services/AgentService';
import type { TransactionExecutionResult } from '../services/HederaService';

const logger = new Logger({ module: 'TransactionHandlers' });

/**
 * Register transaction-related IPC handlers
 */
export function registerTransactionHandlers() {
  const agentService = AgentService.getInstance();
  const hederaService = HederaService.getInstance();
  const configService = ConfigService.getInstance();

  /**
   * Execute a scheduled transaction
   */
  ipcMain.handle('execute-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> => {
    try {
      logger.info('Executing scheduled transaction:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Execute the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success && result.response) {
        return {
          success: true,
          transactionId: result.response.metadata?.transactionId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to execute scheduled transaction'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to execute scheduled transaction:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  /**
   * Delete/reject a scheduled transaction
   */
  ipcMain.handle('delete-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      logger.info('Deleting scheduled transaction:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Delete the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to delete scheduled transaction'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete scheduled transaction:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  /**
   * Get scheduled transaction info
   */
  ipcMain.handle('get-scheduled-transaction', async (_, scheduleId: string): Promise<{
    success: boolean;
    info?: any;
    error?: string;
  }> => {
    try {
      logger.info('Getting scheduled transaction info:', scheduleId);
      
      const result = await agentService.sendMessage(
        `Get information about the scheduled transaction with ID ${scheduleId}`,
        []
      );
      
      if (result.success && result.response) {
        return {
          success: true,
          info: result.response.metadata
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to get scheduled transaction info'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get scheduled transaction info:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  /**
   * Execute transaction bytes directly with stored credentials
   */
  ipcMain.handle('execute-transaction-bytes', async (_, transactionBytes: string, entityContext?: { name?: string, description?: string }): Promise<TransactionExecutionResult> => {
    try {
      logger.info('Executing transaction bytes:', {
        bytesLength: transactionBytes?.length || 0,
        hasEntityContext: !!entityContext
      });

      if (!transactionBytes || typeof transactionBytes !== 'string') {
        return {
          success: false,
          error: 'Transaction bytes are required and must be a valid string'
        };
      }

      const config = await configService.load();
      if (!config) {
        return {
          success: false,
          error: 'No configuration found. Please configure your Hedera credentials first.'
        };
      }

      if (!config.hedera?.accountId || !config.hedera?.privateKey) {
        return {
          success: false,
          error: 'Hedera account credentials not found. Please configure your account ID and private key.'
        };
      }

      if (hederaService.isTransactionExecuted(transactionBytes)) {
        const executed = hederaService.getExecutedTransaction(transactionBytes);
        return {
          success: false,
          error: `Transaction already executed at ${executed?.timestamp.toISOString()} with ID: ${executed?.transactionId}`
        };
      }

      const result = await hederaService.executeTransactionBytes(
        transactionBytes,
        config.hedera.accountId,
        config.hedera.privateKey,
        config.hedera.network || 'testnet'
      );

      if (result.success) {
        logger.info('Transaction executed successfully', {
          transactionId: result.transactionId,
          status: result.status,
          entityId: result.entityId,
          entityType: result.entityType
        });

        if (result.entityId && result.entityType) {
          let entityName = entityContext?.name;
          
          if (!entityName && entityContext?.description) {
            const nameMatch = entityContext.description.match(/(?:token|account|topic|schedule|contract)\s+([A-Za-z0-9_-]+)/i);
            if (nameMatch) {
              entityName = nameMatch[1];
            }
          }
          
          if (!entityName) {
            entityName = `${result.entityType}_${Date.now()}`;
          }

          agentService.storeEntityAssociation(
            result.entityId,
            entityName,
            result.entityType,
            result.transactionId
          );
          
          logger.info('Stored entity association:', {
            entityName,
            entityType: result.entityType,
            entityId: result.entityId,
            transactionId: result.transactionId
          });
        }
      } else {
        logger.error('Transaction execution failed', {
          error: result.error,
          status: result.status
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Failed to execute transaction bytes:', error);
      return {
        success: false,
        error: `Transaction execution failed: ${errorMessage}`
      };
    }
  });
}