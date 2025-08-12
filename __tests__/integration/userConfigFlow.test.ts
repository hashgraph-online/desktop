/**
 * Integration tests simulating real user workflows for config persistence
 * Tests the complete user experience from settings page to app restart
 */

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
    on: jest.fn(),
    quit: jest.fn()
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    webContents: {
      send: jest.fn()
    }
  }))
}))

jest.mock('../../../src/main/utils/logger')

import { ConfigService as MainConfigService } from '../../src/main/services/ConfigService'
import { setupIPCHandlers } from '../../src/main/ipc/handlers'
import { app, safeStorage, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig } from '../../src/renderer/stores/configStore'

describe('User Config Flow Integration Tests', () => {
  let tempDir: string
  let configPath: string
  let mainConfigService: MainConfigService
  let ipcHandlers: Map<string, Function>
  
  const userConfig: AppConfig = {
    hedera: {
      accountId: '0.0.3996850',
      privateKey: '302e020100300706052b8104000a04220420' + 'a'.repeat(64),
      network: 'testnet'
    },
    openai: {
      apiKey: 'sk-proj-VeryLongRealAPIKeyWith48CharactersOrMore123456',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-api03-VeryLongAnthropicKeyWith48CharsOrMore1234',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark',
      autoStart: true,
      logLevel: 'info'
    },
    llmProvider: 'openai'
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-flow-test-'))
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
    
    setupRealisticEncryption()
    
    ;(MainConfigService as any).instance = undefined
    mainConfigService = MainConfigService.getInstance()
    
    ipcHandlers = new Map()
    ;(ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler)
    })
    
    setupIPCHandlers('test-master-password')
  })

  function setupRealisticEncryption() {
    const encryptedData = new Map<string, string>()
    
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((plaintext: string) => {
      const salt = Math.random().toString(36).substring(7)
      const encrypted = Buffer.from(JSON.stringify({
        salt,
        data: Buffer.from(plaintext).toString('base64')
      }))
      const key = encrypted.toString('base64')
      encryptedData.set(key, plaintext)
      return encrypted
    })
    
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const key = buffer.toString('base64')
      const plaintext = encryptedData.get(key)
      if (!plaintext) {
        throw new Error('Decryption failed - key not found')
      }
      return plaintext
    })
  }

  describe('User Workflow: First Time Setup', () => {
    it('should handle first-time user setup flow', async () => {
      const initialConfig = await mainConfigService.load()
      
      expect(initialConfig.hedera.accountId).toBe('')
      expect(initialConfig.hedera.privateKey).toBe('')
      expect(initialConfig.openai.apiKey).toBe('')
      
      const configSaveHandler = ipcHandlers.get('config:save')
      expect(configSaveHandler).toBeDefined()
      
      await configSaveHandler!({ sender: {} }, userConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      
      simulateAppRestart()
      
      const configLoadHandler = ipcHandlers.get('config:load')
      const loadedConfig = await configLoadHandler!({ sender: {} })
      
      expect(loadedConfig).toEqual(userConfig)
    })
  })

  describe('User Workflow: Update Existing Config', () => {
    it('should handle config updates without losing data', async () => {
      await mainConfigService.save(userConfig)
      
      const updatedConfig = {
        ...userConfig,
        openai: {
          ...userConfig.openai,
          apiKey: 'sk-proj-NewAPIKeyAfterRotation1234567890'
        }
      }
      
      const saveHandler = ipcHandlers.get('config:save')
      await saveHandler!({ sender: {} }, updatedConfig)
      
      simulateAppRestart()
      
      const loadHandler = ipcHandlers.get('config:load')
      const loaded = await loadHandler!({ sender: {} })
      
      expect(loaded.openai.apiKey).toBe('sk-proj-NewAPIKeyAfterRotation1234567890')
      expect(loaded.hedera.privateKey).toBe(userConfig.hedera.privateKey)
      expect(loaded.anthropic.apiKey).toBe(userConfig.anthropic.apiKey)
    })

    it('should handle partial config updates', async () => {
      await mainConfigService.save(userConfig)
      
      const partialUpdate = {
        ...userConfig,
        advanced: {
          ...userConfig.advanced,
          theme: 'light' as const,
          logLevel: 'debug' as const
        }
      }
      
      const saveHandler = ipcHandlers.get('config:save')
      await saveHandler!({ sender: {} }, partialUpdate)
      simulateAppRestart()
      
      const loadHandler = ipcHandlers.get('config:load')
      const loaded = await loadHandler!({ sender: {} })
      
      expect(loaded.advanced.theme).toBe('light')
      expect(loaded.advanced.logLevel).toBe('debug')
      expect(loaded.hedera).toEqual(userConfig.hedera)
      expect(loaded.openai).toEqual(userConfig.openai)
    })
  })

  describe('User Workflow: Connection Testing', () => {
    it('should test connections before saving config', async () => {
      const hederaTestHandler = ipcHandlers.get('hedera:testConnection')
      expect(hederaTestHandler).toBeDefined()
      
      const hederaResult = await hederaTestHandler!({ sender: {} }, {
        accountId: userConfig.hedera.accountId,
        privateKey: userConfig.hedera.privateKey,
        network: userConfig.hedera.network
      })
      
      expect(hederaResult.success).toBe(true)
      
      const openaiTestHandler = ipcHandlers.get('openai:test')
      const openaiResult = await openaiTestHandler!({ sender: {} }, {
        apiKey: userConfig.openai.apiKey,
        model: userConfig.openai.model
      })
      
      expect(openaiResult.success).toBe(true)
      
      const saveHandler = ipcHandlers.get('config:save')
      await saveHandler!({ sender: {} }, userConfig)
      
      const loaded = await mainConfigService.load()
      expect(loaded).toEqual(userConfig)
    })
  })

  describe('User Workflow: Error Recovery', () => {
    it('should handle user fixing invalid credentials', async () => {
      const invalidConfig = {
        ...userConfig,
        hedera: {
          ...userConfig.hedera,
          accountId: 'invalid-format'
        }
      }
      
      const saveHandler = ipcHandlers.get('config:save')
      await saveHandler!({ sender: {} }, invalidConfig)
      
      const fixedConfig = {
        ...invalidConfig,
        hedera: {
          ...invalidConfig.hedera,
          accountId: '0.0.1234567'
        }
      }
      
      await saveHandler!({ sender: {} }, fixedConfig)
      
      simulateAppRestart()
      
      const loadHandler = ipcHandlers.get('config:load')
      const loaded = await loadHandler!({ sender: {} })
      
      expect(loaded.hedera.accountId).toBe('0.0.1234567')
    })

    it('should recover from interrupted save operations', async () => {
      fs.writeFileSync(configPath, '{"hedera":{"accountId":"0.0.12345"', 'utf8')
      
      simulateAppRestart()
      
      const loadHandler = ipcHandlers.get('config:load')
      const loaded = await loadHandler!({ sender: {} })
      
      expect(loaded.hedera.accountId).toBe('')
      expect(loaded.hedera.privateKey).toBe('')
      
      const saveHandler = ipcHandlers.get('config:save')
      await saveHandler!({ sender: {} }, userConfig)
      
      const recovered = await mainConfigService.load()
      expect(recovered).toEqual(userConfig)
    })
  })

  describe('User Workflow: Multiple App Windows', () => {
    it('should handle config changes from multiple windows', async () => {
      await mainConfigService.save(userConfig)
      
      const window1Update = {
        ...userConfig,
        hedera: {
          ...userConfig.hedera,
          accountId: '0.0.7777777'
        }
      }
      
      const window2Update = {
        ...userConfig,
        openai: {
          ...userConfig.openai,
          apiKey: 'sk-proj-Window2UpdatedKey123456789'
        }
      }
      
      const saveHandler = ipcHandlers.get('config:save')
      
      await saveHandler!({ sender: { id: 1 } }, window1Update)
      
      await saveHandler!({ sender: { id: 2 } }, window2Update)
      
      const loaded = await mainConfigService.load()
      
      expect(loaded.openai.apiKey).toBe('sk-proj-Window2UpdatedKey123456789')
      expect(loaded.hedera.accountId).toBe(userConfig.hedera.accountId)
    })
  })

  describe('User Workflow: Migration from Old Version', () => {
    it('should handle config migration from older app versions', async () => {
      const oldConfig = {
        hedera: {
          accountId: '0.0.999888',
          privateKey: userConfig.hedera.privateKey,
          network: 'mainnet'
        },
        openai: {
          apiKey: userConfig.openai.apiKey
        }
      }
      
      fs.writeFileSync(configPath, JSON.stringify(oldConfig, null, 2))
      
      simulateAppRestart()
      
      const loadHandler = ipcHandlers.get('config:load')
      const migrated = await loadHandler!({ sender: {} })
      
      expect(migrated.hedera.accountId).toBe('0.0.999888')
      expect(migrated.hedera.network).toBe('mainnet')
      expect(migrated.openai.apiKey).toBe(userConfig.openai.apiKey)
      
      expect(migrated.openai.model).toBe('gpt-4o-mini')
      expect(migrated.anthropic).toBeDefined()
      expect(migrated.anthropic.apiKey).toBe('')
      expect(migrated.advanced).toBeDefined()
      expect(migrated.advanced.theme).toBe('dark')
    })
  })

  function simulateAppRestart() {
    ;(MainConfigService as any).instance = undefined
    
    ipcHandlers.clear()
    
    setupIPCHandlers('test-master-password')
  }
})