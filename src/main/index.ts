import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import './init-logger';
import {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  ipcMain,
  nativeImage,
  type BrowserWindowConstructorOptions,
  type Event as ElectronEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import electronLog from 'electron-log';
import { Logger } from './utils/logger';
import { setupIPCHandlers } from './ipc/handlers';
import { UpdateService } from './services/update-service';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const mainPreloadPath = join(currentDir, 'preload.cjs');
const moonscapePreloadPath = join(currentDir, 'moonscape-preload.cjs');
const moonscapePreloadFileUrl = pathToFileURL(moonscapePreloadPath).toString();

const SAFE_PROTOCOL_REGEX = /^(https?:|ipfs:|ipns:|file:)/i;
const HASHPACK_DEEP_LINK_REGEX = /^https?:\/\/link\.hashpack\.app\//i;
const DEFAULT_URL = 'https://hedera.kiloscribe.com';

type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BrowserState = {
  requestedUrl: string;
  currentUrl: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  lastError: string | null;
};

type BrowserController = {
  window: BrowserWindow;
  view: BrowserView;
  state: BrowserState;
  bounds: BrowserBounds;
  destroyed: boolean;
  attached: boolean;
};

const browserControllers = new Map<number, BrowserController>();

const attachBrowserView = (controller: BrowserController): void => {
  if (controller.destroyed || controller.attached) {
    return;
  }
  try {
    controller.window.addBrowserView(controller.view);
    controller.view.setBounds(controller.bounds);
    controller.view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
    controller.attached = true;
  } catch (error: unknown) {
    electronLog.error('Failed to attach browser view', toError(error));
  }
};

const detachBrowserView = (controller: BrowserController): void => {
  if (controller.destroyed || !controller.attached) {
    return;
  }
  try {
    controller.window.removeBrowserView(controller.view);
  } catch (error: unknown) {
    electronLog.error('Failed to detach browser view', toError(error));
  }
  controller.attached = false;
};

const DEFAULT_BROWSER_STATE: BrowserState = {
  requestedUrl: DEFAULT_URL,
  currentUrl: DEFAULT_URL,
  title: '',
  isLoading: true,
  canGoBack: false,
  canGoForward: false,
  lastError: null,
};

const sendBrowserState = (controller: BrowserController): void => {
  if (controller.destroyed) {
    return;
  }
  if (controller.window.isDestroyed()) {
    return;
  }
  try {
    controller.window.webContents.send('browser:state', controller.state);
  } catch (error) {
    electronLog.error('Failed to send browser state', toError(error));
  }
};

const updateBrowserState = (
  controller: BrowserController,
  patch: Partial<BrowserState>
): void => {
  controller.state = { ...controller.state, ...patch };
  sendBrowserState(controller);
};

type WindowOpenResponse = {
  action: 'allow' | 'deny';
  overrideBrowserWindowOptions?: BrowserWindowConstructorOptions;
};

const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }
  const description = typeof value === 'string' ? value : JSON.stringify(value);
  return new Error(description);
};

type NavigationHistory = {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
};

const getNavigationHistory = (contents: WebContents): NavigationHistory | undefined => {
  const candidate = (contents as unknown as { navigationHistory?: NavigationHistory }).navigationHistory;
  if (!candidate) {
    return undefined;
  }
  if (typeof candidate.canGoBack !== 'function' || typeof candidate.canGoForward !== 'function') {
    return undefined;
  }
  return candidate;
};

const envPath = join(currentDir, '..', '..', '.env');
dotenvConfig({ path: envPath });

electronLog.transports.file.level = 'info';
electronLog.transports.console.level = 'info';

try {
  app.setName('HOL Desktop');
  app.setAboutPanelOptions({ applicationName: 'HOL Desktop' });

  process.title = 'HOL Desktop';
} catch (error: unknown) {
  electronLog.error('Error setting app metadata', toError(error));
}

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let logger: {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

const ensureBrowserController = (window: BrowserWindow): BrowserController => {
  const existing = browserControllers.get(window.id);
  if (existing && !existing.destroyed) {
    return existing;
  }

  const view = new BrowserView({
    webPreferences: {
      preload: moonscapePreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  const controller: BrowserController = {
    window,
    view,
    state: { ...DEFAULT_BROWSER_STATE },
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    destroyed: false,
    attached: false,
  };

  browserControllers.set(window.id, controller);
  attachBrowserView(controller);

  const { webContents } = view;

  const updateNavigationFlags = (): void => {
    try {
      const history = getNavigationHistory(webContents);
      updateBrowserState(controller, {
        canGoBack: history ? history.canGoBack() : false,
        canGoForward: history ? history.canGoForward() : false,
      });
    } catch {
      updateBrowserState(controller, { canGoBack: false, canGoForward: false });
    }
  };

  webContents.on('did-start-loading', (): void => {
    updateBrowserState(controller, { isLoading: true, lastError: null });
  });

  webContents.on('did-stop-loading', (): void => {
    updateNavigationFlags();
    try {
      const url = webContents.getURL();
      const title = webContents.getTitle();
      updateBrowserState(controller, {
        isLoading: false,
        currentUrl: url || controller.state.currentUrl,
        title,
      });
    } catch {
      updateBrowserState(controller, { isLoading: false });
    }
  });

  webContents.on('dom-ready', (): void => {
    updateNavigationFlags();
    try {
      const url = webContents.getURL();
      const title = webContents.getTitle();
      updateBrowserState(controller, {
        currentUrl: url || controller.state.currentUrl,
        title,
      });
    } catch {}
  });

  webContents.on('did-navigate', (_event, url): void => {
    updateBrowserState(controller, {
      currentUrl: url,
      requestedUrl: url,
      lastError: null,
    });
    updateNavigationFlags();
  });

  webContents.on('did-navigate-in-page', (_event, url): void => {
    updateBrowserState(controller, {
      currentUrl: url,
      requestedUrl: url,
      lastError: null,
    });
    updateNavigationFlags();
  });

  webContents.on('page-title-updated', (_event, title): void => {
    updateBrowserState(controller, { title });
  });

  webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, _validatedURL, isMainFrame): void => {
      if (!isMainFrame) {
        return;
      }
      if (errorCode === -3) {
        return;
      }
      updateBrowserState(controller, {
        isLoading: false,
        lastError: `${errorDescription || 'Navigation failed'} (${errorCode})`,
      });
      updateNavigationFlags();
    }
  );

  webContents.setWindowOpenHandler(({ url }): WindowOpenResponse => {
    if (!SAFE_PROTOCOL_REGEX.test(url) || HASHPACK_DEEP_LINK_REGEX.test(url)) {
      void shell.openExternal(url).catch((): void => undefined);
      return { action: 'deny' };
    }
    navigateController(controller, url);
    return { action: 'deny' };
  });

  const blockUnsafeNavigation = (event: ElectronEvent, url: string): void => {
    if (!SAFE_PROTOCOL_REGEX.test(url) || HASHPACK_DEEP_LINK_REGEX.test(url)) {
      event.preventDefault();
      void shell.openExternal(url).catch((): void => undefined);
    }
  };

  webContents.on('will-navigate', blockUnsafeNavigation);
  webContents.on('will-redirect', blockUnsafeNavigation);

  const cleanup = (): void => {
    if (controller.destroyed) {
      return;
    }
    controller.destroyed = true;
    detachBrowserView(controller);
    browserControllers.delete(window.id);
  };

  window.on('closed', cleanup);

  window.on('resize', () => {
    if (controller.bounds.width > 0 && controller.bounds.height > 0) {
      try {
        view.setBounds(controller.bounds);
      } catch (error: unknown) {
        electronLog.error('Failed to reapply browser bounds', toError(error));
      }
    }
  });

  void webContents
    .loadURL(DEFAULT_URL)
    .catch((error: unknown) => electronLog.error('Failed to load initial browser URL', toError(error)));

  sendBrowserState(controller);

  return controller;
};

const getControllerForEvent = (event: IpcMainInvokeEvent): BrowserController | null => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    return null;
  }
  const controller = browserControllers.get(window.id);
  if (controller && !controller.destroyed) {
    return controller;
  }
  return null;
};

const withController = <T>(
  event: IpcMainInvokeEvent,
  handler: (controller: BrowserController) => T
): T => {
  let controller = getControllerForEvent(event);
  if (!controller) {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error('No browser window found for sender');
    }
    controller = ensureBrowserController(window);
  }
  return handler(controller);
};

const navigateController = (controller: BrowserController, url: string): void => {
  if (!SAFE_PROTOCOL_REGEX.test(url) || HASHPACK_DEEP_LINK_REGEX.test(url)) {
    void shell.openExternal(url).catch((): void => undefined);
    return;
  }
  updateBrowserState(controller, {
    requestedUrl: url,
    isLoading: true,
    lastError: null,
  });
  void controller.view.webContents
    .loadURL(url)
    .catch((error: unknown) => {
      electronLog.error('Failed to load URL', { url, error: toError(error) });
      updateBrowserState(controller, {
        isLoading: false,
        lastError: 'Navigation failed',
      });
    });
};

const reloadController = (controller: BrowserController): void => {
  try {
    controller.view.webContents.reload();
    updateBrowserState(controller, { isLoading: true, lastError: null });
  } catch (error: unknown) {
    electronLog.error('Failed to reload browser view', toError(error));
  }
};

const goBackController = (controller: BrowserController): void => {
  try {
    const history = getNavigationHistory(controller.view.webContents);
    if (history ? history.canGoBack() : controller.view.webContents.canGoBack()) {
      controller.view.webContents.goBack();
    }
  } catch (error: unknown) {
    electronLog.error('Failed to go back', toError(error));
  }
};

const goForwardController = (controller: BrowserController): void => {
  try {
    const history = getNavigationHistory(controller.view.webContents);
    if (history ? history.canGoForward() : controller.view.webContents.canGoForward()) {
      controller.view.webContents.goForward();
    }
  } catch (error: unknown) {
    electronLog.error('Failed to go forward', toError(error));
  }
};

const setBoundsForController = (controller: BrowserController, bounds: BrowserBounds): void => {
  controller.bounds = bounds;
  if (!controller.attached) {
    return;
  }
  try {
    controller.view.setBounds(bounds);
  } catch (error: unknown) {
    electronLog.error('Failed to set browser bounds', { bounds, error: toError(error) });
  }
};

ipcMain.handle('paths:get', async () => ({
  moonscapePreload: moonscapePreloadFileUrl,
}));

ipcMain.on('moonscape:open-external', (_event, url) => {
  if (typeof url !== 'string' || !url.trim()) {
    electronLog.error('Invalid moonscape external URL received');
    return;
  }
  try {
    shell.openExternal(url);
  } catch (error) {
    if (logger) {
      logger.error('Failed to open moonscape external URL', toError(error));
    } else {
      electronLog.error('Failed to open moonscape external URL', toError(error));
    }
  }
});

ipcMain.handle('browser:navigate', (event, url: string): Promise<unknown> | unknown =>
  withController(event, (controller) => navigateController(controller, url))
);

ipcMain.handle('browser:reload', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => reloadController(controller))
);

ipcMain.handle('browser:go-back', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => goBackController(controller))
);

ipcMain.handle('browser:go-forward', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => goForwardController(controller))
);

ipcMain.handle(
  'browser:set-bounds',
  (event, bounds: BrowserBounds): Promise<unknown> | unknown =>
    withController(event, (controller) => setBoundsForController(controller, bounds))
);

ipcMain.handle('browser:get-state', (event): Promise<BrowserState> | BrowserState =>
  withController(event, (controller) => ({ ...controller.state }))
);

ipcMain.handle('browser:execute-js', (event, script: string): Promise<unknown> =>
  withController(event, async (controller) => {
    try {
      const result = await controller.view.webContents.executeJavaScript(script, true);
      return result;
    } catch (error: unknown) {
      const formatted = toError(error);
      electronLog.error('Failed to execute browser script', formatted);
      throw formatted;
    }
  })
);

ipcMain.handle('browser:open-devtools', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => {
    try {
      controller.view.webContents.openDevTools({ mode: 'detach' });
    } catch (error: unknown) {
      electronLog.error('Failed to open browser devtools', toError(error));
    }
  })
);

ipcMain.handle('browser:attach', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => attachBrowserView(controller))
);

ipcMain.handle('browser:detach', (event): Promise<unknown> | unknown =>
  withController(event, (controller) => detachBrowserView(controller))
);

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') {
    return;
  }

  contents.setWindowOpenHandler(({ url }) => {
    if (!SAFE_PROTOCOL_REGEX.test(url) || HASHPACK_DEEP_LINK_REGEX.test(url)) {
      void shell.openExternal(url).catch((): void => undefined);
      return { action: 'deny' };
    }
    const host = contents.hostWebContents
      ? BrowserWindow.fromWebContents(contents.hostWebContents)
      : null;
    const controller = host ? browserControllers.get(host.id) : undefined;
    if (controller && !controller.destroyed) {
      navigateController(controller, url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  const interceptNavigation = (event: ElectronEvent, url: string) => {
    if (!SAFE_PROTOCOL_REGEX.test(url) || HASHPACK_DEEP_LINK_REGEX.test(url)) {
      event.preventDefault();
      void shell.openExternal(url).catch((): void => undefined);
    }
  };

  contents.on('will-navigate', interceptNavigation);
  contents.on('will-redirect', interceptNavigation);
});

function createWindow(): void {
  logger.info('Creating main window...');
  logger.info('Preload path:', mainPreloadPath);
  logger.info('Moonscape preload path:', moonscapePreloadPath);

  const primaryIconPath = app.isPackaged
    ? join(currentDir, '../../assets/hol-dock.png')
    : join(currentDir, '../../assets/hol-dock.png');
  let icon = nativeImage.createFromPath(primaryIconPath);
  if (icon.isEmpty()) {
    const fallback = join(currentDir, '../../electron.icns');
    icon = nativeImage.createFromPath(fallback);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    center: true,
    icon: icon,
    title: 'HOL Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: true,
      sandbox: false,
      webSecurity: false,
      webviewTag: true,
      preload: mainPreloadPath,
      webgl: true,
      plugins: true,
      enableWebSQL: false,
    },
  });

  try {
    const ses = mainWindow.webContents.session;

    const expectedOrigin = (() => {
      try {
        if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
          return new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
        }
      } catch {}
      return app.isPackaged ? 'http://localhost' : 'http://localhost:5173';
    })();
    try { electronLog.info('WC expectedOrigin', { expectedOrigin }); } catch {}

    const rewriteUrls = [
      'https://explorer-api.walletconnect.com/*',
      'https://verify.walletconnect.org/*',
      'https://relay.walletconnect.com/*',
      'wss://relay.walletconnect.com/*',
    ];

    ses.webRequest.onBeforeRequest({ urls: rewriteUrls }, (details, callback) => {
      try {
        const url = new URL(details.url);
        if (url.protocol === 'wss:') {
          callback({ cancel: false });
          return;
        }
        const params = url.searchParams;
        let mutated = false;

        if (url.hostname === 'explorer-api.walletconnect.com') {
          const pid = params.get('projectId');
          if (!pid || !String(pid).trim()) {
            params.set('projectId', process.env.WC_PROJECT_ID || '610b20415692c366e3bf97b8208cada5');
            mutated = true;
          }
        }

        if (url.hostname === 'verify.walletconnect.org') {
          const currentOrigin = params.get('origin') || '';
          if (!currentOrigin || currentOrigin.startsWith('file:') || currentOrigin !== expectedOrigin) {
            params.set('origin', expectedOrigin);
            mutated = true;
          }
        }

        if (mutated) {
          callback({ cancel: false, redirectURL: url.toString() });
          return;
        }
      } catch {}
      callback({ cancel: false });
    });

    ses.webRequest.onBeforeSendHeaders({ urls: rewriteUrls }, (details, callback) => {
      try {
        const headers = { ...(details.requestHeaders || {}) } as Record<string, string>;
        if (!headers.Origin || headers.Origin !== expectedOrigin) headers.Origin = expectedOrigin;
        if (!headers.Referer || !headers.Referer.startsWith(expectedOrigin)) headers.Referer = expectedOrigin + '/';
        callback({ requestHeaders: headers });
      } catch {
        callback({ cancel: false });
      }
    });

    ses.webRequest.onHeadersReceived((details, callback) => {
      try {
        const responseHeaders: Record<string, string[]> = { ...details.responseHeaders } as any;
        for (const key of Object.keys(responseHeaders)) {
          if (key.toLowerCase() === 'content-security-policy') delete responseHeaders[key];
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
      } catch (e) {
        try { electronLog.warn('CSP onHeadersReceived error', toError(e)); } catch {}
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      }
    });
} catch (error: unknown) {
  electronLog.error('Failed to register session handlers', toError(error));
}

  ensureBrowserController(mainWindow);

  mainWindow.show();
  mainWindow.focus();

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    logger.info('Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = join(
      currentDir,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    );
    logger.info('Loading file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      logger.error('Failed to load:', errorCode, errorDescription);
    }
  );

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Page finished loading');
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url);
      if (
        url.hostname.endsWith('walletconnect.org') ||
        url.hostname.endsWith('walletconnect.com')
      ) {
        return { action: 'allow' };
      }
    } catch {
    }
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('window-control', (event, action) => {
    if (!mainWindow) return;

    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        mainWindow.close();
        break;
    }
  });

  ipcMain.on('app:reload', () => {
    if (!mainWindow) return;
    logger.info('Reloading app due to error boundary request');
    mainWindow.reload();
  });
}

app.on('ready', async () => {
  logger = new Logger({ module: 'MainProcess' });
  logger.info('App ready, initializing...');

  try {
    const customUserData = process.env.USER_DATA_DIR;
    if (customUserData) {
      app.setPath('userData', customUserData);
      logger.info(
        'Overriding userData path via USER_DATA_DIR:',
        customUserData
      );
    }
  } catch (error) {
    electronLog.warn('Failed to set custom userData path', toError(error));
  }

  if (process.env.SMOKE_DB === '1') {
    try {
      const { databaseManager } = await import('./db/connection');
      const db = databaseManager.getDatabase();
      const ok = Boolean(db);
      const details = ok
        ? { stats: databaseManager.getStats?.() }
        : { reason: 'no-db' };
      const userData = app.getPath('userData');
      try {
        await fs.mkdir(userData, { recursive: true });
      } catch (mkErr) {
        electronLog.warn('Failed to create userData dir for smoke-db', toError(mkErr));
      }
      const outPath = path.join(userData, 'smoke-db.json');
      await fs.writeFile(
        outPath,
        JSON.stringify({ ok, ...details }, null, 2),
        'utf8'
      );
      logger.info('Smoke DB wrote result at:', outPath);
    } catch (e) {
      try {
        const userData = app.getPath('userData');
        const outPath = path.join(userData, 'smoke-db.json');
        try {
          await fs.mkdir(userData, { recursive: true });
      } catch (mkErr) {
        electronLog.warn(
          'Failed to create userData dir for smoke-db (error path)',
          toError(mkErr)
        );
        }
        await fs.writeFile(
          outPath,
          JSON.stringify({ ok: false, error: String(e) }, null, 2),
          'utf8'
        );
        logger.error('Smoke DB error:', e);
      } catch (writeErr) {
        electronLog.error('Failed to write smoke-db error file', writeErr);
      }
    }
    app.quit();
    return;
  }

  if (process.platform === 'darwin') {
    const iconPathCandidate = app.isPackaged
      ? join(currentDir, '../../assets/hol-dock.png')
      : join(currentDir, '../../assets/hol-dock.png');
    let dockIcon = nativeImage.createFromPath(iconPathCandidate);
    if (dockIcon.isEmpty()) {
      const fallback = join(currentDir, '../../electron.icns');
      dockIcon = nativeImage.createFromPath(fallback);
    }
    logger.info('Dock icon path:', iconPathCandidate);
    const icon = dockIcon;
    logger.info('Dock icon loaded:', !icon.isEmpty());

    if (!icon.isEmpty()) {
      if (app.dock) {
        app.dock.setIcon(icon);
        logger.info('Dock icon set successfully');
      }
    } else {
      logger.error('Failed to load dock icon');
    }
  }

  const masterPassword =
    process.env.MASTER_PASSWORD || 'default-secure-password-change-me';
  setupIPCHandlers(masterPassword);
  logger.info('IPC handlers setup complete');

  createWindow();

  if (mainWindow) {
    const updateService = UpdateService.getInstance();
    updateService.setMainWindow(mainWindow);
    logger.info('UpdateService initialized');
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    const contentType = contents.getType?.() || 'window';
    if (contentType === 'window') {
      event.preventDefault();
    }
  });
});
