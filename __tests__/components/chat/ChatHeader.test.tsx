import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatHeader from '../../../src/renderer/components/chat/ChatHeader';
import { useAgentStore } from '../../../src/renderer/stores/agentStore';
import { useConfigStore } from '../../../src/renderer/stores/configStore';

// Mock configStore first before agentStore imports it
jest.mock('../../../src/renderer/stores/configStore', () => ({
  useConfigStore: jest.fn()
}));

jest.mock('../../../src/renderer/stores/agentStore', () => ({
  useAgentStore: jest.fn()
}));

const mockUseAgentStore = useAgentStore as jest.MockedFunction<typeof useAgentStore>;
const mockUseConfigStore = useConfigStore as jest.MockedFunction<typeof useConfigStore>;

describe('ChatHeader', () => {
  const mockConfig = {
    hedera: {
      accountId: '0.0.123456',
      privateKey: 'test-key',
      network: 'testnet' as const
    },
    openai: {
      apiKey: 'test-api-key',
      model: 'gpt-4'
    }
  };

  beforeEach(() => {
    mockUseAgentStore.mockReturnValue({
      status: 'idle',
      isConnected: false,
      connectionError: null,
      messages: [],
      currentSessionId: null,
      setStatus: jest.fn(),
      setConnected: jest.fn(),
      setConnectionError: jest.fn(),
      clearConnectionError: jest.fn(),
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      setSessionId: jest.fn(),
      startNewSession: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });

    mockUseConfigStore.mockReturnValue({
      config: mockConfig,
      isConfigured: true,
      isLoading: false,
      error: null,
      loadConfig: jest.fn(),
      saveConfig: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header with agent title', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('should show disconnected status when not connected', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should show connected status when connected', () => {
    mockUseAgentStore.mockReturnValue({
      status: 'connected',
      isConnected: true,
      connectionError: null,
      messages: [],
      currentSessionId: null,
      setStatus: jest.fn(),
      setConnected: jest.fn(),
      setConnectionError: jest.fn(),
      clearConnectionError: jest.fn(),
      addMessage: jest.fn(),
      clearMessages: jest.fn(),
      setSessionId: jest.fn(),
      startNewSession: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn()
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('AI Online')).toBeInTheDocument();
  });

  it('should show connecting status', () => {
    mockUseAgentStore.mockReturnValue({
      ...mockUseAgentStore(),
      status: 'connecting',
      isConnected: false
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should show error status when there is a connection error', () => {
    mockUseAgentStore.mockReturnValue({
      ...mockUseAgentStore(),
      status: 'error',
      isConnected: false,
      connectionError: 'Connection failed'
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('should display network information when config is available', () => {
    render(<ChatHeader />);
    
    expect(screen.getByText('TESTNET')).toBeInTheDocument();
  });

  it('should display account information when config is available', () => {
    render(<ChatHeader />);
    
    // Check for account ID text
    expect(screen.getByText(/0\.0\.123456/)).toBeInTheDocument();
  });

  it('should handle missing config gracefully', () => {
    mockUseConfigStore.mockReturnValue({
      config: null,
      isConfigured: false,
      isLoading: false,
      error: null,
      loadConfig: jest.fn(),
      saveConfig: jest.fn()
    });
    
    render(<ChatHeader />);
    
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.queryByText('TESTNET')).not.toBeInTheDocument();
  });
});