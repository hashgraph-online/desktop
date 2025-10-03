import React from 'react';
import ToolsPage from '../../pages/ToolsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellToolsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.tools} windowKey='tools'>
      <div className='h-full overflow-hidden bg-gradient-to-br from-white/80 to-white/60 dark:from-black/50 dark:to-black/60'>
        <ToolsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellToolsWindow;