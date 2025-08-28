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

jest.mock('../../../src/main/utils/logger')

import { ConfigService as MainConfigService } from '../../src/main/services/ConfigService'
import { configService as _rendererConfigService } from '../../src/renderer/services/configService'
import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig, AdvancedConfig } from '../../src/renderer/stores/configStore'

interface ExtendedAdvancedConfig extends AdvancedConfig {
  customField?: string
}

interface _TestAppConfig extends AppConfig {
  advanced: ExtendedAdvancedConfig
}

interface FutureAppConfig extends AppConfig {
  futureFeature?: {
    subConfig?: {
      option1: string
    }
  }
  deprecatedField?: string
}

/**
 * Integration test for config persistence to verify the full flow
 * from renderer → IPC → main process → file system → main process → IPC → renderer
 */
describe('Config Persistence Integration Tests', () => {
  let tempDir: string
  let configPath: string
  let mainConfigService: MainConfigService
  
  const testConfig = {
    hedera: {
      accountId: '0.0.12345',
      privateKey: 'integrationTestPrivateKey1234567890123456789012345678901234567890',
      network: 'testnet' as const
    },
    openai: {
      apiKey: 'sk-integrationtest123456789abcdef',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-integrationtest123456789',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark' as const,
      autoStart: true,
      logLevel: 'debug' as const
    },
    llmProvider: 'openai' as const
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'))
    configPath = path.join(tempDir, 'config.json')
  })

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
    
    jest.spyOn(app, 'getPath').mockReturnValue(tempDir)
    
    ;(MainConfigService as { instance?: MainConfigService }).instance = undefined
    mainConfigService = MainConfigService.getInstance()
    
    jest.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(true)
    jest.spyOn(safeStorage, 'encryptString').mockImplementation((str: string) => {
      return Buffer.from(`encrypted_${str}`)
    })
    jest.spyOn(safeStorage, 'decryptString').mockImplementation((buffer: Buffer) => {
      const str = buffer.toString()
      return str.replace('encrypted_', '')
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Main process ConfigService persistence', () => {
    it('should persist config to disk and load it back correctly', async () => {
      await mainConfigService.save(testConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      
      const loadedConfig = await mainConfigService.load()
      
      expect(loadedConfig).toEqual(testConfig)
    })

    it('should encrypt sensitive fields when saving', async () => {
      await mainConfigService.save(testConfig)
      
      const rawContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(rawContent)
      
      expect(savedData.hedera.privateKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.openai.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.anthropic.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      
      expect(savedData.hedera.accountId).toBe(testConfig.hedera.accountId)
      expect(savedData.hedera.network).toBe(testConfig.hedera.network)
      expect(savedData.advanced).toEqual(testConfig.advanced)
    })

    it('should handle multiple rapid save/load cycles without data loss', async () => {
      for (let i = 0; i < 5; i++) {
        const modifiedConfig = {
          ...testConfig,
          hedera: {
            ...testConfig.hedera,
            accountId: `0.0.${12345 + i}`
          }
        }
        
        await mainConfigService.save(modifiedConfig)
        
        const loaded = await mainConfigService.load()
        
        expect(loaded).toEqual(modifiedConfig)
        expect(loaded.hedera.privateKey).toBe(testConfig.hedera.privateKey)
        expect(loaded.openai.apiKey).toBe(testConfig.openai.apiKey)
      }
    })

    it('should handle corrupted config file gracefully', async () => {
      fs.writeFileSync(configPath, '{ invalid json }', 'utf8')
      
      const loaded = await mainConfigService.load()
      
      expect(loaded).toMatchObject({
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet'
        },
        openai: {
          apiKey: '',
          model: 'gpt-4o-mini'
        }
      })
    })

    it('should preserve config integrity when encryption is not available', async () => {
      jest.spyOn(safeStorage, 'isEncryptionAvailable').mockReturnValue(false)
      
      await mainConfigService.save(testConfig)
      
      const rawContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(rawContent)
      
      expect(savedData).toEqual(testConfig)
      
      const loaded = await mainConfigService.load()
      expect(loaded).toEqual(testConfig)
    })
  })

  describe('File system edge cases', () => {
    it('should handle read-only file system gracefully', async () => {
      await mainConfigService.save(testConfig)
      
      fs.chmodSync(configPath, 0o444)
      
      await expect(mainConfigService.save(testConfig)).rejects.toThrow()
      
      const loaded = await mainConfigService.load()
      expect(loaded.hedera.accountId).toBe(testConfig.hedera.accountId)
      
      fs.chmodSync(configPath, 0o644)
    })

    it('should create config directory if it does not exist', async () => {
      fs.rmSync(tempDir, { recursive: true, force: true })
      
      await mainConfigService.save(testConfig)
      
      expect(fs.existsSync(tempDir)).toBe(true)
      expect(fs.existsSync(configPath)).toBe(true)
      
      const loaded = await mainConfigService.load()
      expect(loaded).toEqual(testConfig)
    })

    it('should handle concurrent access gracefully', async () => {
      const configs = Array(10).fill(null).map((_, i) => ({
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: `0.0.${10000 + i}`
        }
      }))
      
      await Promise.all(configs.map(config => mainConfigService.save(config)))
      
      const loaded = await mainConfigService.load()
      
      const accountIds = configs.map(c => c.hedera.accountId)
      expect(accountIds).toContain(loaded.hedera.accountId)
      
      expect(loaded.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })
  })

  describe('Data validation and sanitization', () => {
    it('should handle very long sensitive fields', async () => {
      const longConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'x'.repeat(10000)
        },
        openai: {
          ...testConfig.openai,
          apiKey: 'sk-' + 'y'.repeat(5000)
        }
      }
      
      await mainConfigService.save(longConfig)
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe(longConfig.hedera.privateKey)
      expect(loaded.openai.apiKey).toBe(longConfig.openai.apiKey)
    })

    it('should handle special characters in sensitive fields', async () => {
      const specialCharsConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'key!@#$%^&*()_+-=[]{}|;\':",./<>?`~' + '0'.repeat(30)
        },
        openai: {
          ...testConfig.openai,
          apiKey: 'sk-special!@#$%test123'
        }
      }
      
      await mainConfigService.save(specialCharsConfig)
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe(specialCharsConfig.hedera.privateKey)
      expect(loaded.openai.apiKey).toBe(specialCharsConfig.openai.apiKey)
    })

    it('should handle unicode characters in config', async () => {
      const unicodeConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: '0.0.12345'
        },
        advanced: {
          ...testConfig.advanced,
          customField: '你好世界 🌍 émojis 🚀'
        } as ExtendedAdvancedConfig
      }
      
      await mainConfigService.save(unicodeConfig)
      const loaded = await mainConfigService.load()
      
      expect((loaded.advanced as ExtendedAdvancedConfig).customField).toBe('你好世界 🌍 émojis 🚀')
    })
  })

  describe('Migration and backward compatibility', () => {
    it('should handle configs with missing fields by merging with defaults', async () => {
      const partialConfig = {
        hedera: {
          accountId: '0.0.99999',
          network: 'mainnet' as const
        },
      }
      
      fs.writeFileSync(configPath, JSON.stringify(partialConfig, null, 2))
      
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.accountId).toBe('0.0.99999')
      expect(loaded.hedera.network).toBe('mainnet')
      expect(loaded.hedera.privateKey).toBe('')
      expect(loaded.openai).toBeDefined()
      expect(loaded.anthropic).toBeDefined()
      expect(loaded.advanced).toBeDefined()
    })

    it('should handle configs with extra fields', async () => {
      const configWithExtras = {
        ...testConfig,
        futureFeature: {
          enabled: true,
          settings: {
            option1: 'value1'
          }
        },
        deprecatedField: 'should be ignored'
      }
      
      await mainConfigService.save(configWithExtras as FutureAppConfig)
      
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera).toEqual(testConfig.hedera)
      expect(loaded.openai).toEqual(testConfig.openai)
      
      expect((loaded as FutureAppConfig).futureFeature).toEqual(configWithExtras.futureFeature)
    })
  })
})