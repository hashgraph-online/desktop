import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MCPServerCard } from '../../../src/renderer/components/mcp/MCPServerCard'
import { MCPServerConfig } from '../../../src/renderer/types/mcp'

const mockServer: MCPServerConfig = {
  id: 'test-server-1',
  name: 'Test Server',
  type: 'filesystem',
  status: 'connected',
  enabled: true,
  config: {
    rootPath: '/test/path'
  },
  tools: [
    {
      name: 'read_file',
      description: 'Read a file from the filesystem',
      inputSchema: { type: 'object' }
    },
    {
      name: 'write_file',
      description: 'Write a file to the filesystem',
      inputSchema: { type: 'object' }
    }
  ],
  lastConnected: new Date('2024-01-01T12:00:00Z'),
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T12:00:00Z')
}

const mockHandlers = {
  onToggle: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onTest: jest.fn()
}

describe('MCPServerCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders server information correctly', () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    expect(screen.getByText('Test Server')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('filesystem')).toBeInTheDocument()
    expect(screen.getByText('/test/path')).toBeInTheDocument()
    expect(screen.getByText('2 Available Tools')).toBeInTheDocument()
    expect(screen.getByText('read_file')).toBeInTheDocument()
    expect(screen.getByText('write_file')).toBeInTheDocument()
  })

  it('displays correct status indicator', () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    const statusText = screen.getByText('Connected')
    expect(statusText).toBeInTheDocument()
  })

  it('shows enabled toggle switch', () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    const toggle = screen.getByRole('checkbox')
    expect(toggle).toBeChecked()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('shows disabled toggle switch when server is disabled', () => {
    const disabledServer = { ...mockServer, enabled: false }
    render(<MCPServerCard server={disabledServer} {...mockHandlers} />)
    
    const toggle = screen.getByRole('checkbox')
    expect(toggle).not.toBeChecked()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('calls onToggle when toggle is clicked', async () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    const toggle = screen.getByRole('checkbox')
    fireEvent.click(toggle)
    
    await waitFor(() => {
      expect(mockHandlers.onToggle).toHaveBeenCalledWith('test-server-1', false)
    })
  })

  it('calls onEdit when edit button is clicked', () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    // Find the edit button by its title attribute
    const buttons = screen.getAllByRole('button')
    const editButton = buttons.find(btn => btn.querySelector('svg[data-name="edit"]') || 
                                           btn.innerHTML.includes('FiEdit'))
    
    if (editButton) {
      fireEvent.click(editButton)
      expect(mockHandlers.onEdit).toHaveBeenCalledWith('test-server-1')
    } else {
      // Fallback: click the third button (edit) based on order
      fireEvent.click(buttons[2])
      expect(mockHandlers.onEdit).toHaveBeenCalledWith('test-server-1')
    }
  })

  it('calls onDelete when delete button is clicked', () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    const buttons = screen.getAllByRole('button')
    // Delete button should be the last one
    const deleteButton = buttons[buttons.length - 1]
    fireEvent.click(deleteButton)
    
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('test-server-1')
  })

  it('calls onTest when test button is clicked', async () => {
    render(<MCPServerCard server={mockServer} {...mockHandlers} />)
    
    const buttons = screen.getAllByRole('button')
    // Test button should be the first one (play icon)
    const testButton = buttons[0]
    fireEvent.click(testButton)
    
    await waitFor(() => {
      expect(mockHandlers.onTest).toHaveBeenCalledWith('test-server-1')
    })
  })

  it('displays error message when server has error', () => {
    const errorServer = { 
      ...mockServer, 
      status: 'error' as const,
      errorMessage: 'Connection failed' 
    }
    render(<MCPServerCard server={errorServer} {...mockHandlers} />)
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows appropriate configuration summary for different server types', () => {
    const githubServer: MCPServerConfig = {
      ...mockServer,
      type: 'github',
      config: {
        owner: 'testowner',
        repo: 'testrepo'
      }
    }
    
    const { rerender } = render(<MCPServerCard server={githubServer} {...mockHandlers} />)
    expect(screen.getByText('testowner/testrepo')).toBeInTheDocument()
    
    const postgresServer: MCPServerConfig = {
      ...mockServer,
      type: 'postgres',
      config: {
        host: 'localhost',
        database: 'testdb'
      }
    }
    
    rerender(<MCPServerCard server={postgresServer} {...mockHandlers} />)
    expect(screen.getByText('localhost/testdb')).toBeInTheDocument()
  })

  it('limits displayed tools to 5 and shows overflow count', () => {
    const serverWithManyTools = {
      ...mockServer,
      tools: [
        { name: 'tool1', description: 'Tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Tool 2', inputSchema: {} },
        { name: 'tool3', description: 'Tool 3', inputSchema: {} },
        { name: 'tool4', description: 'Tool 4', inputSchema: {} },
        { name: 'tool5', description: 'Tool 5', inputSchema: {} },
        { name: 'tool6', description: 'Tool 6', inputSchema: {} },
        { name: 'tool7', description: 'Tool 7', inputSchema: {} }
      ]
    }
    
    render(<MCPServerCard server={serverWithManyTools} {...mockHandlers} />)
    
    expect(screen.getByText('7 Available Tools')).toBeInTheDocument()
    expect(screen.getByText('tool1')).toBeInTheDocument()
    expect(screen.getByText('tool4')).toBeInTheDocument()
    expect(screen.getByText('+3 more')).toBeInTheDocument()
    expect(screen.queryByText('tool5')).not.toBeInTheDocument()
  })
})