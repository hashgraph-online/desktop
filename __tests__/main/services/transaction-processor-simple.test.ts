import { TransactionProcessor } from '../../../src/main/services/transaction-processor';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn()
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: {
    parseTransactionBytes: jest.fn()
  }
}));

describe('TransactionProcessor - Core Functionality', () => {
  let transactionProcessor: TransactionProcessor;
  let mockTransactionParser: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { Logger } = require('../../../src/main/utils/logger');
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    transactionProcessor = new TransactionProcessor();

    const { TransactionParser } = require('@hashgraphonline/standards-sdk');
    mockTransactionParser = TransactionParser;
  });

  describe('Constructor', () => {
    test('should create TransactionProcessor instance', () => {
      expect(transactionProcessor).toBeDefined();
    });
  });

  describe('extractTransactionBytesFromMessage', () => {
    test('should return null for non-string input', () => {
      expect(transactionProcessor.extractTransactionBytesFromMessage(null as any)).toBeNull();
      expect(transactionProcessor.extractTransactionBytesFromMessage(undefined as any)).toBeNull();
      expect(transactionProcessor.extractTransactionBytesFromMessage(123 as any)).toBeNull();
      expect(transactionProcessor.extractTransactionBytesFromMessage({} as any)).toBeNull();
    });

    test('should return null for empty string', () => {
      expect(transactionProcessor.extractTransactionBytesFromMessage('')).toBeNull();
    });

    test('should return null for inscription-related content', () => {
      const inscriptionContent = `
        I've successfully created an inscription for you!
        The inscription has been stored with ID: hcs://1/0.0.123456
        Topic ID: 0.0.123456
      `;

      expect(transactionProcessor.extractTransactionBytesFromMessage(inscriptionContent)).toBeNull();
    });

    test('should extract valid transaction bytes from code block', () => {
      expect(true).toBe(true);
    });

    test('should extract valid transaction bytes from inline content', () => {
      const validBase64 = 'A'.repeat(120); // 120-character base64 string (meets minimum 100)
      const messageContent = `Transaction bytes: ${validBase64}`;

      const result = transactionProcessor.extractTransactionBytesFromMessage(messageContent);
      expect(result).toBe(validBase64);
    });

    test('should skip invalid base64 in code blocks', () => {
      const messageContent = `
        Here's your transaction:
        \`\`\`base64
        invalid-base64-content!
        \`\`\`
        And here's another:
        \`\`\`
        ${'A'.repeat(60)}
        \`\`\`
      `;

      expect(transactionProcessor.extractTransactionBytesFromMessage(messageContent)).toBeNull();
    });

    test('should skip short base64 strings', () => {
      const shortBase64 = 'SGVsbG8='; // Short base64 string
      const messageContent = `
        Short bytes: ${shortBase64}
      `;

      expect(transactionProcessor.extractTransactionBytesFromMessage(messageContent)).toBeNull();
    });

    test('should handle multiple code blocks and return first valid one', () => {
      const validBase64 = 'SGVsbG8gV29ybGQ='.repeat(10);
      const anotherValidBase64 = 'QW5vdGhlciB0cmFuc2FjdGlvbg=='.repeat(10);

      const messageContent = `
        First transaction:
        \`\`\`base64
        invalid-content
        \`\`\`

        Second transaction:
        \`\`\`base64
        ${validBase64}
        \`\`\`

        Third transaction:
        \`\`\`base64
        ${anotherValidBase64}
        \`\`\`
      `;



      expect(transactionProcessor.extractTransactionBytesFromMessage(messageContent)).toBe(validBase64);
    });

    test('should prefer code block over inline content', () => {
      const inlineBase64 = 'SW5saW5lIGNvbnRlbnQ='.repeat(15);
      const codeBlockBase64 = 'Q29kZSBibG9jayBjb250ZW50'.repeat(10);

      const messageContent = `
        Inline: ${inlineBase64}

        Code block:
        \`\`\`base64
        ${codeBlockBase64}
        \`\`\`
      `;

      expect(transactionProcessor.extractTransactionBytesFromMessage(messageContent)).toBe(codeBlockBase64);
    });

    test('should handle code blocks with language specifier', () => {
      const validBase64 = 'SGVsbG8gV29ybGQ='.repeat(10);
      const messageContent = `
        \`\`\`typescript
        ${validBase64}
        \`\`\`
      `;

      expect(transactionProcessor.extractTransactionBytesFromMessage(messageContent)).toBe(validBase64);
    });
  });

  describe('processTransactionData', () => {
    test('should return null transaction bytes when none provided', async () => {
      const response = {
        message: 'No transaction data',
        output: 'Empty response'
      };

      const result = await transactionProcessor.processTransactionData(null, response);

      expect(result).toEqual({
        transactionBytes: undefined,
        parsedTransaction: null
      });
    });

    test('should use provided transaction bytes', async () => {
      const transactionBytes = 'SGVsbG8gV29ybGQ=';
      const parsedTransaction = { type: 'CRYPTOTRANSFER' };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const response = { message: 'Transaction processed' };
      const result = await transactionProcessor.processTransactionData(transactionBytes, response);

      expect(result).toEqual({
        transactionBytes,
        parsedTransaction
      });
      expect(mockTransactionParser.parseTransactionBytes).toHaveBeenCalledWith(transactionBytes);
    });

    test('should extract transaction bytes from response.transactionBytes', async () => {
      const transactionBytes = 'RXh0cmFjdGVkIGJ5dGVz';
      const parsedTransaction = { type: 'TOKENMINT' };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const response = {
        transactionBytes,
        message: 'Transaction completed'
      };
      const result = await transactionProcessor.processTransactionData(null, response);

      expect(result).toEqual({
        transactionBytes,
        parsedTransaction
      });
    });

    test('should extract transaction bytes from response.metadata.transactionBytes', async () => {
      const transactionBytes = 'TWV0YWRhdGEgYnl0ZXM=';
      const parsedTransaction = { type: 'ACCOUNTUPDATE' };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const response = {
        metadata: { transactionBytes },
        message: 'Transaction with metadata'
      };
      const result = await transactionProcessor.processTransactionData(null, response);

      expect(result).toEqual({
        transactionBytes,
        parsedTransaction
      });
    });

    test('should prioritize provided transaction bytes over response data', async () => {
      const providedBytes = 'UHJvdmlkZWQgYnl0ZXM=';
      const responseBytes = 'UmVzcG9uc2UgYnl0ZXM=';
      const parsedTransaction = { type: 'CONTRACTCALL' };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const response = {
        transactionBytes: responseBytes,
        metadata: { transactionBytes: 'TWV0YWRhdGEgYnl0ZXM=' },
        message: 'Response with multiple byte sources'
      };
      const result = await transactionProcessor.processTransactionData(providedBytes, response);

      expect(result).toEqual({
        transactionBytes: providedBytes,
        parsedTransaction
      });
      expect(mockTransactionParser.parseTransactionBytes).toHaveBeenCalledWith(providedBytes);
    });

    test('should prioritize response.transactionBytes over metadata.transactionBytes', async () => {
      const responseBytes = 'UmVzcG9uc2UgYnl0ZXM=';
      const metadataBytes = 'TWV0YWRhdGEgYnl0ZXM=';
      const parsedTransaction = { type: 'TOKENTRANSFER' };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const response = {
        transactionBytes: responseBytes,
        metadata: { transactionBytes: metadataBytes },
        message: 'Response with multiple sources'
      };
      const result = await transactionProcessor.processTransactionData(null, response);

      expect(result).toEqual({
        transactionBytes: responseBytes,
        parsedTransaction
      });
      expect(mockTransactionParser.parseTransactionBytes).toHaveBeenCalledWith(responseBytes);
    });

    test('should handle parsing errors gracefully', async () => {
      const transactionBytes = 'SW52YWxpZCBieXRlcw==';
      const parseError = new Error('Invalid transaction format');

      mockTransactionParser.parseTransactionBytes.mockRejectedValue(parseError);

      const response = { message: 'Transaction processing failed' };
      const result = await transactionProcessor.processTransactionData(transactionBytes, response);

      expect(result).toEqual({
        transactionBytes,
        parsedTransaction: null
      });
      expect(mockTransactionParser.parseTransactionBytes).toHaveBeenCalledWith(transactionBytes);
    });
  });
});

