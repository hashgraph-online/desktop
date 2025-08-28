import React, { useCallback } from 'react';
import { cn } from '../../lib/utils';
import Typography from '../ui/Typography';
import { Badge } from '../ui/badge';
import { FiCode, FiUsers } from 'react-icons/fi';

interface Agent {
  id: string;
  accountId: string;
  name: string;
  profile?: {
    display_name?: string;
    isAI?: boolean;
    isRegistryBroker?: boolean;
  };
  timestamp?: Date | number;
  lastMessage?: string;
  unreadCount?: number;
  network?: string;
}

interface AgentItemProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agent: Agent) => void;
  formatTimestamp: (timestamp: Date | number | undefined) => string;
}

/**
 * Displays an individual agent in the sidebar conversation list
 */
const AgentItem = React.memo<AgentItemProps>(
  ({ agent, isSelected, onSelect, formatTimestamp }) => {
    const handleClick = useCallback(() => {
      onSelect(agent);
    }, [agent, onSelect]);

    return (
      <div
        onClick={handleClick}
        className={cn(
          'group flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all duration-200',
          'border border-transparent hover:border-gray-300 dark:hover:border-gray-600',
          isSelected
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 border-blue-200 dark:border-blue-800'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        )}
      >
        <div
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center text-white font-semibold text-xs shrink-0',
            agent.profile?.isAI
              ? 'bg-gradient-to-br from-purple-500 to-blue-500'
              : 'bg-gradient-to-br from-gray-500 to-gray-600'
          )}
        >
          {agent.profile?.isAI ? (
            <FiCode className='w-3 h-3' />
          ) : (
            <FiUsers className='w-3 h-3' />
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between'>
            <Typography
              variant='caption'
              className={cn(
                'font-medium truncate text-xs',
                isSelected
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-gray-900 dark:text-gray-100'
              )}
            >
              {agent.profile?.display_name || agent.name}
            </Typography>
            {agent.timestamp && (
              <Typography
                variant='caption'
                className='text-gray-500 dark:text-gray-400 text-[10px] shrink-0 ml-1'
              >
                {formatTimestamp(agent.timestamp)}
              </Typography>
            )}
          </div>

          <div className='flex items-center justify-between mt-0.5'>
            {agent.lastMessage && (
              <Typography
                variant='caption'
                className='text-gray-600 dark:text-gray-400 truncate text-[10px] flex-1'
              >
                {agent.lastMessage}
              </Typography>
            )}

            <div className='flex items-center gap-1 ml-1 shrink-0'>
              {agent.unreadCount && agent.unreadCount > 0 && (
                <Badge className='bg-blue-500 text-white text-[9px] px-1 py-0 h-3 min-w-3'>
                  {agent.unreadCount}
                </Badge>
              )}
              {agent.profile?.isRegistryBroker && (
                <div
                  className='w-1.5 h-1.5 bg-amber-400 rounded-full'
                  title='External'
                />
              )}
              {agent.network && (
                <div
                  className='w-1.5 h-1.5 bg-green-400 rounded-full'
                  title={agent.network.toUpperCase()}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AgentItem.displayName = 'AgentItem';

export default AgentItem;