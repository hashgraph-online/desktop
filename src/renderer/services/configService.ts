import { AppConfig } from '../stores/configStore'

/**
 * Configuration service that handles IPC communication for app settings
 */
export class ConfigService {
  /**
   * Saves the application configuration using IPC
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      await window.electron.saveConfig(config as unknown as Record<string, unknown>)
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Loads the application configuration using IPC
   */
  async loadConfig(): Promise<AppConfig | null> {
    try {
      const config = await window.electron.loadConfig()
      return config
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Tests the Hedera connection with provided credentials
   */
  async testHederaConnection(credentials: {
    accountId: string
    privateKey: string
    network: 'mainnet' | 'testnet'
  }): Promise<{ success: boolean; balance?: string; error?: string }> {
    try {
      const result = await window.electron.testHederaConnection(credentials)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Tests the OpenAI connection with provided credentials
   */
  async testOpenAIConnection(credentials: {
    apiKey: string
    model: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.testOpenAIConnection(credentials)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Validates Hedera account ID format
   */
  validateAccountId(accountId: string): boolean {
    const pattern = /^\d+\.\d+\.\d+$/
    return pattern.test(accountId)
  }

  /**
   * Validates Hedera private key format
   */
  validatePrivateKey(privateKey: string): boolean {
    return privateKey.length >= 64
  }

  /**
   * Validates OpenAI API key format
   */
  validateOpenAIApiKey(apiKey: string): boolean {
    return apiKey.startsWith('sk-') && apiKey.length > 20
  }

  /**
   * Validates Anthropic API key format
   */
  validateAnthropicApiKey(apiKey: string): boolean {
    return apiKey.startsWith('sk-ant-') && apiKey.length > 20
  }

  /**
   * Applies theme to the application
   */
  async applyTheme(theme: 'light' | 'dark'): Promise<void> {
    try {
      await window.electron.setTheme(theme)
      
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch (error) {
      throw new Error(`Failed to apply theme: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sets the auto-start preference
   */
  async setAutoStart(enabled: boolean): Promise<void> {
    try {
      await window.electron.setAutoStart(enabled)
    } catch (error) {
      throw new Error(`Failed to set auto-start: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sets the application log level
   */
  async setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): Promise<void> {
    try {
      await window.electron.setLogLevel(level)
    } catch (error) {
      throw new Error(`Failed to set log level: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const configService = new ConfigService()