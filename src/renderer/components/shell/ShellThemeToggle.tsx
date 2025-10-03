import React, { useCallback, useMemo } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';

const ShellThemeToggle: React.FC = () => {
  const { config, setTheme } = useConfigStore();

  const currentTheme = useMemo(() => config?.advanced?.theme ?? 'light', [config?.advanced?.theme]);
  const isDark = currentTheme === 'dark';

  const handleToggleTheme = useCallback(() => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    void setTheme(nextTheme);
  }, [currentTheme, setTheme]);

  return (
    <button
      type='button'
      onClick={handleToggleTheme}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isDark
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/40 focus-visible:ring-offset-gray-900'
          : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-400/50 focus-visible:ring-offset-white'
      )}
      aria-label={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {currentTheme === 'light' ? <FiMoon className='h-4 w-4' /> : <FiSun className='h-4 w-4' />}
    </button>
  );
};

export default ShellThemeToggle;
