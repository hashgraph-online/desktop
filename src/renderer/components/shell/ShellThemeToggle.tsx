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
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200',
        isDark
          ? 'bg-white/15 text-white/85 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
          : 'bg-brand-ink/10 text-brand-ink hover:bg-brand-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40'
      )}
      aria-label={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {currentTheme === 'light' ? <FiMoon className='h-4 w-4' /> : <FiSun className='h-4 w-4' />}
    </button>
  );
};

export default ShellThemeToggle;
