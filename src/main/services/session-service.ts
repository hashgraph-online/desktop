import { Logger } from '../utils/logger';
import type { ISessionService, SessionContext } from '../interfaces/services';

/**
 * Service for managing session context and session-related operations
 */
export class SessionService implements ISessionService {
  private logger: Logger;
  private currentSessionContext: SessionContext | null = null;
  private sessionId: string | null = null;

  constructor() {
    this.logger = new Logger({ module: 'SessionService' });
  }

  /**
   * Update session context for entity resolution scoping
   */
  updateContext(context: SessionContext): void {
    this.currentSessionContext = context;
    this.sessionId = context.sessionId;
    this.logger.info('Session context updated', {
      sessionId: context.sessionId,
      mode: context.mode,
      hasTopicId: !!context.topicId,
    });
  }

  /**
   * Clear session context (useful for session boundaries)
   */
  clearContext(): void {
    this.currentSessionContext = null;
    this.sessionId = null;
    this.logger.info('Session context cleared');
  }

  /**
   * Get current session context
   */
  getContext(): SessionContext | null {
    return this.currentSessionContext;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if session context exists
   */
  hasContext(): boolean {
    return this.currentSessionContext !== null;
  }

  /**
   * Set session ID directly (for initialization)
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.logger.debug('Session ID set directly', { sessionId });
  }
}