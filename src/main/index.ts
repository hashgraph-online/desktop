import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import './init-logger';
import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron';
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
} catch {
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

  const iconPath = app.isPackaged
    ? join(currentDir, '../../assets/hol-dock.png')
    : join(currentDir, '../../assets/hol-dock.png');

  const icon = nativeImage.createFromPath(iconPath);

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

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
              "worker-src 'self' blob: data:; " +
              "style-src 'self' 'unsafe-inline' blob: data: https://fonts.googleapis.com; " +
              "img-src 'self' data: blob: https:; " +
              "font-src 'self' data: blob: https://fonts.gstatic.com; " +
              "connect-src 'self' https: ws: wss: wss://inscribe.kiloscribe.com; " +
              "media-src 'self' blob: data:; " +
              "object-src 'none'; " +
              "base-uri 'self';",
          ],
        },
      });
    }
  );

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

  if (process.platform === 'darwin') {
    const iconPath = app.isPackaged
      ? join(currentDir, '../../assets/hol-dock.png')
      : join(currentDir, '../../assets/hol-dock.png');
    logger.info('Dock icon path:', iconPath);

    const icon = nativeImage.createFromPath(iconPath);
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
