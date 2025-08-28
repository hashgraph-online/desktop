import { mergeTransactionDetails } from '../../../src/renderer/utils/transactionMerger';
import type { ParsedTransaction } from '../../../src/renderer/types/transaction';

describe('TransactionMerger', () => {
  describe('mergeTransactionDetails', () => {
    test('should return enhanced transaction when original is null', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: { amount: 100 },
        transfers: [{ account: '0.0.123', amount: 100 }]
      };

      const result = mergeTransactionDetails(enhancedTransaction, null);

      expect(result).toBe(enhancedTransaction);
      expect(result).toEqual({
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: { amount: 100 },
        transfers: [{ account: '0.0.123', amount: 100 }]
      });
    });

    test('should return enhanced transaction when original is undefined', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { name: 'Test Token' }
      };

      const result = mergeTransactionDetails(enhancedTransaction, undefined);

      expect(result).toBe(enhancedTransaction);
    });

    test('should merge tokenCreation fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { name: 'Test Token' },
        tokenCreation: {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 8
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { supplyType: 'INFINITE' },
        tokenCreation: {
          name: 'Original Token',
          initialSupply: 1000000
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.tokenCreation).toEqual({
        name: 'Test Token', // enhanced wins
        symbol: 'TEST',
        decimals: 8,
        initialSupply: 1000000 // original preserved
      });
    });

    test('should merge consensusCreateTopic fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: { topicId: '0.0.123456' },
        consensusCreateTopic: {
          memo: 'Updated Memo',
          autoRenewPeriod: 7776000
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        consensusCreateTopic: {
          memo: 'Original Memo',
          adminKey: 'original-key'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.consensusCreateTopic).toEqual({
        memo: 'Updated Memo', // enhanced wins
        autoRenewPeriod: 7776000,
        adminKey: 'original-key' // original preserved
      });
    });

    test('should merge consensusSubmitMessage fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSSUBMITMESSAGE',
        details: { topicId: '0.0.123456' },
        consensusSubmitMessage: {
          message: 'Updated message',
          messageEncoding: 'utf8'
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSSUBMITMESSAGE',
        details: {},
        consensusSubmitMessage: {
          message: 'Original message',
          topicId: '0.0.123456'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.consensusSubmitMessage).toEqual({
        message: 'Updated message', // enhanced wins
        messageEncoding: 'utf8',
        topicId: '0.0.123456' // original preserved
      });
    });

    test('should merge cryptoCreateAccount fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOCREATEACCOUNT',
        details: { accountId: '0.0.789012' },
        cryptoCreateAccount: {
          initialBalance: 100000000,
          maxAutomaticTokenAssociations: 10
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOCREATEACCOUNT',
        details: {},
        cryptoCreateAccount: {
          initialBalance: 50000000,
          publicKey: 'original-public-key'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.cryptoCreateAccount).toEqual({
        initialBalance: 100000000, // enhanced wins
        maxAutomaticTokenAssociations: 10,
        publicKey: 'original-public-key' // original preserved
      });
    });

    test('should merge contractCreate fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONTRACTCREATEINSTANCE',
        details: { contractId: '0.0.345678' },
        contractCreate: {
          gas: 300000,
          initialBalance: 200000000
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONTRACTCREATEINSTANCE',
        details: {},
        contractCreate: {
          gas: 200000,
          bytecode: 'original-bytecode'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.contractCreate).toEqual({
        gas: 300000, // enhanced wins
        initialBalance: 200000000,
        bytecode: 'original-bytecode' // original preserved
      });
    });

    test('should merge scheduleCreate fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'SCHEDULECREATE',
        details: { scheduleId: '0.0.567890' },
        scheduleCreate: {
          scheduledTransaction: 'updated-tx',
          memo: 'Updated schedule'
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'SCHEDULECREATE',
        details: {},
        scheduleCreate: {
          scheduledTransaction: 'original-tx',
          adminKey: 'original-admin-key'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.scheduleCreate).toEqual({
        scheduledTransaction: 'updated-tx', // enhanced wins
        memo: 'Updated schedule',
        adminKey: 'original-admin-key' // original preserved
      });
    });

    test('should merge fileCreate fields', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'FILECREATE',
        details: { fileId: '0.0.678901' },
        fileCreate: {
          contents: 'updated-contents',
          keys: ['new-key']
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'FILECREATE',
        details: {},
        fileCreate: {
          contents: 'original-contents',
          expirationTime: 1234567890
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.fileCreate).toEqual({
        contents: 'updated-contents', // enhanced wins
        keys: ['new-key'],
        expirationTime: 1234567890 // original preserved
      });
    });

    test('should merge details field', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: {
          name: 'Enhanced Token',
          symbol: 'ENH',
          createdTokenId: '0.0.123456'
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: {
          name: 'Original Token',
          initialSupply: 1000000,
          decimals: 8
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.details).toEqual({
        name: 'Enhanced Token', // enhanced wins
        symbol: 'ENH',
        createdTokenId: '0.0.123456',
        initialSupply: 1000000, // original preserved
        decimals: 8 // original preserved
      });
    });

    test('should preserve original field when enhanced field is missing', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: {}
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        consensusCreateTopic: {
          memo: 'Original Topic',
          adminKey: 'original-key'
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.consensusCreateTopic).toEqual({
        memo: 'Original Topic',
        adminKey: 'original-key'
      });
    });

    test('should preserve enhanced field when original field is missing', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOCREATEACCOUNT',
        details: {},
        cryptoCreateAccount: {
          initialBalance: 100000000,
          publicKey: 'enhanced-key'
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOCREATEACCOUNT',
        details: {}
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.cryptoCreateAccount).toEqual({
        initialBalance: 100000000,
        publicKey: 'enhanced-key'
      });
    });

    test('should handle empty objects gracefully', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: {}
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: {}
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.details).toEqual({});
    });

    test('should not modify fields not in MERGEABLE_FIELDS', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: { amount: 100 },
        transfers: [{ account: '0.0.123', amount: 100 }],
        hbarTransfers: [{ account: '0.0.456', amount: 50 }] // This field is not mergeable
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CRYPTOTRANSFER',
        details: { fee: 1000 },
        transfers: [{ account: '0.0.789', amount: 200 }],
        customField: 'original-value' // This field is not mergeable
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.hbarTransfers).toEqual([{ account: '0.0.456', amount: 50 }]);
      expect(result.customField).toBeUndefined();
      expect(result.transfers).toEqual([{ account: '0.0.123', amount: 100 }]); // transfers is mergeable
      expect(result.details).toEqual({ amount: 100, fee: 1000 }); // details is mergeable
    });

    test('should handle complex nested objects', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { createdTokenId: '0.0.123456' },
        tokenCreation: {
          name: 'Enhanced Token',
          treasuryAccountId: '0.0.123',
          tokenSupplyType: 'FINITE',
          customFees: {
            fixedFees: [{ amount: 100, denominatingTokenId: '0.0.456' }]
          }
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { maxSupply: 1000000 },
        tokenCreation: {
          name: 'Original Token',
          treasuryAccountId: '0.0.789',
          initialSupply: 1000000,
          customFees: {
            fractionalFees: [{ numerator: 1, denominator: 100 }]
          }
        }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.tokenCreation).toEqual({
        name: 'Enhanced Token', // enhanced wins
        treasuryAccountId: '0.0.123', // enhanced wins
        tokenSupplyType: 'FINITE',
        initialSupply: 1000000, // original preserved
        customFees: {
          fixedFees: [{ amount: 100, denominatingTokenId: '0.0.456' }]
        }
      });
    });

    test('should handle undefined nested properties', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        consensusCreateTopic: {
          memo: 'Enhanced Topic'
        }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        consensusCreateTopic: undefined
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.consensusCreateTopic).toEqual({
        memo: 'Enhanced Topic'
      });
    });

    test('should create new transaction object without modifying originals', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { name: 'Test Token' },
        tokenCreation: { symbol: 'TEST' }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'TOKENCREATION',
        details: { initialSupply: 1000 },
        tokenCreation: { decimals: 8 }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(enhancedTransaction.details).toEqual({ name: 'Test Token' });
      expect(originalTransaction.details).toEqual({ initialSupply: 1000 });
      expect(enhancedTransaction.tokenCreation).toEqual({ symbol: 'TEST' });
      expect(originalTransaction.tokenCreation).toEqual({ decimals: 8 });

      expect(result.details).toEqual({ name: 'Test Token', initialSupply: 1000 });
      expect(result.tokenCreation).toEqual({ symbol: 'TEST', decimals: 8 });
    });

    test('should handle all mergeable fields simultaneously', () => {
      const enhancedTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'COMPLEX_TRANSACTION',
        details: { enhancedDetail: true },
        tokenCreation: { enhanced: true },
        consensusCreateTopic: { enhanced: true },
        cryptoCreateAccount: { enhanced: true },
        contractCreate: { enhanced: true },
        scheduleCreate: { enhanced: true },
        fileCreate: { enhanced: true }
      };

      const originalTransaction: ParsedTransaction = {
        transactionId: 'test-tx',
        type: 'COMPLEX_TRANSACTION',
        details: { originalDetail: true },
        tokenCreation: { original: true },
        consensusCreateTopic: { original: true },
        cryptoCreateAccount: { original: true },
        contractCreate: { original: true },
        scheduleCreate: { original: true },
        fileCreate: { original: true }
      };

      const result = mergeTransactionDetails(enhancedTransaction, originalTransaction);

      expect(result.details).toEqual({ enhancedDetail: true, originalDetail: true });
      expect(result.tokenCreation).toEqual({ enhanced: true, original: true });
      expect(result.consensusCreateTopic).toEqual({ enhanced: true, original: true });
      expect(result.cryptoCreateAccount).toEqual({ enhanced: true, original: true });
      expect(result.contractCreate).toEqual({ enhanced: true, original: true });
      expect(result.scheduleCreate).toEqual({ enhanced: true, original: true });
      expect(result.fileCreate).toEqual({ enhanced: true, original: true });
    });
  });
});
