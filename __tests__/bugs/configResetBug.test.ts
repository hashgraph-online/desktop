import { ConfigService } from '../../src/main/services/ConfigService'
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
 * Test suite specifically designed to reproduce and verify the config reset bug
 * where configuration values are lost on app restart
 */
describe('Config Reset Bug - Reproduction Tests', () => {
  let tempDir: string
  let configPath: string
  let configService: ConfigService
  
  const validConfig = {
    hedera: {
      accountId: '0.0.3996850',
      privateKey: '3030020100300706052b8104000a042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      network: 'testnet' as const
    },
    openai: {
      apiKey: 'sk-proj-abcdef123456789012345678901234567890',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-api03-123456789012345678901234567890',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark' as const,
      autoStart: false,
      logLevel: 'info' as const
    },
    llmProvider: 'openai' as const
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-bug-test-'))
    configPath = path.join(tempDir, 'config.json')
    
    ;(app.getPath as jest.Mock).mockReturnValue(tempDir)
    
    ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
    
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    
    const encryptionMap = new Map<string, string>()
    
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((str: string) => {
      const encrypted = Buffer.from(JSON.stringify({ 
        encrypted: true, 
        data: Buffer.from(str).toString('base64') 
      }))
      const key = encrypted.toString('base64')
      encryptionMap.set(key, str)
      return encrypted
    })
    
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const key = buffer.toString('base64')
      const decrypted = encryptionMap.get(key)
      if (!decrypted) {
        throw new Error('Decryption failed - key not found')
      }
      return decrypted
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('Bug Reproduction', () => {
    it('BUG: Config values should persist after save and reload', async () => {
      const firstInstance = ConfigService.getInstance()
      
      await firstInstance.save(validConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      
      const rawContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(rawContent)
      expect(savedData.hedera.accountId).toBe(validConfig.hedera.accountId)
      
      ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
      const secondInstance = ConfigService.getInstance()
      
      const loadedConfig = await secondInstance.load()
      
      expect(loadedConfig.hedera.accountId).toBe(validConfig.hedera.accountId)
      expect(loadedConfig.hedera.privateKey).toBe(validConfig.hedera.privateKey)
      expect(loadedConfig.openai.apiKey).toBe(validConfig.openai.apiKey)
      expect(loadedConfig.advanced.theme).toBe('dark')
    })

    it('BUG: Encrypted values should be properly decrypted on load', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      const savedContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(savedContent)
      
      
      ;(ConfigService as unknown as { instance: ConfigService | undefined }).instance = undefined
      const newConfigService = ConfigService.getInstance()
      const loaded = await newConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe(validConfig.hedera.privateKey)
      expect(loaded.hedera.privateKey).not.toContain('encrypted')
    })

    it('BUG: Multiple save/load cycles should not corrupt data', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      const loaded1 = await configService.load()
      expect(loaded1.hedera.privateKey).toBe(validConfig.hedera.privateKey)
      
      await configService.save(loaded1)
      
      const loaded2 = await configService.load()
      expect(loaded2.hedera.privateKey).toBe(validConfig.hedera.privateKey)
      
      await configService.save(loaded2)
      const loaded3 = await configService.load()
      
      expect(loaded3).toEqual(validConfig)
    })

    it('BUG: Config should handle already-decrypted values on save', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      const loaded = await configService.load()
      
      const corruptedSave = {
        ...loaded,
        hedera: {
          ...loaded.hedera,
          privateKey: loaded.hedera.privateKey
        }
      }
      
      await configService.save(corruptedSave)
      
      const reloaded = await configService.load()
      
      expect(reloaded.hedera.privateKey).toBe(validConfig.hedera.privateKey)
    })

    it('BUG: Empty config values should not override existing values', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      const loaded = await configService.load()
      expect(loaded.hedera.accountId).toBe(validConfig.hedera.accountId)
      
      const partialConfig = {
        ...loaded,
        hedera: {
          ...loaded.hedera,
          privateKey: ''
        }
      }
      
      await configService.save(partialConfig)
      
      const reloaded = await configService.load()
      
      expect(reloaded.hedera.privateKey).toBe('')
    })
  })

  describe('Encryption Edge Cases', () => {
    it('should handle decryption failures gracefully', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      const savedContent = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(savedContent)
      
      savedData.hedera.privateKey = 'Y29ycnVwdGVkX2RhdGE='
      
      fs.writeFileSync(configPath, JSON.stringify(savedData, null, 2))
      
      const originalDecrypt = safeStorage.decryptString as jest.Mock
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
        const base64 = buffer.toString('base64')
        if (base64 === 'Y29ycnVwdGVkX2RhdGE=') {
          throw new Error('Decryption failed')
        }
        return originalDecrypt(buffer)
      })
      
      const loaded = await configService.load()
      
      expect(loaded.hedera.privateKey).toBe('Y29ycnVwdGVkX2RhdGE=')
    })

    it('should detect and handle mixed encrypted/decrypted values', async () => {
      const configService = ConfigService.getInstance()
      
      const mixedConfig = {
        hedera: {
          accountId: '0.0.3996850',
          privateKey: validConfig.hedera.privateKey,
          network: 'testnet'
        },
        openai: {
          apiKey: 'ZW5jcnlwdGVkX2RhdGE=',
          model: 'gpt-4o-mini'
        },
        anthropic: {
          apiKey: 'sk-ant-plaintext123',
          model: 'claude-3-5-sonnet-20241022'
        },
        advanced: validConfig.advanced,
        llmProvider: validConfig.llmProvider
      }
      
      fs.writeFileSync(configPath, JSON.stringify(mixedConfig, null, 2))
      
      const loaded = await configService.load()
      
      expect(loaded.hedera.privateKey).toBe(validConfig.hedera.privateKey)
      expect(loaded.anthropic.apiKey).toBe('sk-ant-plaintext123')
    })
  })

  describe('File System Issues', () => {
    it('should recover from corrupted config file', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      fs.writeFileSync(configPath, '{ "invalid": "json", }')
      
      const loaded = await configService.load()
      
      expect(loaded.hedera.accountId).toBe('')
      expect(loaded.hedera.privateKey).toBe('')
      expect(loaded.advanced.theme).toBe('light')
    })

    it('should handle file permission issues', async () => {
      const configService = ConfigService.getInstance()
      
      await configService.save(validConfig)
      
      if (process.platform !== 'win32') {
        fs.chmodSync(configPath, 0o000)
        
        const loaded = await configService.load()
        expect(loaded.hedera.accountId).toBe('')
        
        fs.chmodSync(configPath, 0o644)
      }
    })
  })
})