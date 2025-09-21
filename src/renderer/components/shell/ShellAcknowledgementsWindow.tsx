import React from 'react';
import AcknowledgementsPage from '../../pages/AcknowledgementsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellAcknowledgementsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.acknowledgements} windowKey='acknowledgements'>
      <div className='h-full overflow-y-auto bg-gradient-to-br from-white/85 to-white/70 dark:from-black/50 dark:to-black/60'>
        <AcknowledgementsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellAcknowledgementsWindow;
