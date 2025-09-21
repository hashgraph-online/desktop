import React from 'react';
import ConnectionsPage from '../../pages/ConnectionsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellConnectionsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.connections} windowKey='connections'>
      <div className='h-full overflow-hidden'>
        <ConnectionsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellConnectionsWindow;