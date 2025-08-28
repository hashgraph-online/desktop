/**
 * Unit tests for entity type validation utilities
 * These tests define expected behavior for entity type correction
 */

export function validateEntityType(entityId: string, reportedType: string, context?: string): string {
  if (!entityId || typeof entityId !== 'string') {
    return reportedType;
  }

  if (!/^0\.0\.\d+$/.test(entityId)) {
    return reportedType;
  }

  if (context) {
    if (context.includes('inscription') || context.includes('inscribe')) {
      return 'topic';
    }
    if (context.includes('token') && context.includes('create')) {
      return 'token';
    }
  }

  return reportedType;
}

export function getEntityTypeFromContext(transactionId?: string, entityName?: string): string {
  if (transactionId) {
    if (transactionId.includes('inscription') || transactionId.includes('inscribe')) {
      return 'topic';
    }
    if (transactionId.includes('token') && transactionId.includes('create')) {
      return 'token';
    }
  }

  if (entityName) {
    if (entityName.includes('#') && entityName.length < 20) {
      return 'topic'; // Likely an inscription
    }
    if (entityName.toLowerCase().includes('collection')) {
      return 'token'; // Likely a token collection
    }
  }

  return 'unknown';
}

describe('Entity Type Validation', () => {
  describe('validateEntityType', () => {
    it('should validate inscription context produces topic type', () => {
      const entityId = '0.0.6624800';
      const reported = 'token';
      const context = 'inscription';
      
      const validatedType = validateEntityType(entityId, reported, context);
      
      expect(validatedType).toBe('topic');
    });

    it('should validate token creation context produces token type', () => {
      const entityId = '0.0.6624832';
      const reported = 'topic';
      const context = 'token create';
      
      const validatedType = validateEntityType(entityId, reported, context);
      
      expect(validatedType).toBe('token');
    });

    it('should return reported type when no context provided', () => {
      const entityId = '0.0.6624800';
      const reported = 'token';
      
      const validatedType = validateEntityType(entityId, reported);
      
      expect(validatedType).toBe('token');
    });

    it('should handle invalid entity IDs gracefully', () => {
      const entityId = 'invalid-id';
      const reported = 'token';
      
      const validatedType = validateEntityType(entityId, reported);
      
      expect(validatedType).toBe(reported);
    });

    it('should handle null/undefined inputs gracefully', () => {
      const validatedType = validateEntityType('', 'token');
      
      expect(validatedType).toBe('token');
    });
  });

  describe('getEntityTypeFromContext', () => {
    it('should infer topic type from inscription transaction ID', () => {
      const transactionId = 'inscription-12345';
      const entityName = 'Forever #1';
      
      const inferredType = getEntityTypeFromContext(transactionId, entityName);
      
      expect(inferredType).toBe('topic');
    });

    it('should infer token type from token creation transaction ID', () => {
      const transactionId = 'token-create-67890';
      const entityName = 'Forever Collection';
      
      const inferredType = getEntityTypeFromContext(transactionId, entityName);
      
      expect(inferredType).toBe('token');
    });

    it('should infer topic type from inscription-style entity name', () => {
      const transactionId = undefined;
      const entityName = 'Forever #1';
      
      const inferredType = getEntityTypeFromContext(transactionId, entityName);
      
      expect(inferredType).toBe('topic');
    });

    it('should infer token type from collection-style entity name', () => {
      const transactionId = undefined;
      const entityName = 'Forever Collection';
      
      const inferredType = getEntityTypeFromContext(transactionId, entityName);
      
      expect(inferredType).toBe('token');
    });

    it('should return unknown for ambiguous context', () => {
      const transactionId = undefined;
      const entityName = 'Some Entity';
      
      const inferredType = getEntityTypeFromContext(transactionId, entityName);
      
      expect(inferredType).toBe('unknown');
    });
  });
});