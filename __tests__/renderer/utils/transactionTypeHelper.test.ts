import { getHumanReadableTransactionType } from '../../../src/renderer/utils/transactionTypeHelper';

describe('getHumanReadableTransactionType', () => {
  describe('Known transaction types', () => {
    test.each([
      ['CRYPTOCREATEACCOUNT', 'Account Creation'],
      ['CRYPTOTRANSFER', 'Transfer'],
      ['CONTRACTCALL', 'Smart Contract Call'],
      ['CONTRACTCREATEINSTANCE', 'Smart Contract Deployment'],
      ['TOKENCREATION', 'Token Creation'],
      ['TOKENASSOCIATE', 'Token Association'],
      ['TOKENDISSOCIATE', 'Token Dissociation'],
      ['TOKENMINT', 'Token Mint'],
      ['TOKENBURN', 'Token Burn'],
      ['CONSENSUSSUBMITMESSAGE', 'Topic Message'],
      ['SCHEDULECREATE', 'Schedule Creation'],
      ['SCHEDULESIGN', 'Schedule Signing'],
      ['TOKENUPDATE', 'Token Update'],
      ['ACCOUNTUPDATE', 'Account Update'],
      ['FILEUPDATE', 'File Update'],
      ['SYSTEMDELETE', 'System Delete'],
      ['FREEZE', 'Network Freeze'],
      ['CONSENSUSCREATETOPIC', 'Topic Creation'],
      ['CONSENSUSUPDATETOPIC', 'Topic Update'],
      ['CONSENSUSDELETETOPIC', 'Topic Deletion'],
    ])('should convert %s to %s', (input, expected) => {
      expect(getHumanReadableTransactionType(input)).toBe(expected);
    });
  });

  describe('Case insensitive conversion', () => {
    test.each([
      ['cryptocreateaccount', 'Account Creation'],
      ['CryptoTransfer', 'Transfer'],
      ['contractCall', 'Smart Contract Call'],
      ['ContractCreateInstance', 'Smart Contract Deployment'],
      ['tokencreation', 'Token Creation'],
      ['TOKENAssociate', 'Token Association'],
    ])('should handle case insensitive input %s', (input, expected) => {
      expect(getHumanReadableTransactionType(input)).toBe(expected);
    });
  });

  describe('Unknown transaction types', () => {
    test.each([
      ['UNKNOWN_TRANSACTION'],
      ['CUSTOM_TRANSACTION_TYPE'],
      ['SOME_NEW_TYPE'],
      ['123'],
      ['SPECIAL-CHARS'],
    ])('should return original type for unknown transaction %s', (input) => {
      expect(getHumanReadableTransactionType(input)).toBe(input);
    });
  });

  describe('Edge cases', () => {
    test('should handle undefined input', () => {
      expect(getHumanReadableTransactionType(undefined)).toBe('Unknown Transaction');
    });

    test('should handle null input', () => {
      expect(getHumanReadableTransactionType(null as any)).toBe('Unknown Transaction');
    });

    test('should handle empty string', () => {
      expect(getHumanReadableTransactionType('')).toBe('Unknown Transaction');
    });

    test('should handle whitespace only string', () => {
      expect(getHumanReadableTransactionType('   ')).toBe('   ');
    });

    test('should handle mixed case unknown types', () => {
      expect(getHumanReadableTransactionType('Unknown_Type')).toBe('Unknown_Type');
    });
  });

  describe('Special characters and formatting', () => {
    test('should preserve original formatting for unknown types', () => {
      expect(getHumanReadableTransactionType('MY_CUSTOM_TYPE')).toBe('MY_CUSTOM_TYPE');
      expect(getHumanReadableTransactionType('my-custom-type')).toBe('my-custom-type');
      expect(getHumanReadableTransactionType('MyCustomType')).toBe('MyCustomType');
    });

    test('should handle types with numbers', () => {
      expect(getHumanReadableTransactionType('TOKEN_UPDATE_V2')).toBe('TOKEN_UPDATE_V2');
      expect(getHumanReadableTransactionType('CONTRACT_CALL_1')).toBe('CONTRACT_CALL_1');
    });

    test('should handle very long transaction type names', () => {
      const longType = 'A'.repeat(100);
      expect(getHumanReadableTransactionType(longType)).toBe(longType);
    });
  });

  describe('Real-world transaction types', () => {
    test('should handle common Hedera transaction types', () => {
      expect(getHumanReadableTransactionType('CRYPTOTRANSFER')).toBe('Transfer');
      expect(getHumanReadableTransactionType('TOKENCREATION')).toBe('Token Creation');
      expect(getHumanReadableTransactionType('CONSENSUSSUBMITMESSAGE')).toBe('Topic Message');
    });

    test('should handle smart contract operations', () => {
      expect(getHumanReadableTransactionType('CONTRACTCALL')).toBe('Smart Contract Call');
      expect(getHumanReadableTransactionType('CONTRACTCREATEINSTANCE')).toBe('Smart Contract Deployment');
    });

    test('should handle consensus service operations', () => {
      expect(getHumanReadableTransactionType('CONSENSUSCREATETOPIC')).toBe('Topic Creation');
      expect(getHumanReadableTransactionType('CONSENSUSUPDATETOPIC')).toBe('Topic Update');
      expect(getHumanReadableTransactionType('CONSENSUSDELETETOPIC')).toBe('Topic Deletion');
      expect(getHumanReadableTransactionType('CONSENSUSSUBMITMESSAGE')).toBe('Topic Message');
    });

    test('should handle scheduling operations', () => {
      expect(getHumanReadableTransactionType('SCHEDULECREATE')).toBe('Schedule Creation');
      expect(getHumanReadableTransactionType('SCHEDULESIGN')).toBe('Schedule Signing');
    });
  });

  describe('Return value consistency', () => {
    test('should always return a string', () => {
      expect(typeof getHumanReadableTransactionType('CRYPTOTRANSFER')).toBe('string');
      expect(typeof getHumanReadableTransactionType('UNKNOWN')).toBe('string');
      expect(typeof getHumanReadableTransactionType(undefined)).toBe('string');
      expect(typeof getHumanReadableTransactionType('')).toBe('string');
    });

    test('should never return empty string for valid inputs', () => {
      expect(getHumanReadableTransactionType('CRYPTOTRANSFER')).not.toBe('');
      expect(getHumanReadableTransactionType('UNKNOWN')).not.toBe('');
      expect(getHumanReadableTransactionType(undefined)).not.toBe('');
    });
  });
});
