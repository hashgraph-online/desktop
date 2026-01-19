import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { Badge } from '../ui/badge';
import {
  FiSearch,
  FiX,
  FiRefreshCw,
  FiUsers,
  FiCode,
  FiMessageSquare,
  FiStar,
  FiGlobe,
  FiZap,
  FiShield,
  FiFilter,
  FiExternalLink,
  FiUserPlus,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useHRLImageUrl } from '../../hooks/useHRLImageUrl';
import { NetworkType } from '@hashgraphonline/standards-sdk';
import ConnectionConfirmDialog from '../shared/ConnectionConfirmDialog';
import { discoverAgents as discoverAgentsFromBroker } from '../../services/registryBrokerService';

interface AgentProfile {
  accountId: string;
  profile?: {
    display_name?: string;
    alias?: string;
    bio?: string;
    profileImage?: string;
    aiAgent?: {
      type?: number;
      capabilities?: number[];
      model?: string;
      creator?: string;
    };
    socials?: Array<{
      platform: string;
      url?: string;
      handle?: string;
    }>;
  };
  metadata?: any;
  rating?: number;
  ratingCount?: number;
  network?: string;
  createdAt?: string;
  isRegistryBroker?: boolean;
}

interface AgentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (agent: AgentProfile) => void;
  currentNetwork: string;
}

interface FilterState {
  capabilities: number[];
  rating: number;
  agentType: 'all' | 'ai' | 'human' | 'registry';
}

const capabilityMap: {
  [key: number]: {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
  };
} = {
  0: { name: 'Text Generation', icon: FiCode },
  1: { name: 'Image Generation', icon: FiZap },
  2: { name: 'Audio Generation', icon: FiZap },
  3: { name: 'Video Generation', icon: FiZap },
  4: { name: 'Code Generation', icon: FiCode },
  5: { name: 'Translation', icon: FiGlobe },
  6: { name: 'Summarization', icon: FiMessageSquare },
  7: { name: 'Knowledge Retrieval', icon: FiShield },
  8: { name: 'Data Integration', icon: FiUsers },
  9: { name: 'Market Intelligence', icon: FiStar },
  10: { name: 'Transaction Analytics', icon: FiShield },
  11: { name: 'Smart Contract Audit', icon: FiShield },
  12: { name: 'Governance', icon: FiUsers },
  13: { name: 'Security Monitoring', icon: FiShield },
  14: { name: 'Compliance Analysis', icon: FiShield },
  15: { name: 'Fraud Detection', icon: FiShield },
  16: { name: 'Multi-Agent Coordination', icon: FiUsers },
  17: { name: 'API Integration', icon: FiCode },
  18: { name: 'Workflow Automation', icon: FiZap },
};

/**
 * Agent selector modal for discovering and connecting to agents
 */
export const AgentSelectorModal: React.FC<AgentSelectorModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  currentNetwork,
}) => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'recent'>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    capabilities: [],
    rating: 0,
    agentType: 'all',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 10;

  const loadAgents = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await discoverAgentsFromBroker({
        q: searchTerm,
        page: currentPage,
        limit: pageSize,
        capabilities: filters.capabilities.length > 0 ? filters.capabilities : undefined,
      });

      if (result.success && result.data) {
        const discovered: AgentProfile[] = result.data.agents.map((hit) => ({
          accountId: hit.accountId ?? hit.uaid,
          profile: {
            display_name: hit.name,
            alias: hit.metadata?.alias as string | undefined,
            bio: hit.description,
            profileImage: hit.profileImage,
            aiAgent: hit.metadata?.aiAgent as NonNullable<AgentProfile['profile']>['aiAgent'],
            socials: hit.metadata?.socials as NonNullable<AgentProfile['profile']>['socials'],
          },
          metadata: hit.metadata,
          rating: hit.rating,
          ratingCount: hit.ratingCount,
          network: hit.network ?? currentNetwork,
          createdAt: hit.createdAt,
          isRegistryBroker: true,
        }));
        setAgents(discovered);
      } else {
        setError(result.error || 'Failed to load agents');
      }
    } catch (err) {
      setError('Failed to discover agents');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, searchTerm, currentNetwork, currentPage, pageSize, filters.capabilities]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAgentToConnect, setSelectedAgentToConnect] =
    useState<AgentProfile | null>(null);

  const handleConnect = useCallback(async (agent: AgentProfile) => {
    setSelectedAgentToConnect(agent);
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmConnect = useCallback(async () => {
    if (!selectedAgentToConnect) return;

    try {
      setIsConnecting(true);
      setShowConfirmDialog(false);
      await onConnect(selectedAgentToConnect);
      onClose();
    } catch (err) {
      setError('Failed to send connection request. Please try again.');
    } finally {
      setIsConnecting(false);
      setSelectedAgentToConnect(null);
    }
  }, [selectedAgentToConnect, onConnect, onClose]);

  const handleCancelConnect = useCallback(() => {
    setShowConfirmDialog(false);
    setSelectedAgentToConnect(null);
  }, []);

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const filteredAgents = agents.filter((agent) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const name = agent.profile?.display_name || agent.profile?.alias || '';
      const bio = agent.profile?.bio || '';
      return (
        name.toLowerCase().includes(searchLower) ||
        bio.toLowerCase().includes(searchLower) ||
        agent.accountId.includes(searchLower)
      );
    }
    return true;
  });

  const AgentCard: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
    const displayName =
      agent.profile?.display_name || agent.profile?.alias || 'Unknown Agent';
    const bio = agent.profile?.bio || 'No description available';
    const capabilities = agent.profile?.aiAgent?.capabilities || [];
    const rating = agent.rating || 0;
    const ratingCount = agent.ratingCount || 0;
    const isAI = agent.profile?.aiAgent?.type !== undefined;

    const { resolvedUrl: imageUrl, isLoading: imageLoading } = useHRLImageUrl(
      agent.profile?.profileImage || '',
      currentNetwork as NetworkType
    );

    return (
      <div className='bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-700'>
        <div className='flex items-start gap-3'>
          {/* Avatar */}
          <div className='w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0'>
            {imageLoading ? (
              <FiRefreshCw className='w-5 h-5 animate-spin' />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={`${displayName} avatar`}
                className='w-12 h-12 rounded-lg object-cover'
                onError={() => {}}
              />
            ) : isAI ? (
              <FiCode className='w-6 h-6' />
            ) : (
              <FiUsers className='w-6 h-6' />
            )}
          </div>

          {/* Content */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between mb-2'>
              <div className='flex-1 min-w-0'>
                <Typography
                  variant='body1'
                  className='font-semibold text-gray-900 dark:text-white truncate'
                >
                  {displayName}
                </Typography>
                <Typography
                  variant='caption'
                  className='text-gray-600 dark:text-gray-400 text-xs'
                >
                  {agent.accountId}
                </Typography>
              </div>

              {rating > 0 && (
                <div className='flex items-center gap-1 shrink-0'>
                  <FiStar className='w-3 h-3 text-yellow-500' />
                  <Typography
                    variant='caption'
                    className='text-gray-600 dark:text-gray-400 text-xs'
                  >
                    {rating.toFixed(1)} ({ratingCount})
                  </Typography>
                </div>
              )}
            </div>

            <Typography
              variant='caption'
              className='text-gray-700 dark:text-gray-300 text-sm line-clamp-2 mb-3'
            >
              {bio}
            </Typography>

            {/* Badges */}
            <div className='flex flex-wrap gap-1 mb-3'>
              {isAI && (
                <Badge variant='outline' className='text-xs px-2 py-0.5'>
                  AI Agent
                </Badge>
              )}
              {agent.isRegistryBroker && (
                <Badge variant='outline' className='text-xs px-2 py-0.5'>
                  External
                </Badge>
              )}
              <Badge variant='outline' className='text-xs px-2 py-0.5'>
                {currentNetwork.toUpperCase()}
              </Badge>
            </div>

            {/* Capabilities */}
            {capabilities.length > 0 && (
              <div className='flex flex-wrap gap-1 mb-3'>
                {capabilities.slice(0, 3).map((capId) => {
                  const cap = capabilityMap[capId];
                  if (!cap) return null;

                  const IconComponent = cap.icon;
                  return (
                    <div
                      key={capId}
                      className='flex items-center gap-1 bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs'
                      title={cap.name}
                    >
                      <IconComponent className='w-3 h-3' />
                      <span>{cap.name}</span>
                    </div>
                  );
                })}
                {capabilities.length > 3 && (
                  <div className='flex items-center text-gray-500 dark:text-gray-400 px-2 py-1 text-xs'>
                    +{capabilities.length - 3} more
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className='flex gap-2'>
              <Button
                size='sm'
                onClick={() => handleConnect(agent)}
                className='flex-1'
              >
                <FiMessageSquare className='w-4 h-4 mr-2' />
                Connect
              </Button>

              <Button size='sm' variant='outline' onClick={() => {}}>
                <FiExternalLink className='w-4 h-4' />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl z-50'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FiUsers className='w-5 h-5' />
            Discover Agents
          </DialogTitle>
        </DialogHeader>

        <div className='flex flex-col h-[70vh]'>
          {/* Search and filters */}
          <div className='space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800'>
            {/* Search bar */}
            <div className='flex gap-2'>
              <div className='relative flex-1'>
                <FiSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
                <input
                  type='text'
                  placeholder='Search agents by name, description, or account ID...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                {searchTerm && (
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setSearchTerm('')}
                    className='absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6'
                  >
                    <FiX className='h-3 w-3' />
                  </Button>
                )}
              </div>

              <Button
                variant='outline'
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'bg-blue-100 dark:bg-blue-950/50')}
              >
                <FiFilter className='w-4 h-4 mr-2' />
                Filters
              </Button>

              <Button
                variant='outline'
                onClick={loadAgents}
                disabled={isLoading}
              >
                <FiRefreshCw
                  className={cn('w-4 h-4', isLoading && 'animate-spin')}
                />
              </Button>
            </div>

            {/* Sort and filter controls */}
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Typography
                  variant='caption'
                  className='text-gray-600 dark:text-gray-400'
                >
                  Sort by:
                </Typography>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className='px-3 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm'
                >
                  <option value='rating'>Rating</option>
                  <option value='name'>Name</option>
                  <option value='recent'>Recently Active</option>
                </select>
              </div>

              <Typography
                variant='caption'
                className='text-gray-600 dark:text-gray-400'
              >
                {filteredAgents.length} agents found
              </Typography>
            </div>

            {/* Advanced filters */}
            {showFilters && (
              <div className='bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg space-y-3'>
                <div>
                  <Typography
                    variant='caption'
                    className='text-gray-700 dark:text-gray-300 mb-2 block'
                  >
                    Agent Type
                  </Typography>
                  <div className='flex gap-2'>
                    {(['all', 'ai', 'human', 'registry'] as const).map(
                      (type) => (
                        <Button
                          key={type}
                          size='sm'
                          variant={
                            filters.agentType === type ? 'default' : 'outline'
                          }
                          onClick={() =>
                            handleFilterChange({ agentType: type })
                          }
                        >
                          {type === 'all' && 'All'}
                          {type === 'ai' && 'AI Agents'}
                          {type === 'human' && 'Human'}
                          {type === 'registry' && 'External'}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <Typography
                    variant='caption'
                    className='text-gray-700 dark:text-gray-300 mb-2 block'
                  >
                    Minimum Rating
                  </Typography>
                  <div className='flex gap-2'>
                    {[0, 3, 4, 4.5].map((rating) => (
                      <Button
                        key={rating}
                        size='sm'
                        variant={
                          filters.rating === rating ? 'default' : 'outline'
                        }
                        onClick={() => handleFilterChange({ rating })}
                      >
                        {rating === 0 ? 'Any' : `${rating}+ ⭐`}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className='flex-1 overflow-y-auto py-4'>
            {error ? (
              <div className='text-center py-8'>
                <Typography
                  variant='body1'
                  className='text-red-600 dark:text-red-400 mb-2'
                >
                  {error}
                </Typography>
                <Button variant='outline' onClick={loadAgents}>
                  <FiRefreshCw className='w-4 h-4 mr-2' />
                  Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className='text-center py-8'>
                <FiRefreshCw className='w-6 h-6 animate-spin text-gray-400 mx-auto mb-3' />
                <Typography
                  variant='body1'
                  className='text-gray-600 dark:text-gray-400'
                >
                  Discovering agents...
                </Typography>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className='text-center py-8'>
                <FiUsers className='w-8 h-8 text-gray-400 mx-auto mb-3' />
                <Typography
                  variant='body1'
                  className='text-gray-600 dark:text-gray-400 mb-2'
                >
                  No agents found
                </Typography>
                <Typography
                  variant='caption'
                  className='text-gray-500 dark:text-gray-500'
                >
                  Try adjusting your search terms or filters
                </Typography>
              </div>
            ) : (
              <div className='grid gap-4'>
                {filteredAgents.map((agent) => (
                  <AgentCard key={agent.accountId} agent={agent} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredAgents.length >= pageSize && (
            <div className='flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800'>
              <Button
                variant='outline'
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
              >
                Previous
              </Button>

              <Typography
                variant='caption'
                className='text-gray-600 dark:text-gray-400'
              >
                Page {currentPage}
              </Typography>

              <Button
                variant='outline'
                disabled={filteredAgents.length < pageSize}
                onClick={() => setCurrentPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      <ConnectionConfirmDialog
        isOpen={showConfirmDialog}
        agent={selectedAgentToConnect}
        isConnecting={isConnecting}
        onConfirm={handleConfirmConnect}
        onCancel={handleCancelConnect}
      />
    </Dialog>
  );
};

export default AgentSelectorModal;
