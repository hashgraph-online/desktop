import { HederaService, type TransactionExecutionResult } from '../../../src/main/services/hedera-service';

// Mock dependencies
jest.mock('../../../src/main/utils/logger');

// Mock Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forMainnet: jest.fn().mockReturnThis(),
    forTestnet: jest.fn().mockReturnThis(),
    setOperator: jest.fn().mockReturnThis()
  },
  Transaction: {
    fromBytes: jest.fn()
  },
  PrivateKey: {
    fromString: jest.fn()
  },
  AccountId: {
    fromString: jest.fn()
  },
  TransactionResponse: jest.fn(),
  TransactionReceipt: jest.fn(),
  ScheduleId: jest.fn(),
  ScheduleSignTransaction: jest.fn(),
  ScheduleDeleteTransaction: jest.fn()
}));

describe('HederaService', () => {
  let hederaService: HederaService;
  let mockLogger: any;
  let mockClient: any;
  let mockTransaction: any;
  let mockTransactionResponse: any;
  let mockTransactionReceipt: any;

  const mockExecutedTransaction = {
    transactionId: '0.0.123@1234567890.000000000',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    transactionBytes: 'mock-transaction-bytes'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockClient = {
      setOperator: jest.fn().mockReturnThis(),
      forMainnet: jest.fn().mockReturnThis(),
      forTestnet: jest.fn().mockReturnThis()
    };

    mockTransaction = {
      execute: jest.fn(),
      getReceipt: jest.fn(),
      transactionId: { toString: jest.fn().mockReturnValue('0.0.123@1234567890.000000000') },
      freezeWith: jest.fn().mockReturnThis(),
      sign: jest.fn().mockReturnThis()
    };

    mockTransactionResponse = {
      transactionId: { toString: jest.fn().mockReturnValue('0.0.123@1234567890.000000000') },
      getReceipt: jest.fn()
    };

    mockTransactionReceipt = {
      status: { toString: jest.fn().mockReturnValue('SUCCESS') },
      accountId: { toString: jest.fn().mockReturnValue('0.0.12345') },
      tokenId: { toString: jest.fn().mockReturnValue('0.0.67890') },
      contractId: { toString: jest.fn().mockReturnValue('0.0.54321') }
    };

    // Mock constructors and methods
    require('../../../src/main/utils/logger').Logger = jest.fn().mockImplementation(() => mockLogger);
    require('@hashgraph/sdk').Client.forMainnet = jest.fn().mockReturnValue(mockClient);
    require('@hashgraph/sdk').Client.forTestnet = jest.fn().mockReturnValue(mockClient);
    require('@hashgraph/sdk').Transaction.fromBytes = jest.fn().mockReturnValue(mockTransaction);
    require('@hashgraph/sdk').PrivateKey.fromString = jest.fn().mockReturnValue('mock-private-key');
    require('@hashgraph/sdk').AccountId.fromString = jest.fn().mockReturnValue('mock-account-id');

    // Reset singleton
    HederaService['instance'] = null;
    hederaService = HederaService.getInstance();
  });

  afterEach(() => {
    // Reset singleton
    HederaService['instance'] = null;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = HederaService.getInstance();
      const instance2 = HederaService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should create new instance when singleton is reset', () => {
      const instance1 = HederaService.getInstance();
      HederaService['instance'] = null;
      const instance2 = HederaService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Transaction Execution Status', () => {
    test('should check if transaction is executed', () => {
      // Initially should return false
      expect(hederaService['isTransactionExecuted']('non-existent')).toBe(false);

      // Add a transaction to the executed set
      (hederaService as any).executedTransactions.set('existing-transaction', mockExecutedTransaction);

      expect(hederaService['isTransactionExecuted']('existing-transaction')).toBe(true);
    });

    test('should retrieve executed transaction', () => {
      // Initially should return undefined
      expect(hederaService['getExecutedTransaction']('non-existent')).toBeUndefined();

      // Add a transaction to the executed set
      (hederaService as any).executedTransactions.set('existing-transaction', mockExecutedTransaction);

      const result = hederaService['getExecutedTransaction']('existing-transaction');
      expect(result).toEqual(mockExecutedTransaction);
    });
  });

  describe('executeTransactionBytes', () => {
    beforeEach(() => {
      mockTransaction.freezeWith = jest.fn().mockResolvedValue(mockTransaction);
      mockTransaction.sign = jest.fn().mockResolvedValue(mockTransaction);
      mockTransaction.execute.mockResolvedValue(mockTransactionResponse);
      mockTransactionResponse.getReceipt.mockResolvedValue(mockTransactionReceipt);
    });

    test('should execute transaction successfully on testnet', async () => {
      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07',
        'testnet'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('0.0.123@1234567890.000000000');
      expect(result.status).toBe('SUCCESS');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting transaction execution via Hedera SDK',
        expect.objectContaining({
          accountId: '0.0.12345',
          network: 'testnet'
        })
      );
    });

    test('should execute transaction successfully on mainnet', async () => {
      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07',
        'mainnet'
      );

      expect(result.success).toBe(true);
      expect(require('@hashgraph/sdk').Client.forMainnet).toHaveBeenCalled();
    });

    test('should reject already executed transaction', async () => {
      // Add transaction to executed set
      (hederaService as any).executedTransactions.set('already-executed', mockExecutedTransaction);

      const result = await hederaService['executeTransactionBytes'](
        'already-executed',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction already executed');
    });

    test('should handle missing required parameters', async () => {
      const testCases = [
        ['', '0.0.12345', 'private-key'],
        ['transaction-bytes', '', 'private-key'],
        ['transaction-bytes', '0.0.12345', '']
      ];

      for (const [bytes, accountId, privateKey] of testCases) {
        const result = await hederaService['executeTransactionBytes'](
          bytes,
          accountId,
          privateKey
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('required');
      }
    });

    test('should handle transaction parsing errors', async () => {
      const parseError = new Error('Invalid transaction bytes');
      require('@hashgraph/sdk').Transaction.fromBytes.mockImplementation(() => {
        throw parseError;
      });

      const result = await hederaService['executeTransactionBytes'](
        'invalid-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transaction bytes format');
    });

    test('should handle transaction execution errors', async () => {
      const executionError = new Error('Transaction execution failed');
      mockTransaction.execute.mockRejectedValue(executionError);

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction execution failed');
    });

    test('should handle receipt retrieval errors', async () => {
      const receiptError = new Error('Receipt retrieval failed');
      mockTransactionResponse.getReceipt.mockRejectedValue(receiptError);

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Receipt retrieval failed');
    });

    test('should extract entity information from receipt', async () => {
      mockTransactionReceipt.status.toString.mockReturnValue('SUCCESS');
      // Set up the receipt to have both accountId and tokenId, tokenId should take precedence
      mockTransactionReceipt.accountId = { toString: () => '0.0.12345' };
      mockTransactionReceipt.tokenId = { toString: () => '0.0.67890' };

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(true);
      expect(result.entityId).toBe('0.0.67890');
      expect(result.entityType).toBe('token');
    });

    test('should handle different transaction types', async () => {
      // Test token creation
      mockTransactionReceipt.status.toString.mockReturnValue('SUCCESS');
      mockTransactionReceipt.tokenId = { toString: () => '0.0.67890' };

      const result = await hederaService['executeTransactionBytes'](
        'token-creation-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.entityId).toBe('0.0.67890');
      expect(result.entityType).toBe('token');
    });
  });



  describe('Error Handling', () => {
    test('should handle client initialization errors', async () => {
      require('@hashgraph/sdk').Client.forTestnet.mockImplementation(() => {
        throw new Error('Client initialization failed');
      });

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Client initialization failed');
    });

    test('should handle operator setting errors', async () => {
      mockClient.setOperator.mockImplementation(() => {
        throw new Error('Invalid operator credentials');
      });

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid operator credentials');
    });

    test('should handle receipt parsing errors', async () => {
      mockTransactionReceipt.status.toString.mockImplementation(() => {
        throw new Error('Invalid status');
      });

      const result = await hederaService['executeTransactionBytes'](
        'valid-transaction-bytes',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(result.success).toBe(true);
      // Should still succeed even with receipt parsing errors
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete transaction lifecycle', async () => {
      // 1. Check if transaction is executed (should be false initially)
      expect(hederaService['isTransactionExecuted']('lifecycle-test')).toBe(false);

      // 2. Execute transaction
      const executeResult = await hederaService['executeTransactionBytes'](
        'lifecycle-test',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(executeResult.success).toBe(true);

      // 3. Check if transaction is now executed
      expect(hederaService['isTransactionExecuted']('lifecycle-test')).toBe(true);

      // 4. Get executed transaction details
      const executedTx = hederaService['getExecutedTransaction']('lifecycle-test');
      expect(executedTx).toBeDefined();
      expect(executedTx?.transactionId).toBe('0.0.123@1234567890.000000000');

      // 5. Try to execute the same transaction again (should fail)
      const duplicateResult = await hederaService['executeTransactionBytes'](
        'lifecycle-test',
        '0.0.12345',
        '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
      );

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error).toContain('Transaction already executed');
    });

    test('should handle multiple concurrent transactions', async () => {
      const transactions = [
        { id: 'tx-1', bytes: 'bytes-1' },
        { id: 'tx-2', bytes: 'bytes-2' },
        { id: 'tx-3', bytes: 'bytes-3' }
      ];

      const promises = transactions.map(tx =>
        hederaService['executeTransactionBytes'](
          tx.bytes,
          '0.0.12345',
          '302e020100300506032b657004220420db484b828e64b2d8f12ce3c0a0e93a0b8cce7af1bb8f39c61e54b5e07'
        )
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify all transactions are marked as executed
      transactions.forEach(tx => {
        expect(hederaService['isTransactionExecuted'](tx.bytes)).toBe(true);
      });
    });
  });
});
