import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { NPMService } from '../../services/npm-service';
import type {
  PluginInstallOptions,
  PluginInstallProgress,
  PluginPermissions,
  NPMPluginConfig,
} from '../../../shared/types/plugin';
import { Logger } from '../../utils/logger';
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';

/**
 * Sets up plugin-related IPC handlers
 */
export function setupPluginHandlers(): void {
  const npmService = NPMService.getInstance();
  const logger = new Logger({ module: 'PluginHandlers' });

  ipcMain.handle(
    'plugin:search',
    async (
      event: IpcMainInvokeEvent,
      data: { query: string; registry?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.searchPlugins(data.query, {
          registry: data.registry,
        });
        return {
          success: result.success,
          data: result.results,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin search failed:', error);
        return handleIPCError(error, 'Failed to search plugins');
      }
    }
  );

  ipcMain.handle(
    'plugin:install',
    async (
      event: IpcMainInvokeEvent,
      data: {
        packageName: string;
        options?: PluginInstallOptions;
      }
    ): Promise<IPCResponse> => {
      try {
        const progressCallback = (progress: PluginInstallProgress) => {
          event.sender.send('plugin:installProgress', progress);
        };

        const result = await npmService.installPlugin(
          data.packageName,
          data.options,
          progressCallback
        );

        return {
          success: result.success,
          data: result.plugin,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin installation failed:', error);
        return handleIPCError(error, 'Failed to install plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:uninstall',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.uninstallPlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin uninstallation failed:', error);
        return handleIPCError(error, 'Failed to uninstall plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:update',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const progressCallback = (progress: PluginInstallProgress) => {
          event.sender.send('plugin:updateProgress', progress);
        };

        const result = await npmService.updatePlugin(
          pluginId,
          progressCallback
        );
        return {
          success: result.success,
          data: result.plugin,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin update failed:', error);
        return handleIPCError(error, 'Failed to update plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:enable',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.enablePlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin enable failed:', error);
        return handleIPCError(error, 'Failed to enable plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:disable',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.disablePlugin(pluginId);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        logger.error('Plugin disable failed:', error);
        return handleIPCError(error, 'Failed to disable plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:configure',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; config: Record<string, any> }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        if (plugin.configSchema) {
        }

        plugin.config = data.config;
        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return createSuccessResponse(plugin);
      } catch (error) {
        logger.error('Plugin configuration failed:', error);
        return handleIPCError(error, 'Failed to configure plugin');
      }
    }
  );

  ipcMain.handle(
    'plugin:getPermissions',
    async (
      event: IpcMainInvokeEvent,
      pluginId: string
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        return createSuccessResponse({
          required: plugin.permissions,
          granted: plugin.grantedPermissions,
        });
      } catch (error) {
        logger.error('Get plugin permissions failed:', error);
        return handleIPCError(error, 'Failed to get plugin permissions');
      }
    }
  );

  ipcMain.handle(
    'plugin:grantPermissions',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; permissions: PluginPermissions }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        plugin.grantedPermissions = data.permissions;
        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return createSuccessResponse(plugin);
      } catch (error) {
        logger.error('Grant plugin permissions failed:', error);
        return handleIPCError(error, 'Failed to grant plugin permissions');
      }
    }
  );

  ipcMain.handle(
    'plugin:revokePermissions',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; permissions: PluginPermissions }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        if (plugin.grantedPermissions) {
          const revokedPermissions = { ...plugin.grantedPermissions };
          Object.keys(data.permissions).forEach((key) => {
            delete revokedPermissions[key as keyof PluginPermissions];
          });
          plugin.grantedPermissions = revokedPermissions;
        }

        plugin.updatedAt = new Date();

        await npmService.savePlugins(plugins);

        return createSuccessResponse(plugin.grantedPermissions);
      } catch (error) {
        logger.error('Revoke plugin permissions failed:', error);
        return handleIPCError(error, 'Failed to revoke plugin permissions');
      }
    }
  );

  ipcMain.handle(
    'plugin:getInstalled',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        return createSuccessResponse(plugins);
      } catch (error) {
        logger.error('Get installed plugins failed:', error);
        return handleIPCError(error, 'Failed to get installed plugins');
      }
    }
  );

  ipcMain.handle(
    'plugin:checkUpdates',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const updates = await Promise.all(
          plugins.map((plugin) => npmService.checkPluginUpdate(plugin.id))
        );

        const availableUpdates = updates.filter((update) => update !== null);
        return createSuccessResponse(availableUpdates);
      } catch (error) {
        logger.error('Check plugin updates failed:', error);
        return handleIPCError(error, 'Failed to check plugin updates');
      }
    }
  );

  ipcMain.handle(
    'plugin:validateConfig',
    async (
      event: IpcMainInvokeEvent,
      data: { pluginId: string; config: Record<string, any> }
    ): Promise<IPCResponse> => {
      try {
        const plugins = await npmService.loadPlugins();
        const plugin = plugins.find((p) => p.id === data.pluginId);

        if (!plugin) {
          return { success: false, error: 'Plugin not found' };
        }

        return createSuccessResponse({ valid: true });
      } catch (error) {
        logger.error('Validate plugin config failed:', error);
        return handleIPCError(error, 'Failed to validate plugin config');
      }
    }
  );

  ipcMain.handle(
    'plugin:validateSecurity',
    async (
      event: IpcMainInvokeEvent,
      data: { packageName: string; version?: string }
    ): Promise<IPCResponse> => {
      try {
        const result = await npmService.validatePackageSecurity(
          data.packageName,
          data.version
        );
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Package security validation failed:', error);
        return handleIPCError(error, 'Failed to validate package security');
      }
    }
  );

  ipcMain.handle(
    'plugin:clearCache',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        npmService.clearCaches();
        return createSuccessResponse();
      } catch (error) {
        logger.error('Clear plugin cache failed:', error);
        return handleIPCError(error, 'Failed to clear plugin cache');
      }
    }
  );
}