import {
  describe,
  beforeAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from 'vitest';
import type { MockInstance } from 'vitest';

import { useConfigStore } from '../renderer/stores/configStore';
import type { AppConfig } from '../renderer/stores/configStore';
import { configService } from '../renderer/services/configService';

type ConfigStoreState = ReturnType<typeof useConfigStore['getState']>;

let defaultState: ConfigStoreState;
let saveConfigSpy: MockInstance;
let loadConfigSpy: MockInstance;
let applyThemeSpy: MockInstance;

describe('ConfigStore settings integrations', () => {
  beforeAll(() => {
    defaultState = useConfigStore.getState();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    resetStore();
    saveConfigSpy = vi
      .spyOn(configService, 'saveConfig')
      .mockResolvedValue(undefined);
    loadConfigSpy = vi
      .spyOn(configService, 'loadConfig')
      .mockResolvedValue(null);
    applyThemeSpy = vi
      .spyOn(configService, 'applyTheme')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetStore();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'desktop');
  });

  it('invokes IPC when toggling auto-start', async () => {
    const spy = vi
      .spyOn(configService, 'setAutoStart')
      .mockResolvedValue(undefined);

    await useConfigStore.getState().setAutoStart(true);

    expect(spy).toHaveBeenCalledWith(true);
  });

  it('invokes IPC when changing log level', async () => {
    const spy = vi
      .spyOn(configService, 'setLogLevel')
      .mockResolvedValue(undefined);

    await useConfigStore.getState().setLogLevel('debug');

    expect(spy).toHaveBeenCalledWith('debug');
  });

  it('treats wallet connection as satisfying Hedera requirements', () => {
    useConfigStore.getState().setHederaAccountId('');
    useConfigStore.getState().setHederaPrivateKey('');
    useConfigStore.getState().updateFromWallet(null);

    expect(useConfigStore.getState().isHederaConfigValid()).toBe(false);
    expect(saveConfigSpy).not.toHaveBeenCalled();

    useConfigStore
      .getState()
      .updateFromWallet({ accountId: '0.0.1234', network: 'testnet' });

    expect(useConfigStore.getState().config?.hedera.accountId).toBe('0.0.1234');
    expect(useConfigStore.getState().config?.hedera.network).toBe('testnet');
    expect(useConfigStore.getState().isHederaConfigValid()).toBe(true);
    expect(saveConfigSpy).not.toHaveBeenCalled();
  });

  it('marks Hedera config invalid again after wallet disconnect', () => {
    useConfigStore
      .getState()
      .updateFromWallet({ accountId: '0.0.5678', network: 'testnet' });
    expect(useConfigStore.getState().isHederaConfigValid()).toBe(true);

    useConfigStore.getState().updateFromWallet(null);

    expect(useConfigStore.getState().isHederaConfigValid()).toBe(false);
    expect(saveConfigSpy).not.toHaveBeenCalled();
  });

  it('persists LLM credentials when API key changes', () => {
    useConfigStore.getState().setOpenAIApiKey('sk-test');

    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        openai: expect.objectContaining({ apiKey: 'sk-test' }),
      })
    );
  });

  it('persists configuration when wallet connects with valid LLM settings', () => {
    useConfigStore.getState().setOpenAIApiKey('sk-test-key');
    saveConfigSpy.mockClear();

    useConfigStore
      .getState()
      .updateFromWallet({ accountId: '0.0.9999', network: 'testnet' });

    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        hedera: expect.objectContaining({
          accountId: '0.0.9999',
          network: 'testnet',
        }),
        openai: expect.objectContaining({ apiKey: 'sk-test-key' }),
      })
    );
  });

  it('loads persisted OpenAI API key from desktop configuration', async () => {
    const loadedConfig: AppConfig = {
      hedera: {
        accountId: '0.0.1111',
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
        theme: 'dark',
        autoStart: false,
        logLevel: 'info',
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
    };

    loadConfigSpy.mockResolvedValueOnce(loadedConfig);
    applyThemeSpy.mockResolvedValueOnce(undefined);

    const desktopStub = {
      saveConfig: async (_config: AppConfig) => {},
      loadConfig: async () => ({ success: true, config: null }),
      getEnvironmentConfig: async () => ({ enableMainnet: false }),
    } as unknown as Window['desktop'];

    (window as Window).desktop = desktopStub;

    await useConfigStore.getState().loadConfig();

    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
    expect(
      useConfigStore.getState().config?.openai.apiKey
    ).toBe('sk-live-test-key');
  });
});

function resetStore() {
  useConfigStore.setState(defaultState, true);
  useConfigStore.setState({
    config: defaultState.config,
    isLoading: false,
    error: null,
    walletConnection: { ...defaultState.walletConnection },
    hasLoadedInitialConfig: true,
  });
}
