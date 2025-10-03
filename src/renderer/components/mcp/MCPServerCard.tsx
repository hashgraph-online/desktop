import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  FiServer,
  FiDatabase,
  FiGithub,
  FiHardDrive,
  FiTrash2,
  FiEdit,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
  FiActivity,
  FiZap,
} from 'react-icons/fi';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';
import Typography from '../ui/Typography';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import { MCPServerCardProps, MCPServerType } from '../../types/mcp';
import { useMCPStore } from '../../stores/mcpStore';
import { MCPToolsModal } from './MCPToolsModal';

const serverTypeIcons: Record<MCPServerType, React.ReactNode> = {
  filesystem: <FiHardDrive className='w-5 h-5' />,
  github: <FiGithub className='w-5 h-5' />,
  postgres: <FiDatabase className='w-5 h-5' />,
  sqlite: <FiDatabase className='w-5 h-5' />,
  custom: <FiServer className='w-5 h-5' />,
};

const statusColors = {
  connected: 'online',
  disconnected: 'offline',
  connecting: 'connecting',
  handshaking: 'connecting',
  ready: 'online',
  error: 'error',
} as const;

const statusIcons = {
  connected: <FiWifi className='w-4 h-4' />,
  disconnected: <FiWifiOff className='w-4 h-4' />,
  connecting: <FiActivity className='w-4 h-4 animate-pulse' />,
  handshaking: <FiActivity className='w-4 h-4 animate-spin' />,
  ready: <FiWifi className='w-4 h-4' />,
  error: <FiWifiOff className='w-4 h-4' />,
} as const;

/**
 * Individual MCP server card component with controls
 * @param props - Server card props including server config and handlers
 * @returns Server card with status, controls, and configuration display
 */
export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  server,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);

  const handleTest = async () => {
    setIsRefreshing(true);
    try {
      await onTest(server.id);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastConnected = (date: Date | undefined) => {
    if (!date) return 'Never';
    try {
      return format(new Date(date), 'PPpp');
    } catch {
      return new Date(date).toLocaleString();
    }
  };

  const getConfigSummary = () => {
    switch (server.type) {
      case 'filesystem':
        if (server.config.type === 'filesystem') {
          return server.config.rootPath || 'No path configured';
        }
        return 'No path configured';
      case 'github':
        if (server.config.type === 'github') {
          return server.config.owner && server.config.repo
            ? `${server.config.owner}/${server.config.repo}`
            : 'No repository configured';
        }
        return 'No repository configured';
      case 'postgres':
        if (server.config.type === 'postgres') {
          return server.config.host && server.config.database
            ? `${server.config.host}/${server.config.database}`
            : 'No database configured';
        }
        return 'No database configured';
      case 'sqlite':
        if (server.config.type === 'sqlite') {
          return server.config.path || 'No database path configured';
        }
        return 'No database path configured';
      case 'custom':
        if (server.config.type === 'custom') {
          const command = server.config.command || 'No command configured';
          const args = server.config.args;
          if (args && args.length > 0) {
            return `${command} ${args.join(' ')}`;
          }
          return command;
        }
        return 'No command configured';
      default:
        return 'Configuration not set';
    }
  };

  const isConnected =
    server.status === 'connected' || server.status === 'ready';

  return (
    <Card
      className={cn(
        'p-4 border transition-all',
        server.enabled &&
          isConnected &&
          'border-[#5599fe]/30 bg-gradient-to-br from-[#5599fe]/5 to-transparent'
      )}
    >
      <div className='flex items-start justify-between mb-3'>
        <div>
          <Typography noMargin variant='body2' className='font-medium mb-0.5'>
            {server.name}
          </Typography>
          <div className='flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400'>
            <div className='flex items-center gap-1'>
              <StatusIndicator status={statusColors[server.status]} size='sm' />
              <span className='leading-none'>
                {server.status === 'handshaking'
                  ? 'Handshaking'
                  : server.status === 'ready'
                  ? 'Ready'
                  : server.status.charAt(0).toUpperCase() +
                    server.status.slice(1)}
              </span>
            </div>
            <span className='leading-none text-gray-400'>•</span>
            <span className='leading-none capitalize'>{server.type}</span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleTest}
            disabled={
              isRefreshing ||
              server.status === 'connecting' ||
              server.status === 'handshaking'
            }
            className='text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            title={
              server.status === 'connecting' || server.status === 'handshaking'
                ? 'Connection in progress'
                : 'Test connection'
            }
          >
            <FiZap className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
          {(server.status === 'connected' || server.status === 'ready') && (
            <Button
              variant='ghost'
              size='sm'
              onClick={async () => {
                try {
                  const { refreshServerTools, reloadServers } =
                    useMCPStore.getState();
                  await refreshServerTools(server.id);
                  setTimeout(async () => {
                    await reloadServers();
                  }, 1000);
                } catch (error) {
                }
              }}
              className={cn(
                'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                (!server.tools || server.tools.length === 0) &&
                  'text-amber-600 dark:text-amber-400 animate-pulse'
              )}
              title='Refresh tools'
            >
              <FiRefreshCw className='w-4 h-4' />
            </Button>
          )}
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onEdit(server.id)}
            className='text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          >
            <FiEdit className='w-4 h-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onDelete(server.id)}
            className='text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
          >
            <FiTrash2 className='w-4 h-4' />
          </Button>
        </div>
      </div>

      <div className='space-y-2'>
        {server.description && (
          <div>
            <Typography
              noMargin
              variant='caption'
              className='text-gray-600 dark:text-gray-400'
            >
              {server.description}
            </Typography>
          </div>
        )}

        <div className='bg-muted/50 rounded p-2'>
          <Typography
            noMargin
            variant='caption'
            color='muted'
            className='block text-xs mb-2'
          >
            Configuration
          </Typography>
          <Typography
            noMargin
            variant='caption'
            className='block font-mono text-xs text-gray-700 dark:text-gray-300'
          >
            {getConfigSummary()}
          </Typography>
        </div>

        {server.tools && server.tools.length > 0 ? (
          <div className='bg-[#5599fe]/10 rounded p-2 border border-[#5599fe]/20'>
            <div className='flex items-center justify-between mb-1.5'>
              <Typography
                noMargin
                variant='caption'
                className='text-xs font-medium text-blue-700 dark:text-blue-300'
              >
                {server.tools.length} Available Tools
              </Typography>
              <button
                onClick={() => setIsToolsModalOpen(true)}
                className='text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              >
                View all →
              </button>
            </div>
            <div className='flex flex-wrap gap-1'>
              {server.tools.slice(0, 4).map((tool, index) => (
                <span
                  key={index}
                  className='px-1.5 py-0.5 bg-white/70 dark:bg-gray-800/70 text-blue-700 dark:text-blue-300 text-xs rounded border border-blue-200 dark:border-blue-700'
                  title={tool.description}
                >
                  {tool.name}
                </span>
              ))}
              {server.tools.length > 4 && (
                <span className='px-1.5 py-0.5 text-blue-600 dark:text-blue-400 text-xs'>
                  +{server.tools.length - 4} more
                </span>
              )}
            </div>
          </div>
        ) : server.status === 'connected' || server.status === 'ready' ? (
          <div className='bg-amber-50 dark:bg-amber-900/10 rounded-md p-2'>
            <div className='flex items-center justify-between'>
              <Typography
                noMargin
                variant='caption'
                className='text-xs text-amber-700 dark:text-amber-300'
              >
                Tools loading...
              </Typography>
              <button
                onClick={async () => {
                  try {
                    const { refreshServerTools, reloadServers } =
                      useMCPStore.getState();
                    await refreshServerTools(server.id);
                    await reloadServers();
                  } catch (error) {
                  }
                }}
                className='text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
              >
                Refresh tools →
              </button>
            </div>
          </div>
        ) : null}

        {server.errorMessage && (
          <div className='p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
            <Typography
              noMargin
              variant='caption'
              className='text-xs text-red-600 dark:text-red-400'
            >
              {server.errorMessage}
            </Typography>
          </div>
        )}

        {server.status === 'connecting' && (
          <div className='p-2 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-md'>
            <Typography
              noMargin
              variant='caption'
              className='text-xs text-amber-700 dark:text-amber-300'
            >
              Establishing connection...
            </Typography>
          </div>
        )}

        {server.status === 'handshaking' && (
          <div className='p-2 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-md'>
            <Typography
              noMargin
              variant='caption'
              className='text-xs text-amber-700 dark:text-amber-300'
            >
              Performing handshake...
            </Typography>
          </div>
        )}

        <div className='flex items-center justify-between pt-2 mt-2 border-t border-gray-200 dark:border-gray-700'>
          <Typography variant='caption' className='text-gray-500 dark:text-gray-400'>
            {formatLastConnected(server.lastConnected)}
          </Typography>

          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={server.enabled}
                onCheckedChange={(checked) => onToggle(server.id, checked)}
              />
              <Typography variant='caption' className='font-medium text-gray-700 dark:text-gray-300'>
                {server.enabled ? 'Enabled' : 'Disabled'}
              </Typography>
            </div>
          </div>
        </div>
      </div>

      <MCPToolsModal
        isOpen={isToolsModalOpen}
        onClose={() => setIsToolsModalOpen(false)}
        serverName={server.name}
        tools={server.tools || []}
      />
    </Card>
  );
};
