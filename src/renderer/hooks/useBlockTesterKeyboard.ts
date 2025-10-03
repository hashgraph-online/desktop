import { useEffect } from 'react';

/**
 * Keyboard shortcut options for Block Tester
 */
export interface UseBlockTesterKeyboardOptions {
  onNextTab: () => void;
  onPrevTab: () => void;
  onCloseTab: () => void;
  onNewTab: () => void;
  onDuplicateTab: () => void;
  onSwitchToTab: (index: number) => void;
  isEnabled?: boolean;
  totalTabs: number;
}

/**
 * Hook for handling Block Tester keyboard shortcuts
 * Follows platform conventions (Ctrl/Cmd + Tab, Ctrl/Cmd + 1-9, etc.)
 */
export function useBlockTesterKeyboard(options: UseBlockTesterKeyboardOptions) {
  useEffect(() => {
    if (!options.isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        options.onNextTab();
        return;
      }
      
      if (cmdKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        options.onPrevTab();
        return;
      }
      
      if (cmdKey && e.key === 'w') {
        e.preventDefault();
        options.onCloseTab();
        return;
      }
      
      if (cmdKey && e.key === 't') {
        e.preventDefault();
        options.onNewTab();
        return;
      }
      
      if (cmdKey && e.key === 'd') {
        e.preventDefault();
        options.onDuplicateTab();
        return;
      }
      
      if (cmdKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < options.totalTabs) {
          options.onSwitchToTab(index);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}