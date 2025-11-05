import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron';
import electronLog from 'electron-log';
import { calculateBrowserBounds, type BrowserLayoutInfo } from '../browser-layout';
import {
  BrowserBounds,
  BrowserController,
  BrowserEnvironmentOptions,
  BrowserState,
} from './browser-types';

const DEFAULT_BROWSER_STATE: BrowserState = {
  requestedUrl: '',
  currentUrl: '',
  title: '',
  isLoading: true,
  canGoBack: false,
  canGoForward: false,
  lastError: null,
};

const controllers = new Map<number, BrowserController>();
let controllerOptions: BrowserEnvironmentOptions | null = null;

export const initializeBrowserControllers = (
  options: BrowserEnvironmentOptions
): void => {
  controllerOptions = options;
};

export const registerControllerIpcHandlers = (): void => {
  const controllerActions: Record<
    string,
    (controller: BrowserController, payload: unknown) => unknown
  > = {
    'browser:navigate': (controller, payload) =>
      navigateController(controller, String(payload ?? '')),
    'browser:reload': (controller) => reloadController(controller),
    'browser:go-back': (controller) => goBackController(controller),
    'browser:go-forward': (controller) => goForwardController(controller),
    'browser:detach': (controller) => detachBrowserView(controller),
  };

  Object.entries(controllerActions).forEach(([channel, handler]) => {
    ipcMain.handle(channel, (event, payload) =>
      withController(event, (controller) => handler(controller, payload))
    );
  });

  ipcMain.handle('browser:set-bounds', (event, bounds: BrowserBounds) =>
    withController(event, (controller) => setBoundsForController(controller, bounds))
  );

  ipcMain.handle('browser:set-layout', (event, layout: BrowserLayoutInfo) =>
    withController(event, (controller) => {
      const bounds = calculateBrowserBounds(layout);
      const scale =
        typeof layout.devicePixelRatio === 'number' && layout.devicePixelRatio > 0
          ? layout.devicePixelRatio
          : 1;
      const adjustedBounds = {
        x: Math.max(
          Math.round((bounds.x + layout.windowBounds.x) * scale),
          0
        ),
        y: Math.max(
          Math.round((bounds.y + layout.windowBounds.y) * scale),
          0
        ),
        width: Math.max(Math.round(bounds.width * scale), 0),
        height: Math.max(Math.round(bounds.height * scale), 0),
      } satisfies BrowserBounds;
      setBoundsForController(controller, adjustedBounds);
    })
  );

  ipcMain.handle('browser:get-state', (event) =>
    withController(event, (controller) => ({ ...controller.state }))
  );

  ipcMain.handle('browser:execute-js', async (event, script: string) =>
    withController(event, async (controller) => {
      try {
        return await controller.view.webContents.executeJavaScript(
          String(script ?? ''),
          true
        );
      } catch (error) {
        throw toError(error);
      }
    })
  );

  ipcMain.handle('browser:open-devtools', (event) =>
    withController(event, (controller) => {
      try {
        controller.view.webContents.openDevTools({ mode: 'detach' });
      } catch (error) {
        electronLog.error('Failed to open browser devtools', toError(error));
      }
    })
  );

  ipcMain.handle('browser:attach', (event) =>
    withController(event, (controller) => {
      attachBrowserView(controller);
      sendBrowserState(controller);
    })
  );
};

export const ensureBrowserController = (
  window: BrowserWindow
): BrowserController => {
  const existing = controllers.get(window.id);
  if (existing && !existing.destroyed) {
    return existing;
  }

  const options = getControllerOptions();
  const view = new WebContentsView({
    webPreferences: {
      preload: options.moonscapePreloadPath,
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

  try {
    controller.view.setAutoResize({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    });
  } catch (error) {
    electronLog.warn('Failed to enable auto-resize on browser view', error);
  }

  registerViewListeners(controller);
  controllers.set(window.id, controller);
  return controller;
};

export const getControllerForHost = (
  host: BrowserWindow | null
): BrowserController | undefined =>
  host ? controllers.get(host.id) : undefined;

export const withController = <T>(
  event: IpcMainInvokeEvent,
  handler: (controller: BrowserController) => T
): T | undefined => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    electronLog.error('No BrowserWindow associated with IPC event');
    return undefined;
  }
  const controller = ensureBrowserController(window);
  return handler(controller);
};

export const navigateController = (
  controller: BrowserController,
  url: string
): void => {
  if (!url) {
    return;
  }
  try {
    controller.view.webContents.loadURL(url);
    updateBrowserState(controller, {
      requestedUrl: url,
      isLoading: true,
      lastError: null,
    });
  } catch (error) {
    electronLog.error('Failed to navigate controller', toError(error));
  }
};

export const reloadController = (controller: BrowserController): void => {
  try {
    controller.view.webContents.reload();
  } catch (error) {
    electronLog.error('Failed to reload controller', toError(error));
  }
};

export const goBackController = (controller: BrowserController): void => {
  if (controller.view.webContents.canGoBack()) {
    controller.view.webContents.goBack();
  }
};

export const goForwardController = (controller: BrowserController): void => {
  if (controller.view.webContents.canGoForward()) {
    controller.view.webContents.goForward();
  }
};

export const setBoundsForController = (
  controller: BrowserController,
  bounds: BrowserBounds
): void => {
  controller.bounds = bounds;
  if (!controller.attached) {
    return;
  }
  try {
    controller.view.setBounds(bounds);
  } catch (error) {
    electronLog.error('Failed to set browser bounds', {
      bounds,
      error: toError(error),
    });
  }
};

export const updateBrowserState = (
  controller: BrowserController,
  patch: Partial<BrowserState>
): void => {
  controller.state = { ...controller.state, ...patch };
  sendBrowserState(controller);
};

export const sendBrowserState = (controller: BrowserController): void => {
  if (controller.destroyed || controller.window.isDestroyed()) {
    return;
  }
  try {
    controller.window.webContents.send('browser:state', controller.state);
  } catch (error) {
    electronLog.error('Failed to send browser state', toError(error));
  }
};

export const attachBrowserView = (controller: BrowserController): void => {
  if (controller.destroyed || controller.attached) {
    return;
  }
  if (controller.bounds.width === 0 || controller.bounds.height === 0) {
    const fallbackBounds = calculateBrowserBounds({
      toolbarHeight: 0,
      bookmarkHeight: 0,
      windowBounds: controller.window.getBounds(),
    });
    controller.bounds = fallbackBounds;
  }
  try {
    controller.window.contentView.addChildView(controller.view);
    controller.attached = true;
    controller.view.setBounds(controller.bounds);
  } catch (error) {
    electronLog.error('Failed to attach browser view', toError(error));
  }
};

export const detachBrowserView = (controller: BrowserController): void => {
  if (controller.destroyed || !controller.attached) {
    return;
  }
  try {
    controller.window.contentView.removeChildView(controller.view);
  } catch (error) {
    electronLog.error('Failed to detach browser view', toError(error));
  }
  controller.attached = false;
};

export const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }
  const description = typeof value === 'string' ? value : JSON.stringify(value);
  return new Error(description);
};

const registerViewListeners = (controller: BrowserController): void => {
  controller.view.webContents.on('did-finish-load', () => {
    updateBrowserState(controller, {
      isLoading: false,
      currentUrl: controller.view.webContents.getURL(),
      title: controller.view.webContents.getTitle(),
      canGoBack: controller.view.webContents.canGoBack(),
      canGoForward: controller.view.webContents.canGoForward(),
    });
  });
  controller.view.webContents.on('did-fail-load', (_event, errorCode, description) => {
    updateBrowserState(controller, {
      isLoading: false,
      lastError: `${errorCode}: ${description}`,
    });
  });
  controller.view.webContents.on('page-title-updated', (_event, title) => {
    updateBrowserState(controller, { title });
  });
  controller.view.webContents.on('did-start-loading', () => {
    updateBrowserState(controller, { isLoading: true, lastError: null });
  });
  controller.view.webContents.on('did-stop-loading', () => {
    updateBrowserState(controller, { isLoading: false });
  });
  controller.view.webContents.on('did-navigate', (_event, url) => {
    updateBrowserState(controller, { currentUrl: url });
  });
  controller.view.webContents.on('destroyed', () => {
    controller.destroyed = true;
    controllers.delete(controller.window.id);
  });
};

const getControllerOptions = (): BrowserEnvironmentOptions => {
  if (!controllerOptions) {
    throw new Error('Browser environment not initialized');
  }
  return controllerOptions;
};
