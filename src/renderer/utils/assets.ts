/**
 * Utility functions for handling asset paths in both development and production
 */

/**
 * Get the correct path for public assets
 * In development, assets are served from the dev server
 * In production, they need to be imported as modules
 */
export function getPublicAssetPath(path: string): string {
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  
  const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
  if (isDev) {
    return `/${path}`;
  }
  
  try {
    return new URL(`/${path}`, import.meta.url).href;
  } catch {
    return `/${path}`;
  }
}