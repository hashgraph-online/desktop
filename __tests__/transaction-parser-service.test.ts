import { TransactionParserService } from '../src/main/services/TransactionParserService';
import type { TransactionValidationResult } from '../src/main/services/TransactionParserService';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: {
    validateTransactionBytes: jest.fn(),
    parseTransactionBytes: jest.fn()
  },
  Logger: jest.fn().mockImplementation(() => mockLogger)
}));

describe('TransactionParserService Type Safety', () => {
  let service: TransactionParserService;

  beforeEach(() => {
    jest.clearAllMocks();
    (TransactionParserService as unknown as { instance: TransactionParserService | undefined }).instance = undefined;
    service = TransactionParserService.getInstance();
  });

  describe('Transaction validation with proper types', () => {
    it('should return proper validation result type structure', () => {
      const mockResult: TransactionValidationResult = {
        isValid: true,
        details: {
          transactionId: '0.0.123@1640995200.000000000',
          transactionType: 'CryptoTransfer'
        }
      };

      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.validateTransactionBytes.mockReturnValue(mockResult);

      const result = service.validateTransactionBytes('mock-transaction-bytes');
      
      expect(typeof result.isValid).toBe('boolean');
      expect(result.isValid).toBe(true);
      if (result.details) {
        expect(typeof result.details).toBe('object');
        expect(result.details.transactionId).toBe('0.0.123@1640995200.000000000');
      }
    });

    it('should handle validation errors with proper type structure', () => {
      const mockResult: TransactionValidationResult = {
        isValid: false,
        error: 'Invalid transaction format'
      };

      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.validateTransactionBytes.mockReturnValue(mockResult);

      const result = service.validateTransactionBytes('invalid-bytes');
      
      expect(typeof result.isValid).toBe('boolean');
      expect(result.isValid).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error).toBe('Invalid transaction format');
    });
  });

  describe('Transaction parsing with proper return types', () => {
    it('should return parsed transaction with proper type structure', async () => {
      const mockParsedTransaction = {
        transactionId: '0.0.123@1640995200.000000000',
        transactionType: 'CryptoTransfer',
        transfers: [
          { accountId: '0.0.456', amount: 1000000 },
          { accountId: '0.0.789', amount: -1000000 }
        ],
        fee: 100000,
        memo: 'Test transaction'
      };

      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.parseTransactionBytes.mockResolvedValue(mockParsedTransaction);

      const result = await service.parseTransactionBytes('mock-transaction-bytes');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      if (result && typeof result === 'object' && 'transactionId' in result) {
        expect(result.transactionId).toBe('0.0.123@1640995200.000000000');
      }
    });

    it('should handle parsing errors gracefully', async () => {
      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.parseTransactionBytes.mockRejectedValue(new Error('Parsing failed'));

      await expect(service.parseTransactionBytes('invalid-bytes'))
        .rejects.toThrow('Parsing failed');
    });

    it('should handle null/undefined parsing results', async () => {
      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.parseTransactionBytes.mockResolvedValue(null);

      const result = await service.parseTransactionBytes('empty-transaction');
      expect(result).toBeNull();
    });
  });

  describe('Service singleton behavior', () => {
    it('should maintain singleton pattern', () => {
      const service1 = TransactionParserService.getInstance();
      const service2 = TransactionParserService.getInstance();
      
      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(TransactionParserService);
    });
  });

  describe('Type safety for transaction data structures', () => {
    it('should handle complex transaction structures with proper typing', async () => {
      const complexTransaction = {
        transactionId: '0.0.123@1640995200.000000000',
        transactionType: 'ContractCall',
        contractId: '0.0.1001',
        functionParameters: new Uint8Array([1, 2, 3, 4]),
        gas: 250000,
        amount: 0,
        fee: 500000,
        validStart: {
          seconds: 1640995200,
          nanos: 0
        },
        validDuration: {
          seconds: 120
        },
        memo: 'Contract call',
        signatures: [
          {
            signature: new Uint8Array([5, 6, 7, 8])
          }
        ]
      };

      const { TransactionParser } = jest.requireActual('@hashgraphonline/standards-sdk');
      TransactionParser.parseTransactionBytes.mockResolvedValue(complexTransaction);

      const result = await service.parseTransactionBytes('complex-transaction-bytes');
      
      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'transactionType' in result) {
        expect(result.transactionType).toBe('ContractCall');
      }
    });
  });
});