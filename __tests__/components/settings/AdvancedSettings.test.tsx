import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdvancedSettings } from '../../../src/renderer/pages/settings/AdvancedSettings'
import { useConfigStore } from '../../../src/renderer/stores/configStore'

jest.mock('../../../src/renderer/stores/configStore')

Object.defineProperty(process, 'versions', {
  value: {
    node: '18.17.0',
    chrome: '114.0.5735.289',
    electron: '25.3.0'
  }
})

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.289 Electron/25.3.0 Safari/537.36',
  configurable: true
})

const mockUseConfigStore = useConfigStore as jest.MockedFunction<typeof useConfigStore>

describe('AdvancedSettings', () => {
  const mockSetTheme = jest.fn()
  const mockSetAutoStart = jest.fn()
  const mockSetLogLevel = jest.fn()

  const defaultConfig = {
    advanced: {
      theme: 'light' as const,
      autoStart: false,
      logLevel: 'info' as const
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseConfigStore.mockReturnValue({
      config: defaultConfig,
      setTheme: mockSetTheme,
      setAutoStart: mockSetAutoStart,
      setLogLevel: mockSetLogLevel,
    } as any)
  })

  it('should render all settings sections', () => {
    render(<AdvancedSettings />)

    expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
    expect(screen.getByText('Customize your application preferences and behavior.')).toBeInTheDocument()
    
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Light Mode')).toBeInTheDocument()
    expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    
    expect(screen.getByText('Start on System Boot')).toBeInTheDocument()
    
    expect(screen.getByText('Log Level')).toBeInTheDocument()
    
    expect(screen.getByText('Application Info')).toBeInTheDocument()
  })

  it('should update theme selection', async () => {
    const user = userEvent.setup()
    render(<AdvancedSettings />)

    const darkModeRadio = screen.getByRole('radio', { name: /dark mode/i })
    await user.click(darkModeRadio)

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })
  })

  it('should update auto-start checkbox', async () => {
    const user = userEvent.setup()
    render(<AdvancedSettings />)

    const autoStartCheckbox = screen.getByRole('checkbox')
    await user.click(autoStartCheckbox)

    await waitFor(() => {
      expect(mockSetAutoStart).toHaveBeenCalledWith(true)
    })
  })

  it('should update log level selection', async () => {
    const user = userEvent.setup()
    render(<AdvancedSettings />)

    const logLevelSelect = screen.getByRole('combobox')
    await user.selectOptions(logLevelSelect, 'debug')

    await waitFor(() => {
      expect(mockSetLogLevel).toHaveBeenCalledWith('debug')
    })
  })

  it('should show all log level options', () => {
    render(<AdvancedSettings />)

    const logLevelSelect = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(logLevelSelect.options).map(opt => opt.value)
    
    expect(options).toContain('debug')
    expect(options).toContain('info')
    expect(options).toContain('warn')
    expect(options).toContain('error')
  })

  it('should display theme descriptions', () => {
    render(<AdvancedSettings />)

    expect(screen.getByText('Bright theme for daytime use')).toBeInTheDocument()
    expect(screen.getByText('Dark theme for reduced eye strain')).toBeInTheDocument()
  })

  it('should display auto-start description', () => {
    render(<AdvancedSettings />)

    expect(screen.getByText('Automatically launch the application when your computer starts')).toBeInTheDocument()
  })

  it('should display log level descriptions', () => {
    render(<AdvancedSettings />)

    const logLevelSelect = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(logLevelSelect.options).map(opt => opt.text)
    
    expect(options).toContain('Debug - All logs including debug information')
    expect(options).toContain('Info - General information and above')
    expect(options).toContain('Warning - Warnings and errors only')
    expect(options).toContain('Error - Errors only')
  })

  it('should display log level performance note', () => {
    render(<AdvancedSettings />)

    expect(screen.getByText('Controls the verbosity of application logs. Debug level may impact performance.')).toBeInTheDocument()
  })

  it('should display application info', () => {
    render(<AdvancedSettings />)

    expect(screen.getByText('Version')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    
    expect(screen.getByText('Electron')).toBeInTheDocument()
    expect(screen.getByText('37.2.4')).toBeInTheDocument()
    
    expect(screen.getByText('Chrome')).toBeInTheDocument()
    expect(screen.getByText('114.0.5735.289')).toBeInTheDocument()
    
    expect(screen.getByText('Node.js')).toBeInTheDocument()
    expect(screen.getByText('18.17.0')).toBeInTheDocument()
  })

  it('should render with pre-filled values', () => {
    mockUseConfigStore.mockReturnValue({
      config: {
        advanced: {
          theme: 'dark',
          autoStart: true,
          logLevel: 'debug'
        }
      },
      setTheme: mockSetTheme,
      setAutoStart: mockSetAutoStart,
      setLogLevel: mockSetLogLevel,
    } as any)

    render(<AdvancedSettings />)

    const darkModeRadio = screen.getByRole('radio', { name: /dark mode/i }) as HTMLInputElement
    expect(darkModeRadio.checked).toBe(true)

    const autoStartCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(autoStartCheckbox.checked).toBe(true)

    const logLevelSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(logLevelSelect.value).toBe('debug')
  })

  it('should handle missing Chrome version gracefully', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true
    })

    render(<AdvancedSettings />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('should set default values when watch returns undefined', async () => {
    render(<AdvancedSettings />)

    const themeRadios = screen.getAllByRole('radio')
    themeRadios.forEach(radio => {
      fireEvent.change(radio, { target: { value: undefined } })
    })

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    const autoStartCheckbox = screen.getByRole('checkbox')
    fireEvent.change(autoStartCheckbox, { target: { checked: undefined } })

    await waitFor(() => {
      expect(mockSetAutoStart).toHaveBeenCalledWith(false)
    })

    const logLevelSelect = screen.getByRole('combobox')
    fireEvent.change(logLevelSelect, { target: { value: undefined } })

    await waitFor(() => {
      expect(mockSetLogLevel).toHaveBeenCalledWith('info')
    })
  })

  it('should have correct styling for theme radio buttons', () => {
    render(<AdvancedSettings />)

    const lightModeLabel = screen.getByText('Light Mode').closest('label')
    const darkModeLabel = screen.getByText('Dark Mode').closest('label')

    expect(lightModeLabel).toHaveClass('cursor-pointer')
    expect(darkModeLabel).toHaveClass('cursor-pointer')
  })
})