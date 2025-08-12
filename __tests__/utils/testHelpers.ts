import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { act } from '@testing-library/react'

/**
 * Custom render function that provides common test providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, options)
}

/**
 * Creates a mock store state for testing
 */
export function createMockStore<T>(initialState: Partial<T>): T {
  return {
    ...initialState,
  } as T
}

/**
 * Helper to create mock functions with type safety
 */
export function createMockFn<T extends (...args: any[]) => any>(): jest.MockedFunction<T> {
  return jest.fn() as jest.MockedFunction<T>
}

/**
 * Helper to wait for state updates in hooks
 */
export async function waitForStateUpdate(callback: () => void) {
  await act(async () => {
    callback()
  })
}

/**
 * Mock window.electron bridge
 */
export function mockElectronBridge() {
  const mockElectron = {
    searchPlugins: jest.fn(),
    installPlugin: jest.fn(),
    uninstallPlugin: jest.fn(),
    updatePlugin: jest.fn(),
    enablePlugin: jest.fn(),
    disablePlugin: jest.fn(),
    configurePlugin: jest.fn(),
    grantPluginPermissions: jest.fn(),
    revokePluginPermissions: jest.fn(),
    loadLocalPlugin: jest.fn(),
    reloadLocalPlugin: jest.fn(),
    setPluginRegistry: jest.fn(),
    getInstalledPlugins: jest.fn(),
    checkPluginUpdates: jest.fn(),
  }

  Object.defineProperty(window, 'electron', {
    value: mockElectron,
    writable: true,
  })

  return mockElectron
}

/**
 * Creates a promise that resolves after a specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock notification API
 */
export function mockNotificationAPI() {
  const mockNotification = jest.fn()
  Object.defineProperty(window, 'Notification', {
    value: mockNotification,
    writable: true,
  })
  return mockNotification
}

/**
 * Reusable assertion helpers
 */
export const assertions = {
  /**
   * Check if element has correct loading state
   */
  expectLoadingState: (element: HTMLElement, isLoading: boolean) => {
    if (isLoading) {
      expect(element).toBeInTheDocument()
      expect(element).toHaveTextContent(/loading/i)
    } else {
      expect(element).not.toHaveTextContent(/loading/i)
    }
  },

  /**
   * Check if error is displayed correctly
   */
  expectErrorState: (element: HTMLElement, errorMessage?: string) => {
    expect(element).toBeInTheDocument()
    if (errorMessage) {
      expect(element).toHaveTextContent(errorMessage)
    }
  },

  /**
   * Check if form field is invalid
   */
  expectFieldInvalid: (field: HTMLElement, errorMessage?: string) => {
    expect(field).toBeInvalid()
    if (errorMessage) {
      expect(field).toHaveAccessibleDescription(errorMessage)
    }
  },
}

/**
 * Common test data factories
 */
export const factories = {
  /**
   * Create mock MCP server data
   */
  mcpServer: (overrides = {}) => ({
    id: 'test-server-1',
    name: 'Test Server',
    command: 'test-command',
    args: [],
    env: {},
    status: 'disconnected' as const,
    enabled: false,
    tools: [],
    ...overrides,
  }),

  /**
   * Create mock plugin data
   */
  plugin: (overrides = {}) => ({
    id: 'test-plugin-1',
    name: 'Test Plugin',
    version: '1.0.0',
    type: 'npm' as const,
    enabled: false,
    status: 'disabled' as const,
    installedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create mock notification data
   */
  notification: (overrides = {}) => ({
    id: 'test-notification-1',
    type: 'info' as const,
    title: 'Test Notification',
    message: 'This is a test notification',
    duration: 5000,
    timestamp: new Date(),
    ...overrides,
  }),

  /**
   * Create mock error object
   */
  error: (message = 'Test error', type = 'unknown') => ({
    type,
    code: `TEST_ERR_${Date.now()}`,
    message,
    timestamp: new Date(),
    recoverable: true,
  }),
}