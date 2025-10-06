import React, { type CSSProperties } from 'react';
import { cn } from '../../../lib/utils';
import type { AssistantDock } from '../../../../shared/browser-layout';
import {
  MIN_ASSISTANT_HEIGHT,
  MAX_ASSISTANT_HEIGHT,
  MIN_ASSISTANT_WIDTH,
  MAX_ASSISTANT_WIDTH,
} from './constants';

interface AssistantDockProps {
  dock: AssistantDock;
  isOpen: boolean;
  width: number;
  height: number;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

const AssistantDock: React.FC<AssistantDockProps> = ({
  dock,
  isOpen,
  width,
  height,
  onPointerDown,
  onMouseDown,
  children,
  className,
  style,
}) => {
  if (!isOpen) {
    return null;
  }

  const sizeStyle =
    dock === 'bottom'
      ? {
          height: `${height}px`,
          minHeight: `${MIN_ASSISTANT_HEIGHT}px`,
          maxHeight: `${MAX_ASSISTANT_HEIGHT}px`,
        }
      : {
          width: `${width}px`,
          minWidth: `${MIN_ASSISTANT_WIDTH}px`,
          maxWidth: `${MAX_ASSISTANT_WIDTH}px`,
        };

  const separatorPosition =
    dock === 'left' ? 'right-0' : dock === 'right' ? 'left-0' : 'left-0';

  const separatorClasses = cn(
    'absolute z-20',
    dock === 'bottom'
      ? 'top-0 left-0 h-2 w-full cursor-ns-resize'
      : 'top-0 h-full w-2 cursor-ew-resize',
    separatorPosition
  );

  const mergedStyle = style ? { ...sizeStyle, ...style } : sizeStyle;

  return (
    <div
      data-testid='assistant-dock'
      data-dock={dock}
      style={mergedStyle}
      className={cn(
        'relative flex-shrink-0 overflow-hidden bg-[rgba(14,16,28,0.92)] text-white backdrop-blur-3xl transition-[width,height] duration-200 h-full',
        dock === 'bottom'
          ? 'w-full border-t border-white/10 min-h-0'
          : 'h-full min-w-0',
        dock === 'left'
          ? 'border-r border-white/10'
          : dock === 'right'
          ? 'border-l border-white/10'
          : '',
        className
      )}
    >
      <div
        role='separator'
        aria-orientation={dock === 'bottom' ? 'horizontal' : 'vertical'}
        data-testid='assistant-resizer'
        onPointerDown={onPointerDown}
        onMouseDown={onMouseDown}
        className={separatorClasses}
      >
        <span className='block h-full w-full rounded-full bg-white/10 opacity-0 transition-opacity duration-150 hover:opacity-80' />
      </div>
      {children}
    </div>
  );
};

export default AssistantDock;
