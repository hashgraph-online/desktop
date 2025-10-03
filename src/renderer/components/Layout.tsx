import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Sidebar from './navigation/Sidebar';
import { FiMoon, FiSun } from 'react-icons/fi';
import { cn } from '../lib/utils';
import { useConfigStore } from '../stores/configStore';
import ProfileButton from './ui/ProfileButton';

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

const ThemeToggle: React.FC = () => {
  const { config, setTheme } = useConfigStore();
  const currentTheme =
    config && (config as any).advanced && (config as any).advanced.theme
      ? (config as any).advanced.theme
      : 'light';

  const toggleTheme = async () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  };

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'ml-4 p-2.5 rounded-xl transition-all duration-200',
        'bg-gradient-to-r from-[#a679f0]/10 to-[#5599fe]/10 hover:from-[#a679f0]/20 hover:to-[#5599fe]/20',
        'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white',
        'border border-gray-200/50 dark:border-white/10'
      )}
      aria-label={`Switch to ${
        currentTheme === 'light' ? 'dark' : 'light'
      } mode`}
    >
      <motion.div
        key={currentTheme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {currentTheme === 'light' ? (
          <FiMoon className='w-5 h-5' />
        ) : (
          <FiSun className='w-5 h-5' />
        )}
      </motion.div>
    </motion.button>
  );
};

const Layout: React.FC<LayoutProps> = ({ children, hideSidebar = false }) => {
  const navigate = useNavigate();

  return (
    <div className='flex h-screen bg-gray-50 dark:bg-[#0a0a0a]'>
      {!hideSidebar && <Sidebar />}

      <div className='flex-1 flex flex-col overflow-hidden'>
        <header className='flex h-16 items-center justify-between px-6 border-b border-gray-200/60 bg-white/90 dark:border-white/10 dark:bg-black/30 backdrop-blur-xl'>
          <button
            type='button'
            onClick={() => navigate('/')}
            className='text-sm font-semibold tracking-wide text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-200 dark:hover:text-white'
          >
            Hashgraph Online
          </button>

          <div className='flex items-center'>
            <ProfileButton className='ml-0' />
            <ThemeToggle />
          </div>
        </header>

        <main className='flex-1 overflow-y-auto'>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
