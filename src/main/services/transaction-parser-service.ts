import { TransactionParser, Logger } from '@hashgraphonline/standards-sdk';

/**
 * Transaction validation result
 */
export interface TransactionValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Parsed transaction structure with common fields
 */
export interface ParsedTransaction {
  transactionId: string;
  transactionType: string;
  fee?: number;
  memo?: string;
  validStart?: {
    seconds: number;
    nanos: number;
  };
  validDuration?: {
    seconds: number;
  };
  signatures?: Array<{
    signature: Uint8Array;
  }>;
  [key: string]: unknown;
}

/**
 * Type guard to check if parsed result is a valid transaction
 */
function isParsedTransaction(result: unknown): result is ParsedTransaction {
  return (
    typeof result === 'object' &&
    result !== null &&
    'transactionId' in result &&
    'transactionType' in result &&
    typeof (result as { transactionId: unknown }).transactionId === 'string' &&
    typeof (result as { transactionType: unknown }).transactionType === 'string'
  );
}

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
  validateTransactionBytes(
    transactionBytes: string
  ): TransactionValidationResult {
    try {
      const result =
        TransactionParser.validateTransactionBytes(transactionBytes);

      if (
        typeof result === 'object' &&
        result !== null &&
        'isValid' in result
      ) {
        const validationResult = result as {
          isValid: unknown;
          error?: unknown;
          [key: string]: unknown;
        };
        return {
          isValid: Boolean(validationResult.isValid),
          error:
            typeof validationResult.error === 'string'
              ? validationResult.error
              : undefined,
          details:
            validationResult.details &&
            typeof validationResult.details === 'object'
              ? (validationResult.details as Record<string, unknown>)
              : undefined,
        };
      }

      return {
        isValid: false,
        error: 'Invalid validation result format',
      };
    } catch (error) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error('Validation failed:', error);
      }
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Proxy parseTransactionBytes from TransactionParser
   */
  async parseTransactionBytes(
    transactionBytes: string
  ): Promise<ParsedTransaction | null> {
    try {
      const result =
        await TransactionParser.parseTransactionBytes(transactionBytes);

      if (result === null || result === undefined) {
        return null;
      }

      if (isParsedTransaction(result)) {
        return result;
      }

      if (typeof result === 'object' && result !== null) {
        if (this.logger && typeof this.logger.warn === 'function') {
          this.logger.warn(
            'Parsed transaction does not match expected format, attempting to normalize'
          );
        }

        const normalized: ParsedTransaction = {
          transactionId:
            this.extractStringField(result, 'transactionId') || 'unknown',
          transactionType:
            this.extractStringField(result, 'transactionType') || 'unknown',
        };

        const fee = this.extractNumberField(result, 'fee');
        if (fee !== undefined) normalized.fee = fee;

        const memo = this.extractStringField(result, 'memo');
        if (memo !== undefined) normalized.memo = memo;

        Object.keys(result).forEach((key) => {
          if (
            !('transactionId' in normalized) ||
            (key !== 'transactionId' && key !== 'transactionType')
          ) {
            normalized[key] = (result as Record<string, unknown>)[key];
          }
        });

        return normalized;
      }

      throw new Error(`Unexpected parse result type: ${typeof result}`);
    } catch (error) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error('Transaction parsing failed:', error);
      }
      throw error;
    }
  }

  /**
   * Helper to safely extract string fields from parsed results
   */
  private extractStringField(obj: unknown, field: string): string | undefined {
    if (typeof obj === 'object' && obj !== null && field in obj) {
      const value = (obj as Record<string, unknown>)[field];
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }

  /**
   * Helper to safely extract number fields from parsed results
   */
  private extractNumberField(obj: unknown, field: string): number | undefined {
    if (typeof obj === 'object' && obj !== null && field in obj) {
      const value = (obj as Record<string, unknown>)[field];
      return typeof value === 'number' ? value : undefined;
    }
    return undefined;
  }
}

export default TransactionParserService;
