import { Logger } from '@hashgraphonline/standards-sdk';

export interface EnvironmentConfig {
  enableMainnet: boolean;
  hedera?: {
    accountId?: string;
    privateKey?: string;
    network?: 'mainnet' | 'testnet';
  };
  openai?: {
    apiKey?: string;
    model?: string;
  };
  anthropic?: {
    apiKey?: string;
    model?: string;
  };
  llmProvider?: 'openai' | 'anthropic';
  walletConnect?: {
    projectId?: string;
    appName?: string;
    appUrl?: string;
    appIcon?: string;
  };
}

/**
 * Retrieves the environment configuration for the application
 * @returns {EnvironmentConfig} Configuration object with feature flags and app config
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const logger = new Logger({ module: 'EnvironmentConfig' });
  const config: EnvironmentConfig = {
    enableMainnet: process.env.ENABLE_MAINNET === 'true' || false,
  };

  if (
    process.env.HEDERA_OPERATOR_ID ||
    process.env.HEDERA_OPERATOR_KEY ||
    process.env.HEDERA_NETWORK
  ) {
    config.hedera = {};

    if (process.env.HEDERA_OPERATOR_ID) {
      config.hedera.accountId = process.env.HEDERA_OPERATOR_ID;
    }

    if (process.env.HEDERA_OPERATOR_KEY) {
      config.hedera.privateKey = process.env.HEDERA_OPERATOR_KEY;
    }

    if (process.env.HEDERA_NETWORK) {
      const network = process.env.HEDERA_NETWORK.toLowerCase();
      if (network === 'mainnet' || network === 'testnet') {
        config.hedera.network = network as 'mainnet' | 'testnet';
      }
    }
  }

  if (process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
    };
  }

  if (process.env.LLM_PROVIDER) {
    const provider = process.env.LLM_PROVIDER.toLowerCase();
    if (provider === 'openai' || provider === 'anthropic') {
      config.llmProvider = provider as 'openai' | 'anthropic';
    }
  } else if (config.anthropic?.apiKey && !config.openai?.apiKey) {
    config.llmProvider = 'anthropic';
  } else if (config.openai?.apiKey && !config.anthropic?.apiKey) {
    config.llmProvider = 'openai';
  }

  logger.info('WALLETCONNECT_PROJECT_ID', process.env.WALLETCONNECT_PROJECT_ID);
  if (
    process.env.WALLETCONNECT_PROJECT_ID ||
    process.env.WALLET_APP_NAME ||
    process.env.WALLET_APP_URL ||
    process.env.WALLET_APP_ICON
  ) {
    config.walletConnect = {
      projectId:
        process.env.WALLETCONNECT_PROJECT_ID ||
        '610b20415692c366e3bf97b8208cada5',
      appName: process.env.WALLET_APP_NAME || undefined,
      appUrl: process.env.WALLET_APP_URL || undefined,
      appIcon: process.env.WALLET_APP_ICON || undefined,
    };
  }

  return config;
}

/**
 * Checks if mainnet is enabled in the environment configuration
 * @returns {boolean} True if mainnet is enabled, false otherwise
 */
export function isMainnetEnabled(): boolean {
  return getEnvironmentConfig().enableMainnet;
}
