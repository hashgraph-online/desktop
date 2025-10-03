import { Logger } from '@hashgraphonline/standards-sdk'
import { AppConfig } from '../stores/configStore'

const PREVIEW_STORAGE_KEY = 'moonscape.preview.config'

const logger = new Logger({ module: 'ConfigService' })

const getDesktopBridge = () => (typeof window === 'undefined' ? undefined : window.desktop)

const savePreviewConfig = (config: AppConfig): void => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(config))
  } catch (storageError) {
    logger.warn('Preview config save failed', { error: storageError })
  }
}

const loadPreviewConfig = (): AppConfig | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const value = window.localStorage.getItem(PREVIEW_STORAGE_KEY)
    return value ? (JSON.parse(value) as AppConfig) : null
  } catch (parseError) {
    logger.warn('Preview config load failed', { error: parseError })
    return null
  }
}

/**
 * Configuration service that handles IPC communication for app settings
 */
export class ConfigService {
  /**
   * Saves the application configuration using IPC
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      const desktop = getDesktopBridge()
      if (desktop?.saveConfig) {
        await desktop.saveConfig(config)
      } else {
        savePreviewConfig(config)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unknown error'
      throw new Error(`Failed to save configuration: ${message}`)
    }
  }

  /**
   * Loads the application configuration using IPC
   */
  async loadConfig(): Promise<AppConfig | null> {
    try {
      const desktop = getDesktopBridge()
      if (desktop?.loadConfig) {
        const response = await desktop.loadConfig()
        if (!response.success) {
          throw new Error(response.error || 'Unknown error')
        }
        const config = response.config ?? null
        if (config) {
          savePreviewConfig(config)
        }
        return config
      }

      return loadPreviewConfig()
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
    const desktop = getDesktopBridge()
    if (!desktop?.testHederaConnection) {
      return {
        success: false,
        error: 'Desktop bridge is unavailable'
      }
    }

    try {
      return await desktop.testHederaConnection(credentials)
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
    const desktop = getDesktopBridge()
    if (!desktop?.testOpenAIConnection) {
      return {
        success: false,
        error: 'Desktop bridge is unavailable'
      }
    }

    try {
      return await desktop.testOpenAIConnection(credentials)
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
      const desktop = getDesktopBridge()
      if (desktop?.setTheme) {
        await desktop.setTheme(theme)
      }

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
    const desktop = getDesktopBridge()
    if (!desktop?.setAutoStart) {
      return
    }

    try {
      await desktop.setAutoStart(enabled)
    } catch (error) {
      throw new Error(`Failed to set auto-start: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sets the application log level
   */
  async setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): Promise<void> {
    const desktop = getDesktopBridge()
    if (!desktop?.setLogLevel) {
      return
    }

    try {
      await desktop.setLogLevel(level)
    } catch (error) {
      throw new Error(`Failed to set log level: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const configService = new ConfigService()
