import { Logger } from '../utils/logger';
import { TransactionParser } from '@hashgraphonline/standards-sdk';

export interface TransactionExtractionResult {
  transactionBytes: string | null;
  parsedTransaction: unknown | null;
}

/**
 * Utility for processing and extracting transaction data from messages
 */
export class TransactionProcessor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ module: 'TransactionProcessor' });
  }

  /**
   * Extract transaction bytes from message content
   */
  extractTransactionBytesFromMessage(messageContent: string): string | null {
    if (typeof messageContent !== 'string') {
      this.logger.warn(
        'extractTransactionBytesFromMessage called with non-string value:',
        {
          actualType: typeof messageContent,
          isNull: messageContent === null,
          isUndefined: messageContent === undefined,
        }
      );
      return null;
    }

    this.logger.info('Attempting to extract transaction bytes from message:', {
      contentLength: messageContent.length,
      contentPreview: messageContent.substring(0, 300) + '...',
      hasCodeBlocks: messageContent.includes('```'),
    });

    const hrlPattern = /hcs:\/\/\d+\/[\d.]+/;
    const hasHrl = hrlPattern.test(messageContent);
    const hasTopicId = messageContent.includes('topicId');
    const hasInscriptionKeywords = /inscription|hashinal|inscribed/i.test(messageContent);

    if (hasHrl || (hasTopicId && hasInscriptionKeywords)) {
      this.logger.info(
        'Inscription tool response detected - no transaction bytes extraction needed',
        { hasHrl, hasTopicId, hasInscriptionKeywords }
      );
      return null;
    }

    const codeBlockRegex = /```[a-z]*\n([A-Za-z0-9+/]{50,}(?:={0,2})?)\n```/g;
    const matches = [...messageContent.matchAll(codeBlockRegex)];

    for (const match of matches) {
      const potentialBytes = match[1];
      if (potentialBytes && potentialBytes.length > 50) {
        try {
          Buffer.from(potentialBytes, 'base64');
          this.logger.info('Valid base64 transaction bytes found in code block');
          return potentialBytes;
        } catch {
          continue;
        }
      }
    }

    const inlineRegex = /([A-Za-z0-9+/]{100,}={0,2})/g;
    const inlineMatches = [...messageContent.matchAll(inlineRegex)];

    for (const match of inlineMatches) {
      const potentialBytes = match[1];
      if (potentialBytes && potentialBytes.length > 100) {
        try {
          Buffer.from(potentialBytes, 'base64');
          this.logger.info('Valid base64 transaction bytes found inline');
          return potentialBytes;
        } catch {
          continue;
        }
      }
    }

    this.logger.warn('No valid transaction bytes found in message content');
    return null;
  }

  /**
   * Process transaction bytes and metadata to create enhanced transaction data
   */
  async processTransactionData(
    transactionBytes: string | null,
    response: { transactionBytes?: string; metadata?: { transactionBytes?: string }; message?: string; output?: string }
  ): Promise<TransactionExtractionResult> {
    let finalTransactionBytes = transactionBytes || response.transactionBytes || response.metadata?.transactionBytes;

    if (!finalTransactionBytes) {
      const messageContent = response.message || response.output || '';
      const extractedBytes = this.extractTransactionBytesFromMessage(messageContent);
      if (extractedBytes) {
        finalTransactionBytes = extractedBytes;
      }
    }

    let parsedTransaction = null;
    if (finalTransactionBytes) {
      try {
        parsedTransaction = await TransactionParser.parseTransactionBytes(finalTransactionBytes);
      } catch (parseError) {
        this.logger.warn('Failed to parse transaction bytes:', parseError);
      }
    }

    return {
      transactionBytes: finalTransactionBytes,
      parsedTransaction
    };
  }
}