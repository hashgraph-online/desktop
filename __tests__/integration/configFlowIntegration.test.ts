/**
 * Integration tests for the complete config flow across process boundaries
 * Tests main process → file → main process and renderer → IPC → main → file → main → IPC → renderer cycles
 */

jest.mock('electron', () => {
  const mockIpcMain = {
    handle: jest.fn(),
    removeHandler: jest.fn()
  }
  
  const mockIpcRenderer = {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn()
  }
  
  return {
    app: {
      getPath: jest.fn()
    },
    safeStorage: {
      isEncryptionAvailable: jest.fn(),
      encryptString: jest.fn(),
      decryptString: jest.fn()
    },
    ipcMain: mockIpcMain,
    ipcRenderer: mockIpcRenderer,
    contextBridge: {
      exposeInMainWorld: jest.fn()
    }
  }
})

jest.mock('../../../src/main/utils/logger')

import { ConfigService as MainConfigService } from '../../src/main/services/ConfigService'
import { ConfigService as RendererConfigService } from '../../src/renderer/services/configService'
import { setupConfigHandlers } from '../../src/main/ipc/handlers'
import { app, safeStorage, ipcMain, ipcRenderer } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig } from '../../src/renderer/stores/configStore'

describe('Config Flow Integration Tests', () => {
  let tempDir: string
  let configPath: string
  let mainConfigService: MainConfigService
  let rendererConfigService: RendererConfigService
  let ipcHandlers: Map<string, Function>
  
  const testConfig: AppConfig = {
    hedera: {
      accountId: '0.0.4567890',
      privateKey: 'integrationTestPrivateKey1234567890123456789012345678901234567890',
      network: 'testnet'
    },
    openai: {
      apiKey: 'sk-integration-test-key-1234567890abcdef',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-integration-test-key-1234567890',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark',
      autoStart: false,
      logLevel: 'info'
    },
    llmProvider: 'openai'
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-flow-test-'))
    configPath = path.join(tempDir, 'config.json')
  })

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  let encryptionMap: Map<string, string>

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
    
    jest.clearAllMocks()
    
    ;(app.getPath as jest.Mock).mockReturnValue(tempDir)
    
    encryptionMap = new Map<string, string>()
    
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((plaintext: string) => {
      const encrypted = Buffer.from(`encrypted_${Buffer.from(plaintext).toString('base64')}`)
      encryptionMap.set(encrypted.toString('base64'), plaintext)
      return encrypted
    })
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const key = buffer.toString('base64')
      const plaintext = encryptionMap.get(key)
      if (!plaintext) {
        throw new Error('Decryption failed')
      }
      return plaintext
    })
    
    ;(MainConfigService as any).instance = undefined
    mainConfigService = MainConfigService.getInstance()
    
    rendererConfigService = new RendererConfigService()
    
    ipcHandlers = new Map()
    ;(ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler)
    })
    
    setupConfigHandlers()
    
    const mockElectron = {
      saveConfig: jest.fn().mockImplementation(async (config: AppConfig) => {
        const handler = ipcHandlers.get('config:save')
        if (handler) {
          await handler({ sender: {} }, config)
        }
      }),
      loadConfig: jest.fn().mockImplementation(async () => {
        const handler = ipcHandlers.get('config:load')
        if (handler) {
          return await handler({ sender: {} })
        }
      })
    }
    
    ;(global as any).window = { electron: mockElectron }
  })

  describe('Main Process → File → Main Process', () => {
    it('should save and load config correctly within main process', async () => {
      await mainConfigService.save(testConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      
      const loaded = await mainConfigService.load()
      
      expect(loaded).toEqual(testConfig)
    })

    it('should handle encryption correctly', async () => {
      await mainConfigService.save(testConfig)
      
      const raw = fs.readFileSync(configPath, 'utf8')
      const savedData = JSON.parse(raw)
      
      expect(savedData.hedera.privateKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.hedera.privateKey).not.toEqual(testConfig.hedera.privateKey)
      expect(savedData.openai.apiKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(savedData.openai.apiKey).not.toEqual(testConfig.openai.apiKey)
      
      expect(savedData.hedera.accountId).toEqual(testConfig.hedera.accountId)
      expect(savedData.advanced).toEqual(testConfig.advanced)
    })

    it('should handle concurrent save/load operations', async () => {
      const operations = []
      
      for (let i = 0; i < 5; i++) {
        const config = {
          ...testConfig,
          hedera: {
            ...testConfig.hedera,
            accountId: `0.0.${1000000 + i}`
          }
        }
        operations.push(mainConfigService.save(config))
      }
      
      await Promise.all(operations)
      
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.accountId).toMatch(/^0\.0\.100000[0-4]$/)
      expect(loaded.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })
  })

  describe('Renderer → IPC → Main → File → Main → IPC → Renderer', () => {
    it('should complete full IPC save/load cycle', async () => {
      await rendererConfigService.saveConfig(testConfig)
      
      expect(window.electron.saveConfig).toHaveBeenCalledWith(testConfig)
      
      expect(fs.existsSync(configPath)).toBe(true)
      
      const loaded = await rendererConfigService.loadConfig()
      
      expect(loaded).toEqual(testConfig)
    })

    it('should handle IPC errors gracefully', async () => {
      ;(window.electron as any).saveConfig = jest.fn().mockRejectedValue(new Error('IPC Error'))
      
      await expect(rendererConfigService.saveConfig(testConfig))
        .rejects.toThrow('Failed to save configuration: IPC Error')
    })

    it('should validate config fields correctly', () => {
      expect(rendererConfigService.validateAccountId('0.0.12345')).toBe(true)
      expect(rendererConfigService.validateAccountId('0.0.0')).toBe(true)
      expect(rendererConfigService.validateAccountId('invalid')).toBe(false)
      expect(rendererConfigService.validateAccountId('0.0')).toBe(false)
      
      expect(rendererConfigService.validatePrivateKey(testConfig.hedera.privateKey)).toBe(true)
      expect(rendererConfigService.validatePrivateKey('short')).toBe(false)
      
      expect(rendererConfigService.validateOpenAIApiKey('sk-proj-validkey123456789012')).toBe(true)
      expect(rendererConfigService.validateOpenAIApiKey('invalid')).toBe(false)
      
      expect(rendererConfigService.validateAnthropicApiKey('sk-ant-validkey123456789012')).toBe(true)
      expect(rendererConfigService.validateAnthropicApiKey('sk-invalid')).toBe(false)
    })
  })

  describe('App Restart Simulation', () => {
    it('should persist config across app restarts', async () => {
      await mainConfigService.save(testConfig)
      
      ;(MainConfigService as any).instance = undefined
      ipcHandlers.clear()
      
      mainConfigService = MainConfigService.getInstance()
      setupConfigHandlers()
      
      const handler = ipcHandlers.get('config:load')
      expect(handler).toBeDefined()
      
      const loaded = await handler!({ sender: {} })
      
      expect(loaded).toEqual(testConfig)
    })

    it('should handle config updates across restarts', async () => {
      await mainConfigService.save(testConfig)
      
      const updatedConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: '0.0.9999999'
        },
        advanced: {
          ...testConfig.advanced,
          theme: 'light' as const
        }
      }
      
      await mainConfigService.save(updatedConfig)
      
      ;(MainConfigService as any).instance = undefined
      mainConfigService = MainConfigService.getInstance()
      
      const loaded = await mainConfigService.load()
      expect(loaded.hedera.accountId).toBe('0.0.9999999')
      expect(loaded.advanced.theme).toBe('light')
      expect(loaded.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })
  })

  describe('Data Integrity Across Boundaries', () => {
    it('should maintain data integrity through full cycle', async () => {
      const edgeCaseConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'key_with_special_chars_!@#$%^&*()_+-=[]{}|;\':",./<>?`~' + '0'.repeat(20)
        },
        openai: {
          ...testConfig.openai,
          apiKey: 'sk-proj-unicode-你好世界-émojis-🚀-test123'
        }
      }
      
      await rendererConfigService.saveConfig(edgeCaseConfig)
      
      const loaded = await rendererConfigService.loadConfig()
      
      expect(loaded).toEqual(edgeCaseConfig)
    })

    it('should handle empty and null values correctly', async () => {
      const emptyConfig = {
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
      
      await mainConfigService.save(emptyConfig)
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe('')
      expect(loaded.openai.apiKey).toBe('')
    })

    it('should handle large config files', async () => {
      const largeConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'x'.repeat(10000)
        },
        customData: {
          largeArray: Array(1000).fill('test-data'),
          nestedObject: {
            deep: {
              very: {
                deep: {
                  data: 'nested-value'
                }
              }
            }
          }
        }
      } as any
      
      await mainConfigService.save(largeConfig)
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe(largeConfig.hedera.privateKey)
      expect((loaded as any).customData).toEqual(largeConfig.customData)
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from corrupted encryption', async () => {
      await mainConfigService.save(testConfig)
      
      const raw = fs.readFileSync(configPath, 'utf8')
      const data = JSON.parse(raw)
      data.hedera.privateKey = 'CorruptedBase64='
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
      
      ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
        const key = buffer.toString('base64')
        if (key === 'CorruptedBase64=') {
          return 'CorruptedBase64='
        }
        const plaintext = encryptionMap.get(key)
        if (!plaintext) {
          return key
        }
        return plaintext
      })
      
      const loaded = await mainConfigService.load()
      
      expect(loaded.hedera.privateKey).toBe('CorruptedBase64=')
      expect(loaded.openai.apiKey).toBe(testConfig.openai.apiKey)
    })

    it('should handle file system errors during save', async () => {
      fs.chmodSync(tempDir, 0o555)
      
      await expect(mainConfigService.save(testConfig)).rejects.toThrow()
      
      fs.chmodSync(tempDir, 0o755)
    })

    it('should handle missing config file on load', async () => {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath)
      }
      
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
  })

  describe('Race Conditions and Concurrency', () => {
    it('should handle rapid IPC calls without data loss', async () => {
      const configs = Array(10).fill(null).map((_, i) => ({
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: `0.0.${2000000 + i}`
        }
      }))
      
      const savePromises = configs.map(config => 
        rendererConfigService.saveConfig(config)
      )
      
      await Promise.all(savePromises)
      
      const loaded = await rendererConfigService.loadConfig()
      
      const accountId = loaded?.hedera.accountId || ''
      expect(accountId).toMatch(/^0\.0\.200000[0-9]$/)
      expect(loaded?.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })

    it('should handle simultaneous read/write operations', async () => {
      await mainConfigService.save(testConfig)
      
      const operations = []
      
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          const config = {
            ...testConfig,
            hedera: {
              ...testConfig.hedera,
              accountId: `0.0.${3000000 + i}`
            }
          }
          operations.push(mainConfigService.save(config))
        } else {
          operations.push(mainConfigService.load())
        }
      }
      
      const results = await Promise.all(operations)
      
      expect(results).toHaveLength(20)
      
      const finalLoad = await mainConfigService.load()
      expect(finalLoad.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })
  })
})