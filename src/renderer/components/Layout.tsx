import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Sidebar from './navigation/Sidebar';
import UserProfileImage from './ui/UserProfileImage';
import { FiMoon, FiSun } from 'react-icons/fi';
import { cn } from '../lib/utils';
import { useConfigStore } from '../stores/configStore';
import { fetchUserProfile as fetchProfileViaFactory } from '../services/hcs10ClientFactory';
import { useWalletStore } from '../stores/walletStore';
import type { UserProfile } from '../types/userProfile';

interface LayoutProps {
  children: React.ReactNode;
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

const ProfileButton: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const wallet = useWalletStore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const effectiveAccountId = wallet.isConnected ? wallet.accountId : config?.hedera?.accountId;
      const effectiveNetwork = wallet.isConnected ? wallet.network : (config?.hedera?.network as ('mainnet'|'testnet'|undefined));
      if (effectiveAccountId && effectiveNetwork && !isLoadingProfile) {
        setIsLoadingProfile(true);
        try {
          const resp = await fetchProfileViaFactory(
            effectiveAccountId as string,
            effectiveNetwork as any,
            {
              walletConnected: wallet.isConnected,
              operatorId: config?.hedera?.accountId,
              privateKey: config?.hedera?.privateKey,
            }
          );
          if (resp.success) {
            setUserProfile(resp.profile as unknown as UserProfile);
          } else if (wallet.isConnected) {
            setUserProfile({ display_name: 'Wallet Account' } as UserProfile);
          }
        } catch (error) {
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchUserProfile();
  }, [wallet.isConnected, wallet.accountId, wallet.network, config?.hedera?.accountId, config?.hedera?.network]);

  return (
    <motion.button
      onClick={() => navigate('/hcs10-profile')}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'ml-3 p-2 rounded-xl transition-all duration-200',
        'bg-gradient-to-r from-[#a679f0]/10 to-[#5599fe]/10 hover:from-[#a679f0]/20 hover:to-[#5599fe]/20',
        'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white',
        'border border-gray-200/50 dark:border-white/10'
      )}
      aria-label='View profile'
      title='My Profile'
    >
      <UserProfileImage
        profileImage={userProfile?.profileImage}
        displayName={userProfile?.display_name}
        alias={userProfile?.alias}
        network={wallet.isConnected ? wallet.network : config?.hedera?.network}
        size='sm'
      />
    </motion.button>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className='flex h-screen bg-gray-50 dark:bg-[#0a0a0a]'>
      <Sidebar />

      <div className='flex-1 flex flex-col overflow-hidden'>
        <header className='h-16 bg-white/80 dark:bg-black/40 backdrop-blur-lg border-b border-gray-200/50 dark:border-white/[0.06] flex items-center justify-end px-6 relative overflow-hidden'>
          {/* Static gradient line */}
          <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b]' />

          <div className='flex items-center'>
            <ProfileButton />
            <ThemeToggle />
          </div>
        </header>

        <main className='flex-1 overflow-y-auto'>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
