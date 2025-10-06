import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAgentStore } from '../stores/agentStore';
import type { ChatSession } from '../../main/db/schema';
import useFileAttachments from './useFileAttachments';
import { useNotificationStore } from '../stores/notificationStore';
import type { Notification } from '../stores/notificationStore';

type AssistantChatContext = {
  mode: 'personal' | 'hcs10';
  topicId?: string;
  agentName?: string;
};

export type AttachmentPayload = {
  name: string;
  data: string;
  type: string;
  size: number;
};

export type BuildSessionNameArgs = {
  message: string;
  chatContext: AssistantChatContext;
  defaultName: string;
  currentSession?: ChatSession | null;
};

export type ExtraAttachmentsBuilderArgs = {
  message: string;
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp'>
  ) => void;
  chatContext: AssistantChatContext;
  session: ChatSession;
};

export type AssistantMessageControllerOptions = {
  /**
   * Builds the session name when a new session must be created.
   */
  buildSessionName: (args: BuildSessionNameArgs) => string;
  /**
   * Optional callback to add additional attachments (e.g. browser page context).
   */
  buildExtraAttachments?: (
    args: ExtraAttachmentsBuilderArgs
  ) => Promise<AttachmentPayload[]>;
  /**
   * Fired before a new session is created, allowing callers to mark manual selection state.
   */
  onBeforeSessionCreate?: () => void;
  /**
   * Fired once a new session has been created.
   */
  onSessionCreated?: (sessionId: string) => void;
  /**
   * Fired whenever a session is confirmed as active for the outbound message.
   */
  onSessionActivated?: (session: ChatSession) => void;
  /**
   * Optional reset trigger. When defined and transitions to false, input & attachments reset.
   */
  resetTrigger?: boolean;
  /**
   * Returns the session id the caller expects to use. If it returns null or
   * a different id than the current session, a new session will be created.
   */
  resolvePreferredSessionId?: () => string | null;
};

export type AssistantMessageControllerResult = {
  inputValue: string;
  setInputValue: (value: string) => void;
  isSending: boolean;
  isSubmitting: boolean;
  selectedFiles: File[];
  fileError: string | null;
  handleFileAdd: (files: FileList) => void;
  handleFileRemove: (index: number) => void;
  handleSendMessage: () => Promise<void>;
  resetAttachments: () => void;
};

/**
 * Creates a reusable controller for composing assistant messages.
 * @param options Controls session naming, attachment enrichment, and lifecycle callbacks.
 * @returns State and handlers used to drive assistant message composition UI.
 */
export function useAssistantMessageController(
  options: AssistantMessageControllerOptions
): AssistantMessageControllerResult {
  const {
    buildSessionName,
    buildExtraAttachments,
    onBeforeSessionCreate,
    onSessionCreated,
    onSessionActivated,
    resetTrigger,
    resolvePreferredSessionId,
  } = options;

  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const isExecutingRef = useRef(false);
  const buildExtraAttachmentsRef = useRef(buildExtraAttachments);

  useEffect(() => {
    buildExtraAttachmentsRef.current = buildExtraAttachments;
  }, [buildExtraAttachments]);

  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );

  const createSession = useAgentStore((state) => state.createSession);
  const loadSession = useAgentStore((state) => state.loadSession);
  const saveSession = useAgentStore((state) => state.saveSession);
  const sendMessage = useAgentStore((state) => state.sendMessage);
  const isConnected = useAgentStore((state) => state.isConnected);
  const isTyping = useAgentStore((state) => state.isTyping);
  const currentSessionId = useAgentStore((state) => state.currentSession?.id);

  const {
    files: selectedFiles,
    addFiles,
    removeFile,
    reset: resetAttachments,
    fileError,
    toBase64,
  } = useFileAttachments(5, 10);

  const handleFileAdd = useCallback(
    (fileList: FileList) => {
      addFiles(fileList);
    },
    [addFiles]
  );

  const handleFileRemove = useCallback(
    (index: number) => {
      removeFile(index);
    },
    [removeFile]
  );

  const handleSendMessage = useCallback(async () => {
    if (isExecutingRef.current) {
      console.warn('[handleSendMessage] Already executing, preventing re-entry');
      return;
    }

    const message = inputValue.trim();
    if (
      (!message && selectedFiles.length === 0) ||
      isSubmitting ||
      isTyping ||
      !isConnected
    ) {
      return;
    }

    isExecutingRef.current = true;
    setIsSubmitting(true);
    setIsSending(true);

    try {
      const chatContext = useAgentStore.getState().chatContext;
      let session = useAgentStore.getState().currentSession;

      if (resolvePreferredSessionId) {
        const preferredId = resolvePreferredSessionId();
        if (!preferredId || !session || session.id !== preferredId) {
          session = null;
        }
      }

      if (!session) {
        if (onBeforeSessionCreate) {
          onBeforeSessionCreate();
        }
        const defaultName =
          chatContext.mode === 'personal'
            ? `Personal Chat - ${new Date().toLocaleDateString()}`
            : chatContext.agentName || `HCS-10 Chat - ${chatContext.topicId}`;

        const sessionName = buildSessionName({
          message,
          chatContext,
          defaultName,
          currentSession: session,
        });

        const newSession = await createSession(
          sessionName,
          chatContext.mode,
          chatContext.mode === 'hcs10' ? chatContext.topicId : undefined
        );

        await loadSession(newSession.id);
        session = useAgentStore.getState().currentSession;

        if (!session) {
          throw new Error('Failed to activate session before sending message');
        }

        if (onSessionCreated) {
          onSessionCreated(newSession.id);
        }
      }

      if (!session) {
        throw new Error('Unable to resolve session for assistant message');
      }

      const attachments: AttachmentPayload[] = [];

      if (selectedFiles.length > 0) {
        const failures: string[] = [];

        for (const file of selectedFiles) {
          try {
            const base64Content = await toBase64(file);
            attachments.push({
              name: file.name,
              data: base64Content,
              type: file.type || 'application/octet-stream',
              size: file.size,
            });
          } catch (error) {
            failures.push(file.name);
          }
        }

        if (failures.length > 0) {
          const allFailed = failures.length === selectedFiles.length;
          const title = allFailed
            ? 'File Attachment Failed'
            : 'Some Files Failed to Attach';
          const messageText =
            failures.length === 1
              ? `Failed to process file: ${failures[0]}`
              : `Failed to process ${failures.length} files: ${failures.join(', ')}`;

          addNotification({
            type: allFailed ? 'error' : 'warning',
            title,
            message: messageText,
            duration: allFailed ? 8000 : 6000,
          });

          if (allFailed) {
            return;
          }
        }
      }

      if (buildExtraAttachmentsRef.current) {
        try {
          const extra = await buildExtraAttachmentsRef.current({
            message,
            addNotification,
            chatContext,
            session,
          });
          if (Array.isArray(extra) && extra.length > 0) {
            attachments.push(...extra);
          }
        } catch (error) {
          addNotification({
            type: 'warning',
            title: 'Context Attachment Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to attach additional context for this message.',
            duration: 6000,
          });
        }
      }

      const { currentSession: activeSession } = useAgentStore.getState();
      const targetSession = activeSession ?? session;
      if (!targetSession) {
        throw new Error('Active session unavailable after loading');
      }

      if (onSessionActivated) {
        onSessionActivated(targetSession);
      }

      const topicId =
        targetSession.mode === 'hcs10' ? targetSession.topicId : undefined;

      await sendMessage(message, attachments, topicId);

      if (targetSession) {
        let nextSessionName = targetSession.name;
        const isPersonalDefault = nextSessionName.includes('Personal Chat -');
        const isHcsDefault = nextSessionName.includes('HCS-10 Chat -');
        const canUseMessageAsName = message.length > 0 && message.length <= 50;

        if (isPersonalDefault && canUseMessageAsName) {
          nextSessionName = message;
        } else if (
          isHcsDefault &&
          Boolean(chatContext.agentName) &&
          nextSessionName !== chatContext.agentName
        ) {
          nextSessionName = chatContext.agentName as string;
        }

        const updatedSession = {
          ...targetSession,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
          name: nextSessionName,
        } as ChatSession;

        try {
          await saveSession(updatedSession);
        } catch (error) {
          addNotification({
            type: 'warning',
            title: 'Session Update Failed',
            message:
              'Unable to update session metadata. Message was still sent.',
            duration: 6000,
          });
        }
      }

      setInputValue('');
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Message Send Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to send your message. Please try again.',
        duration: 7000,
      });
    } finally {
      resetAttachments();
      setIsSubmitting(false);
      setIsSending(false);
      isExecutingRef.current = false;
    }
  }, [
    inputValue,
    selectedFiles,
    isSubmitting,
    isTyping,
    isConnected,
    createSession,
    loadSession,
    saveSession,
    sendMessage,
    toBase64,
    buildSessionName,
    addNotification,
    onBeforeSessionCreate,
    onSessionCreated,
    onSessionActivated,
    resetAttachments,
    resolvePreferredSessionId,
  ]);

  useEffect(() => {
    if (typeof resetTrigger === 'boolean' && !resetTrigger) {
      setInputValue('');
      resetAttachments();
    }
  }, [resetTrigger, resetAttachments]);

  return {
    inputValue,
    setInputValue,
    isSending,
    isSubmitting,
    selectedFiles,
    fileError,
    handleFileAdd,
    handleFileRemove,
    handleSendMessage,
    resetAttachments,
  };
}

export default useAssistantMessageController;
