import React from 'react';
import AgentDiscoveryPage from '../../pages/AgentDiscoveryPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellDiscoveryWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.discover} windowKey='discover'>
      <div className='h-full overflow-hidden'>
        <AgentDiscoveryPage />
      </div>
    </ShellWindow>
  );
};

export default ShellDiscoveryWindow;