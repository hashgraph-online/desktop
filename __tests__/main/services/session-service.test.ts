import { SessionService } from '../../../src/main/services/session-service';
import type { SessionContext } from '../../../src/main/interfaces/services';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn()
}));

describe('SessionService', () => {
  let service: SessionService;
  let mockLogger: any;

  const mockSessionContext: SessionContext = {
    sessionId: 'test-session-123',
    mode: 'personal',
    topicId: 'test-topic-456'
  };

  const mockSessionContextWithoutTopic: SessionContext = {
    sessionId: 'test-session-no-topic',
    mode: 'hcs10'
  };

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

    service = new SessionService();
  });

  describe('constructor', () => {
    test('should create SessionService instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SessionService);
    });

    test('should initialize with null context and sessionId', () => {
      expect(service.getContext()).toBeNull();
      expect(service.getCurrentSessionId()).toBeNull();
      expect(service.hasContext()).toBe(false);
    });
  });

  describe('updateContext', () => {
    test('should update session context with full context', () => {
      service.updateContext(mockSessionContext);

      expect(service.getContext()).toEqual(mockSessionContext);
      expect(service.getCurrentSessionId()).toBe('test-session-123');
      expect(service.hasContext()).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith('Session context updated', {
        sessionId: 'test-session-123',
        mode: 'personal',
        hasTopicId: true
      });
    });

    test('should update session context without topicId', () => {
      service.updateContext(mockSessionContextWithoutTopic);

      expect(service.getContext()).toEqual(mockSessionContextWithoutTopic);
      expect(service.getCurrentSessionId()).toBe('test-session-no-topic');
      expect(service.hasContext()).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith('Session context updated', {
        sessionId: 'test-session-no-topic',
        mode: 'hcs10',
        hasTopicId: false
      });
    });

    test('should overwrite existing context', () => {
      service.updateContext(mockSessionContext);

      const newContext: SessionContext = {
        sessionId: 'new-session-789',
        mode: 'hcs10',
        topicId: 'new-topic-101'
      };

      service.updateContext(newContext);

      expect(service.getContext()).toEqual(newContext);
      expect(service.getCurrentSessionId()).toBe('new-session-789');

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    test('should handle empty topicId string', () => {
      const contextWithEmptyTopic: SessionContext = {
        sessionId: 'test-session-empty-topic',
        mode: 'personal',
        topicId: ''
      };

      service.updateContext(contextWithEmptyTopic);

      expect(service.getContext()).toEqual(contextWithEmptyTopic);
      expect(mockLogger.info).toHaveBeenCalledWith('Session context updated', {
        sessionId: 'test-session-empty-topic',
        mode: 'personal',
        hasTopicId: false // empty string is falsy
      });
    });

    test('should handle null topicId explicitly', () => {
      const contextWithNullTopic: SessionContext = {
        sessionId: 'test-session-null-topic',
        mode: 'hcs10',
        topicId: undefined
      };

      service.updateContext(contextWithNullTopic);

      expect(service.getContext()).toEqual(contextWithNullTopic);
      expect(mockLogger.info).toHaveBeenCalledWith('Session context updated', {
        sessionId: 'test-session-null-topic',
        mode: 'hcs10',
        hasTopicId: false
      });
    });
  });

  describe('clearContext', () => {
    test('should clear existing context', () => {
      service.updateContext(mockSessionContext);
      expect(service.hasContext()).toBe(true);

      service.clearContext();

      expect(service.getContext()).toBeNull();
      expect(service.getCurrentSessionId()).toBeNull();
      expect(service.hasContext()).toBe(false);

      expect(mockLogger.info).toHaveBeenCalledWith('Session context cleared');
    });

    test('should handle clearing when no context exists', () => {
      expect(service.hasContext()).toBe(false);

      service.clearContext();

      expect(service.getContext()).toBeNull();
      expect(service.getCurrentSessionId()).toBeNull();
      expect(service.hasContext()).toBe(false);

      expect(mockLogger.info).toHaveBeenCalledWith('Session context cleared');
    });

    test('should allow setting new context after clearing', () => {
      service.updateContext(mockSessionContext);
      service.clearContext();

      const newContext: SessionContext = {
        sessionId: 'new-session-after-clear',
        mode: 'personal'
      };

      service.updateContext(newContext);

      expect(service.getContext()).toEqual(newContext);
      expect(service.getCurrentSessionId()).toBe('new-session-after-clear');
      expect(service.hasContext()).toBe(true);
    });
  });

  describe('getContext', () => {
    test('should return current context when set', () => {
      service.updateContext(mockSessionContext);

      const context = service.getContext();
      expect(context).toEqual(mockSessionContext);
    });

    test('should return null when no context is set', () => {
      const context = service.getContext();
      expect(context).toBeNull();
    });

    test('should return updated context after modification', () => {
      service.updateContext(mockSessionContext);

      const updatedContext: SessionContext = {
        ...mockSessionContext,
        sessionId: 'updated-session-id'
      };

      service.updateContext(updatedContext);

      const context = service.getContext();
      expect(context).toEqual(updatedContext);
    });

    test('should return context with correct structure', () => {
      service.updateContext(mockSessionContext);

      const context = service.getContext();
      expect(context).toHaveProperty('sessionId');
      expect(context).toHaveProperty('mode');
      expect(context).toHaveProperty('topicId');
      expect(typeof context?.sessionId).toBe('string');
      expect(['personal', 'hcs10']).toContain(context?.mode);
    });
  });

  describe('getCurrentSessionId', () => {
    test('should return current session ID when set via updateContext', () => {
      service.updateContext(mockSessionContext);

      const sessionId = service.getCurrentSessionId();
      expect(sessionId).toBe('test-session-123');
    });

    test('should return session ID when set directly', () => {
      service.setSessionId('direct-session-id');

      const sessionId = service.getCurrentSessionId();
      expect(sessionId).toBe('direct-session-id');

      expect(mockLogger.debug).toHaveBeenCalledWith('Session ID set directly', {
        sessionId: 'direct-session-id'
      });
    });

    test('should return updated session ID after context update', () => {
      service.updateContext(mockSessionContext);

      const newContext: SessionContext = {
        sessionId: 'updated-session-id',
        mode: 'hcs10'
      };

      service.updateContext(newContext);

      const sessionId = service.getCurrentSessionId();
      expect(sessionId).toBe('updated-session-id');
    });

    test('should return null when no session ID is set', () => {
      const sessionId = service.getCurrentSessionId();
      expect(sessionId).toBeNull();
    });

    test('should return null after context is cleared', () => {
      service.updateContext(mockSessionContext);
      expect(service.getCurrentSessionId()).toBe('test-session-123');

      service.clearContext();
      expect(service.getCurrentSessionId()).toBeNull();
    });
  });

  describe('hasContext', () => {
    test('should return true when context is set', () => {
      service.updateContext(mockSessionContext);

      const hasContext = service.hasContext();
      expect(hasContext).toBe(true);
    });

    test('should return false when no context is set', () => {
      const hasContext = service.hasContext();
      expect(hasContext).toBe(false);
    });

    test('should return false after context is cleared', () => {
      service.updateContext(mockSessionContext);
      expect(service.hasContext()).toBe(true);

      service.clearContext();
      expect(service.hasContext()).toBe(false);
    });

    test('should track context state through multiple operations', () => {
      expect(service.hasContext()).toBe(false);

      service.updateContext(mockSessionContext);
      expect(service.hasContext()).toBe(true);

      service.clearContext();
      expect(service.hasContext()).toBe(false);

      service.setSessionId('direct-session');
      expect(service.hasContext()).toBe(false); // setSessionId doesn't set context

      service.updateContext(mockSessionContextWithoutTopic);
      expect(service.hasContext()).toBe(true);
    });
  });

  describe('setSessionId', () => {
    test('should set session ID directly', () => {
      service.setSessionId('direct-session-id');

      expect(service.getCurrentSessionId()).toBe('direct-session-id');
      expect(service.getContext()).toBeNull(); // Context remains null

      expect(mockLogger.debug).toHaveBeenCalledWith('Session ID set directly', {
        sessionId: 'direct-session-id'
      });
    });

    test('should overwrite existing session ID', () => {
      service.setSessionId('original-session');
      expect(service.getCurrentSessionId()).toBe('original-session');

      service.setSessionId('new-session');
      expect(service.getCurrentSessionId()).toBe('new-session');
    });

    test('should not affect context when setting session ID directly', () => {
      service.updateContext(mockSessionContext);
      expect(service.getContext()).toEqual(mockSessionContext);
      expect(service.getCurrentSessionId()).toBe('test-session-123');

      service.setSessionId('direct-session-id');
      expect(service.getContext()).toEqual(mockSessionContext); // Context unchanged
      expect(service.getCurrentSessionId()).toBe('direct-session-id'); // Session ID changed
    });

    test('should allow setting session ID when no context exists', () => {
      expect(service.hasContext()).toBe(false);
      expect(service.getCurrentSessionId()).toBeNull();

      service.setSessionId('session-without-context');

      expect(service.hasContext()).toBe(false); // Still no context
      expect(service.getCurrentSessionId()).toBe('session-without-context');
    });

    test('should handle various session ID formats', () => {
      const testIds = [
        'simple-id',
        'complex-id-123-abc',
        'uuid-550e8400-e29b-41d4-a716-446655440000',
        'short-id'
      ];

      testIds.forEach(id => {
        service.setSessionId(id);
        expect(service.getCurrentSessionId()).toBe(id);
      });
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete session lifecycle', () => {
      expect(service.hasContext()).toBe(false);
      expect(service.getCurrentSessionId()).toBeNull();

      service.updateContext(mockSessionContext);
      expect(service.hasContext()).toBe(true);
      expect(service.getCurrentSessionId()).toBe('test-session-123');
      expect(service.getContext()).toEqual(mockSessionContext);

      const updatedContext: SessionContext = {
        sessionId: 'updated-session-456',
        mode: 'hcs10',
        topicId: 'updated-topic-789'
      };

      service.updateContext(updatedContext);
      expect(service.getCurrentSessionId()).toBe('updated-session-456');
      expect(service.getContext()).toEqual(updatedContext);

      service.clearContext();
      expect(service.hasContext()).toBe(false);
      expect(service.getCurrentSessionId()).toBeNull();
      expect(service.getContext()).toBeNull();

      service.setSessionId('direct-after-clear');
      expect(service.getCurrentSessionId()).toBe('direct-after-clear');
      expect(service.hasContext()).toBe(false);
    });

    test('should handle mixed context and direct ID operations', () => {
      service.updateContext(mockSessionContext);
      expect(service.getCurrentSessionId()).toBe('test-session-123');
      expect(service.hasContext()).toBe(true);

      service.setSessionId('direct-override');
      expect(service.getCurrentSessionId()).toBe('direct-override');
      expect(service.hasContext()).toBe(true); // Context still exists

      service.clearContext();
      service.setSessionId('direct-after-clear');
      expect(service.getCurrentSessionId()).toBe('direct-after-clear');
      expect(service.hasContext()).toBe(false);

      service.updateContext(mockSessionContextWithoutTopic);
      expect(service.getCurrentSessionId()).toBe('test-session-no-topic');
      expect(service.hasContext()).toBe(true);
    });

    test('should handle context with undefined topicId', () => {
      const contextWithoutTopic: SessionContext = {
        sessionId: 'session-no-topic',
        mode: 'personal'
      };

      service.updateContext(contextWithoutTopic);

      expect(service.getContext()).toEqual(contextWithoutTopic);
      expect(service.getCurrentSessionId()).toBe('session-no-topic');
      expect(service.hasContext()).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith('Session context updated', {
        sessionId: 'session-no-topic',
        mode: 'personal',
        hasTopicId: false
      });
    });

    test('should maintain state consistency across operations', () => {
      const operations = [
        () => service.updateContext(mockSessionContext),
        () => service.setSessionId('direct-override'),
        () => service.clearContext(),
        () => service.setSessionId('final-direct'),
        () => service.updateContext(mockSessionContextWithoutTopic)
      ];

      const expectedStates = [
        { hasContext: true, sessionId: 'test-session-123' },
        { hasContext: true, sessionId: 'direct-override' },
        { hasContext: false, sessionId: null },
        { hasContext: false, sessionId: 'final-direct' },
        { hasContext: true, sessionId: 'test-session-no-topic' }
      ];

      operations.forEach((operation, index) => {
        operation();
        expect(service.hasContext()).toBe(expectedStates[index].hasContext);
        expect(service.getCurrentSessionId()).toBe(expectedStates[index].sessionId);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed context objects gracefully', () => {
      const minimalContext: SessionContext = {
        sessionId: 'minimal',
        mode: 'personal'
      };

      service.updateContext(minimalContext);
      expect(service.getContext()).toEqual(minimalContext);
    });

    test('should handle empty sessionId strings', () => {
      const contextWithEmptyId: SessionContext = {
        sessionId: '',
        mode: 'hcs10'
      };

      service.updateContext(contextWithEmptyId);
      expect(service.getCurrentSessionId()).toBe('');
      expect(service.hasContext()).toBe(true);
    });
  });
});