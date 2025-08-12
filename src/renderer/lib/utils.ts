import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines and merges CSS class names using clsx and tailwind-merge.
 * This function is useful for conditionally applying classes and ensuring
 * Tailwind CSS classes are properly merged without conflicts.
 * 
 * @param inputs - Variable number of class value arguments (strings, objects, arrays, etc.)
 * @returns A merged string of CSS class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}