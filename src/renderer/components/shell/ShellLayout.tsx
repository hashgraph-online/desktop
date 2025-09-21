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
          ? 'bg-gradient-to-br from-gray-900 via-brand-ink to-gray-900 text-white'
          : 'bg-white text-gray-900',
        themeClassName
      )}
    >
      <div className='pointer-events-none absolute inset-0'>
        {isDark ? (
          <>
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(234,88,12,0.15),transparent_70%)]' />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.12),transparent_70%)]' />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(234,88,12,0.08),transparent_60%)]' />
            <div className='absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent' />
          </>
        ) : (
          <>
            <div className='absolute top-8 left-8 w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/5 to-orange-600/8 blur-3xl' />
            <div className='absolute bottom-12 right-12 w-24 h-24 rounded-full bg-gradient-to-tl from-blue-500/8 to-blue-400/6 blur-2xl' />
            <div className='absolute top-1/2 left-1/3 w-16 h-16 rounded-full bg-gradient-to-r from-orange-500/6 to-orange-400/5 blur-xl' />
          </>
        )}
      </div>

      <div className='relative z-10 flex h-screen flex-col'>
        <header
          className={cn(
            'flex h-12 items-center justify-between border-b px-6 text-sm font-medium backdrop-blur-xl transition-all duration-300',
            isDark
              ? 'border-white/10 bg-black/20 text-white/90'
              : 'border-gray-100 bg-white/80 text-gray-800 shadow-sm'
          )}
        >
          <button
            type='button'
            onClick={handleNavigateHome}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2',
              isDark
                ? 'text-white hover:bg-orange-900/20 hover:text-orange-100 focus-visible:ring-offset-transparent'
                : 'text-gray-900 hover:bg-orange-50 hover:text-orange-900 focus-visible:ring-offset-white'
            )}
          >
            <Logo variant='icon' size='sm' />
            <span
              className={cn(
                'font-bold tracking-tight',
                isDark ? 'text-white' : 'text-gray-900'
              )}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              HOL Desktop
            </span>
          </button>
          <div className='flex items-center gap-4'>
            <ShellThemeToggle />
            <WalletDisplay />
            <div
              className={cn(
                'flex items-center gap-2 text-sm transition-colors duration-300',
                isDark ? 'text-white/70' : 'text-gray-600'
              )}
              style={{ fontFamily: 'Roboto Mono, monospace' }}
            >
              <span className='hidden md:block'>{formattedDate}</span>
              <span className='tabular-nums'>{formattedTime}</span>
            </div>
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
