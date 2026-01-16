import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FaRobot, FaServer, FaSearch, FaTh, FaList, FaStar, FaSortAmountDown } from 'react-icons/fa';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import ConnectionConfirmDialog from '../components/shared/ConnectionConfirmDialog';
import { AgentProfileModal } from '../components/AgentProfileModal';
import { toast } from 'sonner';
import { useHRLImageUrl } from '../hooks/useHRLImageUrl';
import { discoverAgents as discoverAgentsFromBroker } from '../services/registryBrokerService';
import { cn } from '../lib/utils';
import Typography from '../components/ui/Typography';

interface AgentProfile {
  id?: string;
  accountId: string;
  uaid?: string;
  name?: string;
  description?: string;
  registry?: string;
  profileImage?: string;
  capabilities?: number[];
  protocols?: string[];
  profile?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  rating?: number;
  ratingCount?: number;
  network?: string;
  createdAt?: string | Date;
  trustScore?: number;
  availability?: {
    status: 'online' | 'offline' | 'unknown';
    latencyMs?: number;
    lastChecked?: string;
  };
}

const capabilityLabels: Record<number, string> = {
  0: 'Text',
  1: 'Image',
  2: 'Audio',
  3: 'Video',
  4: 'Code',
  5: 'Translation',
  6: 'Summary',
  7: 'Knowledge',
  8: 'Data',
  9: 'Market',
  10: 'Analytics',
  11: 'Audit',
  12: 'Governance',
  13: 'Security',
  14: 'Compliance',
  15: 'Fraud',
  16: 'Multi-Agent',
  17: 'API',
  18: 'Automation',
};

const availabilityIndicatorClasses: Record<string, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const ScrollProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setProgress(window.scrollY / scrollHeight);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-blue via-brand-purple to-brand-green origin-left z-[100]"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
};

const NetworkBackground: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(85,153,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(85,153,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
    <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-brand-blue/10 rounded-full blur-3xl mix-blend-screen animate-pulse" />
    <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-brand-purple/10 rounded-full blur-3xl mix-blend-screen" />
  </div>
);

const Breadcrumbs: React.FC<{ query?: string }> = ({ query }) => (
  <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-brand-blue/70 mb-8 font-medium font-mono tracking-wide">
    <span className="hover:text-brand-blue transition-colors cursor-pointer">REGISTRY</span>
    <ChevronRight className="w-3 h-3 text-brand-blue/20 dark:text-brand-blue/30" />
    <span className="text-gray-900 dark:text-white font-bold uppercase">
      {query ? 'SEARCH RESULTS' : 'AGENTS'}
    </span>
  </nav>
);

interface SearchHeaderProps {
  query: string;
  totalCount: number;
  globalTotal: number;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ query, totalCount, globalTotal }) => {
  const title = query ? `RESULTS FOR "${query}"` : 'SEARCH AGENTS';
  const words = title.split(' ');
  const lastWord = words.pop() || '';
  const restWords = words.join(' ');

  return (
    <div className="relative pb-12 mb-12 border-b border-brand-blue/10 dark:border-white/5">
      <div className="relative z-10">
        <Breadcrumbs query={query} />
        <div className="max-w-4xl">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-8 uppercase text-gray-900 dark:text-white min-h-[1.1em]">
            {restWords}{' '}
            <span className="text-brand-purple">{lastWord}</span>
          </h1>

          <div className="flex flex-col md:flex-row md:items-center gap-6 text-gray-600 dark:text-brand-blue/60 font-mono text-[10px] tracking-[0.2em] uppercase mt-12 border-l-2 border-brand-blue pl-6 py-1 min-h-[40px]">
            <div className="flex items-center gap-2.5 min-w-[160px]">
              <div className="w-2 h-2 rounded-full bg-brand-blue shadow-[0_0_8px_rgba(85,153,254,0.5)]" />
              <span className="tabular-nums">
                Showing {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="hidden md:block w-px h-4 bg-brand-blue/20 dark:bg-white/10" />
            <div className="flex items-center gap-2.5 min-w-[180px]">
              <div className="w-2 h-2 rounded-full bg-brand-purple shadow-[0_0_8px_rgba(181,108,255,0.5)]" />
              <span className="tabular-nums">{globalTotal.toLocaleString()} Agents Indexed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[-2px] left-0 flex gap-1">
        <div className="w-12 h-1 bg-brand-blue rounded-full" />
        <div className="w-4 h-1 bg-brand-purple rounded-full" />
        <div className="w-2 h-1 bg-brand-green rounded-full" />
      </div>
    </div>
  );
};

interface AgentAvatarProps {
  src?: string;
  name: string;
  network?: string;
  size?: 'sm' | 'md' | 'lg';
  category?: 'ai-agent' | 'mcp-server';
}

const AgentAvatar: React.FC<AgentAvatarProps> = ({ src, name, network, size = 'md', category }) => {
  const { resolvedUrl, isLoading, error } = useHRLImageUrl(
    src,
    network === 'testnet' ? 'testnet' : 'mainnet'
  );
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'h-10 w-10 text-sm',
    md: 'h-12 w-12 text-base',
    lg: 'h-20 w-20 text-2xl',
  };

  const sizeDimensions = {
    sm: 40,
    md: 48,
    lg: 80,
  };

  const defaultFallback = category === 'mcp-server' ? (
    <FaServer className="opacity-40" aria-hidden="true" />
  ) : (
    <FaRobot className="opacity-40" aria-hidden="true" />
  );

  const showImage = resolvedUrl && !error && !imageError && !isLoading;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center bg-blue-50/60 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 overflow-hidden rounded-full',
        sizeClasses[size]
      )}
      role={showImage ? undefined : 'img'}
      aria-label={showImage ? undefined : `${name} avatar`}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={`${name} avatar`}
          loading="lazy"
          width={sizeDimensions[size]}
          height={sizeDimensions[size]}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : isLoading ? (
        <RefreshCw className="w-4 h-4 animate-spin opacity-40" />
      ) : (
        defaultFallback
      )}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 border border-white/10 shadow-inner shadow-black/20 rounded-full'
        )}
      />
    </div>
  );
};

interface AgentCardProps {
  agent: AgentProfile;
  onQuickView: (agent: AgentProfile) => void;
  onConnect: (agent: AgentProfile) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onQuickView, onConnect }) => {
  const displayName =
    agent.name ||
    (agent.metadata as Record<string, unknown>)?.display_name ||
    (agent.metadata as Record<string, unknown>)?.alias ||
    'Unknown Agent';
  const description =
    agent.description ||
    (agent.metadata as Record<string, unknown>)?.bio ||
    'No description available';
  const imageUrl =
    agent.profileImage ||
    (agent.metadata as Record<string, unknown>)?.profileImage ||
    (agent.metadata as Record<string, unknown>)?.logo;
  const capabilities = agent.capabilities || [];
  const registry = agent.registry || 'unknown';
  const isMcp = registry === 'mcp' || agent.protocols?.includes('mcp');
  const category = isMcp ? 'mcp-server' : 'ai-agent';

  const protocolLabel = (() => {
    const protocols = agent.protocols || [];
    if (protocols.includes('a2a')) return 'A2A';
    if (protocols.includes('mcp')) return 'MCP';
    if (protocols.includes('uagent')) return 'uAgent';
    return registry.toUpperCase();
  })();

  const hasErc8004 = agent.protocols?.includes('erc-8004') || false;
  const trustScore = agent.trustScore || agent.rating;
  const availability = agent.availability;

  return (
    <div className="h-full">
      <div
        onClick={() => onQuickView(agent)}
        data-testid="agent-card"
        className="block group h-full cursor-pointer"
      >
        <div
          className={cn(
            'relative bg-white dark:bg-gray-900/80 rounded-lg p-5',
            'border border-gray-200 dark:border-gray-800',
            'shadow-sm transition-all duration-200',
            'hover:shadow-md hover:border-brand-blue/50 dark:hover:border-brand-green/50',
            'flex flex-col h-full min-h-[220px]'
          )}
        >
          <div className="flex flex-col h-full">
            <div className="flex gap-3 mb-4">
              <AgentAvatar
                src={imageUrl as string}
                name={displayName as string}
                network={agent.network}
                size="md"
                category={category}
              />

              <div className="flex-1 min-w-0 flex flex-col relative pr-6">
                {availability && (
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            'absolute top-0 right-0 h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white dark:ring-gray-900',
                            availabilityIndicatorClasses[availability.status] ||
                              availabilityIndicatorClasses.unknown
                          )}
                          aria-label={`Agent availability ${availability.status}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="left" align="center" className="text-xs leading-relaxed max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {availability.status === 'online' ? 'Online' : availability.status === 'offline' ? 'Offline' : 'Unknown'}
                          </p>
                          {availability.latencyMs !== undefined && (
                            <p className="text-gray-600 dark:text-gray-300">
                              Latency: {availability.latencyMs}ms
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <div className="flex items-center gap-1.5 mb-2">
                  <div className="flex items-center justify-center w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {isMcp ? <FaServer className="w-4 h-4" /> : <FaRobot className="w-4 h-4" />}
                  </div>
                  <div className="flex items-baseline gap-1 min-w-0">
                    <Typography
                      variant="h4"
                      className="text-gray-800 dark:text-gray-200 group-hover:text-brand-blue dark:group-hover:text-brand-green transition-colors line-clamp-1 font-medium !text-base leading-tight min-w-0"
                    >
                      {displayName as string}
                    </Typography>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Typography variant="body2" color="muted" className="!text-xs">
                    {protocolLabel}
                    {hasErc8004 ? ' • ERC-8004' : null}
                    {agent.metadata?.version ? ` • v${String(agent.metadata.version)}` : null}
                  </Typography>
                  {trustScore !== undefined && trustScore !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200 px-2 py-0.5 text-[10px] font-semibold">
                      <FaStar className="w-2.5 h-2.5 text-yellow-500" />
                      {Math.round(trustScore)}
                    </span>
                  )}
                </div>

                <div className="py-3">
                  <Typography variant="body2" className="line-clamp-2 !text-xs leading-snug text-gray-500 dark:text-gray-400">
                    {description as string}
                  </Typography>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect(agent);
                }}
                className="text-xs"
              >
                Connect
              </Button>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {capabilities.slice(0, 2).map((cap) => (
                  <Badge
                    key={cap}
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 font-normal text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                  >
                    {capabilityLabels[cap] || `Cap ${cap}`}
                  </Badge>
                ))}
                {capabilities.length > 2 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 font-normal text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                  >
                    +{capabilities.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-200 rounded-b-lg" />
        </div>
      </div>
    </div>
  );
};

interface AgentListItemProps {
  agent: AgentProfile;
  onQuickView: (agent: AgentProfile) => void;
  onConnect: (agent: AgentProfile) => void;
}

const AgentListItem: React.FC<AgentListItemProps> = ({ agent, onQuickView, onConnect }) => {
  const displayName =
    agent.name ||
    (agent.metadata as Record<string, unknown>)?.display_name ||
    (agent.metadata as Record<string, unknown>)?.alias ||
    'Unknown Agent';
  const description =
    agent.description ||
    (agent.metadata as Record<string, unknown>)?.bio ||
    'No description available';
  const imageUrl =
    agent.profileImage ||
    (agent.metadata as Record<string, unknown>)?.profileImage ||
    (agent.metadata as Record<string, unknown>)?.logo;
  const capabilities = agent.capabilities || [];
  const registry = agent.registry || 'unknown';
  const isMcp = registry === 'mcp' || agent.protocols?.includes('mcp');
  const category = isMcp ? 'mcp-server' : 'ai-agent';

  const protocolLabel = (() => {
    const protocols = agent.protocols || [];
    if (protocols.includes('a2a')) return 'A2A';
    if (protocols.includes('mcp')) return 'MCP';
    if (protocols.includes('uagent')) return 'uAgent';
    return registry.toUpperCase();
  })();

  const hasErc8004 = agent.protocols?.includes('erc-8004') || false;
  const availability = agent.availability;

  return (
    <div onClick={() => onQuickView(agent)} className="block group cursor-pointer">
      <div
        className={cn(
          'flex items-center gap-3 bg-white dark:bg-gray-900/80 rounded-lg p-3',
          'border border-gray-200 dark:border-gray-800',
          'hover:shadow-md hover:border-brand-blue/50 dark:hover:border-brand-green/50 transition-all'
        )}
      >
        <AgentAvatar
          src={imageUrl as string}
          name={displayName as string}
          network={agent.network}
          size="md"
          category={category}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex items-center justify-center w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0">
              {isMcp ? <FaServer className="w-4 h-4" /> : <FaRobot className="w-4 h-4" />}
            </div>
            <div className="flex items-baseline gap-1 min-w-0">
              <Typography
                variant="h4"
                className="text-gray-800 dark:text-gray-200 group-hover:text-brand-blue dark:group-hover:text-brand-green transition-colors font-medium !text-base leading-tight line-clamp-1 break-words min-w-0"
              >
                {displayName as string}
              </Typography>
            </div>
          </div>

          <Typography variant="body2" color="muted" className="line-clamp-1 !text-xs leading-snug mb-2">
            {description as string}
          </Typography>

          <div className="mb-2">
            <Typography variant="body2" color="muted" className="!text-xs">
              {protocolLabel}
              {hasErc8004 ? ' • ERC-8004' : null}
              {agent.metadata?.version ? ` • v${String(agent.metadata.version)}` : null}
            </Typography>
          </div>

          {availability && (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
                  availability.status === 'online'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : availability.status === 'offline'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                )}
              >
                {availability.status === 'online' ? 'Online' : availability.status === 'offline' ? 'Offline' : 'Unknown'}
                {availability.latencyMs !== undefined && <span>{availability.latencyMs}ms</span>}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onConnect(agent);
            }}
            className="text-xs"
          >
            Connect
          </Button>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {capabilities.slice(0, 2).map((cap) => (
              <Badge
                key={cap}
                variant="outline"
                className="text-[10px] px-2 py-0.5 font-normal text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"
              >
                {capabilityLabels[cap] || `Cap ${cap}`}
              </Badge>
            ))}
            {capabilities.length > 2 && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 font-normal text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"
              >
                +{capabilities.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSearch, placeholder }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Search for AI agents...'}
          className="relative z-10 h-14 pl-6 pr-14 text-base rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 focus-visible:outline-none transition-all duration-300 placeholder:text-gray-500 dark:placeholder:text-gray-400 shadow-none"
        />
        <Button
          type="submit"
          size="icon"
          className="absolute right-2 top-2 h-10 w-10 z-20 rounded-full bg-brand-blue hover:bg-brand-blue/90 transition-colors"
        >
          <FaSearch className="h-4 w-4 text-white" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
    </form>
  );
};

const AgentDiscoveryPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'best-match' | 'most-recent' | 'trust-score' | 'name'>('trust-score');
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAgentToConnect, setSelectedAgentToConnect] = useState<AgentProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    pageSize: 50,
    totalCount: 0,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);

  const discoverAgents = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      const page = reset ? 1 : pagination.currentPage;

      const result = await discoverAgentsFromBroker({
        q: searchQuery || undefined,
        limit: pagination.pageSize,
        page,
      });

      if (result.success && result.data) {
        const fetchedAgents: AgentProfile[] = result.data.agents.map((agent) => ({
          id: agent.uaid,
          uaid: agent.uaid,
          accountId: agent.accountId || agent.uaid,
          name: agent.name,
          description: agent.description,
          registry: agent.registry,
          profileImage: agent.profileImage,
          capabilities: agent.capabilities,
          protocols: agent.protocols,
          metadata: agent.metadata,
          rating: agent.rating,
          ratingCount: agent.ratingCount,
          network: agent.network,
          createdAt: agent.createdAt,
          trustScore: agent.trustScore,
        }));

        if (reset) {
          setAgents(fetchedAgents);
        } else {
          setAgents((prev) => [...prev, ...fetchedAgents]);
        }

        setPagination({
          currentPage: result.data.pagination.currentPage,
          totalPages: result.data.pagination.totalPages,
          pageSize: result.data.pagination.limit,
          totalCount: result.data.pagination.total,
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
      setIsFetchingMore(false);
    }
  }, [searchQuery, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    discoverAgents(true);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setTimeout(() => discoverAgents(true), 0);
  }, [discoverAgents]);

  const handleQuickView = useCallback((agent: AgentProfile) => {
    setSelectedAgent(agent);
    setIsProfileModalOpen(true);
  }, []);

  const handleConnect = useCallback((agent: AgentProfile) => {
    setSelectedAgentToConnect(agent);
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmConnect = useCallback(async () => {
    if (!selectedAgentToConnect) return;

    try {
      setIsConnecting(true);
      setShowConfirmDialog(false);

      const result = await window?.desktop?.invoke('hcs10_send_connection_request', {
        targetAccountId: selectedAgentToConnect.accountId,
      });

      if (result?.success) {
        toast.success('Connection Request Sent', {
          description: 'Your connection request has been sent to the agent',
        });
      } else {
        toast.error('Connection Failed', {
          description: result?.error || 'Failed to send connection request',
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

  const handleCancelConnect = useCallback(() => {
    setShowConfirmDialog(false);
    setSelectedAgentToConnect(null);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
    setSelectedAgent(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages && !isFetchingMore) {
      setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }));
      discoverAgents(false);
    }
  }, [pagination, isFetchingMore, discoverAgents]);

  const hasMoreResults = pagination.currentPage < pagination.totalPages;

  const skeletonCounts = useMemo(() => {
    const base = viewMode === 'grid' ? 8 : 4;
    const append = viewMode === 'grid' ? 4 : 2;
    return { base, append };
  }, [viewMode]);

  const renderSkeletons = (count: number, keyPrefix: string) =>
    Array.from({ length: count }).map((_, index) =>
      viewMode === 'grid' ? (
        <div key={`${keyPrefix}-grid-${index}`} className="h-full">
          <div className="relative bg-white dark:bg-gray-900/80 rounded-lg p-5 border border-gray-200 dark:border-gray-800 shadow-sm animate-pulse flex flex-col h-full min-h-[220px]">
            <div className="flex flex-col h-full">
              <div className="flex gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col relative pr-6">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-3/4" />
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-1/2" />
                    <div className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="py-3 space-y-2">
                    <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-full" />
                    <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-4/5" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          key={`${keyPrefix}-list-${index}`}
          className="bg-white dark:bg-gray-900/80 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm animate-pulse min-h-[80px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-1/3" />
                <div className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-2/3" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>
      )
    );

  const showInitialSkeletons = agents.length === 0 && isLoading;
  const appendSkeletons = isFetchingMore && agents.length > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1b2e] font-sans text-gray-900 dark:text-white transition-colors duration-300 selection:bg-brand-purple selection:text-white">
      <ScrollProgress />
      <div className="fixed inset-0 pointer-events-none opacity-30 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150 mix-blend-overlay" />
      <NetworkBackground />

      <div className="relative z-10 container mx-auto px-6 2xl:px-8 max-w-[1600px] py-12 lg:py-16 min-h-[1200px]">
        <SearchHeader
          query={searchQuery}
          totalCount={agents.length}
          globalTotal={pagination.totalCount}
        />

        <div className="max-w-[1800px] mx-auto">
          <div className="flex gap-8 min-h-[800px]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSearch={handleSearch}
                    placeholder="Search"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1a1b2e]/30 p-1 rounded-lg border border-gray-200 dark:border-white/10 h-10">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md transition-all',
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-[#1a1b2e]/80 text-brand-blue border border-brand-blue/30'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                      title="Grid view"
                    >
                      <FaTh className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md transition-all',
                        viewMode === 'list'
                          ? 'bg-white dark:bg-[#1a1b2e]/80 text-brand-blue border border-brand-blue/30'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                      title="List view"
                    >
                      <FaList className="w-4 h-4" />
                    </button>
                  </div>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="w-[180px] bg-gray-100 dark:bg-[#1a1b2e]/50 border-none h-10">
                      <div className="flex items-center gap-2">
                        <FaSortAmountDown className="w-3.5 h-3.5" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best-match">Best Match</SelectItem>
                      <SelectItem value="most-recent">Most Recent</SelectItem>
                      <SelectItem value="trust-score">Trust Score</SelectItem>
                      <SelectItem value="name">Name (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => discoverAgents(true)}
                    disabled={isLoading}
                    className="h-10 border-gray-200 dark:border-gray-700/50 hover:border-brand-blue"
                  >
                    <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
              </div>

              {showInitialSkeletons ? (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 min-h-[600px]'
                      : 'space-y-4 min-h-[600px]'
                  }
                >
                  {renderSkeletons(skeletonCounts.base, 'initial')}
                </div>
              ) : agents.length > 0 ? (
                <>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 min-h-[600px]">
                      {agents.map((agent) => (
                        <AgentCard
                          key={agent.id || agent.accountId}
                          agent={agent}
                          onQuickView={handleQuickView}
                          onConnect={handleConnect}
                        />
                      ))}
                      {appendSkeletons && renderSkeletons(skeletonCounts.append, 'fetch-grid')}
                    </div>
                  ) : (
                    <div className="space-y-4 min-h-[600px]">
                      {agents.map((agent) => (
                        <AgentListItem
                          key={agent.id || agent.accountId}
                          agent={agent}
                          onQuickView={handleQuickView}
                          onConnect={handleConnect}
                        />
                      ))}
                      {appendSkeletons && renderSkeletons(skeletonCounts.append, 'fetch-list')}
                    </div>
                  )}

                  {isFetchingMore && (
                    <div className="flex justify-center items-center py-12" data-loading-next="true">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-4 border-gray-300 dark:border-gray-600 border-t-brand-blue rounded-full animate-spin" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Loading more agents…
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={sentinelRef} className="h-px w-full" data-load-sentinel="true" aria-hidden="true" />

                  {hasMoreResults && !isFetchingMore && (
                    <div className="mt-8 flex flex-col items-center gap-3">
                      <Button onClick={handleLoadMore} disabled={!hasMoreResults || isFetchingMore || isLoading} variant="outline">
                        Load more results
                      </Button>
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        Page {pagination.currentPage} of {pagination.totalPages} • {pagination.totalCount.toLocaleString()} total agents
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <FaRobot className="w-8 h-8 text-gray-400" />
                  </div>
                  <Typography variant="h4" className="mb-2">
                    No agents found
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4">
                    Try adjusting your search terms or filters
                  </Typography>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        handleSearch('');
                      }}
                      className="text-brand-blue hover:text-brand-blue/80"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AgentProfileModal
        agent={selectedAgent}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        onConnect={(accountId: string) => {
          const agent = agents.find((a) => a.accountId === accountId);
          if (agent) handleConnect(agent);
        }}
      />

      <ConnectionConfirmDialog
        isOpen={showConfirmDialog}
        agent={selectedAgentToConnect}
        isConnecting={isConnecting}
        onConfirm={handleConfirmConnect}
        onCancel={handleCancelConnect}
      />
    </div>
  );
};

export default AgentDiscoveryPage;
