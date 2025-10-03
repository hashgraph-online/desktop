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
  primary: 'bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green',
  
  /** Reversed HGO gradient: green → blue → purple */
  primaryReverse: 'bg-gradient-to-r from-hgo-green via-hgo-blue to-hgo-purple',
  
  /** Text gradient with transparent background for gradient text effects */
  text: 'bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent',
  
  /** Blue gradient for user messages */
  user: 'bg-gradient-to-r from-hgo-blue to-hgo-purple',
  
  /** Green gradient for assistant messages */
  assistant: 'bg-gradient-to-r from-hgo-green to-hgo-green',
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