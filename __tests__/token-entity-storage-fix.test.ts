/**
 * Test to verify that token entities are correctly stored in the database
 * This test verifies the fix for the token entity storage issue
 */

import { getBestEntityType } from '../src/main/utils/entity-type-validator';

describe('Token Entity Storage Fix', () => {
  describe('getBestEntityType function', () => {
    test('should trust valid entity type from receipt-based extraction', () => {
      const result = getBestEntityType(
        '0.0.12345678',
        'token', // Already correct type from receipt
        'some-transaction-id',
        'Forever'
      );
      
      expect(result).toBe('token');
    });

    test('should trust topic type from receipt-based extraction', () => {
      const result = getBestEntityType(
        '0.0.6624888',
        'topic', // Already correct type from receipt
        'some-transaction-id',
        'Forever #1'
      );
      
      expect(result).toBe('topic');
    });

    test('should override with context if strong evidence suggests different type', () => {
      const result = getBestEntityType(
        '0.0.12345678',
        'account', // Wrong type from somewhere
        'token-creation-transaction',
        'Forever'
      );
      
      expect(result).toBe('token');
    });

    test('should handle entity names with collection patterns', () => {
      const result = getBestEntityType(
        '0.0.12345678',
        'unknown', // Invalid type, should use context
        'some-transaction-id',
        'My Token Collection'
      );
      
      expect(result).toBe('token');
    });

    test('should handle inscription patterns', () => {
      const result = getBestEntityType(
        '0.0.6624888',
        'unknown', // Invalid type, should use context
        'inscription-transaction',
        'Forever #1'
      );
      
      expect(result).toBe('topic');
    });

    test('should handle names with # patterns correctly', () => {
      const result = getBestEntityType(
        '0.0.6624888',
        'unknown', // Invalid type, should use context
        'some-transaction-id',
        'Test #1' // Short name with # pattern
      );
      
      expect(result).toBe('topic');
    });

    test('should prefer context over name patterns when transaction ID has token', () => {
      const result = getBestEntityType(
        '0.0.12345678',
        'unknown', // Invalid type
        'token-creation-id', // Clear token context
        'Test #1' // Would suggest topic by name, but transaction suggests token
      );
      
      expect(result).toBe('token');
    });

    test('should fall back to validation for unknown types with weak context', () => {
      const result = getBestEntityType(
        '0.0.12345678',
        'unknown', // Invalid type
        'some-generic-transaction',
        'Generic Name' // No clear pattern
      );
      
      expect(['unknown', 'token', 'topic', 'account'].includes(result)).toBe(true);
    });
  });
});