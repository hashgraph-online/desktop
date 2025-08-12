import React from 'react';
import Typography from '../ui/Typography';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useAgentStore } from '../../stores/agentStore';
import { useConfigStore } from '../../stores/configStore';
import { FiWifi, FiWifiOff, FiShield, FiZap } from 'react-icons/fi';

interface ChatHeaderProps {}

const ChatHeader: React.FC<ChatHeaderProps> = () => {
  const { status, isConnected, connectionError } = useAgentStore();
  const { config } = useConfigStore();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'online';
      case 'connecting':
      case 'disconnecting':
        return 'connecting';
      case 'error':
        return 'error';
      default:
        return 'offline';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'AI Online';
      case 'connecting':
        return 'Connecting...';
      case 'disconnecting':
        return 'Disconnecting...';
      case 'error':
        return connectionError || 'Connection Error';
      default:
        return 'Offline';
    }
  };

  return (
    <header className='bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm'>
      <div className='flex items-center justify-between px-8 py-4'>
        <div className='flex items-center space-x-4'>
          <div className='flex items-center space-x-3'>
            <div className='w-8 h-8 bg-gradient-to-br from-brand-blue to-brand-purple rounded-lg flex items-center justify-center shadow-lg'>
              <FiZap className='w-4 h-4 text-white' />
            </div>
            <div>
              <Typography
                variant='h5'
                className='font-bold text-gray-900 dark:text-gray-100'
              >
                AI Assistant
              </Typography>
              <StatusIndicator
                status={getStatusColor()}
                label={getStatusText()}
                className='text-xs'
              />
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-6'>
          {config && (
            <>
              <div className='flex items-center space-x-2 bg-gray-50/80 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200/50 dark:border-gray-600/50'>
                {isConnected ? (
                  <FiWifi className='w-4 h-4 text-brand-teal' />
                ) : (
                  <FiWifiOff className='w-4 h-4 text-gray-400' />
                )}
                <Typography
                  variant='caption'
                  className='font-medium text-gray-700 dark:text-gray-300'
                >
                  {config.hedera?.network?.toUpperCase() || 'TESTNET'}
                </Typography>
              </div>

              <div className='flex items-center space-x-2 bg-gray-50/80 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200/50 dark:border-gray-600/50'>
                <FiShield className='w-4 h-4 text-brand-purple' />
                <Typography
                  variant='caption'
                  className='font-medium text-gray-700 dark:text-gray-300'
                >
                  {config.hedera?.accountId || 'Not configured'}
                </Typography>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
