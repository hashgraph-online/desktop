import { TransactionParser, Logger } from '@hashgraphonline/standards-sdk';

/**
 * Proxy service for TransactionParser from standards-sdk
 * This runs in the main process to handle Node.js dependencies
 */
export class TransactionParserService {
  private static instance: TransactionParserService;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger({ module: 'TransactionParserService' });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TransactionParserService {
    if (!TransactionParserService.instance) {
      TransactionParserService.instance = new TransactionParserService();
    }
    return TransactionParserService.instance;
  }

  /**
   * Proxy validateTransactionBytes from TransactionParser
   */
  validateTransactionBytes(transactionBytes: string): any {
    return TransactionParser.validateTransactionBytes(transactionBytes);
  }

  /**
   * Proxy parseTransactionBytes from TransactionParser
   */
  async parseTransactionBytes(transactionBytes: string): Promise<any> {
    return TransactionParser.parseTransactionBytes(transactionBytes);
  }
}

export default TransactionParserService;