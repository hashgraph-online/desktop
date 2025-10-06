import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { SHELL_WINDOWS, useShell } from './ShellContext';
import type { ShellWindowDefinition, ShellWindowKey } from './ShellContext';
import { cn } from '../../lib/utils';

interface ShellWindowProps {
  windowKey: ShellWindowKey;
  definition?: ShellWindowDefinition;
  children: React.ReactNode;
  hideChrome?: boolean;
  defaultExpanded?: boolean;
}

type TeardownReason = 'none' | 'minimize' | 'close';

type WindowLayoutState = {
  isExpanded: boolean;
};

const DEFAULT_LAYOUT_STATE: WindowLayoutState = {
  isExpanded: false,
};

interface ShellWindowControlsContextValue {
  minimize(): void;
  close(): void;
  toggleExpand(): void;
  isExpanded: boolean;
  isMinimized: boolean;
}

const ShellWindowControlsContext = createContext<ShellWindowControlsContextValue | null>(null);

export const useShellWindowControls = (): ShellWindowControlsContextValue => {
  const context = useContext(ShellWindowControlsContext);
  if (!context) {
    throw new Error('useShellWindowControls must be used within a ShellWindow');
  }
  return context;
};

export const ShellWindow: React.FC<ShellWindowProps> = ({
  windowKey,
  definition,
  children,
  hideChrome = false,
  defaultExpanded = false,
}) => {
  const navigate = useNavigate();
  const {
    registerWindow,
    unregisterWindow,
    minimizeWindow,
    restoreWindow,
    isWindowMinimized,
    setActiveWindow,
    getWindowState,
    setWindowState,
    clearWindowState,
    resetWindowMetadata,
    toggleMaximizeWindow,
  } = useShell();

  const teardownReasonRef = useRef<TeardownReason>('none');

  const resolvedDefinition = useMemo(
    () => definition ?? SHELL_WINDOWS[windowKey],
    [definition, windowKey]
  );

  const [layoutState, setLayoutState] = useState<WindowLayoutState>(() => {
    const stored = getWindowState<WindowLayoutState>(windowKey);
    if (stored) {
      return { ...DEFAULT_LAYOUT_STATE, ...stored };
    }
    return { ...DEFAULT_LAYOUT_STATE, isExpanded: defaultExpanded };
  });

  useEffect(() => {
    registerWindow(windowKey, {
      label: resolvedDefinition.label,
      icon: resolvedDefinition.icon,
      iconUrl: null,
    });
    return () => {
      const reason = teardownReasonRef.current;
      teardownReasonRef.current = 'none';
      if (reason === 'minimize') {
        return;
      }
      unregisterWindow(windowKey);
      if (reason === 'close') {
        clearWindowState(windowKey);
        resetWindowMetadata(windowKey);
      }
    };
  }, [clearWindowState, registerWindow, unregisterWindow, resetWindowMetadata, windowKey, resolvedDefinition]);

  useEffect(() => {
    setWindowState(windowKey, layoutState);
  }, [layoutState, setWindowState, windowKey]);

  const minimized = isWindowMinimized(windowKey);

  const handleFocus = useCallback(() => {
    restoreWindow(windowKey);
    setActiveWindow(windowKey);
  }, [restoreWindow, setActiveWindow, windowKey]);

  const handleMinimize = useCallback(() => {
    teardownReasonRef.current = 'minimize';
    minimizeWindow(windowKey);
    navigate('/');
  }, [minimizeWindow, navigate, windowKey]);

  const handleClose = useCallback(() => {
    teardownReasonRef.current = 'close';
    navigate('/');
  }, [navigate]);

  const handleToggleExpand = useCallback(() => {
    toggleMaximizeWindow();
    setLayoutState((prev) => ({
      ...prev,
      isExpanded: !prev.isExpanded,
    }));
  }, [toggleMaximizeWindow]);

  const Icon = resolvedDefinition.icon;

  const chromeClassName = hideChrome
    ? 'border border-transparent bg-transparent shadow-none'
    : 'rounded-desktop-xl border border-hol-border bg-hol-surface shadow-desktop-window';

  const containerBaseClass = hideChrome
    ? 'absolute inset-0 flex min-h-0 flex-col transition-all duration-200'
    : 'relative mx-auto mt-1.5 flex min-h-0 flex-col transition-all duration-200';

  const sizeClass = layoutState.isExpanded
    ? 'h-[calc(100vh-112px)] w-[calc(100vw-64px)] max-w-none'
    : 'h-[78vh] w-full max-w-[1080px]';

  const containerClassName = cn(
    containerBaseClass,
    chromeClassName,
    hideChrome ? 'w-full h-full' : sizeClass
  );

  const scrollableChromeBase = 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden transition-opacity duration-200';

  const contentChromeClass = hideChrome
    ? scrollableChromeBase
    : `${scrollableChromeBase} border border-hol-border bg-hol-surface-alt`;

  return (
    <motion.section
      className={containerClassName}
      layout
      onMouseDown={handleFocus}
      initial={{ opacity: 0.85, scale: 0.98 }}
      animate={{ opacity: minimized ? 0 : 1, scale: minimized ? 0.95 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <ShellWindowControlsContext.Provider
        value={{
          minimize: handleMinimize,
          close: handleClose,
          toggleExpand: handleToggleExpand,
          isExpanded: layoutState.isExpanded,
          isMinimized: minimized,
        }}
      >
        {hideChrome ? null : (
          <div className='flex items-center justify-between rounded-t-desktop-xl bg-gradient-to-r from-hol-primary to-hol-primary-light px-5 py-3 text-hol-text-inverse'>
            <div className='flex items-center gap-3'>
              <span className='flex h-7 w-7 items-center justify-center rounded-md bg-white/25 text-hol-text-inverse'>
                <Icon className='h-4 w-4' aria-hidden='true' />
              </span>
              <Typography variant='caption' className='text-sm font-semibold tracking-wide text-hol-text-inverse'>
                {resolvedDefinition.title}
              </Typography>
            </div>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={handleMinimize}
                className='flex h-6 w-7 items-center justify-center rounded-[4px] border border-white/50 bg-white/30 text-[10px] text-hol-text-inverse'
                aria-label='Minimize window'
              >
                _
              </button>
              <button
                type='button'
                onClick={handleToggleExpand}
                className='flex h-6 w-7 items-center justify-center rounded-[4px] border border-white/50 bg-white/30 text-[10px] text-hol-text-inverse'
                aria-label={layoutState.isExpanded ? 'Restore window size' : 'Maximize window'}
              >
                {layoutState.isExpanded ? '❐' : '□'}
              </button>
              <button
                type='button'
                onClick={handleClose}
                className='flex h-6 w-7 items-center justify-center rounded-[4px] border border-white/60 bg-white/35 text-[10px] text-hol-text-inverse hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hol-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-hol-primary'
                aria-label={`Close ${resolvedDefinition.label}`}
              >
                <FiX className='h-3 w-3' aria-hidden='true' />
              </button>
            </div>
          </div>
        )}
        <div className={cn(contentChromeClass, minimized ? 'pointer-events-none opacity-0' : 'opacity-100')}>
          <div className='min-h-full'>{children}</div>
        </div>
      </ShellWindowControlsContext.Provider>
    </motion.section>
  );
};

export default ShellWindow;
