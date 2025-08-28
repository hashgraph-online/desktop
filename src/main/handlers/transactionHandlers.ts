import { ipcMain } from 'electron';
import { AgentService } from '../services/agent-service';
import { HederaService } from '../services/hedera-service';
import { ConfigService } from '../services/config-service';
import { MirrorNodeService } from '../services/mirror-node-service';
import { Logger } from '../utils/logger';
import type { TransactionExecutionResult } from '../services/hedera-service';

const logger = new Logger({ module: 'TransactionHandlers' });

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    transactionId?: string;
    scheduleId?: string;
    notes?: string[];
    transactionBytes?: string;
    [key: string]: unknown;
  };
}

interface ScheduleInfo {
  scheduleId?: string;
  executed?: boolean;
  deleted?: boolean;
  executed_timestamp?: string;
  consensus_timestamp?: string;
  expiration_time?: string;
  expiry?: Date;
  creator?: string;
  payer?: string;
  memo?: string;
  transactionBytes?: string;
  signatures?: string[];
  transactionId?: string;
  notes?: string[];
  [key: string]: unknown;
}

/**
 * Register transaction-related IPC handlers
 */
export function registerTransactionHandlers(): void {
  const agentService = AgentService.getInstance();
  const hederaService = HederaService.getInstance();
  const configService = ConfigService.getInstance();

  /**
   * Execute a scheduled transaction directly using Hedera SDK
   */
  ipcMain.handle(
    'execute-scheduled-transaction',
    async (
      _,
      scheduleId: string
    ): Promise<{
      success: boolean;
      transactionId?: string;
      error?: string;
    }> => {
      try {
        logger.info('Executing scheduled transaction:', scheduleId);

        const config = await configService.load();
        if (!config?.hedera?.accountId || !config?.hedera?.privateKey) {
          return {
            success: false,
            error: 'Hedera credentials not configured',
          };
        }

        const mirrorNodeService = MirrorNodeService.getInstance();
        try {
          const scheduleInfo = await mirrorNodeService.getScheduleInfo(
            scheduleId,
            (config.hedera.network as 'mainnet' | 'testnet') || 'testnet'
          );

          if ((scheduleInfo as ScheduleInfo)?.executed_timestamp) {
            logger.info('Schedule already executed', {
              scheduleId,
              executedTimestamp: (scheduleInfo as ScheduleInfo)
                .executed_timestamp,
            });
            return {
              success: false,
              error: 'SCHEDULE_ALREADY_EXECUTED',
            };
          }

          if ((scheduleInfo as ScheduleInfo)?.deleted) {
            logger.info('Schedule was deleted', { scheduleId });
            return {
              success: false,
              error: 'SCHEDULE_DELETED',
            };
          }

          if ((scheduleInfo as ScheduleInfo)?.consensus_timestamp) {
            const createdTimestamp = (scheduleInfo as ScheduleInfo)
              .consensus_timestamp as string;
            const createdSeconds = parseFloat(createdTimestamp);
            const createdDate = new Date(createdSeconds * 1000);
            const ageMinutes =
              (Date.now() - createdDate.getTime()) / (1000 * 60);

            if (ageMinutes > 30) {
              logger.info('Schedule has expired due to age', {
                scheduleId,
                ageMinutes: Math.round(ageMinutes),
                consensusTimestamp: createdTimestamp,
                createdDate: createdDate.toISOString(),
              });
              return {
                success: false,
                error: 'SCHEDULE_EXPIRED',
              };
            }
          }

          if ((scheduleInfo as ScheduleInfo)?.expiration_time) {
            const expirationDate = new Date(
              (scheduleInfo as ScheduleInfo).expiration_time as string
            );
            if (expirationDate < new Date()) {
              logger.info('Schedule has expired', {
                scheduleId,
                expirationTime: (scheduleInfo as ScheduleInfo).expiration_time,
              });
              return {
                success: false,
                error: 'SCHEDULE_EXPIRED',
              };
            }
          }
        } catch (mirrorError) {
          logger.warn(
            'Could not check schedule via mirror node, proceeding:',
            mirrorError
          );
        }

        const result = await hederaService.executeScheduledTransaction(
          scheduleId,
          config.hedera.accountId,
          config.hedera.privateKey,
          config.hedera.network || 'testnet'
        );

        if (result.success) {
          logger.info('Scheduled transaction executed successfully:', {
            scheduleId,
            transactionId: result.transactionId,
          });
          return {
            success: true,
            transactionId: result.transactionId,
          };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to execute scheduled transaction',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to execute scheduled transaction:', error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  /**
   * Delete/reject a scheduled transaction directly using Hedera SDK
   */
  ipcMain.handle(
    'delete-scheduled-transaction',
    async (
      _,
      scheduleId: string
    ): Promise<{
      success: boolean;
      error?: string;
    }> => {
      try {
        logger.info('Deleting scheduled transaction:', scheduleId);

        const config = await configService.load();
        if (!config?.hedera?.accountId || !config?.hedera?.privateKey) {
          return {
            success: false,
            error: 'Hedera credentials not configured',
          };
        }

        const result = await hederaService.deleteScheduledTransaction(
          scheduleId,
          config.hedera.accountId,
          config.hedera.privateKey,
          config.hedera.network || 'testnet'
        );

        if (result.success) {
          logger.info(
            'Scheduled transaction deleted successfully:',
            scheduleId
          );
          return { success: true };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to delete scheduled transaction',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to delete scheduled transaction:', error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  /**
   * Get scheduled transaction info
   */
  ipcMain.handle(
    'get-scheduled-transaction',
    async (
      _,
      scheduleId: string
    ): Promise<{
      success: boolean;
      info?: ScheduleInfo;
      error?: string;
    }> => {
      try {
        logger.info('Getting scheduled transaction info:', scheduleId);

        const result = await agentService.sendMessage(
          `Get information about the scheduled transaction with ID ${scheduleId}`,
          []
        );

        if (result.success && result.response) {
          const isAgentMessage = (obj: unknown): obj is AgentMessage => {
            return (
              typeof obj === 'object' &&
              obj !== null &&
              'id' in obj &&
              'role' in obj &&
              'content' in obj &&
              'timestamp' in obj
            );
          };

          if (isAgentMessage(result.response)) {
            return {
              success: true,
              info: result.response.metadata,
            };
          } else {
            return {
              success: false,
              error: 'Invalid response format',
            };
          }
        } else {
          return {
            success: false,
            error: result.error || 'Failed to get scheduled transaction info',
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get scheduled transaction info:', error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  /**
   * Execute transaction bytes directly with stored credentials
   */
  ipcMain.handle(
    'execute-transaction-bytes',
    async (
      _,
      transactionBytes: string,
      entityContext?: { name?: string; description?: string }
    ): Promise<TransactionExecutionResult> => {
      try {
        logger.info('Executing transaction bytes:', {
          bytesLength: transactionBytes?.length || 0,
          hasEntityContext: !!entityContext,
        });

        if (!transactionBytes || typeof transactionBytes !== 'string') {
          return {
            success: false,
            error: 'Transaction bytes are required and must be a valid string',
          };
        }

        const config = await configService.load();
        if (!config) {
          return {
            success: false,
            error:
              'No configuration found. Please configure your Hedera credentials first.',
          };
        }

        if (!config.hedera?.accountId || !config.hedera?.privateKey) {
          return {
            success: false,
            error:
              'Hedera account credentials not found. Please configure your account ID and private key.',
          };
        }

        if (hederaService.isTransactionExecuted(transactionBytes)) {
          const executed =
            hederaService.getExecutedTransaction(transactionBytes);
          return {
            success: false,
            error: `Transaction already executed at ${executed?.timestamp.toISOString()} with ID: ${executed?.transactionId}`,
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
            entityType: result.entityType,
          });

          if (result.entityId && result.entityType) {
            let entityName = entityContext?.name;

            if (!entityName && entityContext?.description) {
              const nameMatch = entityContext.description.match(
                /(?:token|account|topic|schedule|contract)\s+([A-Za-z0-9_-]+)/i
              );
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
              result.transactionId
            );

            logger.info('Stored entity association and informed agent:', {
              entityName,
              entityType: result.entityType,
              entityId: result.entityId,
              transactionId: result.transactionId,
            });
          }
        } else {
          logger.error('Transaction execution failed', {
            error: result.error,
            status: result.status,
          });
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Failed to execute transaction bytes:', error);
        return {
          success: false,
          error: `Transaction execution failed: ${errorMessage}`,
        };
      }
    }
  );
}
