import { cn } from '../../../lib/utils';
import { useCallback } from 'react';
import { IconType } from 'react-icons/lib';

export type AssistantDockPlacement = 'left' | 'right' | 'bottom';

export type DockOption = {
  value: AssistantDockPlacement;
  icon: IconType;
  aria: string;
};

interface DockToggleButtonProps {
  option: DockOption;
  isActive: boolean;
  onSelect: (value: AssistantDockPlacement) => void;
}

const DockToggleButton: React.FC<DockToggleButtonProps> = (props) => {
  const { option, isActive, onSelect } = props;
  const handleClick = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  const Icon = option.icon;

  return (
    <button
      type='button'
      onClick={handleClick}
      aria-label={option.aria}
      className={cn(
        'w-6 h-6 rounded flex items-center justify-center transition-colors',
        isActive
          ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
      )}
    >
      <Icon className='w-3 h-3' />
    </button>
  );
};

export default DockToggleButton;
