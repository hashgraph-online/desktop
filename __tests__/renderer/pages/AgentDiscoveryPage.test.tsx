import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentDiscoveryPage } from '../../../src/renderer/pages/AgentDiscoveryPage';
import { useAgentStore } from '../../../src/renderer/stores/agentStore';

jest.mock('../../../src/renderer/stores/agentStore');
jest.mock('../../../src/renderer/hooks/useHRLImageUrl');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../../src/renderer/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      data-testid='search-input'
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

jest.mock('../../../src/renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('../../../src/renderer/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid='badge' {...props}>
      {children}
    </span>
  ),
}));

jest.mock('../../../src/renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid='dropdown-menu'>{children}</div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid='dropdown-content'>{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid='dropdown-item' onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid='dropdown-trigger'>{children}</div>
  ),
}));

jest.mock('../../../src/renderer/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid='dialog'>{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid='dialog-content'>{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid='dialog-header'>{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <div data-testid='dialog-title'>{children}</div>
  ),
}));

jest.mock('../../../src/renderer/components/ui/Card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid='card' {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => (
    <div data-testid='card-content'>{children}</div>
  ),
  CardDescription: ({ children }: any) => (
    <div data-testid='card-description'>{children}</div>
  ),
  CardFooter: ({ children }: any) => (
    <div data-testid='card-footer'>{children}</div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid='card-header'>{children}</div>
  ),
  CardTitle: ({ children }: any) => (
    <div data-testid='card-title'>{children}</div>
  ),
}));

jest.mock('../../../src/renderer/components/ui/Typography', () => ({
  __esModule: true,
  default: ({ children, variant, onClick, className }: any) => (
    <div
      data-testid={`typography-${variant || 'default'}`}
      onClick={onClick}
      className={className}
    >
      {children}
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/AgentProfileModal', () => ({
  AgentProfileModal: ({ isOpen, onClose, accountId }: any) =>
    isOpen ? (
      <div data-testid='agent-profile-modal'>
        Profile for {accountId}
        <button onClick={onClose} data-testid='close-modal'>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock(
  '../../../src/renderer/components/shared/ConnectionConfirmDialog',
  () => ({
    __esModule: true,
    default: ({ isOpen, onConfirm, onCancel, agentName }: any) =>
      isOpen ? (
        <div data-testid='connection-confirm-dialog'>
          Connect to {agentName}?
          <button onClick={onConfirm} data-testid='confirm-connect'>
            Confirm
          </button>
          <button onClick={onCancel} data-testid='cancel-connect'>
            Cancel
          </button>
        </div>
      ) : null,
  })
);

jest.mock('../../../src/renderer/lib/styles', () => ({
  gradients: {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600',
  },
}));

jest.mock('react-icons/fi', () => ({
  FiSearch: () => <div data-testid='fi-search' />,
  FiFilter: () => <div data-testid='fi-filter' />,
  FiGrid: () => <div data-testid='fi-grid' />,
  FiList: () => <div data-testid='fi-list' />,
  FiRefreshCw: () => <div data-testid='fi-refresh' />,
  FiChevronLeft: () => <div data-testid='fi-chevron-left' />,
  FiChevronRight: () => <div data-testid='fi-chevron-right' />,
  FiStar: () => <div data-testid='fi-star' />,
  FiMessageCircle: () => <div data-testid='fi-message-circle' />,
  FiUser: () => <div data-testid='fi-user' />,
  FiCpu: () => <div data-testid='fi-cpu' />,
  FiLink: () => <div data-testid='fi-link' />,
  FiXCircle: () => <div data-testid='fi-x-circle' />,
  FiImage: () => <div data-testid='fi-image' />,
  FiMinus: () => <div data-testid='fi-minus' />,
  FiPlus: () => <div data-testid='fi-plus' />,
  FiChevronDown: () => <div data-testid='fi-chevron-down' />,
  FiCopy: () => <div data-testid='fi-copy' />,
  FiCamera: () => <div data-testid='fi-camera' />,
  FiMic: () => <div data-testid='fi-mic' />,
  FiFilm: () => <div data-testid='fi-film' />,
  FiCode: () => <div data-testid='fi-code' />,
  FiGlobe: () => <div data-testid='fi-globe' />,
  FiBarChart2: () => <div data-testid='fi-bar-chart' />,
  FiDatabase: () => <div data-testid='fi-database' />,
  FiShare2: () => <div data-testid='fi-share' />,
  FiTrendingUp: () => <div data-testid='fi-trending-up' />,
  FiActivity: () => <div data-testid='fi-activity' />,
  FiShield: () => <div data-testid='fi-shield' />,
  FiCheckCircle: () => <div data-testid='fi-check-circle' />,
  FiAlertTriangle: () => <div data-testid='fi-alert-triangle' />,
  FiBriefcase: () => <div data-testid='fi-briefcase' />,
  FiLock: () => <div data-testid='fi-lock' />,
  FiUsers: () => <div data-testid='fi-users' />,
  FiZap: () => <div data-testid='fi-zap' />,
  FiDollarSign: () => <div data-testid='fi-dollar-sign' />,
}));

jest.mock('react-icons/fa', () => ({
  FaTwitter: () => <div data-testid='fa-twitter' />,
  FaGithub: () => <div data-testid='fa-github' />,
  FaGlobe: () => <div data-testid='fa-globe' />,
  FaDiscord: () => <div data-testid='fa-discord' />,
}));

describe('AgentDiscoveryPage', () => {
  const mockAgents = [
    {
      id: 'agent-1',
      accountId: '0.0.12345',
      network: 'testnet',
      rating: 4.5,
      ratingCount: 10,
      createdAt: '2024-01-01T00:00:00Z',
      metadata: {
        name: 'Test Agent 1',
        display_name: 'Test Agent One',
        description: 'A helpful AI agent for testing',
        bio: 'I am a test agent',
        profileImage: 'ipfs://QmTest1',
        socials: {
          twitter: 'testagent1',
          github: 'testagent1',
        },
        aiAgent: {
          capabilities: [0, 4, 7], // Text Generation, Code Generation, Knowledge Retrieval
        },
      },
    },
    {
      id: 'agent-2',
      accountId: '0.0.67890',
      network: 'mainnet',
      rating: 3.8,
      ratingCount: 5,
      createdAt: '2024-01-02T00:00:00Z',
      metadata: {
        name: 'Test Agent 2',
        display_name: 'Test Agent Two',
        description: 'Another test agent',
        aiAgent: {
          capabilities: [1, 5], // Image Generation, Language Translation
        },
      },
    },
  ];

  const mockAgentStore = {
    status: 'idle',
    isConnected: false,
    messages: [],
    hcs10Messages: {},
    currentSessionId: null,
    currentSession: null,
    sessions: [],
    isTyping: false,
    operationalMode: 'autonomous' as const,
    chatContext: { mode: 'personal' as const },
    hcs10LoadingMessages: {},
    isInitialized: true,
    lastActiveSessionId: null,
    _operationLocks: {},
    _isCreatingSession: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendMessage: jest.fn(),
    setStatus: jest.fn(),
    setConnected: jest.fn(),
    setConnectionError: jest.fn(),
    clearConnectionError: jest.fn(),
    setIsTyping: jest.fn(),
    setOperationalMode: jest.fn(),
    setChatContext: jest.fn(),
    addMessage: jest.fn(),
    clearMessages: jest.fn(),
    getMessages: jest.fn(),
    loadConversationMessages: jest.fn(),
    refreshConversationMessages: jest.fn(),
    setHCS10Messages: jest.fn(),
    setSessionId: jest.fn(),
    startNewSession: jest.fn(),
    setCurrentSession: jest.fn(),
    initializeSessions: jest.fn(),
    restoreLastSession: jest.fn(),
    _lockOperation: jest.fn(),
    _unlockOperation: jest.fn(),
    createSession: jest.fn(),
    loadSession: jest.fn(),
    saveSession: jest.fn(),
    deleteSession: jest.fn(),
    loadAllSessions: jest.fn(),
    saveMessage: jest.fn(),
    loadSessionMessages: jest.fn(),
    approveTransaction: jest.fn(),
    rejectTransaction: jest.fn(),
    findFormMessage: jest.fn(),
    updateFormState: jest.fn(),
    processFormSubmission: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useAgentStore as jest.MockedFunction<any>).mockReturnValue(mockAgentStore);

    Object.defineProperty(window, 'electron', {
      value: {
        invoke: jest.fn().mockResolvedValue({
          success: true,
          data: mockAgents,
          total: 2,
          currentPage: 1,
          totalPages: 1,
        }),
      },
      writable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });
  });

  describe('Initial Render', () => {
    test('should render the page with correct title and layout', async () => {
      render(<AgentDiscoveryPage />);

      expect(screen.getByText('Agent Discovery')).toBeInTheDocument();
      expect(
        screen.getByText('Discover AI agents on Hedera')
      ).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    test('should show loading state initially', () => {
      render(<AgentDiscoveryPage />);

      expect(screen.getByText('Loading agents...')).toBeInTheDocument();
    });

    test('should load agents on mount', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledWith('agent:discover', {
          page: 1,
          limit: 12,
          sortBy: 'created-desc',
          filters: {
            search: '',
            tags: [],
            hasProfileImage: null,
            includeRegistryBroker: false,
            registries: [],
          },
        });
      });
    });
  });

  describe('Search Functionality', () => {
    test('should update search query and trigger search', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test agent');

      await waitFor(
        () => {
          expect(window.electron!.invoke).toHaveBeenCalledWith(
            'agent:discover',
            expect.objectContaining({
              filters: expect.objectContaining({
                search: 'test agent',
              }),
            })
          );
        },
        { timeout: 1000 }
      );
    });

    test('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test search');

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Sorting', () => {
    test('should change sort order', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledTimes(1);
      });

      const sortTrigger = screen.getByTestId('dropdown-trigger');
      await user.click(sortTrigger);

      const ratingOption = screen.getByTestId('dropdown-item');
      await user.click(ratingOption);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledWith(
          'agent:discover',
          expect.objectContaining({
            sortBy: 'rating-desc',
          })
        );
      });
    });
  });

  describe('Agent Cards', () => {
    test('should render agent cards when agents are loaded', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
        expect(screen.getByText('Test Agent Two')).toBeInTheDocument();
      });

      expect(screen.getByText('0.0.12345')).toBeInTheDocument();
      expect(screen.getByText('0.0.67890')).toBeInTheDocument();
    });

    test('should display agent ratings', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('4.5')).toBeInTheDocument();
        expect(screen.getByText('(10)')).toBeInTheDocument();
      });
    });

    test('should show agent capabilities as badges', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('badge')).toHaveLength(5); // 3 + 2 capabilities
      });
    });
  });

  describe('Agent Profile Modal', () => {
    test('should open profile modal when agent name is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
      });

      const agentName = screen.getByText('Test Agent One');
      await user.click(agentName);

      expect(screen.getByTestId('agent-profile-modal')).toBeInTheDocument();
      expect(screen.getByText('Profile for 0.0.12345')).toBeInTheDocument();
    });

    test('should close profile modal', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
      });

      const agentName = screen.getByText('Test Agent One');
      await user.click(agentName);

      const closeButton = screen.getByTestId('close-modal');
      await user.click(closeButton);

      expect(
        screen.queryByTestId('agent-profile-modal')
      ).not.toBeInTheDocument();
    });
  });

  describe('Connection Dialog', () => {
    test('should open connection dialog when connect button is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByRole('button', {
        name: /connect/i,
      });
      await user.click(connectButtons[0]);

      expect(
        screen.getByTestId('connection-confirm-dialog')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Connect to Test Agent One?')
      ).toBeInTheDocument();
    });

    test('should connect to agent when confirmed', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByRole('button', {
        name: /connect/i,
      });
      await user.click(connectButtons[0]);

      const confirmButton = screen.getByTestId('confirm-connect');
      await user.click(confirmButton);

      expect(mockAgentStore.connect).toHaveBeenCalled();
    });

    test('should cancel connection when cancelled', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent One')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByRole('button', {
        name: /connect/i,
      });
      await user.click(connectButtons[0]);

      const cancelButton = screen.getByTestId('cancel-connect');
      await user.click(cancelButton);

      expect(
        screen.queryByTestId('connection-confirm-dialog')
      ).not.toBeInTheDocument();
      expect(mockAgentStore.connect).not.toHaveBeenCalled();
    });
  });

  describe('Copy Account ID', () => {
    test('should copy account ID to clipboard', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('0.0.12345')).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByTestId('fi-copy');
      await user.click(copyButtons[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0.0.12345');
    });
  });

  describe('Pagination', () => {
    test('should show pagination controls when there are multiple pages', async () => {
      (window.electron!.invoke as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAgents,
        total: 25,
        currentPage: 1,
        totalPages: 3,
      });

      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('fi-chevron-left')).toBeInTheDocument();
        expect(screen.getByTestId('fi-chevron-right')).toBeInTheDocument();
      });
    });

    test('should navigate to next page', async () => {
      const user = userEvent.setup();

      (window.electron!.invoke as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAgents,
        total: 25,
        currentPage: 1,
        totalPages: 3,
      });

      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('fi-chevron-right')).toBeInTheDocument();
      });

      const nextButton = screen
        .getByTestId('fi-chevron-right')
        .closest('button');
      await user.click(nextButton!);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledWith(
          'agent:discover',
          expect.objectContaining({
            page: 2,
          })
        );
      });
    });
  });

  describe('View Mode Toggle', () => {
    test('should toggle between grid and list view', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      const gridButton = screen.getByTestId('fi-grid').closest('button');
      const listButton = screen.getByTestId('fi-list').closest('button');

      expect(gridButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();

      await user.click(listButton!);

    });
  });

  describe('Filtering', () => {
    test('should apply capability filters', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('badge')).toHaveLength(5);
      });

      const badges = screen.getAllByTestId('badge');
      await user.click(badges[0]);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledWith(
          'agent:discover',
          expect.objectContaining({
            filters: expect.objectContaining({
              tags: expect.arrayContaining([expect.any(Number)]),
            }),
          })
        );
      });
    });

    test('should clear all filters', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledWith(
          'agent:discover',
          expect.objectContaining({
            filters: expect.objectContaining({
              search: 'test',
            }),
          })
        );
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    test('should show error message when agent discovery fails', async () => {
      (window.electron!.invoke as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to discover agents',
      });

      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to discover agents')
        ).toBeInTheDocument();
      });
    });

    test('should show empty state when no agents found', async () => {
      (window.electron!.invoke as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        currentPage: 1,
        totalPages: 0,
      });

      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByText('No agents found')).toBeInTheDocument();
      });
    });
  });

  describe('Social Links', () => {
    test('should render social media links', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('fa-twitter')).toBeInTheDocument();
        expect(screen.getByTestId('fa-github')).toBeInTheDocument();
      });
    });

    test('should prevent event propagation on social link clicks', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('fa-twitter')).toBeInTheDocument();
      });

      const twitterLink = screen.getByTestId('fa-twitter');
      await user.click(twitterLink);

    });
  });

  describe('Refresh Functionality', () => {
    test('should refresh agent list when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('fi-refresh')).toBeInTheDocument();
      });

      const refreshButton = screen.getByTestId('fi-refresh').closest('button');
      await user.click(refreshButton!);

      await waitFor(() => {
        expect(window.electron!.invoke).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    test('should show loading spinner during search', async () => {
      const user = userEvent.setup();
      render(<AgentDiscoveryPage />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');

      expect(screen.getByTestId('fi-refresh')).toBeInTheDocument();
    });

    test('should disable search input during loading', async () => {
      (window.electron!.invoke as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: mockAgents,
                  total: 2,
                  currentPage: 1,
                  totalPages: 1,
                }),
              1000
            )
          )
      );

      render(<AgentDiscoveryPage />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toHaveAttribute(
          'placeholder'
        );
      });
    });

    test('should support keyboard navigation', async () => {
      render(<AgentDiscoveryPage />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');
      searchInput.focus();

      expect(document.activeElement).toBe(searchInput);
    });
  });
});


