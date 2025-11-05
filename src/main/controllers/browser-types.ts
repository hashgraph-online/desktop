import type { BrowserWindow, WebContentsView } from 'electron';

export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserState = {
  requestedUrl: string;
  currentUrl: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  lastError: string | null;
};

export type BrowserController = {
  window: BrowserWindow;
  view: WebContentsView;
  state: BrowserState;
  bounds: BrowserBounds;
  destroyed: boolean;
  attached: boolean;
};

export interface BrowserEnvironmentOptions {
  currentDir: string;
  mainPreloadPath: string;
  moonscapePreloadPath: string;
  moonscapePreloadFileUrl: string;
  defaultUrl: string;
  safeProtocolRegex: RegExp;
  hashpackDeepLinkRegex: RegExp;
}
