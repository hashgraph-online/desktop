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
import { useWalletStore } from '../stores/walletStore';
import { ConnectionsManager, type NetworkType } from '@hashgraphonline/standards-sdk';
import { getHCS10Client } from '../services/hcs10ClientFactory';

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
  const wallet = useWalletStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<
    ConnectionRequest[]
  >([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<string>();

  const hasOperatorCreds = Boolean(config?.hedera?.accountId && config?.hedera?.privateKey);
  const canPollViaWallet = Boolean(wallet.isConnected && wallet.accountId && wallet.network);
  const isConnected = hasOperatorCreds || canPollViaWallet;

  const cmRef = React.useRef<ConnectionsManager | null>(null);
  const ensureRendererCM = useCallback(async (): Promise<ConnectionsManager | null> => {
    if (!canPollViaWallet) return null;
    if (cmRef.current) return cmRef.current;
    const net = (wallet.network || 'testnet') as NetworkType;
    const baseClient = getHCS10Client(net, {
      walletConnected: true,
      accountId: config?.hedera?.accountId,
      privateKey: config?.hedera?.privateKey,
    });
    cmRef.current = new ConnectionsManager({ baseClient, logLevel: 'info', silent: true });
    return cmRef.current;
  }, [canPollViaWallet, wallet.network, config?.hedera?.accountId, config?.hedera?.privateKey]);

  const fetchConnectionData = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingAgents(true);
    try {
      if (hasOperatorCreds && !canPollViaWallet) {
        const agentsResult = await window?.desktop?.invoke('hcs10_get_active_agents');
        if (agentsResult.success) {
          const newAgents = agentsResult.agents || [];
          setAgents((prevAgents) => (isEqual(prevAgents, newAgents) ? prevAgents : newAgents));
        }

        const requestsResult = await window?.desktop?.invoke('hcs10_get_connection_requests');
        if (requestsResult.success) {
          const newRequests = requestsResult.requests || [];
          setConnectionRequests((prevRequests) => (isEqual(prevRequests, newRequests) ? prevRequests : newRequests));
        }
      } else if (canPollViaWallet) {
        const cm = await ensureRendererCM();
        if (!cm) return;
        const accountId = wallet.accountId as string;
        await cm.fetchConnectionData(accountId);

        const active = cm.getActiveConnections?.() || [];
        const pending = cm.getPendingRequests?.() || [];

        const mappedAgents: Agent[] = active.map((c: any) => ({
          id: c.connectionTopicId || c.id,
          accountId: c.targetAccountId,
          name: c.profileInfo?.displayName || c.targetAccountId || 'Unknown Agent',
          type: 'active',
          lastMessage: c.memo,
          timestamp: c.lastActivity ? new Date(c.lastActivity) : new Date(),
          profile: {
            display_name: c.profileInfo?.displayName || c.targetAccountId,
            bio: c.profileInfo?.bio,
            profileImage: c.profileInfo?.avatar,
            alias: c.profileInfo?.alias,
            isAI: true,
          },
          network: (wallet.network || config?.hedera?.network || 'testnet') as string,
          unreadCount: 0,
        }));
        setAgents((prev) => (isEqual(prev, mappedAgents) ? prev : mappedAgents));

        const mappedReqs: ConnectionRequest[] = (pending || [])
          .filter((c: any) => (c.needsConfirmation || c.status === 'needs_confirmation') || c.inboundRequestId)
          .map((conn: any) => ({
            id: conn.connectionTopicId || conn.id,
            requesting_account_id: conn.targetAccountId,
            sequence_number: Date.now(),
            memo: conn.memo || '',
            operator_id: conn.targetAccountId,
          }));
        setConnectionRequests((prev) => (isEqual(prev, mappedReqs) ? prev : mappedReqs));
      }
    } catch (error) {
    } finally {
      setIsLoadingAgents(false);
    }
  }, [isConnected, hasOperatorCreds, canPollViaWallet, ensureRendererCM, wallet.accountId, wallet.network, config?.hedera?.network]);

  const refreshConnections = useCallback(async () => {
    try { console.debug('[HCS10] refreshConnections()'); } catch {}
    await fetchConnectionData();
  }, [fetchConnectionData]);

  useEffect(() => {
    if (isConnected) {
      try { console.debug('[HCS10] initial fetchConnectionData (isConnected=true)'); } catch {}
      fetchConnectionData();
    }
  }, [isConnected, fetchConnectionData]);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      try { console.debug('[HCS10] interval fetchConnectionData'); } catch {}
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
        await window?.desktop?.invoke('chat_create_session', {
          payload: {
            name: sessionName,
            mode: 'hcs10',
            topicId: agent.id,
            isActive: true,
          },
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
        const result = await window?.desktop?.invoke('hcs10_accept_connection', {
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
        const result = await window?.desktop?.invoke('hcs10_reject_connection', {
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
