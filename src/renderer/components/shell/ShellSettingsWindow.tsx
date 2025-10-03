import React from 'react';
import SettingsPage from '../../pages/SettingsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellSettingsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.settings} windowKey='settings'>
      <div className='h-full overflow-hidden bg-gradient-to-br from-white/80 to-white/60 dark:from-black/50 dark:to-black/60'>
        <SettingsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellSettingsWindow;