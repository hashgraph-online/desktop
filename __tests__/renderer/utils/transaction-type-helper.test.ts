import { getHumanReadableTransactionType } from '../../../src/renderer/utils/transactionTypeHelper';

describe('transactionTypeHelper', () => {
  describe('getHumanReadableTransactionType', () => {
    describe('known transaction types', () => {
      const testCases = [
        { input: 'CRYPTOCREATEACCOUNT', expected: 'Account Creation' },
        { input: 'CRYPTOTRANSFER', expected: 'Transfer' },
        { input: 'CONTRACTCALL', expected: 'Smart Contract Call' },
        { input: 'CONTRACTCREATEINSTANCE', expected: 'Smart Contract Deployment' },
        { input: 'TOKENCREATION', expected: 'Token Creation' },
        { input: 'TOKENASSOCIATE', expected: 'Token Association' },
        { input: 'TOKENDISSOCIATE', expected: 'Token Dissociation' },
        { input: 'TOKENMINT', expected: 'Token Mint' },
        { input: 'TOKENBURN', expected: 'Token Burn' },
        { input: 'CONSENSUSSUBMITMESSAGE', expected: 'Topic Message' },
        { input: 'SCHEDULECREATE', expected: 'Schedule Creation' },
        { input: 'SCHEDULESIGN', expected: 'Schedule Signing' },
        { input: 'TOKENUPDATE', expected: 'Token Update' },
        { input: 'ACCOUNTUPDATE', expected: 'Account Update' },
        { input: 'FILEUPDATE', expected: 'File Update' },
        { input: 'SYSTEMDELETE', expected: 'System Delete' },
        { input: 'FREEZE', expected: 'Network Freeze' },
        { input: 'CONSENSUSCREATETOPIC', expected: 'Topic Creation' },
        { input: 'CONSENSUSUPDATETOPIC', expected: 'Topic Update' },
        { input: 'CONSENSUSDELETETOPIC', expected: 'Topic Deletion' }
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should convert ${input} to ${expected}`, () => {
          const result = getHumanReadableTransactionType(input);
          expect(result).toBe(expected);
        });
      });
    });

    describe('case insensitivity', () => {
      it('should handle lowercase input', () => {
        const result = getHumanReadableTransactionType('cryptotransfer');
        expect(result).toBe('Transfer');
      });

      it('should handle mixed case input', () => {
        const result = getHumanReadableTransactionType('CryptoTransfer');
        expect(result).toBe('Transfer');
      });

      it('should handle mixed case with random casing', () => {
        const result = getHumanReadableTransactionType('cRyPtOtRaNsFeR');
        expect(result).toBe('Transfer');
      });

      it('should handle uppercase input (standard case)', () => {
        const result = getHumanReadableTransactionType('CRYPTOTRANSFER');
        expect(result).toBe('Transfer');
      });
    });

    describe('unknown transaction types', () => {
      it('should return the original type for unknown transactions', () => {
        const unknownType = 'UNKNOWN_TRANSACTION_TYPE';
        const result = getHumanReadableTransactionType(unknownType);
        expect(result).toBe(unknownType);
      });

      it('should preserve case for unknown transactions', () => {
        const unknownType = 'SomeNewTransactionType';
        const result = getHumanReadableTransactionType(unknownType);
        expect(result).toBe(unknownType);
      });

      it('should handle numeric transaction types', () => {
        const numericType = '12345';
        const result = getHumanReadableTransactionType(numericType);
        expect(result).toBe(numericType);
      });

      it('should handle special characters in unknown types', () => {
        const specialType = 'CUSTOM_TRANSACTION_TYPE_V2';
        const result = getHumanReadableTransactionType(specialType);
        expect(result).toBe(specialType);
      });
    });

    describe('edge cases', () => {
      it('should return "Unknown Transaction" for undefined input', () => {
        const result = getHumanReadableTransactionType(undefined);
        expect(result).toBe('Unknown Transaction');
      });

      it('should return "Unknown Transaction" for null input', () => {
        const result = getHumanReadableTransactionType(null as any);
        expect(result).toBe('Unknown Transaction');
      });

      it('should return "Unknown Transaction" for empty string', () => {
        const result = getHumanReadableTransactionType('');
        expect(result).toBe('Unknown Transaction');
      });

      it('should handle whitespace-only strings', () => {
        const result = getHumanReadableTransactionType('   ');
        expect(result).toBe('   '); // Preserves the whitespace since it's not falsy
      });

      it('should handle very long transaction type names', () => {
        const longType = 'A'.repeat(1000);
        const result = getHumanReadableTransactionType(longType);
        expect(result).toBe(longType);
      });
    });

    describe('boundary conditions', () => {
      it('should handle single character input', () => {
        const result = getHumanReadableTransactionType('A');
        expect(result).toBe('A');
      });

      it('should handle transaction types with leading/trailing spaces', () => {
        const result = getHumanReadableTransactionType(' CRYPTOTRANSFER ');
        expect(result).toBe(' CRYPTOTRANSFER '); // Spaces are preserved for unknown matches
      });

      it('should handle numbers as strings', () => {
        const result = getHumanReadableTransactionType('0');
        expect(result).toBe('0');
      });
    });

    describe('comprehensive mapping validation', () => {
      const allMappings = {
        'CRYPTOCREATEACCOUNT': 'Account Creation',
        'CRYPTOTRANSFER': 'Transfer',
        'CONTRACTCALL': 'Smart Contract Call',
        'CONTRACTCREATEINSTANCE': 'Smart Contract Deployment',
        'TOKENCREATION': 'Token Creation',
        'TOKENASSOCIATE': 'Token Association',
        'TOKENDISSOCIATE': 'Token Dissociation',
        'TOKENMINT': 'Token Mint',
        'TOKENBURN': 'Token Burn',
        'CONSENSUSSUBMITMESSAGE': 'Topic Message',
        'SCHEDULECREATE': 'Schedule Creation',
        'SCHEDULESIGN': 'Schedule Signing',
        'TOKENUPDATE': 'Token Update',
        'ACCOUNTUPDATE': 'Account Update',
        'FILEUPDATE': 'File Update',
        'SYSTEMDELETE': 'System Delete',
        'FREEZE': 'Network Freeze',
        'CONSENSUSCREATETOPIC': 'Topic Creation',
        'CONSENSUSUPDATETOPIC': 'Topic Update',
        'CONSENSUSDELETETOPIC': 'Topic Deletion'
      };

      it('should have consistent mappings for all known types', () => {
        Object.entries(allMappings).forEach(([key, expectedValue]) => {
          const result = getHumanReadableTransactionType(key);
          expect(result).toBe(expectedValue);
        });
      });

      it('should handle all known types in lowercase', () => {
        Object.entries(allMappings).forEach(([key, expectedValue]) => {
          const result = getHumanReadableTransactionType(key.toLowerCase());
          expect(result).toBe(expectedValue);
        });
      });
    });

    describe('type safety and consistency', () => {
      it('should always return a string', () => {
        const testInputs = [
          'CRYPTOTRANSFER',
          'unknown',
          '',
          undefined,
          null
        ];

        testInputs.forEach(input => {
          const result = getHumanReadableTransactionType(input as any);
          expect(typeof result).toBe('string');
        });
      });

      it('should never return undefined or null', () => {
        const testInputs = [
          'CRYPTOTRANSFER',
          'UNKNOWN_TYPE',
          '',
          undefined,
          null
        ];

        testInputs.forEach(input => {
          const result = getHumanReadableTransactionType(input as any);
          expect(result).toBeDefined();
          expect(result).not.toBeNull();
        });
      });

      it('should handle boolean inputs gracefully', () => {
        const result1 = getHumanReadableTransactionType(true as any);
        const result2 = getHumanReadableTransactionType(false as any);
        
        expect(typeof result1).toBe('string');
        expect(typeof result2).toBe('string');
      });
    });
  });
});