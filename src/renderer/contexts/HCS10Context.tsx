import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { isEqual } from 'lodash';
import { useConfigStore } from '../stores/configStore';

export interface Agent {
  id: string;
  accountId: string;
  name: string;
  type: 'active' | 'incoming' | 'pending' | 'needs_confirmation';
  lastMessage?: string;
  timestamp?: Date | number;
  profile?: {
    display_name?: string;
    bio?: string;
    profileImage?: string;
    alias?: string;
    isAI?: boolean;
    isRegistryBroker?: boolean;
  };
  network?: string;
  unreadCount?: number;
}

interface ConnectionRequest {
  id: string;
  requesting_account_id: string;
  sequence_number: number;
  memo?: string;
  operator_id?: string;
}

interface HCS10ContextType {
  agents: Agent[];
  connectionRequests: ConnectionRequest[];
  isLoadingAgents: boolean;
  activeTopicId?: string;
  pendingRequestCount: number;
  refreshConnections: () => Promise<void>;
  onOpenNewChat?: () => void;
  onSelectAgent?: (agent: Agent) => void;
  onAcceptRequest?: (request: ConnectionRequest) => Promise<void>;
  onRejectRequest?: (request: ConnectionRequest) => Promise<void>;
}

const HCS10Context = createContext<HCS10ContextType | null>(null);

export const useHCS10 = () => {
  const context = useContext(HCS10Context);
  if (!context) {
    throw new Error('useHCS10 must be used within an HCS10Provider');
  }
  return context;
};

interface HCS10ProviderProps {
  children: ReactNode;
}

/**
 * HCS10 Context Provider that actively fetches and manages connection data
 */
export const HCS10Provider: React.FC<HCS10ProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<
    ConnectionRequest[]
  >([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<string>();

  const isConnected = config?.hedera?.accountId && config?.hedera?.privateKey;

  const fetchConnectionData = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingAgents(true);
    try {
      const agentsResult = await window.electron.invoke(
        'hcs10:get-active-agents'
      );
      if (agentsResult.success) {
        const newAgents = agentsResult.agents || [];

        setAgents((prevAgents) => {
          if (isEqual(prevAgents, newAgents)) {
            return prevAgents;
          }
          return newAgents;
        });
      }

      const requestsResult = await window.electron.invoke(
        'hcs10:get-connection-requests'
      );
      if (requestsResult.success) {
        const newRequests = requestsResult.requests || [];

        setConnectionRequests((prevRequests) => {
          if (isEqual(prevRequests, newRequests)) {
            return prevRequests;
          }
          return newRequests;
        });
      }
    } catch (error) {
    } finally {
      setIsLoadingAgents(false);
    }
  }, [isConnected]);

  const refreshConnections = useCallback(async () => {
    await fetchConnectionData();
  }, [fetchConnectionData]);

  useEffect(() => {
    if (isConnected) {
      fetchConnectionData();
    }
  }, [isConnected, fetchConnectionData]);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      fetchConnectionData();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [isConnected, fetchConnectionData]);

  const onOpenNewChat = useCallback(() => {}, []);

  const onSelectAgent = useCallback(
    async (agent: Agent) => {
      try {
        const sessionName =
          agent.profile?.display_name ||
          agent.name ||
          `HCS-10 Chat - ${agent.id}`;
        await window.electron.invoke('chat:create-session', {
          name: sessionName,
          mode: 'hcs10',
          topicId: agent.id,
          isActive: true,
        });
      } catch {}
      setActiveTopicId(agent.id);
      navigate(`/chat/${agent.id}`);
    },
    [navigate]
  );

  const onAcceptRequest = useCallback(
    async (request: ConnectionRequest) => {
      try {
        const result = await window.electron.invoke('hcs10:accept-connection', {
          connectionId: request.id,
        });

        if (result.success) {
          await fetchConnectionData();
        } else {
          throw new Error(result.error || 'Failed to accept connection');
        }
      } catch (error) {
        throw error;
      }
    },
    [fetchConnectionData]
  );

  const onRejectRequest = useCallback(
    async (request: ConnectionRequest) => {
      try {
        const result = await window.electron.invoke('hcs10:reject-connection', {
          connectionId: request.id,
        });

        if (result.success) {
          await fetchConnectionData();
        } else {
          throw new Error(result.error || 'Failed to reject connection');
        }
      } catch (error) {
        throw error;
      }
    },
    [fetchConnectionData]
  );

  const contextValue = useMemo<HCS10ContextType>(
    () => ({
      agents,
      connectionRequests,
      isLoadingAgents,
      activeTopicId,
      pendingRequestCount: connectionRequests.length,
      refreshConnections,
      onOpenNewChat,
      onSelectAgent,
      onAcceptRequest,
      onRejectRequest,
    }),
    [
      agents,
      connectionRequests,
      isLoadingAgents,
      activeTopicId,
      refreshConnections,
      onOpenNewChat,
      onSelectAgent,
      onAcceptRequest,
      onRejectRequest,
    ]
  );

  return (
    <HCS10Context.Provider value={contextValue}>
      {children}
    </HCS10Context.Provider>
  );
};

export default HCS10Context;
