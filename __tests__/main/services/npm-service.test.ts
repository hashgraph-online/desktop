import { NPMService, type PluginInstallResult, type PluginSearchResults } from '../../../src/main/services/npm-service';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  },
  existsSync: jest.fn()
}));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn()
  }
}));

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn()
}));

describe('NPMService', () => {
  let npmService: NPMService;
  let mockSpawn: jest.MockedFunction<typeof spawn>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockApp: jest.Mocked<typeof app>;
  let mockChildProcess: jest.Mocked<ChildProcess>;

  beforeEach(() => {
    jest.clearAllMocks();

    (NPMService as any).instance = undefined;

    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
    mockFs = fs as jest.Mocked<typeof fs>;
    mockApp = app as jest.Mocked<typeof app>;

    mockApp.getPath.mockReturnValue('/mock/user/data');
    mockFs.existsSync.mockReturnValue(false);
    mockFs.promises.mkdir.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockResolvedValue('[]');
    mockFs.promises.writeFile.mockResolvedValue(undefined);
    mockFs.promises.access.mockResolvedValue(undefined);

    mockChildProcess = {
      stdout: { on: jest.fn() } as any,
      stderr: { on: jest.fn() } as any,
      on: jest.fn(),
      kill: jest.fn()
    } as jest.Mocked<ChildProcess>;

    mockSpawn.mockReturnValue(mockChildProcess);

    const { Logger } = require('../../../src/main/utils/logger');
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    Logger.mockImplementation(() => mockLogger);

    npmService = NPMService.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = NPMService.getInstance();
      const instance2 = NPMService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with correct paths', () => {
      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/mock/user/data/plugins', { recursive: true });
    });
  });

  describe('Plugin Management', () => {
    test('should load plugins from disk', async () => {
      const mockPlugins = [
        { name: 'test-plugin', version: '1.0.0', enabled: true }
      ];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockPlugins));

      const result = await npmService.loadPlugins();

      expect(result).toEqual(mockPlugins);
      expect(mockFs.promises.readFile).toHaveBeenCalledWith('/mock/user/data/npm-plugins.json', 'utf8');
    });

    test('should return empty array when config file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await npmService.loadPlugins();

      expect(result).toEqual([]);
      expect(mockFs.promises.readFile).not.toHaveBeenCalled();
    });

    test('should handle file read errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockRejectedValue(new Error('File read error'));

      const result = await npmService.loadPlugins();

      expect(result).toEqual([]);
    });

    test('should save plugins to disk', async () => {
      const plugins = [
        { name: 'test-plugin', version: '1.0.0', enabled: true }
      ];

      await npmService.savePlugins(plugins);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/mock/user/data/npm-plugins.json',
        JSON.stringify(plugins, null, 2)
      );
    });

    test('should handle save errors', async () => {
      const plugins = [{ name: 'test-plugin', version: '1.0.0', enabled: true }];
      mockFs.promises.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(npmService.savePlugins(plugins)).rejects.toThrow('Write error');
    });
  });

  describe('Plugin Search', () => {
    test('should search plugins successfully', async () => {
      const mockSearchResults = [
        {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          downloads: 1000,
          score: { final: 0.8, detail: { quality: 0.9, popularity: 0.7, maintenance: 0.8 } }
        }
      ];

      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockSearchResults));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const result = await npmService.searchPlugins('test');

      expect(result.success).toBe(true);
      expect(result.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author'
        })
      ]));
      expect(mockSpawn).toHaveBeenCalledWith('npm', ['search', 'test', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('should use custom registry', async () => {
      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify([]));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      await npmService.searchPlugins('test', { registry: 'https://custom.registry.com' });

      expect(mockSpawn).toHaveBeenCalledWith('npm', [
        'search', 'test', '--json', '--registry', 'https://custom.registry.com'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('should handle search errors', async () => {
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(1);
        }
      });

      const mockStderr = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('Search failed');
          }
        })
      };

      mockChildProcess.stderr = mockStderr as any;

      const result = await npmService.searchPlugins('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });

    test('should use cached results', async () => {
      const cachedResults = [
        { name: 'cached-plugin', version: '1.0.0', description: 'Cached plugin' }
      ];

      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(cachedResults));
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      await npmService.searchPlugins('cached');

      const result = await npmService.searchPlugins('cached');

      expect(result.success).toBe(true);
      expect(result.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'cached-plugin',
          version: '1.0.0',
          description: 'Cached plugin'
        })
      ]));
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Plugin Installation', () => {
    test('should install plugin successfully', async () => {
      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('added 1 package');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const result = await npmService.installPlugin('test-plugin', {
        version: '1.0.0',
        registry: 'https://registry.npmjs.org'
      });

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('npm', [
        'install', 'test-plugin',
        '--registry', 'https://registry.npmjs.org'
      ], {
        cwd: '/mock/user/data/plugins/test-plugin',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('should handle installation errors', async () => {
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(1);
        }
      });

      const mockStderr = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('Installation failed');
          }
        })
      };

      mockChildProcess.stderr = mockStderr as any;

      const result = await npmService.installPlugin('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Installation failed');
    });

    test('should handle installation with progress callback', async () => {
      const progressCallback = jest.fn();
      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('added 1 package');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const result = await npmService.installPlugin('test-plugin', {
        onProgress: progressCallback
      });

      expect(result.success).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Plugin Updates', () => {
    test('should update plugin successfully', async () => {
      (npmService as any).pluginConfigs = [
        { id: 'test-plugin', name: 'test-plugin', version: '1.0.0', enabled: true }
      ];

      (npmService as any).checkPluginUpdate = jest.fn().mockResolvedValue({
        pluginId: 'test-plugin',
        currentVersion: '1.0.0',
        availableVersion: '1.1.0',
        updateType: 'minor',
        breakingChanges: false
      });

      const mockStdout = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('updated 1 package');
          }
          if (event === 'end') {
            callback();
          }
        })
      };

      mockChildProcess.stdout = mockStdout as any;
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const result = await npmService.updatePlugin('test-plugin');

      expect(result.success).toBe(true);
    });

    test('should handle plugin not found', async () => {
      const result = await npmService.updatePlugin('non-existent-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin not found');
    });
  });

  describe('Plugin Uninstallation', () => {
    test('should uninstall plugin successfully', async () => {
      (npmService as any).pluginConfigs = [
        { id: 'test-plugin', name: 'test-plugin', version: '1.0.0', enabled: true }
      ];

      const result = await npmService.uninstallPlugin('test-plugin');

      expect(result.success).toBe(true);
    });

    test('should handle plugin not found', async () => {
      const result = await npmService.uninstallPlugin('non-existent-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin not found');
    });
  });






});
