import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getDatabase } from '../db/connection';
import * as schema from '../db/schema';
import type { ChatSession, ChatMessage } from '../db/schema';
import {
  eq,
  desc,
  and,
  isNotNull,
  sql,
  inArray,
  or,
  isNull,
} from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = new Logger({ module: 'ChatHandlers' });

/**
 * JSDoc for createChatSession
 * Creates a new chat session in the database
 */
const createChatSession = async (
  event: IpcMainInvokeEvent,
  sessionData: {
    name: string;
    mode: string;
    topicId?: string;
    isActive?: boolean;
  }
): Promise<{ success: boolean; data?: ChatSession; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    if (sessionData.mode === 'hcs10' && sessionData.topicId) {
      const existingSession = db
        .select()
        .from(schema.chatSessions)
        .where(
          and(
            eq(schema.chatSessions.mode, 'hcs10'),
            eq(schema.chatSessions.topicId, sessionData.topicId),
            eq(schema.chatSessions.isActive, true)
          )
        )
        .get();

      if (existingSession) {
        logger.info(
          `Returning existing HCS-10 session for topic: ${sessionData.topicId}`
        );
        return { success: true, data: existingSession };
      }
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const newSession = {
      id: sessionId,
      name: sessionData.name,
      mode: sessionData.mode,
      topicId: sessionData.topicId || null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null as Date | null,
      isActive: sessionData.isActive ?? true,
    };

    const result = db
      .insert(schema.chatSessions)
      .values(newSession)
      .returning()
      .get();

    logger.info(`Created chat session: ${sessionId}`);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to create chat session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for loadChatSession
 * Loads a chat session by ID from the database
 */
const loadChatSession = async (
  event: IpcMainInvokeEvent,
  { sessionId }: { sessionId: string }
): Promise<{ success: boolean; data?: ChatSession; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const session = db
      .select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error('Session not found');
    }

    logger.info(`Loaded chat session: ${sessionId}`);
    return { success: true, data: session };
  } catch (error) {
    logger.error('Failed to load chat session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for saveChatSession
 * Updates an existing chat session in the database
 */
const saveChatSession = async (
  event: IpcMainInvokeEvent,
  session: ChatSession
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const updateData = {
      ...session,
      updatedAt: new Date(),
    };

    db.update(schema.chatSessions)
      .set(updateData)
      .where(eq(schema.chatSessions.id, session.id))
      .run();

    logger.info(`Saved chat session: ${session.id}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to save chat session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for deleteChatSession
 * Deletes a chat session and all its messages from the database
 */
const deleteChatSession = async (
  event: IpcMainInvokeEvent,
  { sessionId }: { sessionId: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const result = db
      .delete(schema.chatSessions)
      .where(eq(schema.chatSessions.id, sessionId))
      .run();

    if (result.changes === 0) {
      throw new Error('Session not found');
    }

    logger.info(`Deleted chat session: ${sessionId}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete chat session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for loadAllChatSessions
 * Loads all chat sessions from the database, ordered by last message time
 */
const loadAllChatSessions = async (
  _event: IpcMainInvokeEvent
): Promise<{ success: boolean; data?: ChatSession[]; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const sessions = db
      .select()
      .from(schema.chatSessions)
      .where(
        or(
          eq(schema.chatSessions.isActive, true),
          isNull(schema.chatSessions.isActive)
        )
      )
      .orderBy(
        desc(schema.chatSessions.lastMessageAt),
        desc(schema.chatSessions.updatedAt)
      )
      .all();

    logger.info(`Loaded ${sessions.length} chat sessions`);
    return { success: true, data: sessions };
  } catch (error) {
    logger.error('Failed to load chat sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for saveChatMessage
 * Saves a chat message to the database and updates session's last message time
 */
const saveChatMessage = async (
  event: IpcMainInvokeEvent,
  messageData: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    timestamp: Date;
    metadata?: string | null;
    messageType?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const newMessage = {
      id: messageData.id,
      sessionId: messageData.sessionId,
      role: messageData.role,
      content: messageData.content,
      timestamp: messageData.timestamp,
      metadata: messageData.metadata || null,
      messageType: messageData.messageType || 'text',
    };

    db.insert(schema.chatMessages).values(newMessage).run();

    db.update(schema.chatSessions)
      .set({
        lastMessageAt: messageData.timestamp,
        updatedAt: new Date(),
      } as ChatSession)
      .where(eq(schema.chatSessions.id, messageData.sessionId))
      .run();

    logger.info(`Saved message for session: ${messageData.sessionId}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to save chat message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for loadSessionMessages
 * Loads all messages for a specific session, ordered by timestamp
 */
const loadSessionMessages = async (
  event: IpcMainInvokeEvent,
  { sessionId }: { sessionId: string }
): Promise<{ success: boolean; data?: ChatMessage[]; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const messages = db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId))
      .orderBy(schema.chatMessages.timestamp)
      .all();

    logger.info(`Loaded ${messages.length} messages for session: ${sessionId}`);
    return { success: true, data: messages };
  } catch (error) {
    logger.error('Failed to load session messages:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for cleanupDuplicateHCS10Sessions
 * Removes duplicate HCS-10 sessions, keeping the highest priority one per topicId
 * Priority order: active sessions > sessions with messages > newest by creation date
 */
/**
 * JSDoc for findFormMessageById
 * Finds a form message by its form ID in message metadata, with optional session filtering
 */
const findFormMessageById = async (
  event: IpcMainInvokeEvent,
  { formId, sessionId }: { formId: string; sessionId?: string }
): Promise<{ success: boolean; data?: ChatMessage; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const messages = sessionId
      ? db
          .select()
          .from(schema.chatMessages)
          .where(
            and(
              isNotNull(schema.chatMessages.metadata),
              eq(schema.chatMessages.sessionId, sessionId)
            )
          )
          .all()
      : db
          .select()
          .from(schema.chatMessages)
          .where(isNotNull(schema.chatMessages.metadata))
          .all();

    const formMessage = messages.find((message) => {
      if (!message.metadata) return false;
      try {
        const metadata = JSON.parse(message.metadata);
        return metadata?.formMessage?.id === formId;
      } catch {
        logger.warn(`Invalid metadata JSON in message ${message.id}`);
        return false;
      }
    });

    if (!formMessage) {
      logger.info(`Form message not found: ${formId}`);
      return { success: true, data: undefined };
    }

    logger.info(
      `Found form message: ${formId} in session: ${formMessage.sessionId}`
    );
    return { success: true, data: formMessage };
  } catch (error) {
    logger.error('Failed to find form message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for updateFormCompletionState
 * Updates the completion state of a form message in the database
 */
const updateFormCompletionState = async (
  event: IpcMainInvokeEvent,
  {
    formId,
    completionState,
    completionData,
  }: {
    formId: string;
    completionState: 'active' | 'submitting' | 'completed' | 'failed';
    completionData?: {
      success?: boolean;
      message?: string;
      timestamp?: number;
    };
  }
): Promise<{ success: boolean; data?: ChatMessage; error?: string }> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const messages = db
      .select()
      .from(schema.chatMessages)
      .where(isNotNull(schema.chatMessages.metadata))
      .all();

    const formMessage = messages.find((message) => {
      if (!message.metadata) return false;
      try {
        const metadata = JSON.parse(message.metadata);
        return metadata?.formMessage?.id === formId;
      } catch {
        logger.warn(`Invalid metadata JSON in message ${message.id}`);
        return false;
      }
    });

    if (!formMessage) {
      logger.warn(`Form message not found for state update: ${formId}`);
      return {
        success: false,
        error: 'Form message not found',
      };
    }

    try {
      const metadata = JSON.parse(formMessage.metadata!);
      if (metadata?.formMessage) {
        metadata.formMessage.completionState = completionState;

        if (completionState === 'completed' || completionState === 'failed') {
          metadata.formMessage.completedAt = Date.now();
          if (completionData) {
            metadata.formMessage.completionResult = {
              success:
                completionData.success ?? completionState === 'completed',
              message: completionData.message || '',
              timestamp: completionData.timestamp || Date.now(),
            };
          }
        }

        const updatedMetadata = JSON.stringify(metadata);
        db.update(schema.chatMessages)
          .set({
            metadata: updatedMetadata,
          } as ChatMessage)
          .where(eq(schema.chatMessages.id, formMessage.id))
          .run();

        const updatedMessage = { ...formMessage, metadata: updatedMetadata };
        logger.info(
          `Updated form completion state: ${formId} -> ${completionState}`
        );
        return { success: true, data: updatedMessage };
      } else {
        throw new Error('Invalid form message metadata structure');
      }
    } catch (metadataError) {
      logger.error(
        `Failed to parse/update form metadata for ${formId}:`,
        metadataError
      );
      return {
        success: false,
        error: 'Invalid form metadata',
      };
    }
  } catch (error) {
    logger.error('Failed to update form completion state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const cleanupDuplicateHCS10Sessions = async (
  _event: IpcMainInvokeEvent
): Promise<{
  success: boolean;
  removed: number;
  kept: number;
  error?: string;
}> => {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    const duplicateTopics = db
      .select({
        topicId: schema.chatSessions.topicId,
        sessionCount: sql<number>`COUNT(*)`.as('sessionCount'),
      })
      .from(schema.chatSessions)
      .where(
        and(
          eq(schema.chatSessions.mode, 'hcs10'),
          isNotNull(schema.chatSessions.topicId)
        )
      )
      .groupBy(schema.chatSessions.topicId)
      .having(sql`COUNT(*) > 1`)
      .all();

    let totalRemoved = 0;
    let totalKept = 0;

    for (const topic of duplicateTopics) {
      const sessions = db
        .select()
        .from(schema.chatSessions)
        .where(
          and(
            eq(schema.chatSessions.mode, 'hcs10'),
            eq(schema.chatSessions.topicId, topic.topicId!)
          )
        )
        .orderBy(
          desc(schema.chatSessions.isActive),
          desc(schema.chatSessions.lastMessageAt),
          desc(schema.chatSessions.createdAt)
        )
        .all();

      const toDelete = sessions.slice(1);

      totalKept++;
      totalRemoved += toDelete.length;

      for (const session of toDelete) {
        db.delete(schema.chatMessages)
          .where(eq(schema.chatMessages.sessionId, session.id))
          .run();
      }

      const sessionIds = toDelete.map((s) => s.id);
      if (sessionIds.length > 0) {
        db.delete(schema.chatSessions)
          .where(inArray(schema.chatSessions.id, sessionIds))
          .run();
      }
    }

    logger.info(
      `Cleaned up HCS-10 duplicates: removed ${totalRemoved}, kept ${totalKept}`
    );
    return { success: true, removed: totalRemoved, kept: totalKept };
  } catch (error) {
    logger.error('Failed to cleanup duplicate sessions:', error);
    return {
      success: false,
      removed: 0,
      kept: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * JSDoc for setupChatHandlers
 * Registers all chat-related IPC handlers
 */
export function setupChatHandlers(): void {
  ipcMain.handle('chat:create-session', createChatSession);
  ipcMain.handle('chat:load-session', loadChatSession);
  ipcMain.handle('chat:save-session', saveChatSession);
  ipcMain.handle('chat:delete-session', deleteChatSession);
  ipcMain.handle('chat:load-all-sessions', loadAllChatSessions);

  ipcMain.handle('chat:save-message', saveChatMessage);
  ipcMain.handle('chat:load-session-messages', loadSessionMessages);
  ipcMain.handle('chat:find-form-by-id', findFormMessageById);
  ipcMain.handle('chat:update-form-state', updateFormCompletionState);

  ipcMain.handle('chat:cleanup-duplicates', cleanupDuplicateHCS10Sessions);

  logger.info('Chat IPC handlers registered');
}
