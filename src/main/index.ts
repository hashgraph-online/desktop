import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import './init-logger';
import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import electronLog from 'electron-log';
import { Logger } from './utils/logger';
import { setupIPCHandlers } from './ipc/handlers';
import { UpdateService } from './services/update-service';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

const envPath = join(currentDir, '..', '..', '.env');
dotenvConfig({ path: envPath });

electronLog.transports.file.level = 'info';
electronLog.transports.console.level = 'info';

try {
  app.setName('HOL Desktop');
  app.setAboutPanelOptions({ applicationName: 'HOL Desktop' });

  process.title = 'HOL Desktop';
} catch (e) {
  electronLog.error('Error setting app metadata', e);
}

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let logger: {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

function createWindow(): void {
  logger.info('Creating main window...');
  logger.info('Preload path:', join(currentDir, 'preload.cjs'));

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
      preload: join(currentDir, 'preload.cjs'),
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
        try { electronLog.warn('CSP onHeadersReceived error', e); } catch {}
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      }
    });
  } catch (e) {
    electronLog.error('Failed to register session handlers', e);
  }

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
  } catch (e) {
    electronLog.warn('Failed to set custom userData path', e);
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
        electronLog.warn('Failed to create userData dir for smoke-db', mkErr);
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
            mkErr
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
    event.preventDefault();
  });
});
