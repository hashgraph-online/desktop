import { useMCPStore } from '../../src/renderer/stores/mcpStore'
import { MCPServerConfig, MCPServerFormData } from '../../src/renderer/types/mcp'

const mockElectron = {
  loadMCPServers: jest.fn(),
  saveMCPServers: jest.fn(),
  testMCPConnection: jest.fn(),
  connectMCPServer: jest.fn(),
  disconnectMCPServer: jest.fn(),
  getMCPServerTools: jest.fn()
}

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
})

const mockServerConfig: MCPServerConfig = {
  id: 'test-server-1',
  name: 'Test Server',
  type: 'filesystem',
  status: 'disconnected',
  enabled: false,
  config: {
    rootPath: '/test/path'
  },
  tools: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T12:00:00Z')
}

describe('MCPStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useMCPStore.setState({
      servers: [],
      isLoading: false,
      error: null,
      connectionTests: {}
    })
  })

  describe('loadServers', () => {
    it('loads servers successfully', async () => {
      mockElectron.loadMCPServers.mockResolvedValueOnce({
        success: true,
        data: [mockServerConfig]
      })

      const { loadServers } = useMCPStore.getState()
      await loadServers()

      const state = useMCPStore.getState()
      expect(state.servers).toEqual([mockServerConfig])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('handles load error', async () => {
      mockElectron.loadMCPServers.mockResolvedValueOnce({
        success: false,
        error: 'Failed to load'
      })

      const { loadServers } = useMCPStore.getState()
      
      await expect(loadServers()).rejects.toThrow('Failed to load')
      
      const state = useMCPStore.getState()
      expect(state.servers).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('Failed to load')
    })
  })

  describe('addServer', () => {
    it('adds server successfully', async () => {
      mockElectron.saveMCPServers.mockResolvedValueOnce({
        success: true
      })

      const formData: MCPServerFormData = {
        name: 'New Server',
        type: 'filesystem',
        config: { rootPath: '/new/path' }
      }

      const { addServer } = useMCPStore.getState()
      await addServer(formData)

      const state = useMCPStore.getState()
      expect(state.servers).toHaveLength(1)
      expect(state.servers[0].name).toBe('New Server')
      expect(state.servers[0].type).toBe('filesystem')
      expect(state.servers[0].config).toEqual({ rootPath: '/new/path' })
      expect(state.isLoading).toBe(false)
      expect(mockElectron.saveMCPServers).toHaveBeenCalled()
    })

    it('handles add server error', async () => {
      mockElectron.saveMCPServers.mockResolvedValueOnce({
        success: false,
        error: 'Save failed'
      })

      const formData: MCPServerFormData = {
        name: 'New Server',
        type: 'filesystem',
        config: { rootPath: '/new/path' }
      }

      const { addServer } = useMCPStore.getState()
      
      await expect(addServer(formData)).rejects.toThrow('Save failed')
      
      const state = useMCPStore.getState()
      expect(state.error).toBe('Save failed')
    })
  })

  describe('deleteServer', () => {
    beforeEach(() => {
      useMCPStore.setState({
        servers: [mockServerConfig]
      })
    })

    it('deletes server successfully', async () => {
      mockElectron.disconnectMCPServer.mockResolvedValueOnce({
        success: true
      })
      mockElectron.saveMCPServers.mockResolvedValueOnce({
        success: true
      })

      const { deleteServer } = useMCPStore.getState()
      await deleteServer('test-server-1')

      const state = useMCPStore.getState()
      expect(state.servers).toHaveLength(0)
      expect(mockElectron.saveMCPServers).toHaveBeenCalled()
    })

    it('disconnects server before deletion if connected', async () => {
      const connectedServer = { ...mockServerConfig, status: 'connected' as const }
      useMCPStore.setState({
        servers: [connectedServer]
      })

      mockElectron.disconnectMCPServer.mockResolvedValueOnce({
        success: true
      })
      mockElectron.saveMCPServers.mockResolvedValueOnce({
        success: true
      })

      const { deleteServer } = useMCPStore.getState()
      await deleteServer('test-server-1')

      expect(mockElectron.disconnectMCPServer).toHaveBeenCalledWith('test-server-1')
    })
  })

  describe('testConnection', () => {
    beforeEach(() => {
      useMCPStore.setState({
        servers: [mockServerConfig]
      })
    })

    it('tests connection successfully', async () => {
      const mockTools = [
        { name: 'test_tool', description: 'Test tool', inputSchema: {} }
      ]

      mockElectron.testMCPConnection.mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          tools: mockTools
        }
      })

      const { testConnection } = useMCPStore.getState()
      const result = await testConnection('test-server-1')

      expect(result.success).toBe(true)
      expect(result.tools).toEqual(mockTools)
      expect(result.latency).toBeGreaterThan(0)

      const state = useMCPStore.getState()
      expect(state.connectionTests['test-server-1']).toBeDefined()
    })

    it('handles connection test failure', async () => {
      mockElectron.testMCPConnection.mockResolvedValueOnce({
        success: true,
        data: {
          success: false,
          error: 'Connection failed'
        }
      })

      const { testConnection } = useMCPStore.getState()
      const result = await testConnection('test-server-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })
  })

  describe('utility functions', () => {
    beforeEach(() => {
      const servers = [
        mockServerConfig,
        {
          ...mockServerConfig,
          id: 'test-server-2',
          type: 'github' as const,
          status: 'connected' as const,
          enabled: true
        }
      ]
      useMCPStore.setState({ servers })
    })

    it('getServerById returns correct server', () => {
      const { getServerById } = useMCPStore.getState()
      const server = getServerById('test-server-1')
      
      expect(server).toBeDefined()
      expect(server?.name).toBe('Test Server')
    })

    it('getConnectedServers returns only connected and enabled servers', () => {
      const { getConnectedServers } = useMCPStore.getState()
      const connectedServers = getConnectedServers()
      
      expect(connectedServers).toHaveLength(1)
      expect(connectedServers[0].id).toBe('test-server-2')
    })

    it('getServersByType returns servers of specific type', () => {
      const { getServersByType } = useMCPStore.getState()
      const filesystemServers = getServersByType('filesystem')
      const githubServers = getServersByType('github')
      
      expect(filesystemServers).toHaveLength(1)
      expect(githubServers).toHaveLength(1)
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      useMCPStore.setState({ error: 'Test error' })
      
      const { clearError } = useMCPStore.getState()
      clearError()
      
      const state = useMCPStore.getState()
      expect(state.error).toBeNull()
    })
  })
})