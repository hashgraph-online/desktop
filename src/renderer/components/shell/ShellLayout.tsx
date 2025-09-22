import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useShell } from './ShellContext';
import type { ShellWindowKey } from './ShellContext';
import { ShellTaskbar } from './ShellTaskbar';
import Logo from '../ui/Logo';
import WalletDisplay from './WalletDisplay';
import ShellThemeToggle from './ShellThemeToggle';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';

const resolveWindowFromPath = (pathname: string): ShellWindowKey | null => {
  if (pathname.startsWith('/chat')) {
    return 'chat';
  }
  if (pathname.startsWith('/browser')) {
    return 'browser';
  }
  if (pathname.startsWith('/builder')) {
    return 'builder';
  }
  return null;
};

const ShellLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setActiveWindow } = useShell();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { config } = useConfigStore();
  const currentTheme = config?.advanced?.theme ?? 'light';
  const isDark = currentTheme === 'dark';
  const themeClassName = isDark ? 'shell-theme-dark' : 'shell-theme-light';

  useEffect(() => {
    setActiveWindow(resolveWindowFromPath(location.pathname));
  }, [location.pathname, setActiveWindow]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
    }).format(currentTime);
  }, [currentTime]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(currentTime);
  }, [currentTime]);

  const handleNavigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <div
      data-testid='shell-layout-root'
      data-shell-theme={currentTheme}
      className={cn(
        'relative min-h-screen w-full overflow-hidden transition-all duration-500',
        isDark
          ? 'bg-gradient-to-br from-gray-950 via-brand-ink/85 to-gray-900 text-white'
          : 'bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900',
        themeClassName
      )}
    >
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.08),transparent_70%)]' />
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(234,179,8,0.05),transparent_70%)]' />

      <div className='relative z-10 flex h-screen flex-col'>
        <header
          className={cn(
            'flex h-12 items-center justify-between gap-6 border-b px-6 text-xs font-medium transition-all duration-150 backdrop-blur-lg',
            isDark
              ? 'border-white/10 bg-black/25 text-white/80'
              : 'border-gray-200/70 bg-white/85 text-slate-700 shadow-sm'
          )}
        >
          <button
            type='button'
            onClick={handleNavigateHome}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1',
              isDark
                ? 'text-white hover:bg-white/10 focus-visible:ring-white/40 focus-visible:ring-offset-transparent'
                : 'text-slate-900 hover:bg-slate-100 focus-visible:ring-blue-400/40 focus-visible:ring-offset-white'
            )}
          >
            <Logo variant='icon' size='sm' />
            <span className='leading-none'>HOL Desktop</span>
          </button>

          <div className='flex items-center gap-3 md:gap-4 ml-auto'>
            <div
              className={cn(
                'hidden md:flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]',
                isDark
                  ? 'border-white/10 bg-white/5 text-white/70'
                  : 'border-gray-200/50 bg-white/60 text-slate-500'
              )}
            >
              <span>{formattedDate}</span>
              <span className='text-orange-500'>•</span>
              <span className='tabular-nums'>{formattedTime}</span>
            </div>
            <ShellThemeToggle />
            <WalletDisplay />
          </div>
        </header>
        <main className='flex-1 overflow-y-auto'>
          <div className={cn(
            'min-h-full transition-all duration-300',
            isDark ? 'bg-transparent' : 'bg-white/60'
          )}>
            <div className='px-6 pt-6 pb-14 md:px-12 lg:px-14'>
              <Outlet />
            </div>
          </div>
        </main>
        <ShellTaskbar currentTimeLabel={formattedTime} currentDateLabel={formattedDate} />
      </div>
    </div>
  );
};

export default ShellLayout;
