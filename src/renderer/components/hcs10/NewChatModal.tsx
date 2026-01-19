import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import Typography from '../ui/Typography';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  FiMessageSquare,
  FiSearch,
  FiCheck,
  FiPlus,
  FiArrowRight,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { invokeCommand } from '../../tauri/ipc';
import { discoverAgents as discoverAgentsFromBroker } from '../../services/registryBrokerService';
import { sendConnectionRequest } from '../../services/registryBrokerChatService';

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data?: { sessionId?: string; isRegistryBroker?: boolean; agentName?: string }) => void;
  initialTargetAccountId?: string | null;
}

type ViewMode = 'browse-agents' | 'direct-connect';

interface Agent {
  id: string;
  accountId: string;
  name: string;
  profile?: {
    display_name?: string;
    bio?: string;
    profileImage?: string;
    alias?: string;
    isAI?: boolean;
    isRegistryBroker?: boolean;
  };
  inboundTopicId?: string;
}

interface ConnectionWarning {
  message: string;
  variant: 'outbound' | 'inbound' | 'connected' | null;
}


interface SuccessViewProps {
  onClose: () => void;
  onConnectAnother: () => void;
}

interface ConnectionWarningDisplayProps {
  message: string;
}

interface SubmitButtonLabelProps {
  isLoading: boolean;
  variant: 'outbound' | 'inbound' | 'connected' | null;
}


/**
 * Displays the success message after sending a connection request.
 */
const SuccessView: React.FC<SuccessViewProps> = ({
  onClose,
  onConnectAnother,
}) => {
  return (
    <div className="p-6 text-center bg-white dark:bg-gray-950">
      <div className="mb-5 flex justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/30 to-green-500/30 dark:from-green-400/20 dark:to-green-500/20 animate-pulse"></div>
          <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow">
              <FiCheck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>
      <Typography
        variant="h3"
        className="mb-3 font-semibold bg-clip-text text-transparent bg-gradient-to-r from-green-700 to-green-500 dark:from-green-400 dark:to-green-300"
      >
        Connection Request Sent!
      </Typography>
      <Typography
        variant="body2"
        className="text-sm text-gray-600 dark:text-gray-300 mb-5 max-w-xs mx-auto"
      >
        Your request has been sent successfully and is awaiting response.
      </Typography>
      <div className="flex justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/70"
        >
          Close
        </Button>
        <Button
          type="button"
          onClick={onConnectAnother}
          className="bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#5599fe] hover:from-[#5599fe] hover:to-[#a679f0] text-white shadow-sm"
        >
          Connect with Another Agent
        </Button>
      </div>
    </div>
  );
};

/**
 * Displays the connection warning message.
 */
const ConnectionWarningDisplay: React.FC<ConnectionWarningDisplayProps> = ({
  message,
}) => {
  return (
    <div className="mt-2 text-sm flex items-center px-3 py-2 rounded border border-amber-300/70 dark:border-amber-600/50 bg-amber-50/50 dark:bg-amber-900/20 text-amber-800 dark:text-white">
      <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
      {message}
    </div>
  );
};

/**
 * Determines the label for the submit button based on state.
 */
const SubmitButtonLabel: React.FC<SubmitButtonLabelProps> = ({
  isLoading,
  variant,
}) => {
  if (isLoading) {
    return (
      <span className="flex items-center">
        <div className="w-4 h-4 rounded-full border-2 border-t-white border-r-transparent border-b-white border-l-transparent animate-spin mr-2"></div>
        Sending...
      </span>
    );
  }

  if (variant === 'inbound') {
    return (
      <span className="flex items-center">
        <FiCheck className="mr-2 h-4 w-4" />
        Accept Request Instead
      </span>
    );
  }

  if (variant === 'connected' || variant === 'outbound') {
    return (
      <span className="flex items-center">
        <FiMessageSquare className="mr-2 h-4 w-4" />
        Send Another Request
      </span>
    );
  }

  return (
    <span className="flex items-center">
      <FiMessageSquare className="mr-2 h-4 w-4" />
      Send Connection Request
    </span>
  );
};

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTargetAccountId = null,
}) => {
  const [targetAccountId, setTargetAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('browse-agents');
  const [agentSearchTerm, setAgentSearchTerm] = useState('');
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setMemo("Hello! I'd like to connect with you.");
      setError('');
      setIsSuccess(false);
      setTargetAccountId('');
      setAgentSearchTerm('');

      if (!initialTargetAccountId) {
        setViewMode('browse-agents');
      } else {
        setTargetAccountId(initialTargetAccountId);
        setViewMode('direct-connect');
      }

      loadAvailableAgents();
    }
  }, [isOpen, initialTargetAccountId]);

  const loadAvailableAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const result = await discoverAgentsFromBroker({
        q: '',
        limit: 50,
        page: 1,
      });

      if (result.success && result.data) {
        const transformedAgents: Agent[] = result.data.agents.map((hit, index) => ({
          id: hit.accountId ?? hit.uaid ?? `agent-${index}`,
          accountId: hit.accountId ?? hit.uaid ?? '',
          name: hit.name ?? 'Unknown Agent',
          profile: {
            display_name: hit.name,
            bio: hit.description,
            profileImage: hit.profileImage,
            alias: hit.metadata?.alias as string | undefined,
            isAI: Boolean(hit.metadata?.aiAgent),
            isRegistryBroker: true,
          },
          inboundTopicId: hit.metadata?.inboundTopicId as string | undefined,
        }));

        setAvailableAgents(transformedAgents);
      } else {
        setAvailableAgents([]);
      }
    } catch (error) {
      setError('Failed to load available agents. Please try again later.');
      setAvailableAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const filteredAgents = useMemo(() => {
    if (!agentSearchTerm) return availableAgents;

    const searchLower = agentSearchTerm.toLowerCase();
    return availableAgents.filter((agent) => {
      const displayName = agent.profile?.display_name || agent.name || '';
      const description = agent.profile?.bio || '';

      return (
        displayName.toLowerCase().includes(searchLower) ||
        agent.accountId.includes(searchLower) ||
        description.toLowerCase().includes(searchLower)
      );
    });
  }, [availableAgents, agentSearchTerm]);

  const resetForm = useCallback(() => {
    setTargetAccountId('');
    setMemo('');
    setError('');
    setIsSuccess(false);
    setAgentSearchTerm('');
    setViewMode('browse-agents');
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  const onSuccessClose = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const onSuccessConnectAnother = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!targetAccountId) {
      setError('Please enter an account ID.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await sendConnectionRequest(
        targetAccountId,
        { message: memo || "Hello! I'd like to connect with you." }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send connection request');
      }

      setIsSuccess(true);
      onSuccess({ sessionId: result.sessionId, isRegistryBroker: true });
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setMemo(event.target.value);
    },
    []
  );

  const handleSearchTermChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setAgentSearchTerm(event.target.value);
    },
    []
  );

  const clearSearch = useCallback(() => {
    setAgentSearchTerm('');
  }, []);

  const handleAgentSelect = useCallback((agent: Agent) => {
    setTargetAccountId(agent.accountId);
    setError('');
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return isLoading || !targetAccountId;
  }, [targetAccountId, isLoading]);


  const connectionWarning: ConnectionWarning = useMemo(() => {
    return { message: '', variant: null as 'outbound' | 'inbound' | 'connected' | null };
  }, [targetAccountId]);

  let modalTitleString = 'New Chat';
  if (isSuccess) {
    modalTitleString = 'Successfully Connected!';
  } else if (viewMode === 'direct-connect') {
    modalTitleString = 'Connect to an Agent';
  } else if (viewMode === 'browse-agents') {
    modalTitleString = 'Browse Available Agents';
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-hidden p-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl">
        <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
            {modalTitleString}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(80vh-120px)] bg-white dark:bg-gray-950">
          {isSuccess ? (
            <SuccessView
              onClose={onSuccessClose}
              onConnectAnother={onSuccessConnectAnother}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white dark:bg-gray-950">
              <div className="space-y-4">
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="browse-agents" className="flex items-center gap-2">
                      <FiSearch className="h-4 w-4" />
                      Browse Agents
                    </TabsTrigger>
                    <TabsTrigger value="direct-connect" className="flex items-center gap-2">
                      <FiPlus className="h-4 w-4" />
                      Direct Connect
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="direct-connect" className="space-y-4 mt-4">
                      <div>
                        <Typography
                          variant="body2"
                          className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Account ID
                        </Typography>
                        <Input
                          placeholder="Enter account ID (e.g., 0.0.123456)"
                          value={targetAccountId}
                          onChange={(e) => setTargetAccountId(e.target.value)}
                          className="w-full"
                          disabled={isLoading}
                        />
                      </div>
                  </TabsContent>
                  
                  <TabsContent value="browse-agents" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div>
                        <Typography
                          variant="body2"
                          className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Search Agents
                        </Typography>
                        <div className="relative">
                          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Search by name or account ID..."
                            value={agentSearchTerm}
                            onChange={handleSearchTermChange}
                            className="pl-10 w-full"
                            disabled={isLoading}
                          />
                          {agentSearchTerm && (
                            <button
                              type="button"
                              onClick={clearSearch}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {loadingAgents ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-[#5599fe] rounded-full animate-spin"></div>
                            <span className="ml-2 text-gray-500">Loading agents...</span>
                          </div>
                        ) : filteredAgents.length > 0 ? (
                          filteredAgents.map((agent) => (
                            <div
                              key={agent.id}
                              onClick={() => handleAgentSelect(agent)}
                              className={cn(
                                'p-3 rounded-lg border cursor-pointer transition-all bg-white dark:bg-gray-900',
                                targetAccountId === agent.accountId
                                  ? 'border-[#5599fe] bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-[#5599fe]/50 dark:hover:border-[#5599fe]/70'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#a679f0] to-[#5599fe] flex items-center justify-center text-white font-medium">
                                  {agent.profile?.display_name?.[0] || agent.name[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {agent.profile?.display_name || agent.name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {agent.accountId}
                                  </div>
                                  {agent.profile?.bio && (
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                      {agent.profile.bio}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Typography variant="body2" className="text-gray-500 dark:text-gray-400">
                              No agents found
                            </Typography>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {connectionWarning.message && (
                <ConnectionWarningDisplay message={connectionWarning.message} />
              )}

              <div className="message-section pt-2">
                <Typography
                  variant="body2"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Connection Message
                </Typography>
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[#a679f0]/20 to-[#5599fe]/20 dark:from-[#a679f0]/30 dark:to-[#5599fe]/30 rounded-lg blur opacity-40 group-hover:opacity-70 transition-opacity"></div>
                  <div className="relative">
                    <Input
                      placeholder="Enter a message to introduce yourself..."
                      value={memo}
                      onChange={handleMemoChange}
                      className="w-full shadow-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 flex items-center bg-red-50/50 dark:bg-red-900/20 px-3 py-2 rounded border border-red-200/50 dark:border-red-800/30">
                  <FiAlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={cn(
                    isSubmitDisabled
                      ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#5599fe] hover:from-[#5599fe] hover:to-[#a679f0] text-white shadow-sm'
                  )}
                >
                  <SubmitButtonLabel
                    isLoading={isLoading}
                    variant={connectionWarning.variant}
                  />
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatModal;
