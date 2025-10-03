import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ChatSession } from '../../main/db/schema';

export type ChatMode = 'personal' | 'hcs10';

export type UseChatSessionsParams = {
  loadSession: (id: string) => Promise<void>;
  createSession: (
    name: string,
    mode: ChatMode,
    topicId?: string
  ) => Promise<ChatSession>;
  deleteSession: (id: string) => Promise<void>;
  setChatContext: (ctx: {
    mode: ChatMode;
    topicId?: string;
    agentName?: string;
  }) => void;
  currentSession: ChatSession | null;
};

export type UseChatSessionsResult = {
  isLoadingSessions: boolean;
  showSessionCreationModal: boolean;
  sessionDeleteConfirm: string | null;
  setSessionDeleteConfirm: (id: string | null) => void;
  openCreateSession: () => void;
  closeCreateSession: () => void;
  handleSessionSelect: (session: ChatSession) => Promise<void>;
  handleSessionCreated: (session: ChatSession) => Promise<void>;
  handleDeleteSession: (sessionId: string) => Promise<void>;
};

/**
 * Encapsulates session selection, creation and deletion flows for Chat.
 */
export function useChatSessions(
  params: UseChatSessionsParams
): UseChatSessionsResult {
  const { loadSession, deleteSession, setChatContext, currentSession } = params;
  const navigate = useNavigate();

  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showSessionCreationModal, setShowSessionCreationModal] =
    useState(false);
  const [sessionDeleteConfirm, setSessionDeleteConfirm] = useState<
    string | null
  >(null);

  const openCreateSession = useCallback(() => {
    setShowSessionCreationModal(true);
  }, []);

  const closeCreateSession = useCallback(() => {
    setShowSessionCreationModal(false);
  }, []);

  const handleSessionSelect = useCallback(
    async (session: ChatSession) => {
      try {
        setIsLoadingSessions(true);
        await loadSession(session.id);

        if (session.mode === 'personal') {
          setChatContext({ mode: 'personal', agentName: session.name });
          navigate('/chat');
        } else if (session.mode === 'hcs10' && session.topicId) {
          setChatContext({
            mode: 'hcs10',
            topicId: session.topicId,
            agentName: session.name,
          });
          navigate(`/chat/${session.topicId}`);
        }

        toast.success('Session Loaded', {
          description: `Switched to "${session.name}"`,
        });
      } catch (error) {
        toast.error('Failed to Load Session', {
          description:
            error instanceof Error ? error.message : 'Could not load session',
        });
      } finally {
        setIsLoadingSessions(false);
      }
    },
    [loadSession, setChatContext, navigate]
  );

  const handleSessionCreated = useCallback(
    async (session: ChatSession) => {
      setShowSessionCreationModal(false);
      try {
        setIsLoadingSessions(true);

        setChatContext({
          mode: session.mode as ChatMode,
          topicId: session.topicId,
          agentName: session.name,
        });

        await loadSession(session.id);

        if (session.mode === 'hcs10' && session.topicId) {
          navigate(`/chat/${session.topicId}`);
        } else {
          navigate('/chat');
        }

        toast.success('Session Created', {
          description: `Created and activated session "${session.name}"`,
        });
      } catch (error) {
        toast.error('Session Creation Error', {
          description:
            error instanceof Error
              ? error.message
              : 'Could not activate session',
        });
      } finally {
        setIsLoadingSessions(false);
      }
    },
    [loadSession, navigate, setChatContext]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const wasCurrentSession = currentSession?.id === sessionId;

        await deleteSession(sessionId);
        setSessionDeleteConfirm(null);

        toast.success('Session Deleted', {
          description: 'Session has been permanently deleted',
        });

        if (wasCurrentSession) {
          setChatContext({ mode: 'personal', agentName: 'Personal Assistant' });
          navigate('/chat');
        }
      } catch (error) {
        toast.error('Failed to Delete Session', {
          description:
            error instanceof Error ? error.message : 'Could not delete session',
        });
      }
    },
    [deleteSession, currentSession, setChatContext, navigate]
  );

  return {
    isLoadingSessions,
    showSessionCreationModal,
    sessionDeleteConfirm,
    setSessionDeleteConfirm,
    openCreateSession,
    closeCreateSession,
    handleSessionSelect,
    handleSessionCreated,
    handleDeleteSession,
  };
}

export default useChatSessions;
