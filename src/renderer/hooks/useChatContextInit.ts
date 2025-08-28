import { useEffect, useState } from 'react';
import type { ChatSession } from '../../main/db/schema';

interface AgentData {
  id: string;
  name?: string;
  profile?: {
    display_name?: string;
    [key: string]: unknown;
  };
}

export type UseChatContextInitParams = {
  agentId?: string;
  agents: Array<AgentData>;
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  currentContext: { mode: 'personal' | 'hcs10'; topicId?: string; agentName?: string };
  setChatContext: (ctx: { mode: 'personal' | 'hcs10'; topicId?: string; agentName?: string }) => void;
  loadSession: (id: string) => Promise<void>;
  createSession: (name: string, mode: 'personal' | 'hcs10', topicId?: string) => Promise<ChatSession>;
  isManualSelecting: () => boolean;
  clearManualSelecting: () => void;
};

/**
 * Initializes chat context based on URL params and agent list. Ensures appropriate session exists/loaded.
 */
export function useChatContextInit(params: UseChatContextInitParams) {
  const {
    agentId,
    agents,
    sessions,
    currentSession,
    currentContext,
    setChatContext,
    loadSession,
    createSession,
    isManualSelecting,
    clearManualSelecting,
  } = params;

  const [isCreatingSession, setIsCreatingSession] = useState<string | null>(null);

  useEffect(() => {
    if (isManualSelecting()) {
      setTimeout(() => {
        clearManualSelecting();
      }, 1000);
      return;
    }

    if (agentId && agents.length > 0) {
      const selectedAgent = agents.find((a) => a.id === agentId);
      if (selectedAgent) {
        const getDisplayName = (agent: AgentData) => {
          if (agent.profile?.display_name) {
            return agent.profile.display_name;
          }
          if (agent.name && !/^\d+(\.\d+)*$/.test(agent.name)) {
            return agent.name;
          }
          return `Agent ${agent.id?.split('.').pop() || 'Unknown'}`;
        };

        const agentName = getDisplayName(selectedAgent);

        const nextCtx = { mode: 'hcs10' as const, topicId: selectedAgent.id as string, agentName };
        const isDifferent =
          currentContext.mode !== nextCtx.mode ||
          currentContext.topicId !== nextCtx.topicId ||
          currentContext.agentName !== nextCtx.agentName;
        if (isDifferent) {
          setChatContext(nextCtx);
        }


        const existing = sessions.find((s) => s.mode === 'hcs10' && s.topicId === selectedAgent.id);
        if (existing && currentSession?.id !== existing.id && !isManualSelecting()) {
          void loadSession(existing.id).catch(() => {});
        } else if (
          !existing &&
          (!currentSession || currentSession.mode !== 'hcs10' || currentSession.topicId !== selectedAgent.id)
        ) {
          if (isCreatingSession === selectedAgent.id) {
            return;
          }
          setIsCreatingSession(selectedAgent.id);
          void createSession(agentName, 'hcs10', selectedAgent.id)
            .then(() => setIsCreatingSession(null))
            .catch(() => setIsCreatingSession(null));
        }
      }
    } else if (!agentId) {
      if (currentContext.mode !== 'personal' || currentContext.agentName !== 'Personal Assistant') {
        setChatContext({ mode: 'personal', agentName: 'Personal Assistant' });
      }
      if (!currentSession) {
        const personalSessions = sessions.filter((s) => s.mode === 'personal');
        const personal = personalSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (personal && !isManualSelecting()) {
          void loadSession(personal.id).catch(() => {});
        }
      }
    }
  }, [
    agentId,
    agents,
    sessions,
    currentSession?.id,
    currentSession?.mode,
    currentSession?.topicId,
    currentContext,
    setChatContext,
    loadSession,
    createSession,
    isManualSelecting,
    clearManualSelecting,
    isCreatingSession,
  ]);
}

export default useChatContextInit;


