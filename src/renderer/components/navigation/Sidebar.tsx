import React, { useState, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, Location } from 'react-router-dom';
import { cn } from '../../lib/utils';
import Logo from '../ui/Logo';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import {
  FiChevronLeft,
  FiChevronRight,
  FiSend,
  FiRefreshCw,
  FiMessageSquare,
  FiPlus,
  FiUserPlus,
  FiTool,
} from 'react-icons/fi';
import {
  HiChatBubbleBottomCenterText,
  HiServerStack,
  HiPuzzlePiece,
  HiCog6Tooth,
  HiQuestionMarkCircle,
  HiLink,
  HiMagnifyingGlass,
  HiUserCircle,
  HiHeart,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';
import { toast } from 'sonner';
import { useHCS10 } from '../../contexts/HCS10Context';
import { SessionCreationModal } from '../chat/SessionCreationModal';
import AgentItem from './AgentItem';
import ConnectionRequestItem from './ConnectionRequestItem';
import NavItem from './NavItem';

// Use the ConnectionRequest type from HCS10Context
interface ConnectionRequest {
  id: string;
  requesting_account_id: string;
  sequence_number: number;
  memo?: string;
  operator_id?: string;
}

interface NavigationState {
  [key: string]: boolean;
}

interface SidebarProps {
  className?: string;
}

interface NavSubItem {
  id: string;
  path: string;
  label: string;
  icon: IconType;
  description?: string;
  gradient?: string;
}

interface NavItemType {
  id: string;
  path: string;
  label: string;
  icon: IconType;
  description?: string;
  gradient?: string;
  iconBg?: string;
  subItems?: NavSubItem[];
}

const primaryNavItems: NavItemType[] = [
  {
    id: 'discover',
    path: '/discover',
    label: 'Discover',
    icon: HiMagnifyingGlass,
    description: 'Find new agents',
    gradient: 'from-[#ff9b50] to-[#ff6b6b]',
    iconBg: 'from-[#ff9b50] to-[#ff6b6b]',
  },
  {
    id: 'connections',
    path: '/connections',
    label: 'Connections',
    icon: HiLink,
    description: 'Manage connections',
    gradient: 'from-[#4facfe] to-[#00f2fe]',
    iconBg: 'from-[#4facfe] to-[#00f2fe]',
  },
  {
    id: 'mcp',
    path: '/mcp',
    label: 'MCP Servers',
    icon: HiServerStack,
    description: 'Manage MCP connections',
    gradient: 'from-[#5eef81] to-[#48df7b]',
    iconBg: 'from-[#5eef81] to-[#48df7b]',
  },
  {
    id: 'plugins',
    path: '/plugins',
    label: 'Plugins',
    icon: HiPuzzlePiece,
    description: 'Extend functionality',
    gradient: 'from-[#7eb9ff] to-[#5599fe]',
    iconBg: 'from-[#7eb9ff] to-[#5599fe]',
  },
  {
    id: 'tools',
    path: '/tools',
    label: 'Tools',
    icon: FiTool,
    description: 'Development tools',
    gradient: 'from-[#ff9b50] to-[#ff6b6b]',
    iconBg: 'from-[#ff9b50] to-[#ff6b6b]',
  },
  {
    id: 'hcs10',
    path: '/hcs10-profile',
    label: 'My Profile',
    icon: HiUserCircle,
    description: 'Manage your profile',
    gradient: 'from-[#6b73c1] to-[#5054a1]',
    iconBg: 'from-[#6b73c1] to-[#5054a1]',
  },
];

const secondaryNavItems: NavItemType[] = [
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: HiCog6Tooth,
    description: 'Configure your workspace',
    gradient: 'from-gray-500 to-gray-600',
    iconBg: 'from-gray-500 to-gray-600',
  },
  {
    id: 'help',
    path: '/help',
    label: 'Help & Docs',
    icon: HiQuestionMarkCircle,
    description: 'Get support',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'acknowledgements',
    path: '/acknowledgements',
    label: 'Acknowledgements',
    icon: HiHeart,
    description: 'Credits & licenses',
    gradient: 'from-pink-500 to-rose-600',
    iconBg: 'from-pink-500 to-rose-600',
  },
  {
    id: 'telegram',
    path: 'https://t.me/hashgraphonline',
    label: 'Telegram',
    icon: FiSend,
    description: 'Join our community',
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'from-cyan-500 to-blue-600',
  },
];

const SidebarContent: React.FC<SidebarProps & { location: Location }> = React.memo(
  ({ className, location }) => {
    const navigate = useNavigate();
    const {
      agents,
      connectionRequests,
      isLoadingAgents,
      activeTopicId,
      refreshConnections,

      onSelectAgent,
      onAcceptRequest,
      onRejectRequest,
    } = useHCS10();

    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
      {}
    );
    const [expandedSections, setExpandedSections] = useState<NavigationState>(
      {}
    );
    const [isSessionCreationModalOpen, setIsSessionCreationModalOpen] =
      useState(false);
    const isActive = (path: string) => {
      if (path === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(path);
    };

    const handleRefresh = useCallback(async () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      try {
        await refreshConnections();
      } catch {
        // Silently handle refresh errors
      }
      setTimeout(() => setIsRefreshing(false), 1500);
    }, [isRefreshing, refreshConnections]);

    const activeAgents = useMemo(() => {
      return agents.filter((agent) => agent.type === 'active');
    }, [agents]);

    const runAction = useCallback(
      async (actionId: string, actionFn: () => Promise<void>) => {
        setActionLoading((prev) => ({ ...prev, [actionId]: true }));
        try {
          await actionFn();
        } catch {
          // Action errors are handled elsewhere
        } finally {
          setActionLoading((prev) => ({ ...prev, [actionId]: false }));
        }
      },
      []
    );

    const handleAccept = useCallback(
      (request: ConnectionRequest) =>
        runAction(
          `accept_${request.sequence_number}`,
          async () => {
            if (onAcceptRequest) {
              await onAcceptRequest(request);
            }
          }
        ),
      [runAction, onAcceptRequest]
    );

    const handleReject = useCallback(
      (request: ConnectionRequest) =>
        runAction(
          `reject_${request.sequence_number}`,
          async () => {
            if (onRejectRequest) {
              await onRejectRequest(request);
            }
          }
        ),
      [runAction, onRejectRequest]
    );

    const toggleNavSection = useCallback((sectionId: string) => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionId]: !prev[sectionId],
      }));
    }, []);

    const isActiveAgent = useCallback(
      (agentId: string) => activeTopicId === agentId,
      [activeTopicId]
    );

    const handleStartPersonalChat = useCallback(() => {
      setIsSessionCreationModalOpen(true);
    }, []);

    const handleSessionCreated = useCallback(
      async () => {
        try {
          navigate('/chat');
          toast.success('New session created successfully!');
        } catch {
          // Navigation errors are handled by router
        }
        setIsSessionCreationModalOpen(false);
      },
      [navigate]
    );

    const formatTimestamp = useCallback(
      (timestamp: Date | number | undefined) => {
        if (!timestamp) return '';
        const date =
          typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
      },
      []
    );

    return (
      <aside
        className={cn(
          'h-full bg-white/95 dark:bg-black/40 backdrop-blur-xl border-r border-gray-200/50 dark:border-white/[0.06]',
          'flex flex-col relative overflow-hidden transition-all duration-300',
          isCollapsed ? 'w-24' : 'w-72',
          className
        )}
      >
        <div className='absolute inset-0 opacity-[0.03] dark:opacity-[0.02]'>
          <div className='absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#a679f0] to-[#5599fe] rounded-full blur-3xl animate-pulse' />
          <div
            className='absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#48df7b] to-[#5599fe] rounded-full blur-3xl animate-pulse'
            style={{ animationDelay: '2s' }}
          />
        </div>
        <div className='relative p-4 border-b border-gray-200/50 dark:border-white/[0.06]'>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'absolute top-2 right-2 w-7 h-7',
              'bg-white/90 dark:bg-gray-800/90',
              'border border-gray-200 dark:border-gray-700',
              'rounded-md flex items-center justify-center shadow-sm hover:shadow-md',
              'transition-all duration-300 hover:scale-105 z-10',
              'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
              'backdrop-blur-sm'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <FiChevronRight className='w-3 h-3' />
            ) : (
              <FiChevronLeft className='w-3 h-3' />
            )}
          </button>

          {isCollapsed ? (
            <Link to='/dashboard' className='flex justify-center pt-2 group'>
              <Logo
                variant='icon'
                size='md-lg'
                className='transform transition-transform duration-200 group-hover:scale-105'
              />
            </Link>
          ) : (
            <div className='flex justify-start px-4'>
              <Link to='/dashboard' className='group'>
                <Logo
                  size='lg'
                  className='transform transition-transform duration-200 group-hover:scale-105'
                />
              </Link>
            </div>
          )}
        </div>

        <nav className='relative flex-1 p-4 space-y-2 overflow-y-auto'>
          {!isCollapsed && (
            <Link
              to='/chat'
              className={cn(
                'group relative flex items-center gap-4 rounded-2xl transition-all duration-300 px-4 py-3.5',
                'hover:translate-x-1 hover:scale-[1.02] mb-4',
                isActive('/chat')
                  ? 'bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg'
                  : 'hover:bg-gray-100/50 dark:hover:bg-white/5'
              )}
            >
              {isActive('/chat') && (
                <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-[#a679f0] via-[#5599fe] to-[#48df7b] rounded-r-full shadow-[0_0_20px_rgba(85,153,254,0.8)]' />
              )}
              <div
                className={cn(
                  'relative rounded-xl flex items-center justify-center transition-all duration-300 w-10 h-10',
                  isActive('/chat')
                    ? 'bg-gradient-to-br from-[#c89fff] to-[#a679f0] text-white shadow-2xl shadow-[#5599fe]/30'
                    : 'bg-gradient-to-br from-[#c89fff] to-[#a679f0] opacity-70 text-white group-hover:scale-110 group-hover:rotate-3 group-hover:opacity-100'
                )}
              >
                <HiChatBubbleBottomCenterText className='w-5 h-5' />
              </div>
              <div className='flex-1 min-w-0'>
                <div
                  className={cn(
                    'text-sm font-semibold leading-tight font-mono tracking-wide',
                    isActive('/chat')
                      ? 'text-transparent bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text'
                      : 'text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text'
                  )}
                >
                  Personal Assistant
                </div>
                <div
                  className={cn(
                    'text-xs leading-tight font-mono opacity-75 transition-colors duration-300',
                    isActive('/chat')
                      ? 'text-gray-600 dark:text-gray-300'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  )}
                >
                  Your private AI assistant
                </div>
              </div>
            </Link>
          )}

          {!isCollapsed && (
            <div className='border-t border-gray-200/50 dark:border-white/[0.06] my-4' />
          )}

          {!isCollapsed && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between px-2 py-1'>
                <div className='flex items-center gap-2'>
                  <div className='w-6 h-6 rounded-lg bg-gradient-to-br from-[#7eb9ff] to-[#5599fe] flex items-center justify-center'>
                    <FiMessageSquare className='w-3 h-3 text-white' />
                  </div>
                  <Typography
                    variant='caption'
                    className='font-medium text-gray-900 dark:text-white text-xs uppercase tracking-wider'
                  >
                    Conversations{' '}
                    {activeAgents.length > 0 && `(${activeAgents.length})`}
                  </Typography>
                </div>

                <div className='flex gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={handleStartPersonalChat}
                    className='h-6 w-6 rounded-md'
                    title='Start new chat'
                  >
                    <FiPlus className='h-3 w-3' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className='h-6 w-6 rounded-md'
                    title='Refresh connections'
                  >
                    <FiRefreshCw
                      className={cn('h-3 w-3', isRefreshing && 'animate-spin')}
                    />
                  </Button>
                </div>
              </div>

              <div className='px-1 space-y-0.5'>
                {isLoadingAgents ? (
                  <div className='flex items-center justify-center py-3'>
                    <FiRefreshCw className='w-3 h-3 animate-spin text-gray-400' />
                    <Typography
                      variant='caption'
                      className='ml-2 text-gray-500 text-xs'
                    >
                      Loading...
                    </Typography>
                  </div>
                ) : activeAgents.length > 0 ? (
                  activeAgents.map((agent) => (
                    <AgentItem
                      key={agent.id}
                      agent={agent}
                      isSelected={isActiveAgent(agent.id)}
                      onSelect={onSelectAgent!}
                      formatTimestamp={formatTimestamp}
                    />
                  ))
                ) : (
                  <div className='text-center py-3'>
                    <FiMessageSquare className='w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1' />
                    <Typography
                      variant='caption'
                      className='text-gray-500 dark:text-gray-400 text-xs block'
                    >
                      No active conversations
                    </Typography>
                    <Typography
                      variant='caption'
                      className='text-gray-400 dark:text-gray-500 text-[10px] block'
                    >
                      Use Discover to find agents
                    </Typography>
                  </div>
                )}
              </div>

              {connectionRequests.length > 0 && (
                <>
                  <div className='border-t border-gray-200/50 dark:border-white/[0.06] pt-2 mt-2'>
                    <div className='flex items-center gap-2 px-2 py-1 mb-2'>
                      <div className='w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                        <FiUserPlus className='w-3 h-3 text-white' />
                      </div>
                      <Typography
                        variant='caption'
                        className='font-medium text-gray-900 dark:text-white text-xs uppercase tracking-wider'
                      >
                        Requests ({connectionRequests.length})
                      </Typography>
                    </div>
                    <div className='px-1 space-y-0.5'>
                      {connectionRequests.map((request) => (
                        <ConnectionRequestItem
                          key={request.id}
                          request={request}
                          actionLoading={actionLoading}
                          onAccept={handleAccept}
                          onReject={handleReject}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className='space-y-2'>
            {primaryNavItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive}
                isCollapsed={isCollapsed}
                expandedSections={expandedSections}
                onToggleSection={toggleNavSection}
              />
            ))}
          </div>
        </nav>

        <div className='relative border-t border-gray-200/50 dark:border-white/[0.06]'>
          <div className='p-4 space-y-2'>
            {secondaryNavItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive}
                isCollapsed={isCollapsed}
                expandedSections={expandedSections}
                onToggleSection={toggleNavSection}
              />
            ))}
          </div>
        </div>

        <SessionCreationModal
          isOpen={isSessionCreationModalOpen}
          onClose={() => setIsSessionCreationModalOpen(false)}
          onSessionCreated={handleSessionCreated}
        />
      </aside>
    );
  }
);

const Sidebar: React.FC<SidebarProps> = React.memo((props) => {
  const location = useLocation();
  return <SidebarContent {...props} location={location} />;
});

export default Sidebar;
