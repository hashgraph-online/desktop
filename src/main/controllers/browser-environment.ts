import {
  app,
  BrowserWindow,
  WebContents,
  ipcMain,
  shell,
  nativeImage,
  type Event as ElectronEvent,
  type HandlerDetails,
  type OnBeforeSendHeadersListenerDetails,
} from 'electron';
import path from 'node:path';
import electronLog from 'electron-log';
import { calculateBrowserBounds } from '../browser-layout';
import { Logger } from '../utils/logger';
import {
  initializeBrowserControllers,
  registerControllerIpcHandlers,
  ensureBrowserController,
  getControllerForHost,
  navigateController,
  setBoundsForController,
  updateBrowserState,
  toError,
} from './browser-controller';
import { BrowserEnvironmentOptions } from './browser-types';

const WALLETCONNECT_URLS = [
  'https://explorer-api.walletconnect.com/*',
  'https://verify.walletconnect.org/*',
  'https://relay.walletconnect.com/*',
  'wss://relay.walletconnect.com/*',
];
const DEFAULT_WALLETCONNECT_PROJECT_ID =
  process.env.WC_PROJECT_ID || '610b20415692c366e3bf97b8208cada5';
const LOCALHOST_FALLBACK_ORIGIN = 'http://localhost:5173';

const logger = new Logger({ module: 'DesktopBrowser' });

let envOptions: BrowserEnvironmentOptions | null = null;
let activeWindow: BrowserWindow | null = null;
let guardsRegistered = false;

export const initializeBrowserEnvironment = (
  options: BrowserEnvironmentOptions
): void => {
  envOptions = options;
  initializeBrowserControllers(options);
  registerControllerIpcHandlers();
};

export const registerWebContentsGuards = (): void => {
  if (guardsRegistered) {
    return;
  }
  app.on('web-contents-created', (_event, contents) => {
    handleWebContentsCreated(contents);
  });
  guardsRegistered = true;
};

export const createMainWindow = (): BrowserWindow => {
  const options = getEnvironmentOptions();
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    center: true,
    icon: resolveDockIcon(options.currentDir),
    title: 'HOL Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: true,
      sandbox: false,
      webSecurity: false,
      preload: options.mainPreloadPath,
      webgl: true,
      plugins: true,
      enableWebSQL: false,
    },
  });

  try {
    registerSessionGuards(window);
  } catch (error) {
    electronLog.error('Failed to register session guards', toError(error));
  }

  const controller = ensureBrowserController(window);
  const contentBounds = window.getContentBounds();
  const initialBounds = calculateBrowserBounds({
    toolbarHeight: 0,
    bookmarkHeight: 0,
    windowBounds: {
      x: 0,
      y: 0,
      width: contentBounds.width,
      height: contentBounds.height,
    },
  });
  setBoundsForController(controller, initialBounds);
  const bootstrapUrl = options.defaultUrl.trim();
  const initialUrl = bootstrapUrl.length > 0 ? bootstrapUrl : options.defaultUrl;

  updateBrowserState(controller, {
    requestedUrl: initialUrl,
    currentUrl: initialUrl,
  });

  if (bootstrapUrl.length > 0) {
    navigateController(controller, bootstrapUrl);
  }

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
  });

  window.webContents.on('did-finish-load', () => {
    logger.info('Renderer finished loading');
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error('Renderer failed to load', { errorCode, errorDescription });
  });

  window.webContents.setWindowOpenHandler(handleWindowOpen);

  window.on('closed', () => {
    activeWindow = null;
  });

  ipcMain.on('window-control', (_event, action) => {
    if (!activeWindow) {
      return;
    }
    switch (action) {
      case 'minimize':
        activeWindow.minimize();
        break;
      case 'maximize':
        if (activeWindow.isMaximized()) {
          activeWindow.unmaximize();
        } else {
          activeWindow.maximize();
        }
        break;
      case 'close':
        activeWindow.close();
        break;
      default:
        break;
    }
  });

  ipcMain.on('app:reload', () => {
    if (!activeWindow) {
      return;
    }
    logger.info('Reload requested from renderer');
    activeWindow.reload();
  });

  activeWindow = window;
  return window;
};

export const getMainWindow = (): BrowserWindow | null => activeWindow;

export const handleWebContentsCreated = (contents: WebContents): void => {
  const forwardNavigation = (event: ElectronEvent, url: string): void => {
    if (!isAllowedProtocol(url)) {
      event.preventDefault();
      void shell.openExternal(url).catch(() => undefined);
      return;
    }
    const host = contents.hostWebContents
      ? BrowserWindow.fromWebContents(contents.hostWebContents)
      : null;
    const controller = getControllerForHost(host);
    if (!controller || controller.destroyed) {
      return;
    }
    event.preventDefault();
    navigateController(controller, url);
  };

  contents.on('will-navigate', forwardNavigation);
  contents.on('will-redirect', forwardNavigation);
  contents.setWindowOpenHandler((details) => {
    if (!isAllowedProtocol(details.url)) {
      void shell.openExternal(details.url).catch(() => undefined);
      return { action: 'deny' };
    }
    if (isWalletConnectUrl(details.url)) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
};

const registerSessionGuards = (window: BrowserWindow): void => {
  const session = window.webContents.session;
  const expectedOrigin = inferExpectedOrigin();

  session.webRequest.onBeforeRequest({ urls: WALLETCONNECT_URLS }, (details, callback) => {
    try {
      const url = new URL(details.url);
      const redirect = normalizeWalletConnectParams(url, expectedOrigin);
      if (redirect) {
        callback({ cancel: false, redirectURL: redirect });
        return;
      }
    } catch {}
    callback({ cancel: false });
  });

  session.webRequest.onBeforeSendHeaders(
    { urls: WALLETCONNECT_URLS },
    (details: OnBeforeSendHeadersListenerDetails, callback) => {
      try {
        const headers = { ...(details.requestHeaders || {}) } as Record<string, string>;
        if (!headers.Origin || headers.Origin !== expectedOrigin) {
          headers.Origin = expectedOrigin;
        }
        if (!headers.Referer || !headers.Referer.startsWith(expectedOrigin)) {
          headers.Referer = `${expectedOrigin}/`;
        }
        callback({ requestHeaders: headers });
      } catch {
        callback({ cancel: false });
      }
    }
  );

  session.webRequest.onHeadersReceived(
    { urls: WALLETCONNECT_URLS },
    (details: HandlerDetails, callback) => {
      try {
        const responseHeaders: Record<string, string[]> = {
          ...details.responseHeaders,
        } as Record<string, string[]>;
        for (const key of Object.keys(responseHeaders)) {
          if (key.toLowerCase() === 'content-security-policy') {
            delete responseHeaders[key];
          }
        }
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
            "worker-src 'self' blob: data:; " +
            "style-src 'self' 'unsafe-inline' blob: data: https://fonts.googleapis.com; " +
            "img-src 'self' data: blob: https:; " +
            "font-src 'self' data: blob: https://fonts.gstatic.com; " +
            "connect-src 'self' https: ws: wss: wss://inscribe.kiloscribe.com; " +
            "media-src 'self' blob: data:; " +
            "frame-src 'self' https://verify.walletconnect.org; " +
            "child-src 'self' https://verify.walletconnect.org blob: data:; " +
            "object-src 'none'; " +
            "base-uri 'self';",
        ];
        callback({ responseHeaders });
      } catch (error) {
        electronLog.warn('CSP onHeadersReceived error', toError(error));
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      }
    }
  );
};

const resolveDockIcon = (currentDir: string): nativeImage => {
  const resourcesPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const searchRoots = [resourcesPath, app.getAppPath(), currentDir, process.cwd()];
  const fileNames = ['hol-dock.icns', 'hol-dock.png', 'HOL-Icon.png'];

  for (const root of searchRoots) {
    for (const name of fileNames) {
      const candidate = path.join(root, 'assets', name);
      const exists = nativeImage.createFromPath(candidate);
      electronLog.info('[DesktopBrowser] BrowserWindow icon candidate', {
        candidate,
        empty: exists.isEmpty(),
      });
      if (!exists.isEmpty()) {
        electronLog.info('[DesktopBrowser] Resolved BrowserWindow icon', candidate);
        return exists;
      }
    }
  }

  const fallback = nativeImage.createFromPath(path.join(currentDir, '../../electron.icns'));
  if (!fallback.isEmpty()) {
    electronLog.warn('[DesktopBrowser] Falling back to electron.icns for BrowserWindow icon');
    return fallback;
  }

  electronLog.warn('[DesktopBrowser] No dock icon could be resolved for BrowserWindow; returning empty image');
  return nativeImage.createEmpty();
};

const normalizeWalletConnectParams = (
  url: URL,
  expectedOrigin: string
): string | undefined => {
  const params = url.searchParams;
  let mutated = false;
  if (url.hostname === 'explorer-api.walletconnect.com') {
    const projectId = params.get('projectId');
    if (!projectId || !projectId.trim()) {
      params.set('projectId', DEFAULT_WALLETCONNECT_PROJECT_ID);
      mutated = true;
    }
  }
  if (url.hostname === 'verify.walletconnect.org') {
    const origin = params.get('origin');
    if (!origin || origin.startsWith('file:') || origin !== expectedOrigin) {
      params.set('origin', expectedOrigin);
      mutated = true;
    }
  }
  return mutated ? url.toString() : undefined;
};

const handleWindowOpen = (details: HandlerDetails): {
  action: 'allow' | 'deny';
} => {
  if (isWalletConnectUrl(details.url)) {
    return { action: 'allow' };
  }
  if (!isAllowedProtocol(details.url)) {
    void shell.openExternal(details.url).catch(() => undefined);
    return { action: 'deny' };
  }
  return { action: 'deny' };
};

const isAllowedProtocol = (targetUrl: string): boolean => {
  const options = getEnvironmentOptions();
  try {
    if (!options.safeProtocolRegex.test(targetUrl)) {
      return false;
    }
    return !options.hashpackDeepLinkRegex.test(targetUrl);
  } catch {
    return false;
  }
};

const isWalletConnectUrl = (targetUrl: string): boolean => {
  try {
    const hostname = new URL(targetUrl).hostname;
    return (
      hostname.endsWith('walletconnect.com') ||
      hostname.endsWith('walletconnect.org')
    );
  } catch {
    return false;
  }
};

const inferExpectedOrigin = (): string => {
  const explicit =
    process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL ||
    process.env.VITE_DEV_SERVER_URL ||
    process.env.VITE_URL;
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {}
  }
  const options = envOptions;
  if (options) {
    try {
      return new URL(options.defaultUrl).origin;
    } catch {}
  }
  return LOCALHOST_FALLBACK_ORIGIN;
};

const getEnvironmentOptions = (): BrowserEnvironmentOptions => {
  if (!envOptions) {
    throw new Error('Browser environment not initialized');
  }
  return envOptions;
};
