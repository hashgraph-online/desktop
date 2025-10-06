import React from 'react';
import { HCS10ProfileRegistration } from '../../pages/HCS10ProfileRegistration';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellProfileWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.profile} windowKey='profile'>
      <div className='h-full overflow-hidden bg-gradient-to-br from-white/80 to-white/60 dark:from-black/50 dark:to-black/60'>
        <HCS10ProfileRegistration />
      </div>
    </ShellWindow>
  );
};

export default ShellProfileWindow;