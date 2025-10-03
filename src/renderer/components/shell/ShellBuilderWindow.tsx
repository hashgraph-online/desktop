import React from 'react';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';
import BuilderStudioRoutes from './BuilderStudioRouter';

const ShellBuilderWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.builder} windowKey='builder'>
      <div className='h-full overflow-hidden bg-white/85 dark:bg-black/60'>
        <BuilderStudioRoutes />
      </div>
    </ShellWindow>
  );
};

export default ShellBuilderWindow;

