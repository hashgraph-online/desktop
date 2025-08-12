import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../../../src/renderer/pages/SettingsPage'
import { useConfigStore } from '../../../src/renderer/stores/configStore'

jest.mock('../../../src/renderer/stores/configStore')

describe('Configuration Save/Load Integration', () => {
  const mockUseConfigStore = useConfigStore as jest.MockedFunction<typeof useConfigStore>
  
  const mockStore = {
    config: {
      hedera: {
        accountId: '',
        privateKey: '',
        network: 'testnet' as const
      },
      openai: {
        apiKey: '',
        model: 'gpt-4' as const
      },
      advanced: {
        theme: 'light' as const,
        autoStart: false
      }
    },
    isLoading: false,
    error: null,
    setHederaAccountId: jest.fn(),
    setHederaPrivateKey: jest.fn(),
    setHederaNetwork: jest.fn(),
    setOpenAIApiKey: jest.fn(),
    setOpenAIModel: jest.fn(),
    setTheme: jest.fn(),
    setAutoStart: jest.fn(),
    saveConfig: jest.fn(),
    loadConfig: jest.fn(),
    testHederaConnection: jest.fn(),
    testOpenAIConnection: jest.fn(),
    isHederaConfigValid: jest.fn(),
    isOpenAIConfigValid: jest.fn(),
    clearError: jest.fn()
  }

  beforeEach(() => {
    mockUseConfigStore.mockReturnValue(mockStore as any)
    
    window.electron = {
      saveConfig: jest.fn().mockResolvedValue(undefined),
      loadConfig: jest.fn().mockResolvedValue({
        hedera: {
          accountId: '0.0.54321',
          privateKey: 'loaded-key',
          network: 'mainnet' as const
        },
        openai: {
          apiKey: 'sk-loaded-key',
          model: 'gpt-3.5-turbo' as const
        },
        advanced: {
          theme: 'dark' as const,
          autoStart: true
        }
      }),
      testHederaConnection: jest.fn().mockResolvedValue({ success: true }),
      testOpenAIConnection: jest.fn().mockResolvedValue({ success: true })
    }
  })

  it('should load configuration on mount', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockStore.loadConfig).toHaveBeenCalled()
    })
  })

  it('should auto-save valid configuration changes', async () => {
    const user = userEvent.setup()
    
    mockStore.isHederaConfigValid.mockReturnValue(true)
    mockStore.isOpenAIConfigValid.mockReturnValue(true)
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const hederaTab = screen.getByText(/hedera/i, { selector: 'button' })
    fireEvent.click(hederaTab)

    const accountIdInput = screen.getByLabelText(/account id/i)
    await user.clear(accountIdInput)
    await user.type(accountIdInput, '0.0.12345')

    await waitFor(() => {
      expect(mockStore.setHederaAccountId).toHaveBeenCalledWith('0.0.12345')
    })

    await waitFor(() => {
      expect(mockStore.saveConfig).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('should not auto-save invalid configuration', async () => {
    const user = userEvent.setup()
    
    mockStore.isHederaConfigValid.mockReturnValue(false)
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const hederaTab = screen.getByText(/hedera/i, { selector: 'button' })
    fireEvent.click(hederaTab)

    const accountIdInput = screen.getByLabelText(/account id/i)
    await user.type(accountIdInput, 'invalid')

    await waitFor(() => {
      expect(mockStore.setHederaAccountId).toHaveBeenCalledWith('invalid')
    })

    await new Promise(resolve => setTimeout(resolve, 3000))
    
    expect(mockStore.saveConfig).not.toHaveBeenCalled()
  })

  it('should display save errors', async () => {
    mockStore.saveConfig.mockRejectedValue(new Error('Failed to save configuration'))
    mockStore.error = 'Failed to save configuration'
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/failed to save configuration/i)).toBeInTheDocument()
    })
  })

  it('should display load errors', async () => {
    mockStore.loadConfig.mockRejectedValue(new Error('Failed to load configuration'))
    mockStore.error = 'Failed to load configuration'
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/failed to load configuration/i)).toBeInTheDocument()
    })
  })

  it('should handle configuration migration', async () => {
    const oldConfig = {
      hederaAccountId: '0.0.11111',
      hederaPrivateKey: 'old-key',
      openaiApiKey: 'sk-old-key'
    }

    window.electron.loadConfig = jest.fn().mockResolvedValue(oldConfig)
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockStore.loadConfig).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockStore.saveConfig).toHaveBeenCalled()
    })
  })

  it('should validate all fields before enabling save', async () => {
    const user = userEvent.setup()
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const saveButton = screen.getByText(/save configuration/i)
    expect(saveButton).toBeDisabled()

    const hederaTab = screen.getByText(/hedera/i, { selector: 'button' })
    fireEvent.click(hederaTab)

    const accountIdInput = screen.getByLabelText(/account id/i)
    const privateKeyInput = screen.getByLabelText(/private key/i)

    await user.type(accountIdInput, '0.0.12345')
    await user.type(privateKeyInput, '302e020100300506032b657004220420' + '0'.repeat(64))

    const openaiTab = screen.getByText(/openai/i, { selector: 'button' })
    fireEvent.click(openaiTab)

    const apiKeyInput = screen.getByLabelText(/api key/i)
    await user.type(apiKeyInput, 'sk-test-key')

    mockStore.isHederaConfigValid.mockReturnValue(true)
    mockStore.isOpenAIConfigValid.mockReturnValue(true)

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled()
    })
  })

  it('should reset form to saved values on cancel', async () => {
    const savedConfig = {
      hedera: {
        accountId: '0.0.99999',
        privateKey: 'saved-key',
        network: 'mainnet' as const
      },
      openai: {
        apiKey: 'sk-saved-key',
        model: 'gpt-4' as const
      },
      advanced: {
        theme: 'dark' as const,
        autoStart: true
      }
    }

    mockStore.config = savedConfig
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    
    const hederaTab = screen.getByText(/hedera/i, { selector: 'button' })
    fireEvent.click(hederaTab)

    const accountIdInput = screen.getByLabelText(/account id/i)
    await user.clear(accountIdInput)
    await user.type(accountIdInput, '0.0.12345')

    const cancelButton = screen.getByText(/cancel/i)
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(mockStore.loadConfig).toHaveBeenCalled()
    })
  })
})