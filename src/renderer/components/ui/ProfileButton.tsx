import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useConfigStore } from '../../stores/configStore';
import { useWalletStore } from '../../stores/walletStore';
import { fetchUserProfile as fetchProfileViaFactory } from '../../services/hcs10ClientFactory';
import UserProfileImage from './UserProfileImage';
import type { UserProfile } from '../../types/userProfile';

interface ProfileButtonProps {
  className?: string;
  navigateTo?: string;
}

const ProfileButton: React.FC<ProfileButtonProps> = ({
  className,
  navigateTo = '/hcs10-profile',
}) => {
  const navigate = useNavigate();
  const { config } = useConfigStore();
  const wallet = useWalletStore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const effectiveAccountId = wallet.isConnected
        ? wallet.accountId
        : config?.hedera?.accountId;
      const effectiveNetwork = wallet.isConnected
        ? wallet.network
        : (config?.hedera?.network as 'mainnet' | 'testnet' | undefined);

      if (!effectiveAccountId || !effectiveNetwork || isLoadingProfile) {
        return;
      }

      setIsLoadingProfile(true);
      try {
        const response = await fetchProfileViaFactory(effectiveAccountId, effectiveNetwork, {
          walletConnected: wallet.isConnected,
          operatorId: config?.hedera?.accountId,
          privateKey: config?.hedera?.privateKey,
        });

        if (response.success) {
          setUserProfile(response.profile as unknown as UserProfile);
        } else if (wallet.isConnected) {
          setUserProfile({ display_name: 'Wallet Account' } as UserProfile);
        }
      } catch (_error) {
        // ignore profile load failures
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [wallet.isConnected, wallet.accountId, wallet.network, config?.hedera?.accountId, config?.hedera?.network, isLoadingProfile]);

  return (
    <motion.button
      onClick={() => navigate(navigateTo)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'ml-3 p-2 rounded-xl transition-all duration-200',
        'bg-gradient-to-r from-[#a679f0]/10 to-[#5599fe]/10 hover:from-[#a679f0]/20 hover:to-[#5599fe]/20',
        'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white',
        'border border-gray-200/50 dark:border-white/10',
        className,
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

export default ProfileButton;
