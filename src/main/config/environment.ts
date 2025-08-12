export interface EnvironmentConfig {
  enableMainnet: boolean;
}

/**
 * Retrieves the environment configuration for the application
 * @returns {EnvironmentConfig} Configuration object with feature flags
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    enableMainnet: process.env.ENABLE_MAINNET === 'true' || false
  };
}

/**
 * Checks if mainnet is enabled in the environment configuration
 * @returns {boolean} True if mainnet is enabled, false otherwise
 */
export function isMainnetEnabled(): boolean {
  return getEnvironmentConfig().enableMainnet;
}