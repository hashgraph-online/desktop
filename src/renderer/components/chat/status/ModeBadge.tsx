import React from 'react';
import { cn } from '../../../lib/utils';

/**
 * Small pill showing the current chat mode and agent name when applicable.
 */
export type ModeBadgeProps = {
  mode: 'personal' | 'hcs10';
  agentName?: string;
};

export function ModeBadge(props: ModeBadgeProps) {
  const { mode, agentName } = props;
  const isPersonal = mode === 'personal';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
        isPersonal
          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
      )}
    >
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          isPersonal ? 'bg-blue-500' : 'bg-purple-500'
        )}
      />
      <span>
        {isPersonal ? 'Personal Assistant' : `HCS-10: ${agentName || ''}`}
      </span>
    </div>
  );
}

export default ModeBadge;
