import React from 'react';
import PluginsPage from '../../pages/PluginsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellPluginsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.plugins} windowKey='plugins'>
      <div className='h-full overflow-hidden bg-gradient-to-br from-white/80 to-white/60 dark:from-black/50 dark:to-black/60'>
        <PluginsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellPluginsWindow;