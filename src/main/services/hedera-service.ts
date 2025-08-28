import { Logger } from '../utils/logger';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import {
  Client,
  Transaction,
  PrivateKey,
  AccountId,
  TransactionResponse,
  TransactionReceipt,
  ScheduleId,
  ScheduleSignTransaction,
  ScheduleDeleteTransaction,
} from '@hashgraph/sdk';

export interface TransactionExecutionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  status?: string;
  entityId?: string;
  entityType?: string;
}

export interface ExecutedTransaction {
  transactionId: string;
  timestamp: Date;
  transactionBytes: string;
}

export class HederaService {
  private static instance: HederaService;
  private logger: Logger;
  private executedTransactions: Map<string, ExecutedTransaction> = new Map();

  private constructor() {
    this.logger = new Logger({ module: 'HederaService' });
  }

  static getInstance(): HederaService {
    if (!HederaService.instance) {
      HederaService.instance = new HederaService();
    }
    return HederaService.instance;
  }

  isTransactionExecuted(transactionBytes: string): boolean {
    return this.executedTransactions.has(transactionBytes);
  }

  getExecutedTransaction(
    transactionBytes: string
  ): ExecutedTransaction | undefined {
    return this.executedTransactions.get(transactionBytes);
  }

  async executeTransactionBytes(
    transactionBytes: string,
    accountId: string,
    privateKey: string,
    network: NetworkType = 'testnet'
  ): Promise<TransactionExecutionResult> {
    try {
      this.logger.info('Starting transaction execution via Hedera SDK', {
        accountId,
        network,
        bytesLength: transactionBytes.length,
      });

      if (this.isTransactionExecuted(transactionBytes)) {
        const executed = this.getExecutedTransaction(transactionBytes);
        return {
          success: false,
          error: `Transaction already executed at ${executed?.timestamp.toISOString()} with ID: ${
            executed?.transactionId
          }`,
        };
      }

      if (!transactionBytes || !accountId || !privateKey) {
        return {
          success: false,
          error: 'Transaction bytes, account ID, and private key are required',
        };
      }

      const client =
        network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

      const operatorAccountId = AccountId.fromString(accountId);
      const operatorPrivateKey = PrivateKey.fromString(privateKey);
      client.setOperator(operatorAccountId, operatorPrivateKey);

      let transaction: Transaction;
      try {
        transaction = Transaction.fromBytes(
          Buffer.from(transactionBytes, 'base64')
        );
        this.logger.info('Successfully parsed transaction from bytes');
      } catch (parseError) {
        this.logger.error('Failed to parse transaction bytes:', parseError);
        try {
          client.close();
        } catch (closeError) {
          this.logger.warn('Error closing Hedera client:', closeError);
        }
        return {
          success: false,
          error:
            'Invalid transaction bytes format. The transaction may be corrupted.',
        };
      }

      let transactionResponse: TransactionResponse;
      try {
        this.logger.info('Freezing, signing and executing transaction');

        const frozenTransaction = await transaction.freezeWith(client);
        const signedTransaction =
          await frozenTransaction.sign(operatorPrivateKey);

        transactionResponse = await signedTransaction.execute(client);

        this.logger.info('Transaction submitted successfully', {
          transactionId: transactionResponse.transactionId.toString(),
        });
      } catch (executeError) {
        this.logger.error('Failed to execute transaction:', executeError);
        try {
          client.close();
        } catch (closeError) {
          this.logger.warn('Error closing Hedera client:', closeError);
        }

        const errorMessage =
          executeError instanceof Error
            ? executeError.message
            : 'Unknown execution error';
        let userFriendlyError = errorMessage;

        if (errorMessage.toLowerCase().includes('insufficient')) {
          userFriendlyError =
            'Insufficient account balance to execute this transaction';
        } else if (errorMessage.toLowerCase().includes('expired')) {
          userFriendlyError =
            'Transaction has expired. Please generate a new transaction.';
        } else if (errorMessage.toLowerCase().includes('invalid')) {
          userFriendlyError =
            'Invalid transaction. Please check the transaction parameters.';
        } else if (
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('network')
        ) {
          userFriendlyError =
            'Network error. Please check your connection and try again.';
        } else if (errorMessage.toLowerCase().includes('duplicate')) {
          userFriendlyError =
            'Duplicate transaction detected. This transaction has already been submitted.';
        }

        return {
          success: false,
          error: userFriendlyError,
        };
      }

      let receipt: TransactionReceipt;
      try {
        this.logger.info('Getting transaction receipt');
        receipt = await transactionResponse.getReceipt(client);
        this.logger.info('Transaction receipt received', {
          status: receipt.status.toString(),
        });
      } catch (receiptError) {
        this.logger.error('Failed to get transaction receipt:', receiptError);
        try {
          client.close();
        } catch (closeError) {
          this.logger.warn('Error closing Hedera client:', closeError);
        }

        const errorMessage =
          receiptError instanceof Error
            ? receiptError.message
            : 'Unknown receipt error';
        let userFriendlyError = errorMessage;

        if (errorMessage.includes('INVALID_TOKEN_ID')) {
          userFriendlyError =
            '🪙 Invalid Token ID\n\nThe specified token does not exist or you may not have permission to access it. Please verify the token ID and try again.';
        } else if (errorMessage.includes('INVALID_ACCOUNT_ID')) {
          userFriendlyError =
            'Invalid account ID. The specified account does not exist.';
        } else if (errorMessage.includes('INSUFFICIENT_TOKEN_BALANCE')) {
          userFriendlyError = 'Insufficient token balance for this operation.';
        } else if (errorMessage.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
          userFriendlyError =
            'The token is not associated with the target account. The account must associate with the token first.';
        } else if (errorMessage.includes('INSUFFICIENT_ACCOUNT_BALANCE')) {
          userFriendlyError =
            'Insufficient account balance to pay for transaction fees.';
        } else if (errorMessage.includes('EXPIRED')) {
          userFriendlyError =
            'Transaction has expired. Please generate a new transaction.';
        } else if (errorMessage.includes('DUPLICATE')) {
          userFriendlyError =
            'Duplicate transaction detected. This transaction has already been submitted.';
        } else if (errorMessage.toLowerCase().includes('receipt')) {
          userFriendlyError = `Transaction was submitted but failed: ${errorMessage}. Please check the transaction status on HashScan.`;
        }

        return {
          success: false,
          error: userFriendlyError,
        };
      } finally {
        try {
          client.close();
        } catch (closeError) {
          this.logger.warn('Error closing Hedera client:', closeError);
        }
      }

      const transactionId = transactionResponse.transactionId.toString();
      const status = receipt.status.toString();

      if (status === 'SUCCESS') {
        this.executedTransactions.set(transactionBytes, {
          transactionId,
          timestamp: new Date(),
          transactionBytes,
        });

        let entityId: string | undefined;
        let entityType: string | undefined;

        if (receipt.tokenId) {
          entityId = receipt.tokenId.toString();
          entityType = 'token';
          this.logger.info('Token created with ID:', entityId);
        } else if (receipt.topicId) {
          entityId = receipt.topicId.toString();
          entityType = 'topic';
          this.logger.info('Topic created with ID:', entityId);
        } else if (receipt.accountId) {
          entityId = receipt.accountId.toString();
          entityType = 'account';
          this.logger.info('Account created with ID:', entityId);
        } else if (receipt.scheduleId) {
          entityId = receipt.scheduleId.toString();
          entityType = 'schedule';
          this.logger.info('Schedule created with ID:', entityId);
        } else if (receipt.contractId) {
          entityId = receipt.contractId.toString();
          entityType = 'contract';
          this.logger.info('Contract created with ID:', entityId);
        }

        this.logger.info('Transaction executed successfully', {
          transactionId,
          status,
          entityId,
          entityType,
        });

        return {
          success: true,
          transactionId,
          status,
          entityId,
          entityType,
        };
      } else {
        this.logger.warn('Transaction completed but not successful', {
          transactionId,
          status,
        });

        return {
          success: false,
          error: `Transaction failed with status: ${status}`,
        };
      }
    } catch (error) {
      this.logger.error('Unexpected error in executeTransactionBytes:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      let userFriendlyError = `Transaction execution failed: ${errorMessage}`;

      if (errorMessage.toLowerCase().includes('invalid account')) {
        userFriendlyError =
          'Invalid account ID format. Please check your account configuration.';
      } else if (errorMessage.toLowerCase().includes('invalid private key')) {
        userFriendlyError =
          'Invalid private key format. Please check your private key configuration.';
      } else if (errorMessage.toLowerCase().includes('timeout')) {
        userFriendlyError = 'Request timed out. Please try again.';
      }

      return {
        success: false,
        error: userFriendlyError,
      };
    }
  }

  clearExecutedTransactions(): void {
    this.executedTransactions.clear();
    this.logger.info('Executed transactions cache cleared');
  }

  getExecutedTransactionCount(): number {
    return this.executedTransactions.size;
  }

  /**
   * Execute a scheduled transaction by signing it
   */
  async executeScheduledTransaction(
    scheduleId: string,
    accountId: string,
    privateKey: string,
    network: NetworkType | string = 'testnet'
  ): Promise<TransactionExecutionResult> {
    let client: Client | null = null;

    try {
      this.logger.info('Executing scheduled transaction:', {
        scheduleId,
        accountId,
        network,
      });

      client =
        network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

      const operatorAccountId = AccountId.fromString(accountId);
      const operatorPrivateKey = PrivateKey.fromString(privateKey);
      client.setOperator(operatorAccountId, operatorPrivateKey);

      let parsedScheduleId;
      try {
        parsedScheduleId = ScheduleId.fromString(scheduleId);
      } catch (parseError) {
        this.logger.error('Failed to parse schedule ID:', parseError);
        return {
          success: false,
          error: 'INVALID_SCHEDULE_ID',
          status: 'INVALID_SCHEDULE_ID',
        };
      }

      const scheduleSign = new ScheduleSignTransaction()
        .setScheduleId(parsedScheduleId)
        .freezeWith(client);

      const signedTx = await scheduleSign.sign(
        PrivateKey.fromString(privateKey)
      );
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);

      const transactionId = txResponse.transactionId.toString();
      const status = receipt.status.toString();

      this.logger.info('Scheduled transaction execution result', {
        scheduleId,
        transactionId,
        status,
      });

      if (status === 'INVALID_SCHEDULE_ID') {
        return {
          success: false,
          error: 'INVALID_SCHEDULE_ID',
          status: 'INVALID_SCHEDULE_ID',
        };
      }

      return {
        success: status === 'SUCCESS',
        transactionId,
        status,
      };
    } catch (error) {
      this.logger.error('Failed to execute scheduled transaction:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('INVALID_SCHEDULE_ID')) {
        this.logger.warn(
          'Schedule ID is invalid or no longer exists:',
          scheduleId
        );
        return {
          success: false,
          error: 'INVALID_SCHEDULE_ID',
          status: 'INVALID_SCHEDULE_ID',
        };
      }

      if (errorMessage.includes('SCHEDULE_ALREADY_EXECUTED')) {
        return {
          success: false,
          error: 'SCHEDULE_ALREADY_EXECUTED',
          status: 'SCHEDULE_ALREADY_EXECUTED',
        };
      }

      if (errorMessage.includes('SCHEDULE_DELETED')) {
        return {
          success: false,
          error: 'SCHEDULE_DELETED',
          status: 'SCHEDULE_DELETED',
        };
      }

      let userFriendlyError = errorMessage;

      if (errorMessage.includes('INSUFFICIENT')) {
        userFriendlyError =
          'Insufficient account balance to execute this scheduled transaction.';
      } else if (errorMessage.includes('EXPIRED')) {
        userFriendlyError = 'This scheduled transaction has expired.';
      } else if (errorMessage.includes('INVALID_SIGNATURE')) {
        userFriendlyError = 'Invalid signature. Please check your private key.';
      }

      return {
        success: false,
        error: userFriendlyError,
      };
    } finally {
      if (client) {
        try {
          client.close();
        } catch (closeError) {
          this.logger.warn('Error closing Hedera client:', closeError);
        }
      }
    }
  }

  /**
   * Delete a scheduled transaction
   */
  async deleteScheduledTransaction(
    scheduleId: string,
    accountId: string,
    privateKey: string,
    network: NetworkType | string = 'testnet'
  ): Promise<TransactionExecutionResult> {
    try {
      this.logger.info('Deleting scheduled transaction:', {
        scheduleId,
        accountId,
        network,
      });

      const client =
        network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

      const operatorAccountId = AccountId.fromString(accountId);
      const operatorPrivateKey = PrivateKey.fromString(privateKey);
      client.setOperator(operatorAccountId, operatorPrivateKey);

      const scheduleDelete = new ScheduleDeleteTransaction()
        .setScheduleId(scheduleId)
        .freezeWith(client);

      const signedTx = await scheduleDelete.sign(
        PrivateKey.fromString(privateKey)
      );
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);

      const transactionId = txResponse.transactionId.toString();
      const status = receipt.status.toString();

      this.logger.info('Scheduled transaction deleted', {
        scheduleId,
        transactionId,
        status,
      });

      return {
        success: status === 'SUCCESS',
        transactionId,
        status,
      };
    } catch (error) {
      this.logger.error('Failed to delete scheduled transaction:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
