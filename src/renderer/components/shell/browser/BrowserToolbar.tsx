import React, { useMemo } from 'react';
import {
  FiArrowRightCircle,
  FiMessageSquare,
  FiRotateCw,
} from 'react-icons/fi';
import moonscapeLogo from '../../../assets/images/moonscape-logo.png';
import { cn } from '../../../lib/utils';
import TrafficLightButton from './TrafficLightButton';

interface BrowserToolbarProps {
  isExpanded: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onToggleAssistant: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onToggleExpand: () => void;
  inputRef: React.Ref<HTMLInputElement>;
}

const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  isExpanded,
  canGoBack,
  canGoForward,
  inputValue,
  onInputChange,
  onSubmit,
  onGoBack,
  onGoForward,
  onRefresh,
  onToggleAssistant,
  onMinimize,
  onClose,
  onToggleExpand,
  inputRef,
}) => {
  const actionButtonClass = useMemo(
    () => (enabled: boolean) =>
      cn(
        'p-1 rounded text-white transition-colors',
        enabled ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'
      ),
    []
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(event.target.value);
  };

  return (
    <div className='relative z-10 bg-gradient-to-r from-purple-600 to-orange-400 p-2 flex items-center gap-2'>
      <div className='flex items-center gap-[6px] pl-1'>
        <TrafficLightButton variant='close' onClick={onClose} />
        <TrafficLightButton variant='minimize' onClick={onMinimize} />
        <TrafficLightButton
          variant='maximize'
          onClick={onToggleExpand}
          isExpanded={isExpanded}
        />
      </div>

      <div className='flex items-center gap-2 ml-4'>
        <button
          type='button'
          onClick={onGoBack}
          disabled={!canGoBack}
          className={actionButtonClass(canGoBack)}
          aria-label='Go Back'
        >
          <FiArrowRightCircle className='w-4 h-4 text-white rotate-180' />
        </button>
        <button
          type='button'
          onClick={onGoForward}
          disabled={!canGoForward}
          className={actionButtonClass(canGoForward)}
          aria-label='Go Forward'
        >
          <FiArrowRightCircle className='w-4 h-4 text-white' />
        </button>
        <button
          type='button'
          onClick={onRefresh}
          className='p-1 hover:bg-white/10 rounded'
          aria-label='Refresh'
        >
          <FiRotateCw className='w-4 h-4 text-white' />
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className='flex-1 mx-4 flex items-center gap-2 bg-white/90 rounded-md px-3 py-1'
      >
        <img
          src={moonscapeLogo}
          alt='Moonscape'
          className='w-4 h-4 object-contain'
        />
        <input
          id='browser-url'
          value={inputValue}
          onChange={handleInputChange}
          ref={inputRef}
          className='flex-1 bg-transparent text-gray-700 text-sm focus:outline-none placeholder:text-gray-500'
          placeholder='Search or enter address'
          aria-label='Browser address'
          style={{ fontFamily: 'Roboto, sans-serif' }}
        />
      </form>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onToggleAssistant}
          className='p-1 hover:bg-white/10 rounded text-white'
          aria-label='Toggle Assistant'
        >
          <FiMessageSquare className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
};

export default BrowserToolbar;
