import { TransactionParserService } from '../../../src/main/services/transaction-parser-service';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: {
    validateTransactionBytes: jest.fn(),
    parseTransactionBytes: jest.fn()
  },
  Logger: jest.fn()
}));

describe('TransactionParserService', () => {
  let service: TransactionParserService;
  let mockTransactionParser: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    (TransactionParserService as any).instance = null;

    const { TransactionParser } = require('@hashgraphonline/standards-sdk');
    mockTransactionParser = TransactionParser;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    const { Logger } = require('../../../src/main/utils/logger');
    Logger.mockImplementation(() => mockLogger);

    service = TransactionParserService.getInstance();
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = TransactionParserService.getInstance();
      const instance2 = TransactionParserService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(TransactionParserService);
    });

    test('should create new instance when called first time', () => {
      const instance = TransactionParserService.getInstance();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(TransactionParserService);
    });
  });

  describe('validateTransactionBytes', () => {
    const validTransactionBytes = 'valid-transaction-bytes';
    const invalidTransactionBytes = 'invalid-transaction-bytes';

    test('should return valid result when validation succeeds', () => {
      const validationResult = {
        isValid: true,
        error: undefined,
        details: { someDetail: 'value' }
      };

      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const result = service.validateTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        isValid: true,
        error: undefined,
        details: { someDetail: 'value' }
      });
      expect(mockTransactionParser.validateTransactionBytes).toHaveBeenCalledWith(validTransactionBytes);
    });

    test('should return invalid result when validation fails', () => {
      const validationResult = {
        isValid: false,
        error: 'Invalid transaction format',
        details: { reason: 'malformed' }
      };

      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const result = service.validateTransactionBytes(invalidTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid transaction format',
        details: { reason: 'malformed' }
      });
    });

    test('should handle validation result with string error', () => {
      const validationResult = {
        isValid: false,
        error: 'Validation error message',
        otherField: 'ignored'
      };

      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const result = service.validateTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: 'Validation error message',
        details: undefined
      });
    });

    test('should handle validation result with non-string error', () => {
      const validationResult = {
        isValid: false,
        error: { message: 'Error object' },
        details: { someDetail: 'value' }
      };

      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const result = service.validateTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: undefined,
        details: { someDetail: 'value' }
      });
    });

    test('should handle validation result with invalid format', () => {
      const validationResult = 'invalid-format';

      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const result = service.validateTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid validation result format'
      });
    });

    test('should handle validation exception', () => {
      const validationError = new Error('Validation failed');
      mockTransactionParser.validateTransactionBytes.mockImplementation(() => {
        throw validationError;
      });

      const result = service.validateTransactionBytes(invalidTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: 'Validation failed'
      });
    });

    test('should handle non-Error validation exception', () => {
      const validationError = 'String error';
      mockTransactionParser.validateTransactionBytes.mockImplementation(() => {
        throw validationError;
      });

      const result = service.validateTransactionBytes(invalidTransactionBytes);

      expect(result).toEqual({
        isValid: false,
        error: 'Validation failed'
      });
    });
  });

  describe('parseTransactionBytes', () => {
    const validTransactionBytes = 'valid-transaction-bytes';
    const invalidTransactionBytes = 'invalid-transaction-bytes';

    test('should return null when parser returns null', async () => {
      mockTransactionParser.parseTransactionBytes.mockResolvedValue(null);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toBeNull();
    });

    test('should return null when parser returns undefined', async () => {
      mockTransactionParser.parseTransactionBytes.mockResolvedValue(undefined);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toBeNull();
    });

    test('should return parsed transaction when format matches expected', async () => {
      const parsedTransaction = {
        transactionId: '0.0.123@123456789.000000000',
        transactionType: 'CRYPTOTRANSFER',
        fee: 100000,
        memo: 'Test transaction',
        validStart: { seconds: 123456789, nanos: 0 },
        signatures: [{ signature: new Uint8Array([1, 2, 3]) }]
      };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toEqual(parsedTransaction);
    });

    test('should normalize transaction when format does not match expected', async () => {
      const rawResult = {
        transactionId: '0.0.123@123456789.000000000',
        transactionType: 'CRYPTOTRANSFER',
        fee: 100000,
        memo: 'Test transaction',
        customField: 'custom value',
        anotherField: 42
      };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(rawResult);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        transactionId: '0.0.123@123456789.000000000',
        transactionType: 'CRYPTOTRANSFER',
        fee: 100000,
        memo: 'Test transaction',
        customField: 'custom value',
        anotherField: 42
      });
    });

    test('should handle missing required fields in normalization', async () => {
      const rawResult = {
        fee: 100000,
        memo: 'Test transaction',
        customField: 'custom value'
      };

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(rawResult);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        transactionId: 'unknown',
        transactionType: 'unknown',
        fee: 100000,
        memo: 'Test transaction',
        customField: 'custom value'
      });
    });

    test('should handle empty object in normalization', async () => {
      const rawResult = {};

      mockTransactionParser.parseTransactionBytes.mockResolvedValue(rawResult);

      const result = await service.parseTransactionBytes(validTransactionBytes);

      expect(result).toEqual({
        transactionId: 'unknown',
        transactionType: 'unknown'
      });
    });

    test('should throw error for unexpected result type', async () => {
      mockTransactionParser.parseTransactionBytes.mockResolvedValue('unexpected-string');

      await expect(service.parseTransactionBytes(validTransactionBytes))
        .rejects.toThrow('Unexpected parse result type: string');
    });

    test('should throw error when parser throws', async () => {
      const parseError = new Error('Parse failed');
      mockTransactionParser.parseTransactionBytes.mockImplementation(() => {
        throw parseError;
      });

      await expect(service.parseTransactionBytes(invalidTransactionBytes))
        .rejects.toThrow('Parse failed');
    });

    test('should handle parsing exceptions', async () => {
      const parseError = new Error('Parse failed');
      mockTransactionParser.parseTransactionBytes.mockImplementation(() => {
        throw parseError;
      });

      await expect(service.parseTransactionBytes(invalidTransactionBytes))
        .rejects.toThrow('Parse failed');
    });
  });

  describe('extractStringField', () => {
    test('should extract string field successfully', () => {
      const obj = { testField: 'test value', otherField: 123 };
      const result = (service as any).extractStringField(obj, 'testField');

      expect(result).toBe('test value');
    });

    test('should return undefined for non-string field', () => {
      const obj = { testField: 123 };
      const result = (service as any).extractStringField(obj, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for missing field', () => {
      const obj = { otherField: 'value' };
      const result = (service as any).extractStringField(obj, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for null object', () => {
      const result = (service as any).extractStringField(null, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for non-object', () => {
      const result = (service as any).extractStringField('string', 'testField');

      expect(result).toBeUndefined();
    });
  });

  describe('extractNumberField', () => {
    test('should extract number field successfully', () => {
      const obj = { testField: 123, otherField: 'string' };
      const result = (service as any).extractNumberField(obj, 'testField');

      expect(result).toBe(123);
    });

    test('should return undefined for non-number field', () => {
      const obj = { testField: 'not a number' };
      const result = (service as any).extractNumberField(obj, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for missing field', () => {
      const obj = { otherField: 456 };
      const result = (service as any).extractNumberField(obj, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for null object', () => {
      const result = (service as any).extractNumberField(null, 'testField');

      expect(result).toBeUndefined();
    });

    test('should return undefined for non-object', () => {
      const result = (service as any).extractNumberField(42, 'testField');

      expect(result).toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete transaction validation and parsing flow', async () => {
      const transactionBytes = 'sample-transaction-bytes';

      const validationResult = { isValid: true };
      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const parsedTransaction = {
        transactionId: '0.0.123@123456789.000000000',
        transactionType: 'CRYPTOTRANSFER',
        fee: 100000,
        memo: 'Integration test'
      };
      mockTransactionParser.parseTransactionBytes.mockResolvedValue(parsedTransaction);

      const validation = service.validateTransactionBytes(transactionBytes);
      expect(validation.isValid).toBe(true);

      const parsed = await service.parseTransactionBytes(transactionBytes);
      expect(parsed).toEqual(parsedTransaction);
    });

    test('should handle validation failure and parsing skip', async () => {
      const transactionBytes = 'invalid-transaction-bytes';

      const validationResult = {
        isValid: false,
        error: 'Invalid format'
      };
      mockTransactionParser.validateTransactionBytes.mockReturnValue(validationResult);

      const validation = service.validateTransactionBytes(transactionBytes);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid format');

      mockTransactionParser.parseTransactionBytes.mockRejectedValue(new Error('Parse failed'));
      await expect(service.parseTransactionBytes(transactionBytes))
        .rejects.toThrow('Parse failed');
    });
  });
});
