import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FiSearch, 
  FiFilter, 
  FiGrid, 
  FiList,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiStar,
  FiMessageCircle,
  FiUser,
  FiCpu,
  FiLink,
  FiXCircle,
  FiImage,
  FiMinus,
  FiPlus,
  FiChevronDown,
  FiCopy,
  FiCamera,
  FiMic,
  FiFilm,
  FiCode,
  FiGlobe,
  FiBarChart2,
  FiDatabase,
  FiShare2,
  FiTrendingUp,
  FiActivity,
  FiShield,
  FiCheckCircle,
  FiAlertTriangle,
  FiBriefcase,
  FiLock,
  FiUsers,
  FiZap,
  FiDollarSign
} from 'react-icons/fi';
import { FaTwitter, FaGithub, FaGlobe as FaGlobeIcon, FaDiscord } from 'react-icons/fa';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/Button';
import ConnectionConfirmDialog from '../components/shared/ConnectionConfirmDialog';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';
import Typography from '../components/ui/Typography';
import { AgentProfileModal } from '../components/AgentProfileModal';
import { AIAgentCapability, NetworkType } from '@hashgraphonline/standards-sdk';
import { toast } from 'sonner';
import { gradients } from '../lib/styles';
import { useHRLImageUrl } from '../hooks/useHRLImageUrl';

interface AgentProfile {
  id?: string;
  accountId: string;
  profile?: any;
  metadata?: any;
  rating?: number;
  ratingCount?: number;
  network?: string;
  createdAt?: string | Date;
}

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'rating-desc'
  | 'rating-asc'
  | 'creator'
  | 'created-desc';

type FilterState = {
  search: string;
  tags: number[];
  hasProfileImage: boolean | null;
  includeRegistryBroker?: boolean;
  registries?: string[];
};

interface AgentDiscoveryPagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

const capabilityIconMap: {
  [key: number]: {
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  };
} = {
  0: { icon: FiCpu, description: 'Text Generation' },
  1: { icon: FiCamera, description: 'Image Generation' },
  2: { icon: FiMic, description: 'Audio Generation' },
  3: { icon: FiFilm, description: 'Video Generation' },
  4: { icon: FiCode, description: 'Code Generation' },
  5: { icon: FiGlobe, description: 'Language Translation' },
  6: { icon: FiBarChart2, description: 'Summarization & Content Extraction' },
  7: { icon: FiDatabase, description: 'Knowledge Retrieval & Reasoning' },
  8: { icon: FiShare2, description: 'Data Integration & Visualization' },
  9: { icon: FiTrendingUp, description: 'Market Intelligence' },
  10: { icon: FiActivity, description: 'Transaction Analytics' },
  11: { icon: FiShield, description: 'Smart Contract Audit' },
  12: { icon: FiCheckCircle, description: 'Governance Facilitation' },
  13: { icon: FiAlertTriangle, description: 'Security Monitoring' },
  14: { icon: FiBriefcase, description: 'Compliance & Regulatory Analysis' },
  15: { icon: FiLock, description: 'Fraud Detection & Prevention' },
  16: { icon: FiUsers, description: 'Multi-Agent Coordination' },
  17: { icon: FiLink, description: 'API Integration & Orchestration' },
  18: { icon: FiZap, description: 'Workflow Automation' },
};

const allCapabilityTags: { capabilityId: number; label: string }[] =
  Object.entries(capabilityIconMap).map(([idStr, data]) => ({
    capabilityId: parseInt(idStr, 10),
    label: data.description,
  }));


const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'created-desc', label: 'Newest to Oldest' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'rating-desc', label: 'Highest Rating' },
  { value: 'rating-asc', label: 'Lowest Rating' },
  { value: 'creator', label: 'Creator' },
];

interface AgentCardProps {
  agent: AgentProfile;
  onViewProfile: (accountId: string) => void;
  onConnect: (accountId: string) => void;
}

/**
 * Individual agent card component
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onViewProfile, onConnect }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const { metadata, accountId } = agent;
  const {
    name,
    description,
    logo,
    profileImage,
    socials,
    bio,
    display_name,
    alias,
    aiAgent,
    inboundTopicId,
  } = metadata || {};

  const displayName = display_name || alias || name || 'Unknown Agent';
  const rawImageUrl = profileImage || logo;
  const capabilities = aiAgent?.capabilities || [];
  const rating = agent.rating || 0;
  const ratingCount = agent.ratingCount || 0;

  const { resolvedUrl: imageUrl, isLoading: imageLoading, error: imageError } = useHRLImageUrl(
    rawImageUrl,
    agent.network === 'testnet' ? 'testnet' : 'mainnet'
  );

  const handleCopyAccountId = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(accountId);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    },
    [accountId]
  );

  const handleSocialClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-900/90 backdrop-blur-sm border-gray-200 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-500/40 h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${
                  imageUrl && !imageLoading && !imageError ? '' : gradients.primary
                } text-white overflow-hidden cursor-pointer`}
                onClick={() => onViewProfile(accountId)}
              >
                {imageLoading ? (
                  <div className="animate-spin">
                    <FiRefreshCw className="h-4 w-4" />
                  </div>
                ) : imageUrl && !imageError ? (
                  <img
                    src={imageUrl}
                    alt={`${displayName} logo`}
                    className="w-12 h-12 object-cover"
                    onError={() => {
                    }}
                  />
                ) : (
                  displayName.charAt(0) || 'A'
                )}
              </div>
              <div className="flex flex-col pt-1 min-w-0">
                <Typography
                  variant="h3"
                  className="font-bold text-lg leading-tight truncate max-w-[180px] sm:max-w-[250px] text-purple-600 dark:text-purple-400 mb-0.5 hover:text-purple-500 dark:hover:text-purple-300 transition-colors cursor-pointer"
                  onClick={() => onViewProfile(accountId)}
                >
                  {displayName}
                </Typography>
                {rating > 0 && (
                  <div className="flex items-center space-x-1 mb-1">
                    <FiStar className="h-3 w-3 text-yellow-400 fill-current" />
                    <Typography variant="caption" className="font-medium text-gray-600 dark:text-gray-300">{rating.toFixed(1)}</Typography>
                    <Typography variant="caption" className="text-gray-500">({ratingCount})</Typography>
                  </div>
                )}
                <Typography
                  variant="caption"
                  className="text-gray-500 dark:text-gray-500 font-mono tracking-tight truncate max-w-[180px] sm:max-w-[250px] flex items-center"
                >
                  <Typography variant="caption" className="truncate mr-1">{accountId}</Typography>
                  <button
                    onClick={handleCopyAccountId}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Copy account ID"
                  >
                    {copySuccess ? (
                      <Typography variant="caption" className="text-green-500 dark:text-green-400">Copied</Typography>
                    ) : (
                      <FiCopy className="w-2.5 h-2.5" />
                    )}
                  </button>
                </Typography>
              </div>
            </div>
          </div>

          <Typography variant="body2" className="text-sm text-gray-600 dark:text-gray-300 mb-5 line-clamp-2 grow">
            {description || bio || 'No description available'}
          </Typography>

          <div className="mt-auto">
            <div className="flex flex-wrap gap-2 mb-4 overflow-visible">
              {(() => {
                const capabilitiesToDisplay = capabilities || [];
                const visibleCapabilities = capabilitiesToDisplay.slice(0, 4);
                const tagElements = [];

                for (let i = 0; i < visibleCapabilities.length; i++) {
                  const capabilityId = visibleCapabilities[i];
                  const capabilityInfo = capabilityIconMap[capabilityId];
                  const IconComponent = capabilityInfo?.icon;
                  const capDescription =
                    capabilityInfo?.description || `Capability ${capabilityId}`;

                  tagElements.push(
                    <div
                      key={capabilityId}
                      className="relative group"
                      title={capDescription}
                    >
                      <Badge
                        variant="outline"
                        className="text-xs h-7 w-7 p-0 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 rounded-full"
                      >
                        {IconComponent ? (
                          <IconComponent className="h-4 w-4" />
                        ) : (
                          <FiGrid className="h-4 w-4" />
                        )}
                      </Badge>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 dark:bg-gray-900/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <Typography
                          variant="caption"
                          className="text-xs !m-0 !p-0 !leading-none"
                        >
                          {capDescription}
                        </Typography>
                      </div>
                    </div>
                  );
                }

                return tagElements;
              })()}

              {capabilities.length > 4 && (
                <Badge
                  variant="outline"
                  className="text-xs h-7 w-7 p-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-full"
                >
                  +{capabilities.length - 4}
                </Badge>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                {socials && Array.isArray(socials) ? (
                  (() => {
                    const socialElements = [];

                    for (let i = 0; i < socials.length; i++) {
                      const social = socials[i];
                      let icon = <FaGlobeIcon className="w-4 h-4" />;
                      let url = social.url || social.handle;

                      if (!url) continue;

                      if (
                        social.platform === 'twitter' ||
                        social.platform === 'x'
                      ) {
                        icon = <FaTwitter className="w-4 h-4" />;
                        if (!url.includes('http')) {
                          url = `https://twitter.com/${url.replace('@', '')}`;
                        }
                      } else if (social.platform === 'github') {
                        icon = <FaGithub className="w-4 h-4" />;
                        if (!url.includes('http')) {
                          url = `https://github.com/${url}`;
                        }
                      } else if (social.platform === 'discord') {
                        icon = <FaDiscord className="w-4 h-4" />;
                      } else if (social.platform === 'website') {
                        icon = <FaGlobeIcon className="w-4 h-4" />;
                      }

                      socialElements.push(
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                          onClick={handleSocialClick}
                        >
                          {icon}
                        </a>
                      );
                    }

                    return socialElements;
                  })()
                ) : (
                  <>
                    {socials?.twitter && (
                      <a
                        href={`https://twitter.com/${socials.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        onClick={handleSocialClick}
                      >
                        <FaTwitter className="w-4 h-4" />
                      </a>
                    )}
                    {socials?.github && (
                      <a
                        href={`https://github.com/${socials.github}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                        onClick={handleSocialClick}
                      >
                        <FaGithub className="w-4 h-4" />
                      </a>
                    )}
                    {socials?.website && (
                      <a
                        href={socials.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                        onClick={handleSocialClick}
                      >
                        <FaGlobeIcon className="w-4 h-4" />
                      </a>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewProfile(accountId)}
                  className="text-xs"
                >
                  View Profile
                </Button>
                <Button
                  size="sm"
                  onClick={() => onConnect(accountId)}
                  className={`text-xs font-medium rounded-full ${gradients.primary} hover:opacity-90 text-white transition-opacity`}
                >
                  <FiLink className="mr-1 h-3 w-3" />
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AgentDiscoveryPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption>('rating-desc');
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAgentToConnect, setSelectedAgentToConnect] = useState<AgentProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pagination, setPagination] = useState<AgentDiscoveryPagination>({
    currentPage: 1,
    totalPages: 1,
    pageSize: 50,
    totalCount: 0,
  });
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    tags: [],
    hasProfileImage: null,
    includeRegistryBroker: false,
    registries: ['nanda', 'virtuals-protocol', 'olas-protocol', 'openrouter'],
  });
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    search: '',
    tags: [],
    hasProfileImage: null,
    includeRegistryBroker: false,
    registries: ['nanda', 'virtuals-protocol', 'olas-protocol', 'openrouter'],
  });

  /**
   * Discovers agents from the backend
   */
  const discoverAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const offset = (pagination.currentPage - 1) * pagination.pageSize;
      
      const result = await window.electron.invoke('hcs10:discover-agents', {
        filters: {
          ...activeFilters,
          capabilities: activeFilters.tags.length > 0 ? activeFilters.tags : undefined,
        },
        pagination: {
          page: pagination.currentPage,
          limit: pagination.pageSize,
          offset,
        },
      });

      if (result.success) {
        const fetchedAgents: AgentProfile[] = result.data.agents || [];
        
        if (fetchedAgents.length > 0) {
          const topicIds = fetchedAgents
            .map((agent) => agent.metadata?.inboundTopicId)
            .filter(Boolean)
            .join(',');

          if (topicIds.length > 0) {
            try {
            } catch (error) {
            }
          }
        }
        
        setAgents(fetchedAgents);
        setPagination({
          currentPage: result.data.pagination?.currentPage || pagination.currentPage,
          totalPages: result.data.pagination?.totalPages || 1,
          pageSize: result.data.pagination?.limit || pagination.pageSize,
          totalCount: result.data.pagination?.total || 0,
        });
      } else {
        toast.error('Discovery Failed', {
          description: result.error || 'Failed to discover agents',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to connect to discovery service',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilters, pagination.currentPage, pagination.pageSize]);

  /**
   * Handles search and filtering
   */
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, search: value }));
    setActiveFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const handleSort = useCallback((option: SortOption) => {
    setCurrentSort(option);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      tags: [],
      hasProfileImage: null,
      includeRegistryBroker: false,
      registries: ['nanda', 'virtuals-protocol', 'olas-protocol', 'openrouter'],
    });
    setActiveFilters({
      search: '',
      tags: [],
      hasProfileImage: null,
      includeRegistryBroker: false,
      registries: ['nanda', 'virtuals-protocol', 'olas-protocol', 'openrouter'],
    });
  }, []);

  const toggleTag = useCallback((capabilityId: number) => {
    setFilters((prev) => {
      const newTags = prev.tags.includes(capabilityId)
        ? prev.tags.filter((id) => id !== capabilityId)
        : [...prev.tags, capabilityId];

      setActiveFilters((current) => ({ ...current, tags: newTags }));
      return { ...prev, tags: newTags };
    });
  }, []);

  const toggleShowAllTags = useCallback(() => {
    setShowAllTags((prev) => !prev);
  }, []);

  const toggleHasProfileImage = useCallback(() => {
    setFilters((prev) => {
      const newValue = prev.hasProfileImage === true ? null : true;
      setActiveFilters((current) => ({
        ...current,
        hasProfileImage: newValue,
      }));
      return { ...prev, hasProfileImage: newValue };
    });
  }, []);

  const handleSortOptionClick = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    sortOptions.forEach((option) => {
      handlers[option.value] = () => handleSort(option.value);
    });
    return handlers;
  }, [handleSort]);

  const tagClickHandlers = useMemo(() => {
    const handlers: Record<number, () => void> = {};
    allCapabilityTags.forEach((tag) => {
      handlers[tag.capabilityId] = () => toggleTag(tag.capabilityId);
    });
    return handlers;
  }, [toggleTag]);

  /**
   * Handles connecting to an agent - shows confirmation dialog first
   */
  const handleConnect = useCallback(async (accountId: string) => {
    const agent = agents.find(a => a.accountId === accountId);
    if (agent) {
      setSelectedAgentToConnect(agent);
      setShowConfirmDialog(true);
    } else {
      toast.error('Error', {
        description: 'Agent not found',
      });
    }
  }, [agents]);

  /**
   * Confirms and sends connection request after user confirmation
   */
  const handleConfirmConnect = useCallback(async () => {
    if (!selectedAgentToConnect) return;

    try {
      setIsConnecting(true);
      setShowConfirmDialog(false);
      
      const result = await window.electron.invoke('hcs10:send-connection-request', {
        targetAccountId: selectedAgentToConnect.accountId,
      });

      if (result.success) {
        toast.success('Connection Request Sent', {
          description: 'Your connection request has been sent to the agent',
        });
      } else {
        toast.error('Connection Failed', {
          description: result.error || 'Failed to send connection request',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to send connection request',
      });
    } finally {
      setIsConnecting(false);
      setSelectedAgentToConnect(null);
    }
  }, [selectedAgentToConnect]);

  /**
   * Cancels connection request
   */
  const handleCancelConnect = useCallback(() => {
    setShowConfirmDialog(false);
    setSelectedAgentToConnect(null);
  }, []);

  /**
   * Handles viewing agent profile
   */
  const handleViewProfile = useCallback((accountId: string) => {
    const agent = agents.find(a => a.accountId === accountId);
    if (agent) {
      setSelectedAgent(agent);
      setIsProfileModalOpen(true);
    } else {
      toast.error('Error', {
        description: 'Agent not found',
      });
    }
  }, [agents]);

  /**
   * Handles closing the profile modal
   */
  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
    setSelectedAgent(null);
  }, []);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (!agent.metadata) return false;

      if (activeFilters.search && activeFilters.search.trim() !== '') {
        const searchLower = activeFilters.search.toLowerCase();
        const displayNameMatch = agent?.metadata?.display_name
          ?.toLowerCase()
          .includes(searchLower);
        const aliasMatch = agent?.metadata?.alias
          ?.toLowerCase()
          .includes(searchLower);
        const descMatch = agent?.metadata?.bio
          ?.toLowerCase()
          .includes(searchLower);
        const creatorMatch = agent?.metadata?.aiAgent?.creator
          ?.toLowerCase()
          .includes(searchLower);

        if (
          !(
            displayNameMatch ||
            aliasMatch ||
            descMatch ||
            creatorMatch
          )
        ) {
          return false;
        }
      }

      if (activeFilters.tags.length > 0) {
        const agentCapabilities = agent?.metadata?.aiAgent?.capabilities || [];
        if (
          !activeFilters.tags.every((tagId) =>
            agentCapabilities.includes(tagId)
          )
        ) {
          return false;
        }
      }

      if (activeFilters.hasProfileImage === true) {
        const hasImage = Boolean(agent.metadata?.profileImage);
        if (!hasImage) {
          return false;
        }
      }

      return true;
    });
  }, [agents, activeFilters]);

  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const displayNameA = a.metadata?.display_name?.toLowerCase() || '';
      const displayNameB = b.metadata?.display_name?.toLowerCase() || '';
      const aliasA = a.metadata?.alias?.toLowerCase() || '';
      const aliasB = b.metadata?.alias?.toLowerCase() || '';
      const primaryNameA = displayNameA || aliasA;
      const primaryNameB = displayNameB || aliasB;
      const creatorA = a.metadata?.aiAgent?.creator?.toLowerCase() || '';
      const creatorB = b.metadata?.aiAgent?.creator?.toLowerCase() || '';
      const ratingA = a.metadata?.rating || 0;
      const ratingB = b.metadata?.rating || 0;
      const ratingCountA = a.metadata?.ratingCount || 0;
      const ratingCountB = b.metadata?.ratingCount || 0;

      let createdA = 0;
      if (a.createdAt instanceof Date) {
        createdA = a.createdAt.getTime();
      } else if (typeof a.createdAt === 'string') {
        createdA = new Date(a.createdAt).getTime();
      }

      let createdB = 0;
      if (b.createdAt instanceof Date) {
        createdB = b.createdAt.getTime();
      } else if (typeof b.createdAt === 'string') {
        createdB = new Date(b.createdAt).getTime();
      }

      switch (currentSort) {
        case 'name-asc':
          return primaryNameA.localeCompare(primaryNameB);
        case 'name-desc':
          return primaryNameB.localeCompare(primaryNameA);
        case 'rating-desc':
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          if (ratingCountB !== ratingCountA) {
            return ratingCountB - ratingCountA;
          }
          return primaryNameA.localeCompare(primaryNameB);
        case 'rating-asc':
          if (ratingA !== ratingB) {
            return ratingA - ratingB;
          }
          if (ratingCountA !== ratingCountB) {
            return ratingCountA - ratingCountB;
          }
          return primaryNameA.localeCompare(primaryNameB);
        case 'creator':
          return creatorA.localeCompare(creatorB);
        case 'created-desc':
          return createdB - createdA;
        default:
          return 0;
      }
    });
  }, [filteredAgents, currentSort]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.search) count++;
    count += activeFilters.tags.length;
    if (activeFilters.hasProfileImage !== null) count++;
    if (activeFilters.includeRegistryBroker) count++;
    return count;
  }, [activeFilters]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: page,
    }));
  }, []);

  const handleFirstPage = useCallback(() => {
    handlePageChange(1);
  }, [handlePageChange]);

  const handlePreviousPage = useCallback(() => {
    handlePageChange(pagination.currentPage - 1);
  }, [handlePageChange, pagination.currentPage]);

  const handleNextPage = useCallback(() => {
    handlePageChange(pagination.currentPage + 1);
  }, [handlePageChange, pagination.currentPage]);

  const handleLastPage = useCallback(() => {
    handlePageChange(pagination.totalPages);
  }, [handlePageChange, pagination.totalPages]);

  const pageButtonHandlers = useMemo(() => {
    const handlers: Record<number, () => void> = {};
    for (let i = 1; i <= pagination.totalPages; i++) {
      handlers[i] = () => handlePageChange(i);
    }
    return handlers;
  }, [handlePageChange, pagination.totalPages]);

  useEffect(() => {
    discoverAgents();
  }, [pagination.currentPage, pagination.pageSize, activeFilters]);


  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative">
      <div className="absolute top-0 left-0 right-0 h-[800px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-x-0 -top-40 transform-gpu overflow-hidden blur-3xl">
          <div className={`relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] ${gradients.primary} opacity-10`} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Typography variant="h2" className={`${gradients.text} mb-2`}>
              AI Agents Directory
            </Typography>
            <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
              Discover and connect with AI agents on the Hedera network
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={discoverAgents}
              disabled={isLoading}
              className="border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500"
            >
              <FiRefreshCw className={isLoading ? 'animate-spin mr-2 h-4 w-4' : 'mr-2 h-4 w-4'} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex-grow relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search by name, description, creator..."
              className="pl-10 h-11 bg-white dark:bg-gray-800/90 backdrop-blur-sm border-gray-300 dark:border-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              value={filters.search}
              onChange={handleSearch}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-md flex-grow min-w-0 relative border border-gray-200 dark:border-gray-700">
              <div
                className={`gap-2 ${
                  showAllTags
                    ? 'flex flex-wrap'
                    : 'flex flex-nowrap overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500'
                } items-center`}
              >
                <div className="flex items-center gap-2 mr-2 flex-shrink-0">
                  <FiFilter className="text-gray-500 h-4 w-4" />
                  <Typography
                    variant="caption"
                    className="text-gray-700 dark:text-gray-300 !m-0 !p-0"
                  >
                    Filters:
                  </Typography>
                </div>
                <Badge
                  variant="outline"
                  className={`cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    activeFilters.hasProfileImage
                      ? 'bg-purple-100 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700'
                      : 'bg-gray-100 dark:bg-gray-900/10 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                  } hover:bg-purple-200 dark:hover:bg-purple-800/20 h-7 px-3 flex items-center`}
                  onClick={toggleHasProfileImage}
                >
                  <FiImage className="h-3 w-3 mr-1" />
                  <Typography
                    variant="caption"
                    className="!m-0 !p-0 !leading-none text-xs"
                  >
                    With profile image
                  </Typography>
                </Badge>

                {(showAllTags
                  ? allCapabilityTags
                  : allCapabilityTags.slice(0, 9)
                ).map((tag) => {
                  const isSelected = filters.tags.includes(tag.capabilityId);
                  const IconComponent = capabilityIconMap[tag.capabilityId]?.icon;

                  return (
                    <Badge
                      key={tag.capabilityId}
                      variant="outline"
                      className={`cursor-pointer whitespace-nowrap flex-shrink-0 ${
                        isSelected
                          ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-600'
                          : 'bg-gray-100 dark:bg-gray-900/10 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                      } hover:bg-purple-200 dark:hover:bg-purple-800/20 h-7 px-3 flex items-center gap-1`}
                      onClick={tagClickHandlers[tag.capabilityId]}
                    >
                      {IconComponent ? <IconComponent className="h-3 w-3" /> : null}
                      <Typography
                        variant="caption"
                        className="!m-0 !p-0 !leading-none text-xs"
                      >
                        {tag.label}
                      </Typography>
                    </Badge>
                  );
                })}

                <Badge
                  variant="outline"
                  className="cursor-pointer whitespace-nowrap flex-shrink-0 bg-purple-100 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800/20 h-7 px-3 flex items-center"
                  onClick={toggleShowAllTags}
                >
                  {showAllTags ? (
                    <>
                      <FiMinus className="h-3 w-3 mr-1" />
                      <Typography
                        variant="caption"
                        className="!m-0 !p-0 !leading-none text-xs"
                      >
                        Show less
                      </Typography>
                    </>
                  ) : (
                    <>
                      <FiPlus className="h-3 w-3 mr-1" />
                      <Typography
                        variant="caption"
                        className="!m-0 !p-0 !leading-none text-xs"
                      >
                        Show more
                      </Typography>
                    </>
                  )}
                </Badge>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-md lg:w-auto flex-shrink-0 border border-gray-200 dark:border-gray-700">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 w-full lg:w-auto border-gray-300 dark:border-gray-600"
                  >
                    <FiStar className="h-3 w-3 mr-1" />
                    <Typography
                      variant="caption"
                      className="hidden sm:inline !m-0 !p-0 !leading-none text-xs"
                    >
                      {sortOptions.find(
                        (option) => option.value === currentSort
                      )?.label || 'Sort By'}
                    </Typography>
                    <Typography
                      variant="caption"
                      className="sm:hidden !m-0 !p-0 !leading-none text-xs"
                    >
                      Sort
                    </Typography>
                    <FiChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={`cursor-pointer ${
                        currentSort === option.value
                          ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300'
                      }`}
                      onClick={handleSortOptionClick[option.value]}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-gray-200 dark:bg-gray-800/40 animate-pulse rounded-xl"
                ></div>
              ))}
            </div>
          )}

          {!isLoading && sortedAgents.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAgents.map((agent) => (
                  <div key={agent.accountId || agent.id} className="h-full">
                    <AgentCard
                      agent={agent}
                      onViewProfile={handleViewProfile}
                      onConnect={handleConnect}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="mt-8 flex flex-col items-center">
                  <div className="flex items-center space-x-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFirstPage}
                      disabled={pagination.currentPage <= 1}
                      className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600"
                    >
                      <Typography variant="caption" className="sr-only">First Page</Typography>
                      <FiChevronLeft className="h-4 w-4" />
                      <FiChevronLeft className="h-4 w-4 -ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={pagination.currentPage <= 1}
                      className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600"
                    >
                      <Typography variant="caption" className="sr-only">Previous Page</Typography>
                      <FiChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center">
                      {Array.from({
                        length: Math.min(5, pagination.totalPages),
                      }).map((_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (
                          pagination.currentPage >=
                          pagination.totalPages - 2
                        ) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={
                              pagination.currentPage === pageNum
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            onClick={pageButtonHandlers[pageNum]}
                            className={`h-8 w-8 p-0 mx-1 ${
                              pagination.currentPage === pageNum
                                ? `${gradients.primary} text-white hover:opacity-90`
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <Typography variant="caption">{pageNum}</Typography>
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={pagination.currentPage >= pagination.totalPages}
                      className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600"
                    >
                      <Typography variant="caption" className="sr-only">Next Page</Typography>
                      <FiChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLastPage}
                      disabled={pagination.currentPage >= pagination.totalPages}
                      className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600"
                    >
                      <Typography variant="caption" className="sr-only">Last Page</Typography>
                      <FiChevronRight className="h-4 w-4" />
                      <FiChevronRight className="h-4 w-4 -ml-2" />
                    </Button>
                  </div>

                  <div className="text-center text-gray-600 dark:text-gray-400 mt-2">
                    <Typography variant="body2">
                      Showing {sortedAgents.length} of {pagination.totalCount}{' '}
                      agents (Page {pagination.currentPage} of{' '}
                      {pagination.totalPages})
                    </Typography>
                  </div>
                </div>
              )}
            </>
          )}

          {!isLoading && sortedAgents.length === 0 && (
            <div className="bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <FiXCircle className="h-8 w-8 text-gray-500" />
              </div>
              <Typography variant="h3" className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                No agents found
              </Typography>
              <Typography variant="body1" className="text-gray-600 dark:text-gray-400 mb-6">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'No agents registered yet'}
              </Typography>
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={handleClearFilters} className="border-gray-300 dark:border-gray-600">
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agent Profile Modal */}
      <AgentProfileModal
        agent={selectedAgent}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        onConnect={handleConnect}
      />

      <ConnectionConfirmDialog
        isOpen={showConfirmDialog}
        agent={selectedAgentToConnect}
        isConnecting={isConnecting}
        onConfirm={handleConfirmConnect}
        onCancel={handleCancelConnect}
      />
    </main>
  );
};

export default AgentDiscoveryPage;