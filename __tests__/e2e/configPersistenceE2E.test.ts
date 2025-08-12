import { ConfigService } from '../../src/main/services/ConfigService'
import { configService as rendererConfigService } from '../../src/renderer/services/configService'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

import { app, safeStorage } from 'electron'

/**
 * End-to-end test that simulates the full config save/load cycle
 * including app restarts and validates data integrity
 */
describe('Config Persistence E2E Tests', () => {
  let tempDir: string
  let configPath: string
  
  const realWorldConfig = {
    hedera: {
      accountId: '0.0.3996850',
      privateKey: '302e020100300706052b8104000a04220420abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      network: 'testnet' as const
    },
    openai: {
      apiKey: 'sk-proj-VeryLongRealAPIKeyWith48CharactersOrMore123456',
      model: 'gpt-4o-mini' as const
    },
    anthropic: {
      apiKey: 'sk-ant-api03-VeryLongAnthropicKeyWith48CharsOrMore1234',
      model: 'claude-3-5-sonnet-20241022' as const
    },
    advanced: {
      theme: 'dark' as const,
      autoStart: false,
      logLevel: 'info' as const
    },
    llmProvider: 'openai' as const
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-e2e-test-'))
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
    
    jest.clearAllMocks()
    
    ;(app.getPath as jest.Mock).mockReturnValue(tempDir)
    
    const encryptionStore = new Map<string, string>()
    
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((plaintext: string) => {
      const encrypted = Buffer.from(JSON.stringify({
        iv: Math.random().toString(36).substring(7),
        data: Buffer.from(plaintext).toString('base64')
      }))
      const key = encrypted.toString('base64')
      encryptionStore.set(key, plaintext)
      return encrypted
    })
    
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const key = buffer.toString('base64')
      const plaintext = encryptionStore.get(key)
      if (!plaintext) {
        throw new Error('Decryption failed - invalid key')
      }
      return plaintext
    })
    
    ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
  })

  describe('Full Application Lifecycle', () => {
    it('should persist config through full app lifecycle', async () => {
      const firstLaunchService = ConfigService.getInstance()
      await firstLaunchService.save(realWorldConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      const savedContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(savedContent)
      
      
      expect(savedData.hedera.privateKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.openai.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.anthropic.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      
      expect(savedData.hedera.accountId).toBe(realWorldConfig.hedera.accountId)
      expect(savedData.advanced.theme).toBe('dark')
      
      ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
      const secondLaunchService = ConfigService.getInstance()
      
      const loadedConfig = await secondLaunchService.load()
      
      
      expect(loadedConfig).toEqual(realWorldConfig)
      
      const updatedConfig = {
        ...loadedConfig,
        hedera: {
          ...loadedConfig.hedera,
          accountId: '0.0.9999999'
        },
        advanced: {
          ...loadedConfig.advanced,
          theme: 'light' as const
        }
      }
      
      await secondLaunchService.save(updatedConfig)
      
      ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
      const thirdLaunchService = ConfigService.getInstance()
      
      const finalConfig = await thirdLaunchService.load()
      
      expect(finalConfig.hedera.accountId).toBe('0.0.9999999')
      expect(finalConfig.advanced.theme).toBe('light')
      
      expect(finalConfig.hedera.privateKey).toBe(realWorldConfig.hedera.privateKey)
      expect(finalConfig.openai.apiKey).toBe(realWorldConfig.openai.apiKey)
    })

    it('should handle encryption unavailability gracefully', async () => {
      ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false)
      
      const service = ConfigService.getInstance()
      await service.save(realWorldConfig)
      
      const savedContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(savedContent)
      
      expect(savedData.hedera.privateKey).toBe(realWorldConfig.hedera.privateKey)
      expect(savedData.openai.apiKey).toBe(realWorldConfig.openai.apiKey)
      
      const loaded = await service.load()
      expect(loaded).toEqual(realWorldConfig)
    })

    it('should recover from corrupted encryption', async () => {
      const service = ConfigService.getInstance()
      await service.save(realWorldConfig)
      
      const savedContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(savedContent)
      savedData.hedera.privateKey = 'CorruptedBase64Data=='
      fs.writeFileSync(configPath, JSON.stringify(savedData, null, 2))
      
      const originalDecrypt = safeStorage.decryptString as jest.Mock
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
        const base64 = buffer.toString('base64')
        if (base64 === 'CorruptedBase64Data==') {
          throw new Error('Invalid encrypted data')
        }
        return originalDecrypt(buffer)
      })
      
      const loaded = await service.load()
      
      expect(loaded.hedera.privateKey).toBe('CorruptedBase64Data==')
      expect(loaded.openai.apiKey).toBe(realWorldConfig.openai.apiKey)
    })

    it('should handle rapid save/load cycles without corruption', async () => {
      const service = ConfigService.getInstance()
      
      for (let i = 0; i < 10; i++) {
        const modifiedConfig = {
          ...realWorldConfig,
          hedera: {
            ...realWorldConfig.hedera,
            accountId: `0.0.${1000000 + i}`
          }
        }
        
        await service.save(modifiedConfig)
        const loaded = await service.load()
        
        expect(loaded.hedera.accountId).toBe(`0.0.${1000000 + i}`)
        expect(loaded.hedera.privateKey).toBe(realWorldConfig.hedera.privateKey)
        expect(loaded.openai.apiKey).toBe(realWorldConfig.openai.apiKey)
      }
    })

    it('should handle empty or missing sensitive fields', async () => {
      const configWithEmptyFields = {
        ...realWorldConfig,
        hedera: {
          ...realWorldConfig.hedera,
          privateKey: ''
        },
        openai: {
          ...realWorldConfig.openai,
          apiKey: ''
        }
      }
      
      const service = ConfigService.getInstance()
      await service.save(configWithEmptyFields)
      
      const loaded = await service.load()
      
      expect(loaded.hedera.privateKey).toBe('')
      expect(loaded.openai.apiKey).toBe('')
      expect(loaded.anthropic.apiKey).toBe(realWorldConfig.anthropic.apiKey)
    })
  })

  describe('Renderer Integration', () => {
    it('should handle IPC communication correctly', async () => {
      const mockElectron = {
        saveConfig: jest.fn().mockResolvedValue(undefined),
        loadConfig: jest.fn().mockResolvedValue(realWorldConfig)
      }
      
      ;(global as unknown as { window: { electron: typeof mockElectron } }).window = { electron: mockElectron }
      
      await rendererConfigService.saveConfig(realWorldConfig)
      expect(mockElectron.saveConfig).toHaveBeenCalledWith(realWorldConfig)
      
      const loaded = await rendererConfigService.loadConfig()
      expect(loaded).toEqual(realWorldConfig)
    })

    it('should validate config fields correctly', () => {
      expect(rendererConfigService.validateAccountId('0.0.12345')).toBe(true)
      expect(rendererConfigService.validateAccountId('invalid')).toBe(false)
      
      expect(rendererConfigService.validatePrivateKey(realWorldConfig.hedera.privateKey)).toBe(true)
      expect(rendererConfigService.validatePrivateKey('too-short')).toBe(false)
      
      expect(rendererConfigService.validateOpenAIApiKey(realWorldConfig.openai.apiKey)).toBe(true)
      expect(rendererConfigService.validateOpenAIApiKey('invalid-key')).toBe(false)
      
      expect(rendererConfigService.validateAnthropicApiKey(realWorldConfig.anthropic.apiKey)).toBe(true)
      expect(rendererConfigService.validateAnthropicApiKey('invalid-key')).toBe(false)
    })
  })
})