import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TransformCardProps {
  children: React.ReactNode;
  rotation?: string;
  background?: string;
  border?: string;
  shadow?: string;
  rounded?: string;
  className?: string;
  style?: React.CSSProperties;
}

const TransformCard: React.FC<TransformCardProps> = ({
  children,
  rotation = 'rotate-0',
  background = 'bg-white dark:bg-gray-800',
  border = 'border border-gray-200 dark:border-gray-700',
  shadow = 'shadow-lg',
  rounded = '2xl',
  className,
  style,
}) => {
  return (
    <motion.div
      className={cn(
        rotation,
        background,
        border,
        `shadow-${shadow}`,
        `rounded-${rounded}`,
        'transform transition-all duration-500',
        className
      )}
      style={style}
      whileHover={{
        scale: 1.02,
        rotateZ: rotation.includes('-') ? 2 : -2,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {children}
    </motion.div>
  );
};

export { TransformCard };