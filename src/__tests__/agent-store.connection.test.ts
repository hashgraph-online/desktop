import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  vi,
} from 'vitest';

import { useAgentStore } from '../renderer/stores/agentStore';
import { useConfigStore } from '../renderer/stores/configStore';
import { useWalletStore } from '../renderer/stores/walletStore';
import { configService } from '../renderer/services/configService';
import type { AppConfig } from '../renderer/stores/configStore';

type AgentStoreState = ReturnType<typeof useAgentStore['getState']>;
type ConfigStoreState = ReturnType<typeof useConfigStore['getState']>;
type WalletStoreState = ReturnType<typeof useWalletStore['getState']>;

let defaultAgentState: AgentStoreState;
let defaultConfigState: ConfigStoreState;
let defaultWalletState: WalletStoreState;

describe('AgentStore configuration bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    defaultAgentState = useAgentStore.getState();
    defaultConfigState = useConfigStore.getState();
    defaultWalletState = useWalletStore.getState();

    useAgentStore.setState(defaultAgentState, true);
    useConfigStore.setState(defaultConfigState, true);
    useWalletStore.setState(defaultWalletState, true);
  });

  afterEach(() => {
    useAgentStore.setState(defaultAgentState, true);
    useConfigStore.setState(defaultConfigState, true);
    useWalletStore.setState(defaultWalletState, true);
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'desktop');
  });

  it('connects using AppConfig returned by configService.loadConfig', async () => {
    const loadConfigSpy = vi
      .spyOn(configService, 'loadConfig')
      .mockResolvedValue({
        hedera: {
          accountId: '0.0.2001',
          privateKey: 'PRIVATE_KEY',
          network: 'testnet',
        },
        openai: {
          apiKey: 'sk-live-test-key',
          model: 'gpt-5',
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-7-sonnet-latest',
        },
        advanced: {
          autoStart: false,
          logLevel: 'info',
          theme: 'light',
          operationalMode: 'provideBytes',
          webBrowserPluginEnabled: true,
        },
        llmProvider: 'openai',
        autonomousMode: false,
        operationalMode: 'provideBytes',
        legalAcceptance: {
          termsAccepted: false,
          privacyAccepted: false,
        },
      } satisfies AppConfig);

    const initializeAgent = vi
      .fn()
      .mockResolvedValue({ success: true, data: { sessionId: 'session-123' } });

    const desktopStub = {
      initializeAgent,
      loadConfig: vi.fn().mockResolvedValue({ success: true, config: null }),
      getEnvironmentConfig: vi.fn().mockResolvedValue({ enableMainnet: false }),
    } as unknown as Window['desktop'];

    (window as Window).desktop = desktopStub;

    useWalletStore.setState({
      isConnected: false,
      accountId: null,
      network: 'testnet',
    } as Partial<WalletStoreState>);

    await expect(useAgentStore.getState().connect()).resolves.not.toThrow();

    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
    expect(initializeAgent).toHaveBeenCalledWith(
      expect.objectContaining({ 
        openAIApiKey: 'sk-live-test-key',
        additionalPlugins: undefined, // No swarm config in mock
      })
    );
  });

  it('includes swarm plugin config when enabled', async () => {
    const loadConfigSpy = vi
      .spyOn(configService, 'loadConfig')
      .mockResolvedValue({
        hedera: {
          accountId: '0.0.2001',
          privateKey: 'PRIVATE_KEY',
          network: 'testnet',
        },
        openai: {
          apiKey: 'sk-live-test-key',
          model: 'gpt-5',
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-7-sonnet-latest',
        },
        advanced: {
          autoStart: false,
          logLevel: 'info',
          theme: 'light',
          operationalMode: 'provideBytes',
          webBrowserPluginEnabled: true,
          swarmPluginEnabled: true,
        },
        swarm: {
          beeApiUrl: 'http://localhost:1633',
          beeFeedPK: 'test-feed-pk',
          autoAssignStamp: true,
          deferredUploadSizeThresholdMB: 10,
        },
        llmProvider: 'openai',
        autonomousMode: false,
        operationalMode: 'provideBytes',
        legalAcceptance: {
          termsAccepted: false,
          privacyAccepted: false,
        },
      } satisfies AppConfig);

    const initializeAgent = vi
      .fn()
      .mockResolvedValue({ success: true, data: { sessionId: 'session-123' } });

    const desktopStub = {
      initializeAgent,
      loadConfig: vi.fn().mockResolvedValue({ success: true, config: null }),
      getEnvironmentConfig: vi.fn().mockResolvedValue({ enableMainnet: false }),
    } as unknown as Window['desktop'];

    (window as Window).desktop = desktopStub;

    useWalletStore.setState({
      isConnected: false,
      accountId: null,
      network: 'testnet',
    } as Partial<WalletStoreState>);

    await expect(useAgentStore.getState().connect()).resolves.not.toThrow();

    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
    expect(initializeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        openAIApiKey: 'sk-live-test-key',
        additionalPlugins: [
          {
            pluginType: 'swarm',
            config: {
              beeApiUrl: 'http://localhost:1633',
              beeFeedPK: 'test-feed-pk',
              autoAssignStamp: true,
              deferredUploadSizeThresholdMB: 10,
            },
          },
        ],
      })
    );
  });

  it('excludes swarm plugin when disabled', async () => {
    const loadConfigSpy = vi
      .spyOn(configService, 'loadConfig')
      .mockResolvedValue({
        hedera: {
          accountId: '0.0.2001',
          privateKey: 'PRIVATE_KEY',
          network: 'testnet',
        },
        openai: {
          apiKey: 'sk-live-test-key',
          model: 'gpt-5',
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-7-sonnet-latest',
        },
        advanced: {
          autoStart: false,
          logLevel: 'info',
          theme: 'light',
          operationalMode: 'provideBytes',
          webBrowserPluginEnabled: true,
          swarmPluginEnabled: false,
        },
        swarm: {
          beeApiUrl: 'http://localhost:1633',
          beeFeedPK: 'test-feed-pk',
          autoAssignStamp: true,
          deferredUploadSizeThresholdMB: 10,
        },
        llmProvider: 'openai',
        autonomousMode: false,
        operationalMode: 'provideBytes',
        legalAcceptance: {
          termsAccepted: false,
          privacyAccepted: false,
        },
      } satisfies AppConfig);

    const initializeAgent = vi
      .fn()
      .mockResolvedValue({ success: true, data: { sessionId: 'session-123' } });

    const desktopStub = {
      initializeAgent,
      loadConfig: vi.fn().mockResolvedValue({ success: true, config: null }),
      getEnvironmentConfig: vi.fn().mockResolvedValue({ enableMainnet: false }),
    } as unknown as Window['desktop'];

    (window as Window).desktop = desktopStub;

    useWalletStore.setState({
      isConnected: false,
      accountId: null,
      network: 'testnet',
    } as Partial<WalletStoreState>);

    await expect(useAgentStore.getState().connect()).resolves.not.toThrow();

    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
    expect(initializeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        openAIApiKey: 'sk-live-test-key',
        disabledPlugins: ['swarm'], // Disabled plugins list
        additionalPlugins: undefined, // Empty array becomes undefined
      })
    );
  });
});
