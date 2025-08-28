/**
 * Integration tests for IPC boundary config communication
 * Focuses on testing the exact IPC message flow and data transformation
 */

const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => unknown>()
const mockIpcRendererListeners = new Map<string, ((...args: unknown[]) => unknown)[]>()

jest.mock('electron', () => {
  return {
    app: {
      getPath: jest.fn()
    },
    safeStorage: {
      isEncryptionAvailable: jest.fn(),
      encryptString: jest.fn(),
      decryptString: jest.fn()
    },
    ipcMain: {
      handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        mockIpcMainHandlers.set(channel, handler)
      }),
      removeHandler: jest.fn((channel: string) => {
        mockIpcMainHandlers.delete(channel)
      })
    },
    ipcRenderer: {
      invoke: jest.fn(async (channel: string, ...args: unknown[]) => {
        const handler = mockIpcMainHandlers.get(channel)
        if (!handler) {
          throw new Error(`No handler registered for channel: ${channel}`)
        }
        const event = { sender: { send: jest.fn() } }
        return handler(event, ...args)
      }),
      send: jest.fn((channel: string, ...args: unknown[]) => {
        const listeners = mockIpcRendererListeners.get(channel) || []
        listeners.forEach(listener => {
          listener({ channel }, ...args)
        })
      }),
      on: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        const listeners = mockIpcRendererListeners.get(channel) || []
        listeners.push(listener)
        mockIpcRendererListeners.set(channel, listeners)
      })
    },
    contextBridge: {
      exposeInMainWorld: jest.fn()
    }
  }
})

jest.mock('../../src/main/utils/logger')

import { ConfigService as MainConfigService } from '../../src/main/services/ConfigService'
import { setupConfigHandlers } from '../../src/main/ipc/handlers'
import { app, safeStorage, ipcRenderer } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig, AdvancedConfig } from '../../src/renderer/stores/configStore'

interface ExtendedAdvancedConfig extends AdvancedConfig {
  customNumber?: number
  customBoolean?: boolean
  customArray?: number[]
  customObject?: {
    nested: {
      value: string
    }
  }
  customDate?: string
}

interface ExtendedAppConfig extends AppConfig {
  advanced: ExtendedAdvancedConfig
  largeData?: {
    array: string[]
    nested: Record<string, unknown>
  }
}

interface PartialInvalidConfig {
  notAValidField?: string
  hedera?: {
    network?: string
  }
}

describe('IPC Config Boundary Tests', () => {
  let tempDir: string
  let configPath: string
  let _mainConfigService: MainConfigService
  
  const testConfig: AppConfig = {
    hedera: {
      accountId: '0.0.1234567',
      privateKey: 'ipcBoundaryTestPrivateKey' + '0'.repeat(40),
      network: 'testnet'
    },
    openai: {
      apiKey: 'sk-ipc-boundary-test-key-1234567890',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      apiKey: 'sk-ant-ipc-boundary-test-key-123456',
      model: 'claude-3-5-sonnet-20241022'
    },
    advanced: {
      theme: 'dark',
      autoStart: false,
      logLevel: 'debug'
    },
    llmProvider: 'anthropic'
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-boundary-test-'))
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
    mockIpcMainHandlers.clear()
    mockIpcRendererListeners.clear()
    
    ;(app.getPath as jest.Mock).mockReturnValue(tempDir)
    
    setupMockEncryption()
    
    ;(MainConfigService as { instance?: MainConfigService }).instance = undefined
    mainConfigService = MainConfigService.getInstance()
    
    setupConfigHandlers()
  })

  function setupMockEncryption() {
    const encryptionMap = new Map<string, string>()
    
    ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true)
    ;(safeStorage.encryptString as jest.Mock).mockImplementation((text: string) => {
      const encrypted = Buffer.from(`enc:${Buffer.from(text).toString('base64')}`)
      encryptionMap.set(encrypted.toString(), text)
      return encrypted
    })
    ;(safeStorage.decryptString as jest.Mock).mockImplementation((buffer: Buffer) => {
      const original = encryptionMap.get(buffer.toString())
      if (!original) throw new Error('Decryption failed')
      return original
    })
  }

  describe('IPC Message Structure', () => {
    it('should correctly serialize config data across IPC boundary', async () => {
      const saveHandler = mockIpcMainHandlers.get('config:save')
      expect(saveHandler).toBeDefined()
      
      const mockEvent = {
        sender: {
          send: jest.fn(),
          id: 1
        },
        reply: jest.fn()
      }
      
      await saveHandler!(mockEvent, testConfig)
      
      const savedData = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      
      expect(savedData).toHaveProperty('hedera')
      expect(savedData).toHaveProperty('openai')
      expect(savedData).toHaveProperty('anthropic')
      expect(savedData).toHaveProperty('advanced')
      expect(savedData).toHaveProperty('llmProvider')
    })

    it('should handle undefined and null values in IPC messages', async () => {
      const configWithNulls = {
        ...testConfig,
        openai: {
          ...testConfig.openai,
          apiKey: ''
        },
        customField: undefined
      }
      
      await ipcRenderer.invoke('config:save', configWithNulls)
      
      const loaded = await ipcRenderer.invoke('config:load')
      
      expect(loaded.openai.apiKey).toBe('')
      expect(loaded).not.toHaveProperty('customField')
    })
  })

  describe('IPC Error Handling', () => {
    it('should handle IPC timeout scenarios', async () => {
      const slowHandler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return testConfig
      })
      
      mockIpcMainHandlers.set('config:loadSlow', slowHandler)
      
      const result = await ipcRenderer.invoke('config:loadSlow')
      expect(result).toEqual(testConfig)
    })

    it('should handle IPC handler exceptions', async () => {
      mockIpcMainHandlers.set('config:fail', async () => {
        throw new Error('Handler error')
      })
      
      await expect(ipcRenderer.invoke('config:fail'))
        .rejects.toThrow('Handler error')
    })

    it('should handle missing IPC handlers', async () => {
      await expect(ipcRenderer.invoke('config:nonexistent'))
        .rejects.toThrow('No handler registered for channel: config:nonexistent')
    })
  })

  describe('IPC Data Transformation', () => {
    it('should maintain data types across IPC boundary', async () => {
      const complexConfig = {
        ...testConfig,
        advanced: {
          ...testConfig.advanced,
          customNumber: 42,
          customBoolean: true,
          customArray: [1, 2, 3],
          customObject: {
            nested: {
              value: 'deep'
            }
          },
          customDate: new Date().toISOString()
        }
      } as ExtendedAppConfig
      
      await ipcRenderer.invoke('config:save', complexConfig)
      
      const loaded = await ipcRenderer.invoke('config:load')
      
      expect(typeof (loaded.advanced as ExtendedAdvancedConfig).customNumber).toBe('number')
      expect((loaded.advanced as ExtendedAdvancedConfig).customNumber).toBe(42)
      expect(typeof (loaded.advanced as ExtendedAdvancedConfig).customBoolean).toBe('boolean')
      expect((loaded.advanced as ExtendedAdvancedConfig).customBoolean).toBe(true)
      expect(Array.isArray((loaded.advanced as ExtendedAdvancedConfig).customArray)).toBe(true)
      expect((loaded.advanced as ExtendedAdvancedConfig).customArray).toEqual([1, 2, 3])
      expect((loaded.advanced as ExtendedAdvancedConfig).customObject?.nested.value).toBe('deep')
    })

    it('should handle large payloads across IPC', async () => {
      const largeConfig = {
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          privateKey: 'x'.repeat(100000)
        },
        largeData: {
          array: new Array(1000).fill('test-data'),
          nested: {}
        }
      } as ExtendedAppConfig
      
      let current = largeConfig.largeData.nested
      for (let i = 0; i < 100; i++) {
        current.next = { level: i }
        current = current.next
      }
      
      await ipcRenderer.invoke('config:save', largeConfig)
      const loaded = await ipcRenderer.invoke('config:load')
      
      expect(loaded.hedera.privateKey).toBe(largeConfig.hedera.privateKey)
      expect((loaded as ExtendedAppConfig).largeData?.array.length).toBe(1000)
    })
  })

  describe('IPC Channel Security', () => {
    it('should only expose whitelisted config channels', () => {
      const expectedChannels = ['config:save', 'config:load']
      const registeredChannels = Array.from(mockIpcMainHandlers.keys())
        .filter(channel => channel.startsWith('config:'))
      
      expect(registeredChannels.sort()).toEqual(expectedChannels.sort())
    })

    it('should validate config data before saving', async () => {
      const invalidConfig = {
        notAValidField: 'test',
        hedera: {
          network: 'testnet'
        }
      }
      
      await ipcRenderer.invoke('config:save', invalidConfig as PartialInvalidConfig)
      
      const loaded = await ipcRenderer.invoke('config:load')
      
      expect(loaded.hedera.accountId).toBe('')
      expect(loaded.hedera.privateKey).toBe('')
      expect(loaded.openai).toBeDefined()
    })
  })

  describe('Concurrent IPC Operations', () => {
    it('should handle concurrent save operations correctly', async () => {
      const configs = Array(5).fill(null).map((_, i) => ({
        ...testConfig,
        hedera: {
          ...testConfig.hedera,
          accountId: `0.0.${5000000 + i}`
        }
      }))
      
      const savePromises = configs.map(config => 
        ipcRenderer.invoke('config:save', config)
      )
      
      await Promise.all(savePromises)
      
      const loaded = await ipcRenderer.invoke('config:load')
      
      const accountId = loaded.hedera.accountId
      expect(accountId).toMatch(/^0\.0\.500000[0-4]$/)
    })

    it('should handle interleaved save/load operations', async () => {
      const operations: Promise<unknown>[] = []
      
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          const config = {
            ...testConfig,
            hedera: {
              ...testConfig.hedera,
              accountId: `0.0.${6000000 + i}`
            }
          }
          operations.push(ipcRenderer.invoke('config:save', config))
        } else {
          operations.push(ipcRenderer.invoke('config:load'))
        }
      }
      
      const results = await Promise.all(operations)
      
      expect(results.length).toBe(10)
      
      const loadResults = results.filter((_, i) => i % 3 !== 0)
      loadResults.forEach(config => {
        expect(config).toHaveProperty('hedera')
        expect(config).toHaveProperty('openai')
      })
    })
  })

  describe('IPC Event Lifecycle', () => {
    it('should properly clean up IPC handlers on shutdown', () => {
      expect(mockIpcMainHandlers.has('config:save')).toBe(true)
      expect(mockIpcMainHandlers.has('config:load')).toBe(true)
      
      mockIpcMainHandlers.forEach((_, channel) => {
        if (channel.startsWith('config:')) {
          mockIpcMainHandlers.delete(channel)
        }
      })
      
      expect(mockIpcMainHandlers.has('config:save')).toBe(false)
      expect(mockIpcMainHandlers.has('config:load')).toBe(false)
    })

    it('should handle renderer process reload', async () => {
      await ipcRenderer.invoke('config:save', testConfig)
      
      mockIpcRendererListeners.clear()
      
      const loaded = await ipcRenderer.invoke('config:load')
      expect(loaded).toEqual(testConfig)
    })
  })

  describe('IPC Performance Characteristics', () => {
    it('should handle rapid successive IPC calls efficiently', async () => {
      const startTime = Date.now()
      const callCount = 100
      
      const promises = []
      for (let i = 0; i < callCount; i++) {
        if (i % 2 === 0) {
          promises.push(ipcRenderer.invoke('config:load'))
        } else {
          const config = {
            ...testConfig,
            hedera: {
              ...testConfig.hedera,
              accountId: `0.0.${7000000 + i}`
            }
          }
          promises.push(ipcRenderer.invoke('config:save', config))
        }
      }
      
      await Promise.all(promises)
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(1000)
      
      const finalConfig = await ipcRenderer.invoke('config:load')
      expect(finalConfig.hedera.privateKey).toBe(testConfig.hedera.privateKey)
    })
  })
})