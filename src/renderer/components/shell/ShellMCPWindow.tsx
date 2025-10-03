import React from 'react';
import MCPPage from '../../pages/MCPPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellMCPWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.mcp} windowKey='mcp'>
      <div className='h-full overflow-hidden'>
        <MCPPage />
      </div>
    </ShellWindow>
  );
};

export default ShellMCPWindow;