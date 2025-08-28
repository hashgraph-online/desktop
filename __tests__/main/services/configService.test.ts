import { ConfigService } from '../../../src/main/services/ConfigService'
import { app, safeStorage } from 'electron'
import * as fs from 'fs'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn()
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn()
  }
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn()
  }
}))

jest.mock('../../../src/main/utils/logger')

describe('ConfigService - Main Process', () => {
  let configService: ConfigService
  const mockUserDataPath = '/mock/user/data'
  const mockConfigPath = '/mock/user/data/config.json'
  
  const testConfig = {
    hedera: {
      accountId: '0.0.12345',
      privateKey: 'myPrivateKey123456789012345678901234567890123456789012345678901234',
      network: 'testnet' as const
    },
    openai: {
      apiKey: 'sk-test123456789abcdef',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-test123456789',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark' as const,
      autoStart: true,
      logLevel: 'debug' as const
    },
    llmProvider: 'openai' as const
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    ;(ConfigService as unknown as { instance: undefined }).instance = undefined
    
    ;(app.getPath as jest.Mock).mockReturnValue(mockUserDataPath)
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((str: string) => {
      return Buffer.from(`encrypted_${str}`)
    })
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const str = buffer.toString()
      return str.replace('encrypted_', '')
    })
    
    const writtenFiles = new Map<string, string>()
    ;(fs.promises.writeFile as jest.Mock).mockImplementation(async (path: string, data: string, options: { flag?: string }) => {
      if (options?.flag === 'a') {
        return
      }
      writtenFiles.set(path, data)
    })
    ;(fs.promises.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path.includes('.config-transaction.log')) {
        throw new Error('ENOENT: no such file or directory')
      }
      const data = writtenFiles.get(path)
      if (!data) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      }
      return data
    })
    
    ;(fs.existsSync as jest.Mock).mockReturnValue(false)
    
    configService = ConfigService.getInstance()
  })

  describe('save()', () => {
    it('should save config with encrypted sensitive fields', async () => {

      await configService.save(testConfig)

      expect(fs.promises.mkdir).toHaveBeenCalledWith(mockUserDataPath, { recursive: true })
      expect(fs.promises.writeFile).toHaveBeenCalled()
      
      const tempFileCall = (fs.promises.writeFile as jest.Mock).mock.calls.find(
        call => call[0].includes('.tmp.') && !call[2]?.flag
      )
      expect(tempFileCall).toBeDefined()
      expect(tempFileCall[0]).toMatch(/config\.json\.tmp\.[a-f0-9]+$/)
      expect(tempFileCall[2]).toBe('utf8')
      
      const savedData = JSON.parse(tempFileCall[1])
      expect(savedData.hedera.accountId).toBe(testConfig.hedera.accountId)
      expect(savedData.hedera.privateKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.openai.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.anthropic.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      
      expect(fs.promises.rename).toHaveBeenCalled()
      const renameCall = (fs.promises.rename as jest.Mock).mock.calls[0]
      expect(renameCall[0]).toMatch(/config\.json\.tmp\.[a-f0-9]+$/)
      expect(renameCall[1]).toBe(mockConfigPath)
      
      expect(safeStorage.encryptString).toHaveBeenCalledTimes(3)
      expect(safeStorage.encryptString).toHaveBeenCalledWith(testConfig.hedera.privateKey)
      expect(safeStorage.encryptString).toHaveBeenCalledWith(testConfig.openai.apiKey)
      expect(safeStorage.encryptString).toHaveBeenCalledWith(testConfig.anthropic.apiKey)
    })

    it('should save config without encryption when safeStorage is not available', async () => {
      ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false)

      await configService.save(testConfig)

      const tempFileCall = (fs.promises.writeFile as jest.Mock).mock.calls.find(
        call => call[0].includes('.tmp.') && !call[2]?.flag
      )
      expect(tempFileCall).toBeDefined()
      
      expect(fs.promises.rename).toHaveBeenCalled()
      const renameCall = (fs.promises.rename as jest.Mock).mock.calls[0]
      expect(renameCall[1]).toBe(mockConfigPath)
      
      const savedData = JSON.parse(tempFileCall[1])
      expect(savedData.hedera.privateKey).toBe(testConfig.hedera.privateKey)
      expect(savedData.openai.apiKey).toBe(testConfig.openai.apiKey)
      expect(savedData.anthropic.apiKey).toBe(testConfig.anthropic.apiKey)
      expect(safeStorage.encryptString).not.toHaveBeenCalled()
    })

    it('should not modify the original config object', async () => {
      const originalConfig = JSON.parse(JSON.stringify(testConfig))

      await configService.save(testConfig)

      expect(testConfig).toEqual(originalConfig)
    })

    it('should handle save errors gracefully', async () => {
      const error = new Error('Write permission denied')
      ;(fs.promises.writeFile as jest.Mock).mockRejectedValue(error)

      await expect(configService.save(testConfig)).rejects.toThrow(error)
    })

    it('should create user data directory if it does not exist', async () => {
      const writtenData = new Map<string, string>()
      ;(fs.promises.writeFile as jest.Mock).mockImplementation(async (path: string, data: string, options: { flag?: string }) => {
        if (options?.flag !== 'a') {
          writtenData.set(path, data)
        }
      })
      ;(fs.promises.readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.includes('.config-transaction.log')) {
          throw new Error('ENOENT: no such file or directory')
        }
        const data = writtenData.get(path)
        if (data) return data
        throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      })
      
      await configService.save(testConfig)

      expect(fs.promises.mkdir).toHaveBeenCalledWith(mockUserDataPath, { recursive: true })
    })
  })

  describe('load()', () => {
    it('should load and decrypt config successfully', async () => {
      const encryptedConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'ZW5jcnlwdGVkX215UHJpdmF0ZUtleTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ='
        },
        openai: {
          ...testConfig.openai,
          apiKey: 'ZW5jcnlwdGVkX3NrLXRlc3QxMjM0NTY3ODlhYmNkZWY='
        },
        anthropic: {
          ...testConfig.anthropic,
          apiKey: 'ZW5jcnlwdGVkX3NrLWFudC10ZXN0MTIzNDU2Nzg5'
        }
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(encryptedConfig))

      let decryptCallCount = 0
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((_buffer: Buffer) => {
        decryptCallCount++
        if (decryptCallCount === 1) return testConfig.hedera.privateKey
        if (decryptCallCount === 2) return testConfig.openai.apiKey
        if (decryptCallCount === 3) return testConfig.anthropic.apiKey
        return ''
      })

      const result = await configService.load()

      expect(result).toEqual(testConfig)
      expect(safeStorage.decryptString).toHaveBeenCalledTimes(3)
    })

    it('should return default config when file does not exist', async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

      const result = await configService.load()

      expect(result).toEqual({
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet'
        },
        openai: {
          apiKey: '',
          model: 'gpt-4o-mini'
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022'
        },
        advanced: {
          theme: 'light',
          autoStart: false,
          logLevel: 'info'
        },
        llmProvider: 'openai'
      })
      expect(fs.promises.readFile).not.toHaveBeenCalled()
    })

    it('should handle already decrypted values gracefully', async () => {
      const configWithMixedValues = {
        hedera: {
          accountId: '0.0.12345',
          privateKey: 'alreadyDecryptedPrivateKey1234567890123456789012345678901234567890',
          network: 'testnet' as const
        },
        openai: {
          apiKey: 'ZW5jcnlwdGVkX3NrLXRlc3QxMjM0NTY3ODlhYmNkZWY=',
          model: 'gpt-4o-mini'
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022'
        },
        advanced: testConfig.advanced,
        llmProvider: testConfig.llmProvider
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(configWithMixedValues))
      ;(safeStorage.decryptString as jest.Mock).mockImplementation(() => testConfig.openai.apiKey)

      const result = await configService.load()

      expect(result.hedera.privateKey).toBe('alreadyDecryptedPrivateKey1234567890123456789012345678901234567890')
      expect(result.openai.apiKey).toBe(testConfig.openai.apiKey)
      expect(safeStorage.decryptString).toHaveBeenCalledTimes(1)
    })

    it('should handle decryption errors without clearing values', async () => {
      const encryptedConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'ZW5jcnlwdGVkX215UHJpdmF0ZUtleTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ='
        }
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(encryptedConfig))
      ;(safeStorage.decryptString as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      const result = await configService.load()

      expect(result.hedera.privateKey).toBe(encryptedConfig.hedera.privateKey)
    })

    it('should merge loaded config with defaults', async () => {
      const partialConfig = {
        hedera: {
          accountId: '0.0.99999',
          privateKey: 'partialKey',
          network: 'mainnet' as const
        }
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(partialConfig))
      
      ;(safeStorage.decryptString as jest.Mock).mockImplementation(() => 'partialKey')

      const result = await configService.load()

      expect(result.hedera.accountId).toBe(partialConfig.hedera.accountId)
      expect(result.hedera.network).toBe(partialConfig.hedera.network)
      expect(result.hedera.privateKey).toBe('partialKey')
      expect(result.openai).toBeDefined()
      expect(result.anthropic).toBeDefined()
      expect(result.advanced).toBeDefined()
      expect(result.llmProvider).toBe('openai')
    })

    it('should handle malformed JSON gracefully', async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{ invalid json }')

      const result = await configService.load()

      expect(result).toEqual(expect.objectContaining({
        hedera: expect.any(Object),
        openai: expect.any(Object),
        anthropic: expect.any(Object),
        advanced: expect.any(Object),
        llmProvider: expect.any(String)
      }))
    })

    it('should handle read errors gracefully', async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Permission denied'))

      const result = await configService.load()

      expect(result).toEqual(expect.objectContaining({
        hedera: expect.any(Object),
        openai: expect.any(Object),
        anthropic: expect.any(Object),
        advanced: expect.any(Object),
        llmProvider: expect.any(String)
      }))
    })
  })

  describe('save() and load() integration', () => {
    it('should correctly round-trip config through save and load', async () => {
      let finalData: string = ''
      const tempFiles = new Map<string, string>()
      
      ;(fs.promises.writeFile as jest.Mock).mockImplementation((path: string, data: string, options: { flag?: string }) => {
        if (options?.flag !== 'a') {
          tempFiles.set(path, data)
        }
        return Promise.resolve()
      })
      
      ;(fs.promises.rename as jest.Mock).mockImplementation((from: string, to: string) => {
        const data = tempFiles.get(from)
        if (data && to === mockConfigPath) {
          finalData = data
        }
        return Promise.resolve()
      })
      
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.config-transaction.log')) {
          return Promise.reject(new Error('ENOENT'))
        }
        if (path.includes('.tmp.')) {
          return Promise.resolve(tempFiles.get(path) || '')
        }
        return Promise.resolve(finalData)
      })

      const encryptedValues = new Map<string, string>()
      ;(safeStorage.encryptString as jest.Mock).mockImplementation((str: string) => {
        const encrypted = Buffer.from(`encrypted_${str}`)
        const base64 = encrypted.toString('base64')
        encryptedValues.set(base64, str)
        return encrypted
      })
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((_buffer: Buffer) => {
        const base64 = buffer.toString('base64')
        return encryptedValues.get(base64) || ''
      })

      await configService.save(testConfig)
      const loadedConfig = await configService.load()

      expect(loadedConfig).toEqual(testConfig)
    })

    it('should maintain data integrity across multiple save/load cycles', async () => {
      let finalData: string = ''
      const tempFiles = new Map<string, string>()
      
      ;(fs.promises.writeFile as jest.Mock).mockImplementation((path: string, data: string, options: { flag?: string }) => {
        if (options?.flag !== 'a') {
          tempFiles.set(path, data)
        }
        return Promise.resolve()
      })
      
      ;(fs.promises.rename as jest.Mock).mockImplementation((from: string, to: string) => {
        const data = tempFiles.get(from)
        if (data && to === mockConfigPath) {
          finalData = data
        }
        return Promise.resolve()
      })
      
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.promises.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.config-transaction.log')) {
          return Promise.reject(new Error('ENOENT'))
        }
        if (path.includes('.tmp.')) {
          return Promise.resolve(tempFiles.get(path) || '')
        }
        return Promise.resolve(finalData)
      })

      const encryptedMap = new Map<string, string>()
      ;(safeStorage.encryptString as jest.Mock).mockImplementation((str: string) => {
        const encrypted = `encrypted_${str}`
        const buffer = Buffer.from(encrypted)
        const base64 = buffer.toString('base64')
        encryptedMap.set(base64, str)
        return buffer
      })
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((_buffer: Buffer) => {
        const base64 = buffer.toString('base64')
        return encryptedMap.get(base64) || ''
      })

      await configService.save(testConfig)
      const loaded1 = await configService.load()
      await configService.save(loaded1)
      const loaded2 = await configService.load()
      await configService.save(loaded2)
      const loaded3 = await configService.load()

      expect(loaded1).toEqual(testConfig)
      expect(loaded2).toEqual(testConfig)
      expect(loaded3).toEqual(testConfig)
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigService.getInstance()
      const instance2 = ConfigService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('edge cases and error scenarios', () => {
    it('should handle empty sensitive fields', async () => {
      const configWithEmptyFields = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: ''
        },
        openai: {
          ...testConfig.openai,
          apiKey: ''
        }
      }

      await configService.save(configWithEmptyFields)

      expect(safeStorage.encryptString).toHaveBeenCalledTimes(1)
    })

    it('should handle missing sensitive fields', async () => {
      const configWithMissingFields = {
        hedera: {
          accountId: '0.0.12345',
          network: 'testnet' as const
        },
        openai: {
          model: 'gpt-4o-mini'
        },
        anthropic: testConfig.anthropic,
        advanced: testConfig.advanced,
        llmProvider: testConfig.llmProvider
      }

      await configService.save(configWithMissingFields as Partial<typeof import('../../../src/main/services/config-service').AppConfig>)

      expect(safeStorage.encryptString).toHaveBeenCalledTimes(1)
    })

    it('should validate that config path uses app userData directory', () => {
      expect(app.getPath).toHaveBeenCalledWith('userData')
      expect((configService as unknown as { configPath: string }).configPath).toBe(mockConfigPath)
    })
  })
})