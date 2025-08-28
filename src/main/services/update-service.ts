import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import { Logger } from '../utils/logger';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export class UpdateService {
  private static instance: UpdateService;
  private logger: Logger;
  private mainWindow: BrowserWindow | null = null;
  private updateInfo: UpdateInfo | null = null;

  private constructor() {
    this.logger = new Logger({ module: 'UpdateService' });
    this.setupAutoUpdater();
  }

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupAutoUpdater(): void {
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = 'dev-app-update.yml';
    } else {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'hashgraph-online',
        repo: 'conversational-agent',
        private: false,
        releaseType: 'release'
      });
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    autoUpdater.fullChangelog = true;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for update...');
      this.sendToRenderer('update:checking');
    });

    autoUpdater.on('update-available', (info) => {
      this.logger.info('Update available:', info.version);
      this.updateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      };
      this.sendToRenderer('update:available', this.updateInfo);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('Update not available. Current version:', info.version);
      this.sendToRenderer('update:not-available', { 
        version: info.version,
        releaseDate: new Date().toISOString()
      });
    });

    autoUpdater.on('error', (err) => {
      this.logger.error('Error in auto-updater:', err);
      this.sendToRenderer('update:error', { 
        error: err.message
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const progress: UpdateProgress = {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        total: progressObj.total,
        transferred: progressObj.transferred,
      };
      
      this.logger.info(`Download progress: ${progress.percent}%`);
      this.sendToRenderer('update:download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info('Update downloaded:', info.version);
      this.sendToRenderer('update:downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
      throw error;
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      if (!this.updateInfo) {
        throw new Error('No update available to download');
      }
      
      this.logger.info('Starting update download...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.logger.error('Failed to download update:', error);
      throw error;
    }
  }

  async installUpdate(): Promise<void> {
    try {
      this.logger.info('Installing update and restarting...');
      
      if (this.mainWindow) {
        const response = await dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          message: 'Update Downloaded',
          detail: 'Update has been downloaded. The application will restart to apply the update.',
        });

        if (response.response === 0) {
          autoUpdater.quitAndInstall();
        }
      } else {
        autoUpdater.quitAndInstall();
      }
    } catch (error) {
      this.logger.error('Failed to install update:', error);
      throw error;
    }
  }

  getCurrentVersion(): string {
    return autoUpdater.currentVersion?.version || '0.0.0';
  }

  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  private sendToRenderer(channel: string, data?: UpdateInfo | UpdateProgress | { error: string }): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  setAutoDownload(enabled: boolean): void {
    autoUpdater.autoDownload = enabled;
  }

  setUpdateChannel(channel: 'stable' | 'beta'): void {
    if (channel === 'beta') {
      autoUpdater.allowPrerelease = true;
      if (process.env.NODE_ENV !== 'development') {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner: 'hashgraph-online',
          repo: 'conversational-agent',
          private: false,
          releaseType: 'prerelease'
        });
      }
    } else {
      autoUpdater.allowPrerelease = false;
      if (process.env.NODE_ENV !== 'development') {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner: 'hashgraph-online',
          repo: 'conversational-agent',
          private: false,
          releaseType: 'release'
        });
      }
    }
  }

  /**
   * Force check for updates, bypassing cache
   */
  async forceCheckForUpdates(): Promise<void> {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      this.logger.error('Failed to force check for updates:', error);
      throw error;
    }
  }

  /**
   * Get the GitHub repository URL for releases
   */
  getRepositoryUrl(): string {
    return 'https://github.com/hashgraphonline/hashgraph-online';
  }

  /**
   * Check if updates are supported on current platform
   */
  isUpdateSupported(): boolean {
    return process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux';
  }
}