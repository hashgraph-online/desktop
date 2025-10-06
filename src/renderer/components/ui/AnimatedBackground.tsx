import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface AnimatedBackgroundProps {
  variant?: 'blobs' | 'lines' | 'grid';
  colors?: string[];
  intensity?: 'low' | 'medium' | 'high';
  opacity?: number;
  className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'blobs',
  colors = ['blue-500', 'purple-500', 'green-500'],
  intensity = 'medium',
  opacity = 0.1,
  className,
}) => {
  const sizeMap = {
    low: 'w-64 h-64',
    medium: 'w-96 h-96',
    high: 'w-screen h-screen',
  };

  const animationDuration = {
    low: 20,
    medium: 15,
    high: 10,
  };

  if (variant === 'blobs') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        {colors.map((color, index) => (
          <motion.div
            key={color}
            className={cn(
              sizeMap[intensity],
              `bg-${color}`,
              'rounded-full blur-3xl absolute'
            )}
            style={{ opacity }}
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -100, 50, 0],
              scale: [1, 1.2, 0.8, 1],
            }}
            transition={{
              duration: animationDuration[intensity],
              repeat: Infinity,
              ease: 'easeInOut',
              delay: index * 2,
            }}
            initial={{
              x: `${index * 30}%`,
              y: `${index * 20}%`,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'lines') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        <svg
          className="w-full h-full"
          style={{ opacity }}
          viewBox="0 0 1000 1000"
        >
          <defs>
            {colors.map((color, index) => (
              <linearGradient
                key={color}
                id={`gradient-${index}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={`var(--${color})`} stopOpacity="0" />
                <stop offset="50%" stopColor={`var(--${color})`} stopOpacity="0.5" />
                <stop offset="100%" stopColor={`var(--${color})`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {Array.from({ length: 20 }).map((_, index) => (
            <motion.path
              key={index}
              d={`M${index * 50},0 Q${index * 50 + 100},500 ${index * 50},1000`}
              stroke={`url(#gradient-${index % colors.length})`}
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: animationDuration[intensity],
                repeat: Infinity,
                ease: 'easeInOut',
                delay: index * 0.2,
              }}
            />
          ))}
        </svg>
      </div>
    );
  }

  return null;
};

export { AnimatedBackground };