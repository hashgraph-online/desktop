import React from 'react';
import BitDomainsPage from '../../pages/BitDomainsPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

/**
 * Shell window wrapper exposing the Bit Domains registration experience.
 */
const ShellBitDomainsWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.bitDomains} windowKey='bitDomains'>
      <div className='h-full overflow-hidden'>
        <BitDomainsPage />
      </div>
    </ShellWindow>
  );
};

export default ShellBitDomainsWindow;

