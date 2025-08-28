import React, { useState } from 'react';
import { FiUser } from 'react-icons/fi';
import { useHRLImageUrl } from '../../hooks/useHRLImageUrl';
import { NetworkType } from '@hashgraphonline/standards-sdk';
import { cn } from '../../lib/utils';

interface UserProfileImageProps {
  profileImage?: string;
  displayName?: string;
  alias?: string;
  network?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fallbackClassName?: string;
  isAgent?: boolean;
  agentName?: string;
}

/**
 * A comprehensive component for displaying user profile images with proper HCS URL resolution
 * Handles HCS URLs, IPFS URLs, regular URLs, and provides consistent fallback UI
 * Centralizes all profile image logic to avoid duplication across components
 */
const UserProfileImage: React.FC<UserProfileImageProps> = ({
  profileImage,
  displayName,
  alias,
  network,
  className = '',
  size = 'md',
  fallbackClassName = '',
  isAgent = false,
  agentName
}) => {
  const [hasImageError, setHasImageError] = useState(false);
  const networkType = (network === 'mainnet' ? 'mainnet' : 'testnet') as NetworkType;
  const { resolvedUrl, isLoading, error } = useHRLImageUrl(profileImage, networkType);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const name = displayName || alias || agentName || '';
  const showImage = !isLoading && !error && !hasImageError && resolvedUrl && profileImage;


  const fallbackContent = () => {
    if (isAgent && agentName) {
      const initial = (() => {
        if (!agentName || agentName.length === 0) return 'A';
        if (/^\d+$/.test(agentName)) return 'A';
        if (/^\d/.test(agentName)) return 'A';
        return agentName[0].toUpperCase();
      })();
      
      return (
        <span className='text-white text-sm font-semibold'>
          {initial}
        </span>
      );
    }

    if (name) {
      return (
        <span className='text-gray-700 dark:text-white text-sm font-semibold'>
          {name.charAt(0).toUpperCase()}
        </span>
      );
    }

    return <FiUser className={cn('text-gray-700 dark:text-white', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />;
  };

  const baseFallbackClasses = cn(
    sizeClasses[size],
    'rounded-full flex items-center justify-center flex-shrink-0',
    isAgent && agentName
      ? 'bg-gradient-to-br from-blue-500 to-purple-600 border border-blue-200 dark:border-purple-400'
      : 'bg-gray-300 dark:bg-gray-600'
  );

  return (
    <div className={cn('relative', className)}>
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={name || 'Profile'}
          className={cn(
            sizeClasses[size],
            'rounded-full object-cover border-2 border-blue-500/20 flex-shrink-0'
          )}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className={cn(baseFallbackClasses, fallbackClassName)}>
          {fallbackContent()}
        </div>
      )}
    </div>
  );
};

export default UserProfileImage;