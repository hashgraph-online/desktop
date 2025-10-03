import { create } from 'zustand';
import { configService } from '../services/configService';

/**
 * Helper to wait for desktop bridge to be available
 */
const waitForDesktopBridge = async (
  maxRetries = 20,
  retryDelay = 100
): Promise<boolean> => {
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 5000);
  });

  const checkBridgePromise = async (): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      if (window.desktop && typeof window?.desktop?.saveConfig === 'function') {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
    return false;
  };

  return Promise.race([checkBridgePromise(), timeoutPromise]);
};

export interface HederaConfig {
  accountId: string;
  privateKey: string;
  network: 'mainnet' | 'testnet';
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

export interface AdvancedConfig {
  theme: 'light' | 'dark';
  autoStart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  operationalMode?: 'autonomous' | 'provideBytes' | 'returnBytes';
  webBrowserPluginEnabled?: boolean;
}

export interface LegalAcceptanceConfig {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  acceptedAt?: string;
}

interface WalletConnectionState {
  isConnected: boolean;
  accountId: string | null;
  network: 'mainnet' | 'testnet' | null;
}

export interface AppConfig {
  hedera: HederaConfig;
  openai: OpenAIConfig;
  anthropic: AnthropicConfig;
  advanced: AdvancedConfig;
  llmProvider: 'openai' | 'anthropic';
  autonomousMode: boolean;
  operationalMode: 'autonomous' | 'provideBytes' | 'returnBytes';
  legalAcceptance: LegalAcceptanceConfig;
}

export interface ConfigStore {
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;
  hasLoadedInitialConfig: boolean;
  walletConnection: WalletConnectionState;
  isConfigured: () => boolean;

  setHederaAccountId: (accountId: string) => void;
  setHederaPrivateKey: (privateKey: string) => void;
  setHederaNetwork: (network: 'mainnet' | 'testnet') => void;

  setOpenAIApiKey: (apiKey: string) => void;
  setOpenAIModel: (model: string) => void;

  setAnthropicApiKey: (apiKey: string) => void;
  setAnthropicModel: (model: string) => void;

  setLLMProvider: (provider: 'openai' | 'anthropic') => void;

  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setAutoStart: (autoStart: boolean) => void;
  setLogLevel: (logLevel: 'debug' | 'info' | 'warn' | 'error') => void;
  setWebBrowserPluginEnabled: (enabled: boolean) => void;
  setOperationalMode: (
    mode: 'autonomous' | 'provideBytes' | 'returnBytes'
  ) => void;
  setAutonomousMode: (enabled: boolean) => void;
  updateFromWallet: (
    info: { accountId: string; network: 'mainnet' | 'testnet' } | null
  ) => void;

  saveConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;

  testHederaConnection: () => Promise<{ success: boolean; error?: string }>;
  testOpenAIConnection: () => Promise<{ success: boolean; error?: string }>;
  testAnthropicConnection: () => Promise<{ success: boolean; error?: string }>;

  isHederaConfigValid: () => boolean;
  isOpenAIConfigValid: () => boolean;
  isAnthropicConfigValid: () => boolean;
  isLLMConfigValid: () => boolean;

  clearError: () => void;
}

const defaultConfig: AppConfig = {
  hedera: {
    accountId: '',
    privateKey: '',
    network: 'testnet',
  },
  openai: {
    apiKey: '',
    model: 'gpt-5',
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-7-sonnet-latest',
  },
  advanced: {
    theme: 'light',
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

const cloneConfig = (config: AppConfig): AppConfig => ({
  ...config,
  hedera: { ...config.hedera },
  openai: { ...config.openai },
  anthropic: { ...config.anthropic },
  advanced: { ...config.advanced },
  legalAcceptance: { ...config.legalAcceptance },
});

const persistToLocalStorage = (config: AppConfig): void => {
  try {
    localStorage.setItem('app-config', JSON.stringify(config));
  } catch (_error) {}
};

const persistConfig = (config: AppConfig): void => {
  persistToLocalStorage(config);
  void configService.saveConfig(config);
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,
  hasLoadedInitialConfig: false,
  walletConnection: {
    isConnected: false,
    accountId: null,
    network: null,
  },

  isConfigured: () => {
    const state = get();

    if (state.isLoading) {
      return false;
    }

    const hederaValid = state.isHederaConfigValid();
    const llmValid = state.isLLMConfigValid();
    const result = hederaValid && llmValid;

    return result;
  },

  setHederaAccountId: (accountId) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            hedera: { ...state.config.hedera, accountId },
          }
        : null,
    })),

  setHederaPrivateKey: (privateKey) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            hedera: { ...state.config.hedera, privateKey },
          }
        : null,
    })),

  setHederaNetwork: (network) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            hedera: { ...state.config.hedera, network },
          }
        : null,
    })),

  setOpenAIApiKey: (apiKey) => {
    try {
      console.debug('[ConfigStore] setOpenAIApiKey()', {
        length: apiKey?.length,
      });
    } catch {}
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            openai: { ...state.config.openai, apiKey },
          }
        : null,
    }));
    const state = get();
    if (state.config && state.hasLoadedInitialConfig) {
      const snapshot = cloneConfig(state.config);
      persistConfig(snapshot);
    }
  },

  setOpenAIModel: (model) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            openai: { ...state.config.openai, model },
          }
        : null,
    }));
    const state = get();
    if (
      state.config &&
      state.isLLMConfigValid() &&
      state.hasLoadedInitialConfig
    ) {
      persistConfig(cloneConfig(state.config));
    }
  },

  setAnthropicApiKey: (apiKey) => {
    try {
      console.debug('[ConfigStore] setAnthropicApiKey()', {
        length: apiKey?.length,
      });
    } catch {}
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            anthropic: { ...state.config.anthropic, apiKey },
          }
        : null,
    }));
    const state = get();
    if (state.config && state.hasLoadedInitialConfig) {
      const snapshot = cloneConfig(state.config);
      persistConfig(snapshot);
    }
  },

  setAnthropicModel: (model) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            anthropic: { ...state.config.anthropic, model },
          }
        : null,
    }));
    const state = get();
    if (
      state.config &&
      state.isLLMConfigValid() &&
      state.hasLoadedInitialConfig
    ) {
      persistConfig(cloneConfig(state.config));
    }
  },

  setLLMProvider: (provider) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            llmProvider: provider,
          }
        : null,
    })),

  setTheme: async (theme) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            advanced: { ...state.config.advanced, theme },
          }
        : null,
    }));

    try {
      await configService.applyTheme(theme);
    } catch (_error) {}
  },

  setAutoStart: (autoStart) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            advanced: { ...state.config.advanced, autoStart },
          }
        : null,
    }));

    try {
      void configService.setAutoStart(autoStart);
    } catch (_error) {}
  },

  setLogLevel: (logLevel) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            advanced: { ...state.config.advanced, logLevel },
          }
        : null,
    }));

    try {
      void configService.setLogLevel(logLevel);
    } catch (_error) {}
  },

  setWebBrowserPluginEnabled: (enabled) => {
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            advanced: {
              ...state.config.advanced,
              webBrowserPluginEnabled: enabled,
            },
          }
        : null,
    }));

    const state = get();
    if (state.config && state.hasLoadedInitialConfig) {
      persistConfig(cloneConfig(state.config));
    }
  },

  setOperationalMode: (mode) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            advanced: { ...state.config.advanced, operationalMode: mode },
          }
        : null,
    })),

  setAutonomousMode: (enabled) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            autonomousMode: enabled,
          }
        : null,
    })),

  updateFromWallet: (info) => {
    const previous = get();
    const connection: WalletConnectionState = info
      ? {
          isConnected: true,
          accountId: info.accountId,
          network: info.network,
        }
      : {
          isConnected: false,
          accountId: null,
          network: null,
        };

    let nextConfig = previous.config;

    if (info && info.accountId) {
      const base = nextConfig ?? cloneConfig(defaultConfig);
      if (
        base.hedera.accountId !== info.accountId ||
        base.hedera.network !== info.network
      ) {
        nextConfig = {
          ...base,
          hedera: {
            ...base.hedera,
            accountId: info.accountId,
            network: info.network,
          },
        };
      } else if (nextConfig === null) {
        nextConfig = base;
      }
    }

    set({
      walletConnection: connection,
      config: nextConfig ?? null,
    });

    if (!info) {
      return;
    }

    const state = get();
    if (!state.config || !state.isLLMConfigValid()) {
      return;
    }

    persistConfig(cloneConfig(state.config));
  },

  saveConfig: async () => {
    const { config } = get();
    if (!config) {
      throw new Error('No configuration to save');
    }

    try {
      console.debug('[ConfigStore] saveConfig()', {
        openaiKeyLength: config.openai.apiKey.length,
        anthropicKeyLength: config.anthropic.apiKey.length,
        hasLoadedInitialConfig: get().hasLoadedInitialConfig,
      });
    } catch {}

    set({ isLoading: true, error: null });

    try {
      const isAvailable = await waitForDesktopBridge();
      if (!isAvailable) {
        const errorMsg = 'Unable to save settings - Electron API not available';
        set({
          isLoading: false,
          error: errorMsg,
        });
        return;
      }

      await configService.saveConfig(config);

      localStorage.setItem('app-config', JSON.stringify(config));

      set({ isLoading: false, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save configuration';

      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  loadConfig: async () => {
    set({ isLoading: true, error: null });

    const emergencyTimeout = setTimeout(() => {
      set({ isLoading: false, error: 'Configuration loading timed out' });
    }, 8000);

    try {
      const loadConfigWithTimeout = async (): Promise<void> => {
        const isAvailable = await waitForDesktopBridge();
        if (!isAvailable) {
          set({
            config: defaultConfig,
            isLoading: false,
            hasLoadedInitialConfig: true,
          });
          return;
        }

        const [loadedConfig, envConfig] = await Promise.all([
          configService.loadConfig(),
          window?.desktop?.getEnvironmentConfig?.(),
        ]);

        let finalConfig = defaultConfig;

        const resolvedConfig = loadedConfig ?? null;

        if (resolvedConfig) {
          const rawMode =
            resolvedConfig.operationalMode ??
            resolvedConfig.advanced?.operationalMode ??
            'provideBytes';

          let normalizedMode: 'autonomous' | 'provideBytes' | 'returnBytes' =
            'provideBytes';

          if (rawMode === 'autonomous') {
            normalizedMode = 'autonomous';
          } else if (rawMode === 'returnBytes') {
            normalizedMode = 'returnBytes';
          } else if (rawMode === 'provideBytes') {
            normalizedMode = 'provideBytes';
          }

          const effectiveMode: 'autonomous' | 'provideBytes' | 'returnBytes' =
            normalizedMode === 'returnBytes'
              ? 'provideBytes'
              : normalizedMode;

          finalConfig = {
            ...defaultConfig,
            ...resolvedConfig,
            operationalMode: effectiveMode,
            advanced: {
              ...defaultConfig.advanced,
              ...resolvedConfig.advanced,
              operationalMode: effectiveMode,
            },
          };
        }

        if (envConfig && typeof envConfig === 'object') {
          if (envConfig.hedera) {
            finalConfig.hedera = {
              ...envConfig.hedera,
              ...finalConfig.hedera,
            };
          }
          if (envConfig.openai) {
            finalConfig.openai = {
              ...envConfig.openai,
              ...finalConfig.openai,
            };
          }
          if (envConfig.anthropic) {
            finalConfig.anthropic = {
              ...envConfig.anthropic,
              ...finalConfig.anthropic,
            };
          }
          if (envConfig.llmProvider && !finalConfig.llmProvider) {
            finalConfig.llmProvider = envConfig.llmProvider;
          }
        }

        set({
          config: finalConfig,
          isLoading: false,
          hasLoadedInitialConfig: true,
        });
        localStorage.setItem('app-config', JSON.stringify(finalConfig));

        try {
          await configService.applyTheme(finalConfig.advanced.theme);
        } catch {}
      };

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('LoadConfig timeout')), 5000);
      });

      await Promise.race([loadConfigWithTimeout(), timeoutPromise]);
    } catch (error) {
      set({
        config: defaultConfig,
        isLoading: false,
        hasLoadedInitialConfig: true,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load configuration',
      });
    } finally {
      clearTimeout(emergencyTimeout);

      const currentState = get();
      if (currentState.isLoading) {
        set({ isLoading: false });
      }
    }
  },

  testHederaConnection: async () => {
    const { config } = get();

    if (!config || !config.hedera) {
      return { success: false, error: 'Hedera configuration not found' };
    }

    const isAvailable = await waitForDesktopBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window?.desktop?.testHederaConnection({
        accountId: config.hedera.accountId,
        privateKey: config.hedera.privateKey,
        network: config.hedera.network,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  },

  testOpenAIConnection: async () => {
    const { config } = get();

    if (!config || !config.openai) {
      return { success: false, error: 'OpenAI configuration not found' };
    }

    const isAvailable = await waitForDesktopBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window?.desktop?.testOpenAIConnection({
        apiKey: config.openai.apiKey,
        model: config.openai.model,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  },

  testAnthropicConnection: async () => {
    const { config } = get();

    if (!config || !config.anthropic) {
      return { success: false, error: 'Anthropic configuration not found' };
    }

    const isAvailable = await waitForDesktopBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window?.desktop?.testAnthropicConnection({
        apiKey: config.anthropic.apiKey,
        model: config.anthropic.model,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  },

  isHederaConfigValid: () => {
    const { config, walletConnection } = get();
    if (!config || !config.hedera) {
      return false;
    }

    const accountId = config.hedera.accountId.trim();
    const privateKey = config.hedera.privateKey.trim();
    const accountValid = Boolean(accountId) && isValidAccountId(accountId);
    const privateKeyValid =
      Boolean(privateKey) && isValidPrivateKey(privateKey);

    if (accountValid && privateKeyValid) {
      return true;
    }

    if (walletConnection.isConnected && accountValid) {
      return Boolean(walletConnection.network);
    }

    return false;
  },

  isOpenAIConfigValid: () => {
    const { config } = get();
    if (!config || !config.openai) {
      return false;
    }

    const hasKey = !!config.openai.apiKey;
    const result = hasKey;

    return result;
  },

  isAnthropicConfigValid: () => {
    const { config } = get();
    if (!config || !config.anthropic) return false;

    return !!config.anthropic.apiKey;
  },

  isLLMConfigValid: () => {
    const { config } = get();
    if (!config) {
      return false;
    }

    if (config.llmProvider === 'openai') {
      const result = get().isOpenAIConfigValid();
      return result;
    } else if (config.llmProvider === 'anthropic') {
      const result = get().isAnthropicConfigValid();
      return result;
    }

    return false;
  },

  clearError: () => set({ error: null }),
}));

/**
 * Validates Hedera account ID format
 */
function isValidAccountId(accountId: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/;
  return pattern.test(accountId);
}

/**
 * Validates Hedera private key format
 */
function isValidPrivateKey(privateKey: string): boolean {
  return !!privateKey && privateKey.length > 0;
}
