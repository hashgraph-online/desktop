/**
 * Common style utilities and constants for the application.
 * Centralizes frequently used style patterns to maintain consistency.
 */

/**
 * Common gradient patterns used throughout the application.
 * Uses Tailwind classes defined in the config for brand colors.
 */
export const gradients = {
  /** Primary HGO gradient: purple → blue → green */
  primary: 'bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b]',
  
  /** Reversed HGO gradient: green → blue → purple */
  primaryReverse: 'bg-gradient-to-r from-[#48df7b] via-[#5599fe] to-[#a679f0]',
  
  /** Text gradient with transparent background for gradient text effects */
  text: 'bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent',
  
  /** Blue gradient for user messages */
  user: 'bg-gradient-to-r from-[#5599fe] to-[#a679f0]',
  
  /** Green gradient for assistant messages */
  assistant: 'bg-gradient-to-r from-[#48df7b] to-[#48df7b]',
} as const;

/**
 * Common animation classes for consistent motion design.
 */
export const animations = {
  /** Smooth transition for hover and state changes */
  transition: 'transition-all duration-300',
  
  /** Scale effect for interactive elements */
  pressable: 'transform active:scale-[0.98] touch-manipulation',
  
  /** Focus ring styles for accessibility */
  focusRing: 'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
} as const;

/**
 * Common shadow styles for depth and elevation.
 */
export const shadows = {
  /** Default interactive element shadow */
  interactive: 'shadow-lg hover:shadow-xl',
  
  /** Card and container shadows */
  card: 'shadow-md hover:shadow-lg',
  
  /** Subtle shadow for nested elements */
  subtle: 'shadow-sm',
} as const;