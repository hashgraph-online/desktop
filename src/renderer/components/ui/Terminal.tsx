import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TerminalLineProps {
  command?: string;
  output?: string;
  type?: 'command' | 'output' | 'comment';
  clickable?: boolean;
  onClick?(): void;
}

interface TerminalProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

const TerminalLine: React.FC<TerminalLineProps> = ({
  command,
  output,
  type = 'command',
  clickable = false,
  onClick,
}) => {
  const content = command || output || '';
  const isCommand = type === 'command' || command;
  const isComment = type === 'comment';

  return (
    <div
      className={cn(
        'font-mono text-sm',
        clickable && 'cursor-pointer hover:bg-gray-800/30 px-2 py-1 rounded transition-colors',
        isComment && 'text-green-400/70',
        isCommand && 'text-white',
        !isCommand && !isComment && 'text-gray-300'
      )}
      onClick={onClick}
    >
      {isCommand && !isComment && <span className="text-green-400">$ </span>}
      <span>{content}</span>
    </div>
  );
};

const Terminal: React.FC<TerminalProps> & {
  Line: React.FC<TerminalLineProps>;
} = ({ title = 'terminal', className, children }) => {
  return (
    <div
      className={cn(
        'bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl',
        className
      )}
    >
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <div className="w-3 h-3 bg-green-500 rounded-full" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-sm font-mono text-gray-300">{title}</span>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="p-4 space-y-2 min-h-[200px] bg-gradient-to-br from-gray-900 via-gray-900 to-black">
        {children}
      </div>
    </div>
  );
};

Terminal.Line = TerminalLine;

export { Terminal };