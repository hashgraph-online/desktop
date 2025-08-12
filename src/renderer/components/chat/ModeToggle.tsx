import React from 'react';
import { cn } from '../../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Switch } from '../ui/switch';
import { FiCode, FiZap, FiLock } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { useConfigStore } from '../../stores/configStore';
import { useLegalStore } from '../../stores/legalStore';

export type OperationalMode = 'autonomous' | 'provideBytes';

interface ModeToggleProps {
  mode: OperationalMode;
  onChange: (mode: OperationalMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * ModeToggle component with configuration-based autonomous mode support
 * @param props - Component props including current mode, change handler, and disabled state
 * @returns React component showing current mode with toggle capability
 */
export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  onChange,
  disabled = false,
  className,
}) => {
  const { config } = useConfigStore();
  const { hasAcceptedAll } = useLegalStore();

  const isAutonomousModeEnabled = config?.autonomousMode && hasAcceptedAll();
  const isAutonomousMode = mode === 'autonomous';

  const handleToggle = () => {
    if (disabled || !isAutonomousModeEnabled) return;
    onChange(isAutonomousMode ? 'provideBytes' : 'autonomous');
  };

  const getDisplayText = () => {
    if (isAutonomousMode && isAutonomousModeEnabled) {
      return 'Autonomous Mode';
    }
    return 'Manual Mode';
  };

  const getIcon = () => {
    if (isAutonomousMode && isAutonomousModeEnabled) {
      return <FiZap className='w-4 h-4 text-[#10b981]' />;
    }
    return <FiCode className='w-4 h-4 text-[#5599fe]' />;
  };

  const getTooltipContent = () => {
    if (!hasAcceptedAll()) {
      return (
        <div className='space-y-1'>
          <Typography variant='caption' className='text-white font-medium'>
            Legal Agreements Required
          </Typography>
          <Typography variant='caption' className='text-red-100'>
            Please accept Terms of Service and Privacy Policy to enable
            autonomous mode
          </Typography>
        </div>
      );
    }

    if (!config?.autonomousMode) {
      return (
        <div className='space-y-1'>
          <div>
            <Typography variant='caption' className='text-blue-100'>
              Currently in Manual Mode - AI returns transaction bytes for manual
              signing
            </Typography>
          </div>
        </div>
      );
    }

    if (isAutonomousMode) {
      return (
        <div className='space-y-1'>
          <Typography variant='caption' className='text-white font-medium'>
            Autonomous Mode Active
          </Typography>
          <Typography variant='caption' className='text-green-100'>
            AI can automatically sign and submit transactions
          </Typography>
          <div className='pt-1 border-t border-green-400/30'>
            <Typography variant='caption' className='text-green-100'>
              Click to switch to Manual Mode
            </Typography>
          </div>
        </div>
      );
    }

    return (
      <div className='space-y-1'>
        <Typography variant='caption' className='text-white font-medium'>
          Manual Mode Active
        </Typography>
        <Typography variant='caption' className='text-blue-100'>
          AI returns transaction bytes for manual signing
        </Typography>
        <div className='pt-1 border-t border-blue-400/30'>
          <Typography variant='caption' className='text-blue-100'>
            Click to switch to Autonomous Mode
          </Typography>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            {isAutonomousModeEnabled ? (
              <button
                onClick={handleToggle}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 backdrop-blur-md rounded-lg border shadow-sm transition-all duration-200',
                  isAutonomousMode
                    ? 'bg-green-50/90 dark:bg-green-900/30 border-green-200/40 dark:border-green-700/40 hover:bg-green-100/90 dark:hover:bg-green-900/50'
                    : 'bg-white/80 dark:bg-gray-800/80 border-gray-200/40 dark:border-gray-700/40 hover:bg-white/90 dark:hover:bg-gray-800/90',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {getIcon()}
                <Typography variant='caption' className='font-semibold'>
                  {getDisplayText()}
                </Typography>
                <Switch
                  checked={isAutonomousMode}
                  disabled={disabled}
                  className='scale-75'
                />
              </button>
            ) : (
              <div className='flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm'>
                {getIcon()}
                <Typography variant='caption' className='font-semibold'>
                  {getDisplayText()}
                </Typography>
                {!hasAcceptedAll() && (
                  <FiLock className='w-3 h-3 text-gray-400' />
                )}
              </div>
            )}

            {!isAutonomousModeEnabled && (
              <Typography
                variant='caption'
                className='text-xs text-gray-500 dark:text-gray-400'
              >
                <FiZap className='inline w-3 h-3 mr-0.5 opacity-60' />
                Autonomous (soon)
              </Typography>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className={cn(
            'text-white border-2',
            isAutonomousMode && isAutonomousModeEnabled
              ? 'bg-[#10b981] border-[#059669]'
              : 'bg-[#5599fe] border-[#4488ee]'
          )}
        >
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ModeToggle;
