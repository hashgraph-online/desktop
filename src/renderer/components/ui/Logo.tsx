import React from 'react';
import { cn } from '../../lib/utils';
import logo from '../../../../assets/Desktop.png';
import iconLogo from '../../../../assets/HOL-Icon.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'md-lg' | 'lg';
  variant?: 'full' | 'icon';
}

/**
 * Logo component that displays the Hashgraph Online logo
 * Uses the new Desktop.png logo consistently across the app
 */
const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  variant = 'full',
}) => {

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    'md-lg': 'h-12',
    lg: 'h-16',
  };


  return (
    <div
      className={cn(
        'flex items-center justify-center',
        className
      )}
    >
      <img
        src={variant === 'icon' ? iconLogo : logo}
        alt='Hashgraph Online'
        className={cn(
          sizeClasses[size],
          'transition-all duration-200',
          'object-contain',
          'w-auto'
        )}
      />
    </div>
  );
};

export default Logo;
