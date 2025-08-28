import { UpdateService, type UpdateInfo, type UpdateProgress } from '../../../src/main/services/update-service';
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';

jest.mock('electron-updater', () => ({
  autoUpdater: {
    updateConfigPath: '',
    autoDownload: false,
    autoInstallOnAppQuit: true,
    fullChangelog: true,
    allowDowngrade: false,
    currentVersion: { version: '1.0.0' },
    allowPrerelease: false,
    setFeedURL: jest.fn(),
    on: jest.fn(),
    checkForUpdates: jest.fn().mockResolvedValue(undefined),
    downloadUpdate: jest.fn().mockResolvedValue(undefined),
    quitAndInstall: jest.fn(),
    checkForUpdatesAndNotify: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  dialog: {
    showMessageBox: jest.fn()
  }
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn()
}));

describe('UpdateService', () => {
  let updateService: UpdateService;
  let mockAutoUpdater: jest.Mocked<typeof autoUpdater>;
  let mockBrowserWindow: jest.MockedClass<typeof BrowserWindow>;
  let mockDialog: jest.Mocked<typeof dialog>;
  let mockMainWindow: jest.Mocked<BrowserWindow>;

  beforeEach(() => {
    jest.clearAllMocks();

    (UpdateService as any).instance = undefined;

    delete process.env.NODE_ENV;

    mockAutoUpdater = autoUpdater as jest.Mocked<typeof autoUpdater>;
    mockBrowserWindow = BrowserWindow as jest.MockedClass<typeof BrowserWindow>;
    mockDialog = dialog as jest.Mocked<typeof dialog>;

    mockMainWindow = {
      webContents: {
        send: jest.fn()
      },
      isDestroyed: jest.fn().mockReturnValue(false)
    } as jest.Mocked<BrowserWindow>;

    mockBrowserWindow.mockImplementation(() => mockMainWindow);

    const { Logger } = require('../../../src/main/utils/logger');
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    updateService = UpdateService.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = UpdateService.getInstance();
      const instance2 = UpdateService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should setup auto updater correctly', () => {
      expect(mockAutoUpdater.autoDownload).toBe(false);
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
      expect(mockAutoUpdater.fullChangelog).toBe(true);
      expect(mockAutoUpdater.allowDowngrade).toBe(false);
      expect(mockAutoUpdater.on).toHaveBeenCalled();
    });

    test('should setup GitHub feed URL in production', () => {
      process.env.NODE_ENV = 'production';
      
      (UpdateService as any).instance = undefined;
      UpdateService.getInstance();

      expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'hashgraph-online',
        repo: 'conversational-agent',
        private: false,
        releaseType: 'release'
      });
    });

    test('should use dev config in development', () => {
      process.env.NODE_ENV = 'development';
      
      (UpdateService as any).instance = undefined;
      UpdateService.getInstance();

      expect(mockAutoUpdater.updateConfigPath).toBe('dev-app-update.yml');
    });
  });

  describe('Main Window Management', () => {
    test('should set main window', () => {
      updateService.setMainWindow(mockMainWindow);
      
      expect((updateService as any).mainWindow).toBe(mockMainWindow);
    });
  });

  describe('Update Checking', () => {
    test('should check for updates successfully', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined);

      await updateService.checkForUpdates();

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });



    test('should force check for updates', async () => {
      mockAutoUpdater.checkForUpdatesAndNotify.mockResolvedValue(undefined);

      await updateService.forceCheckForUpdates();

      expect(mockAutoUpdater.checkForUpdatesAndNotify).toHaveBeenCalled();
    });


  });

  describe('Update Downloading', () => {
    test('should download update successfully', async () => {
      const updateInfo: UpdateInfo = {
        version: '1.1.0',
        releaseDate: '2024-01-01T00:00:00Z'
      };
      
      (updateService as any).updateInfo = updateInfo;
      mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined);

      await updateService.downloadUpdate();

      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    test('should handle download when no update available', async () => {
      (updateService as any).updateInfo = null;

      await expect(updateService.downloadUpdate()).rejects.toThrow('No update available to download');
    });


  });

  describe('Update Installation', () => {
    test('should install update with user confirmation', async () => {
      updateService.setMainWindow(mockMainWindow);
      mockDialog.showMessageBox.mockResolvedValue({ response: 0 });

      await updateService.installUpdate();

      expect(mockDialog.showMessageBox).toHaveBeenCalledWith(mockMainWindow, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        message: 'Update Downloaded',
        detail: 'Update has been downloaded. The application will restart to apply the update.'
      });
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    test('should install update when user chooses later', async () => {
      updateService.setMainWindow(mockMainWindow);
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 });

      await updateService.installUpdate();

      expect(mockDialog.showMessageBox).toHaveBeenCalled();
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
    });

    test('should install update without dialog when no main window', async () => {
      await updateService.installUpdate();

      expect(mockDialog.showMessageBox).not.toHaveBeenCalled();
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
    });


  });

  describe('Version Information', () => {
    test('should get current version', () => {
      const version = updateService.getCurrentVersion();
      expect(version).toBe('1.0.0');
    });

    test('should get update info', () => {
      const updateInfo: UpdateInfo = {
        version: '1.1.0',
        releaseDate: '2024-01-01T00:00:00Z',
        releaseNotes: 'Bug fixes and improvements'
      };
      
      (updateService as any).updateInfo = updateInfo;

      const result = updateService.getUpdateInfo();
      expect(result).toEqual(updateInfo);
    });

    test('should return null when no update info', () => {
      (updateService as any).updateInfo = null;

      const result = updateService.getUpdateInfo();
      expect(result).toBeNull();
    });
  });

  describe('Auto Download Settings', () => {
    test('should set auto download', () => {
      updateService.setAutoDownload(true);
      expect(mockAutoUpdater.autoDownload).toBe(true);

      updateService.setAutoDownload(false);
      expect(mockAutoUpdater.autoDownload).toBe(false);
    });
  });

  describe('Update Channel Management', () => {
    test('should set stable channel', () => {
      process.env.NODE_ENV = 'production';
      
      updateService.setUpdateChannel('stable');

      expect(mockAutoUpdater.allowPrerelease).toBe(false);
      expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'hashgraph-online',
        repo: 'conversational-agent',
        private: false,
        releaseType: 'release'
      });
    });

    test('should set beta channel', () => {
      process.env.NODE_ENV = 'production';
      
      updateService.setUpdateChannel('beta');

      expect(mockAutoUpdater.allowPrerelease).toBe(true);
      expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'hashgraph-online',
        repo: 'conversational-agent',
        private: false,
        releaseType: 'prerelease'
      });
    });

    test('should not set feed URL in development', () => {
      process.env.NODE_ENV = 'development';
      
      (UpdateService as any).instance = undefined;
      
      mockAutoUpdater.setFeedURL.mockClear();
      
      const devUpdateService = UpdateService.getInstance();
      
      devUpdateService.setUpdateChannel('beta');

      expect(mockAutoUpdater.setFeedURL).not.toHaveBeenCalled();
    });
  });

  describe('Platform Support', () => {
    test('should support updates on supported platforms', () => {
      const originalPlatform = process.platform;
      
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
      expect(updateService.isUpdateSupported()).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      expect(updateService.isUpdateSupported()).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      expect(updateService.isUpdateSupported()).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });

    test('should not support updates on unsupported platforms', () => {
      const originalPlatform = process.platform;
      
      Object.defineProperty(process, 'platform', { value: 'freebsd', writable: true });
      expect(updateService.isUpdateSupported()).toBe(false);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });
  });

  describe('Repository Information', () => {
    test('should return correct repository URL', () => {
      const url = updateService.getRepositoryUrl();
      expect(url).toBe('https://github.com/hashgraphonline/hashgraph-online');
    });
  });


});
