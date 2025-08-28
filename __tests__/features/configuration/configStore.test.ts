import { renderHook, act } from '@testing-library/react'
import { useConfigStore } from '../../../src/renderer/stores/configStore'

interface WindowWithElectron {
  electron: {
    testHederaConnection: jest.Mock;
    testOpenAIConnection: jest.Mock;
    testAnthropicConnection: jest.Mock;
  };
}

interface HederaConnectionResult {
  success: boolean;
  balance?: string;
  error?: string;
}

interface ConnectionResult {
  success: boolean;
  error?: string;
}

describe('configStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useConfigStore.setState({
      config: {
        hedera: {
          accountId: '',
          privateKey: '',
          network: 'testnet'
        },
        openai: {
          apiKey: '',
          model: 'gpt-4o'
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
      },
      isLoading: false,
      error: null
    })
  })

  describe('Hedera Configuration', () => {
    it('should update hedera account ID', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
      })

      expect(result.current.config?.hedera.accountId).toBe('0.0.12345')
    })

    it('should update hedera private key', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaPrivateKey('0x' + '0'.repeat(64))
      })

      expect(result.current.config?.hedera.privateKey).toBe('0x' + '0'.repeat(64))
    })

    it('should update hedera network', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setHederaNetwork('mainnet')
      })

      expect(result.current.config?.hedera.network).toBe('mainnet')
    })

    it('should validate hedera config correctly', () => {
      const { result } = renderHook(() => useConfigStore())

      expect(result.current.isHederaConfigValid()).toBe(false)

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
      })
      expect(result.current.isHederaConfigValid()).toBe(false)

      act(() => {
        result.current.setHederaPrivateKey('0x' + '0'.repeat(64))
      })
      expect(result.current.isHederaConfigValid()).toBe(true)

      act(() => {
        result.current.setHederaAccountId('invalid')
      })
      expect(result.current.isHederaConfigValid()).toBe(false)
    })

    it('should test hedera connection', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const mockElectron = (window as WindowWithElectron).electron
      mockElectron.testHederaConnection.mockResolvedValue({
        success: true,
        balance: '100 HBAR'
      })

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
        result.current.setHederaPrivateKey('0x' + '0'.repeat(64))
      })

      let testResult: HederaConnectionResult
      await act(async () => {
        testResult = await result.current.testHederaConnection()
      })

      expect(mockElectron.testHederaConnection).toHaveBeenCalledWith({
        accountId: '0.0.12345',
        privateKey: '0x' + '0'.repeat(64),
        network: 'testnet'
      })
      expect(testResult).toEqual({
        success: true,
        balance: '100 HBAR'
      })
    })
  })

  describe('OpenAI Configuration', () => {
    it('should update OpenAI API key', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setOpenAIApiKey('sk-test123456789')
      })

      expect(result.current.config?.openai.apiKey).toBe('sk-test123456789')
    })

    it('should update OpenAI model', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setOpenAIModel('gpt-4')
      })

      expect(result.current.config?.openai.model).toBe('gpt-4')
    })

    it('should validate OpenAI config correctly', () => {
      const { result } = renderHook(() => useConfigStore())

      expect(result.current.isOpenAIConfigValid()).toBe(false)

      act(() => {
        result.current.setOpenAIApiKey('sk-test123456789')
      })
      expect(result.current.isOpenAIConfigValid()).toBe(true)

      act(() => {
        result.current.setOpenAIApiKey('invalid-key')
      })
      expect(result.current.isOpenAIConfigValid()).toBe(false)
    })

    it('should test OpenAI connection', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const mockElectron = (window as WindowWithElectron).electron
      mockElectron.testOpenAIConnection.mockResolvedValue({
        success: true
      })

      act(() => {
        result.current.setOpenAIApiKey('sk-test123456789')
      })

      let testResult: ConnectionResult
      await act(async () => {
        testResult = await result.current.testOpenAIConnection()
      })

      expect(mockElectron.testOpenAIConnection).toHaveBeenCalledWith({
        apiKey: 'sk-test123456789',
        model: 'gpt-4o'
      })
      expect(testResult).toEqual({
        success: true
      })
    })
  })

  describe('Advanced Configuration', () => {
    it('should update theme', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.config?.advanced.theme).toBe('dark')
    })

    it('should update auto start', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setAutoStart(true)
      })

      expect(result.current.config?.advanced.autoStart).toBe(true)
    })

    it('should update log level', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        result.current.setLogLevel('debug')
      })

      expect(result.current.config?.advanced.logLevel).toBe('debug')
    })
  })

  describe('Config Persistence', () => {
    it('should save config', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const mockElectron = (window as WindowWithElectron).electron
      mockElectron.saveConfig.mockResolvedValue(undefined)

      act(() => {
        result.current.setHederaAccountId('0.0.12345')
        result.current.setOpenAIApiKey('sk-test123456789')
      })

      await act(async () => {
        await result.current.saveConfig()
      })

      expect(mockElectron.saveConfig).toHaveBeenCalledWith({
        hedera: {
          accountId: '0.0.12345',
          privateKey: '',
          network: 'testnet'
        },
        openai: {
          apiKey: 'sk-test123456789',
          model: 'gpt-4o'
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
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle save errors', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const mockElectron = (window as WindowWithElectron).electron
      const error = new Error('Save failed')
      mockElectron.saveConfig.mockRejectedValue(error)

      await act(async () => {
        try {
          await result.current.saveConfig()
        } catch (_e) {
        }
      })

      expect(result.current.error).toBe('Save failed')
      expect(result.current.isLoading).toBe(false)
    })

    it('should load config', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const savedConfig = {
        hedera: {
          accountId: '0.0.99999',
          privateKey: '0x' + '1'.repeat(64),
          network: 'mainnet' as const
        },
        openai: {
          apiKey: 'sk-loaded123456789',
          model: 'gpt-4' as const
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022' as const
        },
        advanced: {
          theme: 'dark' as const,
          autoStart: true,
          logLevel: 'debug' as const
        },
        llmProvider: 'openai' as const
      }
      
      const mockElectron = (window as WindowWithElectron).electron
      mockElectron.loadConfig.mockResolvedValue(savedConfig)

      await act(async () => {
        await result.current.loadConfig()
      })

      expect(result.current.config).toEqual(savedConfig)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle load errors', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const mockElectron = (window as WindowWithElectron).electron
      const error = new Error('Load failed')
      mockElectron.loadConfig.mockRejectedValue(error)

      await act(async () => {
        try {
          await result.current.loadConfig()
        } catch (_e) {
        }
      })

      expect(result.current.error).toBe('Load failed')
      expect(result.current.isLoading).toBe(false)
    })

    it('should migrate old config format', async () => {
      const { result } = renderHook(() => useConfigStore())
      
      const oldConfig = {
        hederaAccountId: '0.0.88888',
        hederaPrivateKey: '0x' + '2'.repeat(64),
        hederaNetwork: 'mainnet',
        openaiApiKey: 'sk-old123456789',
        openaiModel: 'gpt-3.5-turbo',
        theme: 'dark',
        autoStart: true
      }
      
      const mockElectron = (window as WindowWithElectron).electron
      mockElectron.loadConfig.mockResolvedValue(oldConfig)

      await act(async () => {
        await result.current.loadConfig()
      })

      expect(result.current.config).toEqual({
        hedera: {
          accountId: '0.0.88888',
          privateKey: '0x' + '2'.repeat(64),
          network: 'mainnet'
        },
        openai: {
          apiKey: 'sk-old123456789',
          model: 'gpt-3.5-turbo'
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022'
        },
        advanced: {
          theme: 'dark',
          autoStart: true,
          logLevel: 'info'
        },
        llmProvider: 'openai'
      })
    })
  })

  describe('Error Handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useConfigStore())

      act(() => {
        useConfigStore.setState({ error: 'Test error' })
      })

      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })
  })
})