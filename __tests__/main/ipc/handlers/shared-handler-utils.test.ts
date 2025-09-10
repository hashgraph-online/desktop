import { handleIPCError, createSuccessResponse } from '../../../../src/main/ipc/handlers/shared-handler-utils';
import { z } from 'zod';

describe('Shared Handler Utils', () => {
  describe('handleIPCError', () => {
    test('should handle Error instances', () => {
      const error = new Error('Test error message');
      const result = handleIPCError(error, 'Fallback message');

      expect(result).toEqual({
        success: false,
        error: 'Test error message',
      });
    });

    test('should handle ZodError instances', () => {
      const schema = z.object({ name: z.string().min(1) });
      let zodError: z.ZodError;

      try {
        schema.parse({ name: '' });
      } catch (error) {
        zodError = error as z.ZodError;
      }

      const result = handleIPCError(zodError!, 'Fallback message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error:');
    });

    test('should handle non-Error instances with fallback', () => {
      const error = 'String error';
      const result = handleIPCError(error, 'Default fallback message');

      expect(result).toEqual({
        success: false,
        error: 'Default fallback message',
      });
    });

    test('should handle null and undefined', () => {
      const result1 = handleIPCError(null, 'Null fallback');
      const result2 = handleIPCError(undefined, 'Undefined fallback');

      expect(result1).toEqual({
        success: false,
        error: 'Null fallback',
      });

      expect(result2).toEqual({
        success: false,
        error: 'Undefined fallback',
      });
    });

    test('should handle complex error objects', () => {
      const complexError = { message: 'Complex error', code: 500 };
      const result = handleIPCError(complexError, 'Complex fallback');

      expect(result).toEqual({
        success: false,
        error: 'Complex fallback',
      });
    });

    test('should handle Error with empty message', () => {
      const error = new Error('');
      const result = handleIPCError(error, 'Empty message fallback');

      expect(result).toEqual({
        success: false,
        error: '', // Returns empty string, not fallback
      });
    });
  });

  describe('createSuccessResponse', () => {
    test('should create success response without data', () => {
      const result = createSuccessResponse();

      expect(result).toEqual({
        success: true,
        data: undefined,
      });
    });

    test('should create success response with string data', () => {
      const result = createSuccessResponse('test data');

      expect(result).toEqual({
        success: true,
        data: 'test data',
      });
    });

    test('should create success response with object data', () => {
      const testData = { id: 1, name: 'Test' };
      const result = createSuccessResponse(testData);

      expect(result).toEqual({
        success: true,
        data: testData,
      });
    });

    test('should create success response with array data', () => {
      const testData = [1, 2, 3, 4, 5];
      const result = createSuccessResponse(testData);

      expect(result).toEqual({
        success: true,
        data: testData,
      });
    });

    test('should create success response with null data', () => {
      const result = createSuccessResponse(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    test('should create success response with undefined data', () => {
      const result = createSuccessResponse(undefined);

      expect(result).toEqual({
        success: true,
        data: undefined,
      });
    });

    test('should handle complex nested data structures', () => {
      const complexData = {
        users: [
          { id: 1, name: 'User 1', roles: ['admin', 'user'] },
          { id: 2, name: 'User 2', roles: ['user'] },
        ],
        metadata: {
          total: 2,
          page: 1,
          limit: 10,
        },
      };

      const result = createSuccessResponse(complexData);

      expect(result).toEqual({
        success: true,
        data: complexData,
      });
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle error to success response flow', () => {
      const error = new Error('Operation failed');
      const errorResponse = handleIPCError(error, 'Default error');

      expect(errorResponse.success).toBe(false);

      const successData = { result: 'Operation completed' };
      const successResponse = createSuccessResponse(successData);

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toEqual(successData);
    });

    test('should handle validation error to success flow', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      let validationError: z.ZodError;
      try {
        schema.parse({ email: 'invalid-email', age: 15 });
      } catch (error) {
        validationError = error as z.ZodError;
      }

      const errorResponse = handleIPCError(validationError!, 'Validation failed');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toContain('Validation error');

      const validData = { email: 'user@example.com', age: 25 };
      const successResponse = createSuccessResponse(validData);

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toEqual(validData);
    });

    test('should handle API-like request/response flow', () => {
      const simulateAPIRequest = (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('API request failed');
        }
        return { userId: 123, data: 'Success' };
      };

      try {
        simulateAPIRequest(true);
      } catch (error) {
        const errorResponse = handleIPCError(error, 'Request failed');
        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBe('API request failed');
      }

      const result = simulateAPIRequest(false);
      const successResponse = createSuccessResponse(result);

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toEqual({
        userId: 123,
        data: 'Success',
      });
    });

    test('should handle different error types consistently', () => {
      const errorTypes = [
        new Error('Standard error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
        'String error',
        123,
        null,
        undefined,
        { message: 'Object error' },
      ];

      errorTypes.forEach((error, index) => {
        const result = handleIPCError(error, `Fallback ${index}`);
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      });
    });

    test('should handle empty and whitespace-only error messages', () => {
      const emptyError = new Error('');
      const whitespaceError = new Error('   ');

      const result1 = handleIPCError(emptyError, 'Default message');
      const result2 = handleIPCError(whitespaceError, 'Default message');

      expect(result1.error).toBe(''); // Returns empty string, not fallback
      expect(result2.error).toBe('   '); // Preserves whitespace
    });
  });

  describe('Type Safety', () => {
    test('should maintain type safety for success responses', () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      const response = createSuccessResponse(user);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(user);

      if (response.success && response.data) {
        expect(typeof response.data.id).toBe('number');
        expect(typeof response.data.name).toBe('string');
        expect(typeof response.data.email).toBe('string');
      }
    });

    test('should handle union types correctly', () => {
      type Result = string | number | boolean;

      const stringResult: Result = 'success';
      const numberResult: Result = 42;
      const booleanResult: Result = true;

      const responses = [
        createSuccessResponse(stringResult),
        createSuccessResponse(numberResult),
        createSuccessResponse(booleanResult),
      ];

      responses.forEach((response, index) => {
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
      });
    });
  });

  describe('Error Message Formatting', () => {
    test('should handle multiline error messages', () => {
      const multilineError = new Error('Line 1\nLine 2\nLine 3');
      const result = handleIPCError(multilineError, 'Fallback');

      expect(result.error).toBe('Line 1\nLine 2\nLine 3');
      expect(result.success).toBe(false);
    });

    test('should handle error messages with special characters', () => {
      const specialError = new Error('Error with "quotes" and \'apostrophes\'');
      const result = handleIPCError(specialError, 'Fallback');

      expect(result.error).toBe('Error with "quotes" and \'apostrophes\'');
    });

    test('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const longError = new Error(longMessage);
      const result = handleIPCError(longError, 'Fallback');

      expect(result.error).toBe(longMessage);
      expect(result.error.length).toBe(1000);
    });
  });
});
