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
  
  if (import.meta.env.DEV) {
    return `/${path}`;
  }
  
  return new URL(`/${path}`, import.meta.url).href;
}