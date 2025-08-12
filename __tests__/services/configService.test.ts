import { configService } from '../../src/renderer/services/configService'
import { AppConfig } from '../../src/renderer/stores/configStore'

const mockElectron = {
  saveConfig: jest.fn(),
  loadConfig: jest.fn(),
  testHederaConnection: jest.fn(),
  testOpenAIConnection: jest.fn(),
  setTheme: jest.fn(),
  setAutoStart: jest.fn(),
  setLogLevel: jest.fn(),
}

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
})

const mockClassList = {
  add: jest.fn(),
  remove: jest.fn(),
}

Object.defineProperty(document, 'documentElement', {
  value: {
    classList: mockClassList,
  },
  writable: true,
})

describe('configService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('IPC communication', () => {
    it('should properly serialize config data for IPC', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined)

      await configService.saveConfig(testConfig)

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(testConfig)
      expect(mockElectron.saveConfig).toHaveBeenCalledTimes(1)
    })

    it('should handle IPC timeout errors', async () => {
      const timeoutError = new Error('IPC call timed out')
      mockElectron.saveConfig.mockRejectedValue(timeoutError)

      await expect(configService.saveConfig(testConfig)).rejects.toThrow(
        'Failed to save configuration: IPC call timed out'
      )
    })

    it('should handle IPC channel errors', async () => {
      const channelError = new Error('IPC channel closed')
      mockElectron.loadConfig.mockRejectedValue(channelError)

      await expect(configService.loadConfig()).rejects.toThrow(
        'Failed to load configuration: IPC channel closed'
      )
    })
  })

  const testConfig: AppConfig = {
    hedera: {
      accountId: '0.0.12345',
      privateKey: '0x' + '0'.repeat(64),
      network: 'testnet'
    },
    openai: {
      apiKey: 'sk-test123456789',
      model: 'gpt-4o'
    },
    anthropic: {
      apiKey: 'sk-ant-test123456789',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark',
      autoStart: true,
      logLevel: 'debug'
    },
    llmProvider: 'openai'
  }

  describe('saveConfig', () => {
    it('should save configuration successfully', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined)

      await configService.saveConfig(testConfig)

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(testConfig)
    })

    it('should throw error on save failure', async () => {
      const error = new Error('Save failed')
      mockElectron.saveConfig.mockRejectedValue(error)

      await expect(configService.saveConfig(testConfig)).rejects.toThrow(
        'Failed to save configuration: Save failed'
      )
    })
  })

  describe('config persistence', () => {
    it('should verify config is persisted after save', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined)
      await configService.saveConfig(testConfig)

      mockElectron.loadConfig.mockResolvedValue(testConfig)
      const loaded = await configService.loadConfig()

      expect(loaded).toEqual(testConfig)
    })

    it('should handle partial config updates', async () => {
      const partialUpdate = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: '0.0.99999'
        }
      }

      mockElectron.saveConfig.mockResolvedValue(undefined)
      await configService.saveConfig(partialUpdate)

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(partialUpdate)
    })

    it('should not lose data on repeated saves', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined)

      await configService.saveConfig(testConfig)
      await configService.saveConfig(testConfig)
      await configService.saveConfig(testConfig)

      expect(mockElectron.saveConfig).toHaveBeenCalledTimes(3)
      expect(mockElectron.saveConfig).toHaveBeenCalledWith(testConfig)
    })
  })

  describe('loadConfig', () => {
    it('should load configuration successfully', async () => {
      mockElectron.loadConfig.mockResolvedValue(testConfig)

      const result = await configService.loadConfig()

      expect(result).toEqual(testConfig)
      expect(mockElectron.loadConfig).toHaveBeenCalled()
    })

    it('should return null when no config exists', async () => {
      mockElectron.loadConfig.mockResolvedValue(null)

      const result = await configService.loadConfig()

      expect(result).toBeNull()
    })

    it('should throw error on load failure', async () => {
      const error = new Error('Load failed')
      mockElectron.loadConfig.mockRejectedValue(error)

      await expect(configService.loadConfig()).rejects.toThrow(
        'Failed to load configuration: Load failed'
      )
    })
  })

  describe('testHederaConnection', () => {
    const credentials = {
      accountId: '0.0.12345',
      privateKey: '0x' + '0'.repeat(64),
      network: 'testnet' as const
    }

    it('should test connection successfully', async () => {
      const successResult = { success: true, balance: '100 HBAR' }
      mockElectron.testHederaConnection.mockResolvedValue(successResult)

      const result = await configService.testHederaConnection(credentials)

      expect(result).toEqual(successResult)
      expect(mockElectron.testHederaConnection).toHaveBeenCalledWith(credentials)
    })

    it('should handle connection test failure', async () => {
      const failureResult = { success: false, error: 'Invalid credentials' }
      mockElectron.testHederaConnection.mockResolvedValue(failureResult)

      const result = await configService.testHederaConnection(credentials)

      expect(result).toEqual(failureResult)
    })

    it('should handle connection test exception', async () => {
      const error = new Error('Network error')
      mockElectron.testHederaConnection.mockRejectedValue(error)

      const result = await configService.testHederaConnection(credentials)

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      })
    })
  })

  describe('testOpenAIConnection', () => {
    const credentials = {
      apiKey: 'sk-test123456789',
      model: 'gpt-4o'
    }

    it('should test connection successfully', async () => {
      const successResult = { success: true }
      mockElectron.testOpenAIConnection.mockResolvedValue(successResult)

      const result = await configService.testOpenAIConnection(credentials)

      expect(result).toEqual(successResult)
      expect(mockElectron.testOpenAIConnection).toHaveBeenCalledWith(credentials)
    })

    it('should handle connection test failure', async () => {
      const failureResult = { success: false, error: 'Invalid API key' }
      mockElectron.testOpenAIConnection.mockResolvedValue(failureResult)

      const result = await configService.testOpenAIConnection(credentials)

      expect(result).toEqual(failureResult)
    })

    it('should handle connection test exception', async () => {
      const error = new Error('API error')
      mockElectron.testOpenAIConnection.mockRejectedValue(error)

      const result = await configService.testOpenAIConnection(credentials)

      expect(result).toEqual({
        success: false,
        error: 'API error'
      })
    })
  })

  describe('sensitive data handling', () => {
    it('should maintain sensitive data integrity through IPC', async () => {
      const sensitiveConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'verySecretKey1234567890123456789012345678901234567890123456789012'
        },
        openai: {
          ...testConfig.openai,
          apiKey: 'sk-verysecretapikey123456789'
        }
      }

      mockElectron.saveConfig.mockResolvedValue(undefined)
      await configService.saveConfig(sensitiveConfig)

      const savedConfig = mockElectron.saveConfig.mock.calls[0][0]
      expect(savedConfig.hedera.privateKey).toBe(sensitiveConfig.hedera.privateKey)
      expect(savedConfig.openai.apiKey).toBe(sensitiveConfig.openai.apiKey)
    })
  })

  describe('validation methods', () => {
    describe('validateAccountId', () => {
      it('should validate correct account ID format', () => {
        expect(configService.validateAccountId('0.0.12345')).toBe(true)
        expect(configService.validateAccountId('0.0.1')).toBe(true)
        expect(configService.validateAccountId('10.20.30000')).toBe(true)
      })

      it('should reject invalid account ID format', () => {
        expect(configService.validateAccountId('12345')).toBe(false)
        expect(configService.validateAccountId('0.0')).toBe(false)
        expect(configService.validateAccountId('0.0.0.0')).toBe(false)
        expect(configService.validateAccountId('abc.def.ghi')).toBe(false)
        expect(configService.validateAccountId('')).toBe(false)
      })
    })

    describe('validatePrivateKey', () => {
      it('should validate correct private key length', () => {
        expect(configService.validatePrivateKey('0x' + '0'.repeat(64))).toBe(true)
        expect(configService.validatePrivateKey('a'.repeat(64))).toBe(true)
        expect(configService.validatePrivateKey('1234567890'.repeat(10))).toBe(true)
      })

      it('should reject invalid private key length', () => {
        expect(configService.validatePrivateKey('0x' + '0'.repeat(63))).toBe(false)
        expect(configService.validatePrivateKey('short')).toBe(false)
        expect(configService.validatePrivateKey('')).toBe(false)
      })

      it('should validate Hedera private key formats', () => {
        expect(configService.validatePrivateKey('302e020100300506032b657004220420' + '0'.repeat(32))).toBe(true)
        expect(configService.validatePrivateKey('302a300506032b6570032100' + 'a'.repeat(64))).toBe(true)
      })
    })

    describe('validateOpenAIApiKey', () => {
      it('should validate correct API key format', () => {
        expect(configService.validateOpenAIApiKey('sk-' + 'a'.repeat(20))).toBe(true)
        expect(configService.validateOpenAIApiKey('sk-proj-' + 'a'.repeat(40))).toBe(true)
      })

      it('should reject invalid API key format', () => {
        expect(configService.validateOpenAIApiKey('invalid')).toBe(false)
        expect(configService.validateOpenAIApiKey('sk-')).toBe(false)
        expect(configService.validateOpenAIApiKey('sk-short')).toBe(false)
        expect(configService.validateOpenAIApiKey('')).toBe(false)
      })
    })

    describe('validateAnthropicApiKey', () => {
      it('should validate correct Anthropic API key format', () => {
        expect(configService.validateAnthropicApiKey?.('sk-ant-' + 'a'.repeat(20))).toBe(true)
      })

      it('should reject invalid Anthropic API key format', () => {
        expect(configService.validateAnthropicApiKey?.('invalid')).toBe(false)
        expect(configService.validateAnthropicApiKey?.('sk-ant-')).toBe(false)
        expect(configService.validateAnthropicApiKey?.('')).toBe(false)
      })
    })
  })

  describe('applyTheme', () => {
    it('should apply dark theme', async () => {
      mockElectron.setTheme.mockResolvedValue(undefined)

      await configService.applyTheme('dark')

      expect(mockElectron.setTheme).toHaveBeenCalledWith('dark')
      expect(mockClassList.add).toHaveBeenCalledWith('dark')
    })

    it('should apply light theme', async () => {
      mockElectron.setTheme.mockResolvedValue(undefined)

      await configService.applyTheme('light')

      expect(mockElectron.setTheme).toHaveBeenCalledWith('light')
      expect(mockClassList.remove).toHaveBeenCalledWith('dark')
    })

    it('should throw error on theme application failure', async () => {
      const error = new Error('Theme error')
      mockElectron.setTheme.mockRejectedValue(error)

      await expect(configService.applyTheme('dark')).rejects.toThrow(
        'Failed to apply theme: Theme error'
      )
    })
  })

  describe('setAutoStart', () => {
    it('should enable auto-start', async () => {
      mockElectron.setAutoStart.mockResolvedValue(undefined)

      await configService.setAutoStart(true)

      expect(mockElectron.setAutoStart).toHaveBeenCalledWith(true)
    })

    it('should disable auto-start', async () => {
      mockElectron.setAutoStart.mockResolvedValue(undefined)

      await configService.setAutoStart(false)

      expect(mockElectron.setAutoStart).toHaveBeenCalledWith(false)
    })

    it('should throw error on auto-start failure', async () => {
      const error = new Error('Auto-start error')
      mockElectron.setAutoStart.mockRejectedValue(error)

      await expect(configService.setAutoStart(true)).rejects.toThrow(
        'Failed to set auto-start: Auto-start error'
      )
    })
  })

  describe('setLogLevel', () => {
    it('should set log level to debug', async () => {
      mockElectron.setLogLevel.mockResolvedValue(undefined)

      await configService.setLogLevel('debug')

      expect(mockElectron.setLogLevel).toHaveBeenCalledWith('debug')
    })

    it('should set log level to error', async () => {
      mockElectron.setLogLevel.mockResolvedValue(undefined)

      await configService.setLogLevel('error')

      expect(mockElectron.setLogLevel).toHaveBeenCalledWith('error')
    })

    it('should throw error on log level failure', async () => {
      const error = new Error('Log level error')
      mockElectron.setLogLevel.mockRejectedValue(error)

      await expect(configService.setLogLevel('info')).rejects.toThrow(
        'Failed to set log level: Log level error'
      )
    })
  })

  describe('error scenarios and edge cases', () => {
    it('should handle concurrent save operations', async () => {
      mockElectron.saveConfig.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      const save1 = configService.saveConfig(testConfig)
      const save2 = configService.saveConfig(testConfig)
      const save3 = configService.saveConfig(testConfig)

      await Promise.all([save1, save2, save3])

      expect(mockElectron.saveConfig).toHaveBeenCalledTimes(3)
    })

    it('should handle rapid save/load cycles', async () => {
      mockElectron.saveConfig.mockResolvedValue(undefined)
      mockElectron.loadConfig.mockResolvedValue(testConfig)

      for (let i = 0; i < 10; i++) {
        await configService.saveConfig(testConfig)
        const loaded = await configService.loadConfig()
        expect(loaded).toEqual(testConfig)
      }

      expect(mockElectron.saveConfig).toHaveBeenCalledTimes(10)
      expect(mockElectron.loadConfig).toHaveBeenCalledTimes(10)
    })

    it('should handle large config objects', async () => {
      const largeConfig = {
        ...testConfig,
        customData: {
          largeArray: new Array(1000).fill('data'),
          nestedObject: {
            deep: {
              nested: {
                data: 'value'.repeat(1000)
              }
            }
          }
        }
      }

      mockElectron.saveConfig.mockResolvedValue(undefined)
      await configService.saveConfig(largeConfig as any)

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(largeConfig)
    })

    it('should handle undefined and null values in config', async () => {
      const configWithNulls = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: undefined as any
        },
        openai: null as any
      }

      mockElectron.saveConfig.mockResolvedValue(undefined)
      await configService.saveConfig(configWithNulls)

      expect(mockElectron.saveConfig).toHaveBeenCalledWith(configWithNulls)
    })
  })
})