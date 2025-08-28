import { create } from 'zustand';
import { configService } from '../services/configService';

/**
 * Helper to wait for electron bridge to be available
 */
const waitForElectronBridge = async (
  maxRetries = 20,
  retryDelay = 100
): Promise<boolean> => {
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 5000);
  });

  const checkBridgePromise = async (): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      if (window.electron && typeof window.electron.saveConfig === 'function') {
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
  operationalMode?: 'autonomous' | 'provideBytes';
}

export interface LegalAcceptanceConfig {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  acceptedAt?: string;
}

export interface AppConfig {
  hedera: HederaConfig;
  openai: OpenAIConfig;
  anthropic: AnthropicConfig;
  advanced: AdvancedConfig;
  llmProvider: 'openai' | 'anthropic';
  autonomousMode: boolean;
  legalAcceptance: LegalAcceptanceConfig;
}

export interface ConfigStore {
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;
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
  setOperationalMode: (mode: 'autonomous' | 'provideBytes') => void;
  setAutonomousMode: (enabled: boolean) => void;

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
    model: 'gpt-4o',
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
  },
  advanced: {
    theme: 'light',
    autoStart: false,
    logLevel: 'info',
    operationalMode: 'provideBytes',
  },
  llmProvider: 'openai',
  autonomousMode: false,
  legalAcceptance: {
    termsAccepted: false,
    privacyAccepted: false,
  },
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,

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

  setOpenAIApiKey: (apiKey) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            openai: { ...state.config.openai, apiKey },
          }
        : null,
    })),

  setOpenAIModel: (model) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            openai: { ...state.config.openai, model },
          }
        : null,
    })),

  setAnthropicApiKey: (apiKey) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            anthropic: { ...state.config.anthropic, apiKey },
          }
        : null,
    })),

  setAnthropicModel: (model) =>
    set((state) => ({
      config: state.config
        ? {
            ...state.config,
            anthropic: { ...state.config.anthropic, model },
          }
        : null,
    })),

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
    } catch (_error) {
    }
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

  saveConfig: async () => {
    const { config } = get();
    if (!config) {
      throw new Error('No configuration to save');
    }

    set({ isLoading: true, error: null });

    try {
      const isAvailable = await waitForElectronBridge();
      if (!isAvailable) {
        const errorMsg = 'Unable to save settings - Electron API not available';
        set({ 
          isLoading: false,
          error: errorMsg 
        });
        throw new Error(errorMsg);
      }

      await window.electron.saveConfig(
        config as unknown as Record<string, unknown>
      );
      
      localStorage.setItem('app-config', JSON.stringify(config));
      
      set({ isLoading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to save configuration';
      
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
        const isAvailable = await waitForElectronBridge();
        if (!isAvailable) {
          set({ config: defaultConfig, isLoading: false });
          return;
        }

        const [loadedConfig, envConfig] = await Promise.all([
          window.electron.loadConfig(),
          window.electron.getEnvironmentConfig(),
        ]);

        let finalConfig = defaultConfig;

        if (loadedConfig) {
          const mode = (
            loadedConfig.operationalMode ||
            loadedConfig.advanced?.operationalMode ||
            'provideBytes'
          ).replace('returnBytes', 'provideBytes');

          finalConfig = {
            ...defaultConfig,
            ...loadedConfig,
            advanced: {
              ...defaultConfig.advanced,
              ...loadedConfig.advanced,
              operationalMode: mode,
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

        set({ config: finalConfig, isLoading: false });
        localStorage.setItem('app-config', JSON.stringify(finalConfig));

        try {
          await configService.applyTheme(finalConfig.advanced.theme);
        } catch {
        }
      };

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('LoadConfig timeout')), 5000);
      });

      await Promise.race([loadConfigWithTimeout(), timeoutPromise]);
      
    } catch (error) {
      set({
        config: defaultConfig,
        isLoading: false,
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

    const isAvailable = await waitForElectronBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electron.testHederaConnection({
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

    const isAvailable = await waitForElectronBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electron.testOpenAIConnection({
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

    const isAvailable = await waitForElectronBridge();
    if (!isAvailable) {
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electron.testAnthropicConnection({
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
    const { config } = get();
    if (!config || !config.hedera) {
      return false;
    }

    const hasAccountId = !!config.hedera.accountId;
    const hasPrivateKey = !!config.hedera.privateKey;
    const validAccountId = isValidAccountId(config.hedera.accountId);
    const validPrivateKey = isValidPrivateKey(config.hedera.privateKey);

    const result =
      hasAccountId && hasPrivateKey && validAccountId && validPrivateKey;
    return result;
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
