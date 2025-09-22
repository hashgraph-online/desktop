;(window as any).electron = {
  getEnvironmentConfig: jest.fn(() => Promise.resolve({ enableMainnet: false })),
  testHederaConnection: jest.fn(() => Promise.resolve({ success: true })),
  testOpenAIConnection: jest.fn(() => Promise.resolve({ success: true })),
  testAnthropicConnection: jest.fn(() => Promise.resolve({ success: true })),
  saveConfig: jest.fn(() => Promise.resolve(undefined)),
  loadConfig: jest.fn(() => Promise.resolve({})),
  reset: jest.fn(),
};

import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../../../src/renderer/pages/SettingsPage';
import { useConfigStore } from '../../../src/renderer/stores/configStore';
import type { ConfigStore } from '../../../src/renderer/stores/configStore';

jest.mock('../../../src/renderer/stores/configStore');
jest.mock('framer-motion', () => {
  const React = require('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout']);
  const createMock = (tag: string) => {
    const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...rest }, ref) => {
      const safeProps: Record<string, unknown> = {};
      Object.entries(rest).forEach(([key, value]) => {
        if (!MOTION_PROPS.has(key)) {
          safeProps[key] = value;
        }
      });
      return React.createElement(tag, { ref, ...safeProps }, children);
    });
    Component.displayName = `MockMotion(${tag})`;
    return Component;
  };

  return {
    __esModule: true,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => createMock(prop),
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
jest.mock('../../../src/renderer/stores/agentStore', () => ({
  useAgentStore: () => ({
    isConnected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

describe('SettingsPage', () => {
  const mockUseConfigStore = useConfigStore as jest.MockedFunction<typeof useConfigStore> & {
    subscribe?: jest.Mock;
    getState?: jest.Mock;
  };

  let mockStore: ConfigStore;
  let subscribeCallback: ((state: ConfigStore, prevState: ConfigStore) => void) | null;

  beforeEach(() => {
    jest.useFakeTimers();
    subscribeCallback = null;

    (window as any).electron = {
      getEnvironmentConfig: jest.fn(() => Promise.resolve({ enableMainnet: false })),
      testHederaConnection: jest.fn(() => Promise.resolve({ success: true })),
      testOpenAIConnection: jest.fn(() => Promise.resolve({ success: true })),
      testAnthropicConnection: jest.fn(() => Promise.resolve({ success: true })),
      saveConfig: jest.fn(() => Promise.resolve(undefined)),
      loadConfig: jest.fn(() => Promise.resolve({})),
      reset: jest.fn(),
    };

    mockStore = {
      config: {
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet',
        },
        openai: {
          apiKey: '',
          model: 'gpt-4',
        },
        advanced: {
          theme: 'light',
          autoStart: false,
        },
      },
      isLoading: false,
      error: null,
      setHederaAccountId: jest.fn(),
      setHederaPrivateKey: jest.fn(),
      setHederaNetwork: jest.fn(),
      setOpenAIApiKey: jest.fn(),
      setOpenAIModel: jest.fn(),
      setTheme: jest.fn(),
      setAutoStart: jest.fn(),
      saveConfig: jest.fn().mockResolvedValue(undefined),
      loadConfig: jest.fn().mockResolvedValue(undefined),
      testHederaConnection: jest.fn(),
      testOpenAIConnection: jest.fn(),
      isHederaConfigValid: jest.fn().mockReturnValue(true),
      isOpenAIConfigValid: jest.fn().mockReturnValue(true),
      clearError: jest.fn(),
      setAnthropicApiKey: jest.fn(),
      setAnthropicModel: jest.fn(),
      setLLMProvider: jest.fn(),
      setLogLevel: jest.fn(),
      setOperationalMode: jest.fn(),
      setAutonomousMode: jest.fn(),
      testAnthropicConnection: jest.fn(),
      isAnthropicConfigValid: jest.fn().mockReturnValue(true),
      isLLMConfigValid: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(false),
    } as ConfigStore;

    const subscribeMock = jest.fn(
      (listener: (state: ConfigStore, prevState: ConfigStore) => void) => {
        subscribeCallback = listener;
        return jest.fn();
      }
    );

    const getStateMock = jest.fn(() => mockStore);

    mockUseConfigStore.mockReturnValue(mockStore);
    mockUseConfigStore.subscribe = subscribeMock;
    mockUseConfigStore.getState = getStateMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderPage = async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      );
    });
  };

  it('loads configuration on mount', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockStore.loadConfig).toHaveBeenCalled();
    });
  });

  it('auto-saves valid configuration changes after debounce', async () => {
    await renderPage();

    const nextState = {
      ...mockStore,
      config: {
        ...mockStore.config,
        hedera: { ...mockStore.config.hedera, accountId: '0.0.12345' },
      },
    } as ConfigStore;

    act(() => {
      subscribeCallback?.(nextState, mockStore);
    });

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockStore.saveConfig).toHaveBeenCalled();
    });
  });

  it('does not auto-save when configuration is invalid', async () => {
    mockStore.isHederaConfigValid.mockReturnValue(false);
    await renderPage();

    const nextState = {
      ...mockStore,
      config: {
        ...mockStore.config,
        hedera: { ...mockStore.config.hedera, accountId: '0.0.invalid' },
      },
    } as ConfigStore;

    act(() => {
      subscribeCallback?.(nextState, mockStore);
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(mockStore.saveConfig).not.toHaveBeenCalled();
  });

  it('invokes manual save handler when save button is clicked', async () => {
    await renderPage();

    const saveButton = await screen.findByRole('button', {
      name: /save configuration/i,
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockStore.saveConfig).toHaveBeenCalled();
    });
  });

  it('resets configuration when cancel is clicked after changes', async () => {
    await renderPage();

    const cancelButton = await screen.findByRole('button', {
      name: /cancel/i,
    });

    expect(cancelButton).toBeDisabled();

    const updatedState = {
      ...mockStore,
      config: {
        ...mockStore.config,
        hedera: { ...mockStore.config.hedera, privateKey: 'updated-key' },
      },
    } as ConfigStore;

    act(() => {
      subscribeCallback?.(updatedState, mockStore);
    });

    expect(cancelButton).not.toBeDisabled();

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockStore.loadConfig).toHaveBeenCalledTimes(2);
    });
  });
});
