import type { BrowserState } from '@/types/desktop-bridge';

export const isBrowserState = (value: unknown): value is BrowserState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<BrowserState>;
  if (typeof candidate.requestedUrl !== 'string') {
    return false;
  }
  if (typeof candidate.currentUrl !== 'string') {
    return false;
  }
  if (typeof candidate.title !== 'string') {
    return false;
  }
  if (typeof candidate.isLoading !== 'boolean') {
    return false;
  }
  if (typeof candidate.canGoBack !== 'boolean') {
    return false;
  }
  if (typeof candidate.canGoForward !== 'boolean') {
    return false;
  }
  if (!(typeof candidate.lastError === 'string' || candidate.lastError === null)) {
    return false;
  }
  return true;
};
