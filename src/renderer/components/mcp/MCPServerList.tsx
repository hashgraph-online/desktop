import React from 'react'
import { FiPlus, FiServer } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import Typography from '../ui/Typography'
import { MCPServerCard } from './MCPServerCard'
import { MCPServerListProps } from '../../types/mcp'

/**
 * List component for displaying all MCP servers
 * @param props - Server list props including servers array and handlers
 * @returns List of server cards with add button and loading states
 */
export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading = false,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  onAdd
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <Typography variant="body1" color="secondary">
            Loading MCP servers...
          </Typography>
        </div>
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="border-2 border-dashed border-muted rounded-lg p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-[#5599fe]/20 to-[#5599fe]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
          <FiServer className="w-8 h-8 text-[#5599fe]" />
        </div>
        <Typography variant="h5" className="text-lg mb-2">
          No servers configured
        </Typography>
        <Typography variant="body1" className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          Add MCP servers to extend your agent with new capabilities
        </Typography>
        {onAdd && (
          <Button onClick={onAdd} className="bg-[#5599fe] text-white hover:bg-[#4488ed]" size="sm">
            <FiPlus className="w-3.5 h-3.5 mr-1.5" />
            Add Server
          </Button>
        )}
      </div>
    )
  }

  const connectedServers = servers.filter(server => server.status === 'connected' && server.enabled)
  const totalTools = connectedServers.reduce((acc, server) => acc + (server.tools?.length || 0), 0)

  return (
    <div className="grid gap-4">
      {servers.map(server => (
        <MCPServerCard
          key={server.id}
          server={server}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onTest={onTest}
        />
      ))}
    </div>
  )
}