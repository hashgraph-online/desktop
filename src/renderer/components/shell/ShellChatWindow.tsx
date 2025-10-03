import React from 'react';
import ChatPage from '../../pages/ChatPage';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';

const ShellChatWindow: React.FC = () => {
  return (
    <ShellWindow definition={SHELL_WINDOWS.chat} windowKey='chat'>
      <div className='h-full overflow-hidden bg-gradient-to-br from-white/80 to-white/60 dark:from-black/50 dark:to-black/60'>
        <ChatPage />
      </div>
    </ShellWindow>
  );
};

export default ShellChatWindow;

