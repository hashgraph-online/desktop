import { Logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import type {
  NPMPluginConfig,
  PluginInstallOptions,
  PluginSearchResult,
  PluginInstallProgress,
  PluginMetadata,
  PluginPermissions,
  PluginUpdateInfo,
} from '../../shared/types/plugin';

interface NPMSearchPackage {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  date: string;
  author?: {
    name: string;
    email?: string;
  };
  maintainers?: Array<{
    name: string;
    email?: string;
  }>;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  license?: string;
  downloads?: number;
  links?: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  publisher?: {
    username: string;
    email?: string;
  };
  score?: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

interface NPMVulnerability {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  name?: string;
  overview: string;
  recommendation: string;
  url?: string;
  via?: string[];
  effects?: string[];
  range?: string;
}

/**
 * Result of plugin installation
 */
export interface PluginInstallResult {
  success: boolean;
  plugin?: NPMPluginConfig;
  error?: string;
}

/**
 * Result of plugin search
 */
export interface PluginSearchResults {
  success: boolean;
  results?: PluginSearchResult[];
  error?: string;
}

/**
 * Service for managing NPM plugin operations in the main process
 */
export class NPMService {
  private static instance: NPMService;
  private logger: Logger;
  private pluginConfigs: NPMPluginConfig[] = [];
  private configPath: string;
  private pluginsDir: string;
  private installProcesses: Map<string, ChildProcess> = new Map();
  private installProgressCallbacks: Map<
    string,
    (progress: PluginInstallProgress) => void
  > = new Map();
  private searchCache: Map<
    string,
    { results: PluginSearchResult[]; timestamp: number }
  > = new Map();
  private cacheTimeout = 5 * 60 * 1000;

  private constructor() {
    this.logger = new Logger({ module: 'NPMService' });
    this.configPath = path.join(app.getPath('userData'), 'npm-plugins.json');
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.ensurePluginsDirectory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NPMService {
    if (!NPMService.instance) {
      NPMService.instance = new NPMService();
    }
    return NPMService.instance;
  }

  /**
   * Ensure plugins directory exists
   */
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.pluginsDir, { recursive: true });
    } catch (_error) {
      this.logger.error('Failed to create plugins directory:', _error);
    }
  }

  /**
   * Load plugin configurations from disk
   */
  async loadPlugins(): Promise<NPMPluginConfig[]> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = await fs.promises.readFile(this.configPath, 'utf8');
        this.pluginConfigs = JSON.parse(data);
        this.logger.info(
          `Loaded ${this.pluginConfigs.length} plugin configurations`
        );
      } else {
        this.pluginConfigs = [];
        this.logger.info('No plugin configurations found');
      }
      return this.pluginConfigs;
    } catch (_error) {
      this.logger.error('Failed to load plugin configurations:', _error);
      this.pluginConfigs = [];
      return this.pluginConfigs;
    }
  }

  /**
   * Save plugin configurations to disk
   */
  async savePlugins(plugins: NPMPluginConfig[]): Promise<void> {
    try {
      this.pluginConfigs = plugins;
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(plugins, null, 2)
      );
      this.logger.info(`Saved ${plugins.length} plugin configurations`);
    } catch (_error) {
      this.logger.error('Failed to save plugin configurations:', _error);
      throw _error;
    }
  }

  /**
   * Search for plugins in NPM registry
   */
  async searchPlugins(
    query: string,
    options?: { registry?: string }
  ): Promise<PluginSearchResults> {
    try {
      const cacheKey = `${query}-${options?.registry || 'default'}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return { success: true, results: cached.results };
      }

      this.logger.info(`Searching for plugins: ${query}`);

      const args = ['search', query, '--json'];
      if (options?.registry) {
        args.push('--registry', options.registry);
      }

      return new Promise((resolve) => {
        const npmProcess = spawn('npm', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        npmProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        npmProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const results = JSON.parse(stdout);
              const pluginResults: PluginSearchResult[] = results.map(
                (pkg: NPMSearchPackage) => ({
                  name: pkg.name,
                  version: pkg.version,
                  description: pkg.description || '',
                  keywords: pkg.keywords || [],
                  date: pkg.date,
                  links: pkg.links,
                  author: pkg.author,
                  publisher: pkg.publisher,
                  maintainers: pkg.maintainers,
                  score: pkg.score,
                })
              );

              this.searchCache.set(cacheKey, {
                results: pluginResults,
                timestamp: Date.now(),
              });

              resolve({ success: true, results: pluginResults });
            } catch (_error) {
              resolve({
                success: false,
                error: 'Failed to parse search results',
              });
            }
          } else {
            resolve({
              success: false,
              error: stderr || `Process exited with code ${code}`,
            });
          }
        });

        npmProcess.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
      });
    } catch (_error) {
      this.logger.error('Plugin search failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Search failed',
      };
    }
  }

  /**
   * Install a plugin from NPM
   */
  async installPlugin(
    packageName: string,
    options?: PluginInstallOptions,
    progressCallback?: (progress: PluginInstallProgress) => void
  ): Promise<PluginInstallResult> {
    try {
      this.logger.info(`Installing plugin: ${packageName}`);

      const pluginId = this.generatePluginId(packageName);
      const installPath = path.join(this.pluginsDir, pluginId);

      const existingPlugin = this.pluginConfigs.find(
        (p) => p.name === packageName
      );
      if (existingPlugin && !options?.force) {
        return {
          success: false,
          error: 'Plugin is already installed. Use force option to reinstall.',
        };
      }

      await fs.promises.mkdir(installPath, { recursive: true });

      const packageJsonPath = path.join(installPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        await fs.promises.writeFile(
          packageJsonPath,
          JSON.stringify(
            {
              name: `plugin-${pluginId}`,
              version: '1.0.0',
              private: true,
            },
            null,
            2
          )
        );
      }

      const args = ['install', packageName];
      if (options?.saveExact) args.push('--save-exact');
      if (options?.noDeps) args.push('--no-save');
      if (options?.legacyPeerDeps) args.push('--legacy-peer-deps');
      if (options?.registry) args.push('--registry', options.registry);

      if (progressCallback) {
        this.installProgressCallbacks.set(pluginId, progressCallback);
        progressCallback({
          pluginId,
          phase: 'downloading',
          message: 'Downloading package from registry',
        });
      }

      return new Promise((resolve) => {
        const npmProcess = spawn('npm', args, {
          cwd: installPath,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.installProcesses.set(pluginId, npmProcess);

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data) => {
          stdout += data.toString();

          if (progressCallback) {
            if (stdout.includes('resolving')) {
              progressCallback({
                pluginId,
                phase: 'downloading',
                progress: 25,
                message: 'Resolving dependencies',
              });
            } else if (
              stdout.includes('extracting') ||
              stdout.includes('unpacking')
            ) {
              progressCallback({
                pluginId,
                phase: 'extracting',
                progress: 50,
                message: 'Extracting package',
              });
            } else if (stdout.includes('installing')) {
              progressCallback({
                pluginId,
                phase: 'installing',
                progress: 75,
                message: 'Installing dependencies',
              });
            }
          }
        });

        npmProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        npmProcess.on('close', async (code) => {
          this.installProcesses.delete(pluginId);
          this.installProgressCallbacks.delete(pluginId);

          if (code === 0) {
            try {
              const metadata = await this.readPackageMetadata(
                installPath,
                packageName
              );

              const permissions = this.extractPermissions(metadata);

              const pluginConfig: NPMPluginConfig = {
                id: pluginId,
                name: packageName,
                type: 'npm',
                status: 'installed',
                enabled: false,
                version: metadata.version,
                installedVersion: metadata.version,
                metadata,
                permissions,
                installPath,
                registry: options?.registry,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const updatedConfigs = [
                ...this.pluginConfigs.filter((p) => p.id !== pluginId),
                pluginConfig,
              ];
              await this.savePlugins(updatedConfigs);

              if (progressCallback) {
                progressCallback({
                  pluginId,
                  phase: 'completed',
                  progress: 100,
                  message: 'Installation completed successfully',
                });
              }

              resolve({ success: true, plugin: pluginConfig });
            } catch (_error) {
              if (progressCallback) {
                progressCallback({
                  pluginId,
                  phase: 'failed',
                  error: 'Failed to save plugin configuration',
                });
              }
              resolve({
                success: false,
                error: 'Failed to save plugin configuration',
              });
            }
          } else {
            if (progressCallback) {
              progressCallback({
                pluginId,
                phase: 'failed',
                error: stderr || `Installation failed with code ${code}`,
              });
            }
            resolve({
              success: false,
              error: stderr || `Process exited with code ${code}`,
            });
          }
        });

        npmProcess.on('error', (error) => {
          this.installProcesses.delete(pluginId);
          this.installProgressCallbacks.delete(pluginId);

          if (progressCallback) {
            progressCallback({
              pluginId,
              phase: 'failed',
              error: error.message,
            });
          }

          resolve({ success: false, error: error.message });
        });
      });
    } catch (_error) {
      this.logger.error('Plugin installation failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Installation failed',
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(
    pluginId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = this.pluginConfigs.find((p) => p.id === pluginId);
      if (!plugin) {
        return { success: false, error: 'Plugin not found' };
      }

      this.logger.info(`Uninstalling plugin: ${plugin.name}`);

      if (plugin.installPath && fs.existsSync(plugin.installPath)) {
        await fs.promises.rm(plugin.installPath, {
          recursive: true,
          force: true,
        });
      }

      const updatedConfigs = this.pluginConfigs.filter(
        (p) => p.id !== pluginId
      );
      await this.savePlugins(updatedConfigs);

      return { success: true };
    } catch (_error) {
      this.logger.error('Plugin uninstallation failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Uninstallation failed',
      };
    }
  }

  /**
   * Update a plugin
   */
  async updatePlugin(
    pluginId: string,
    progressCallback?: (progress: PluginInstallProgress) => void
  ): Promise<PluginInstallResult> {
    try {
      const plugin = this.pluginConfigs.find((p) => p.id === pluginId);
      if (!plugin) {
        return { success: false, error: 'Plugin not found' };
      }

      this.logger.info(`Updating plugin: ${plugin.name}`);

      const updateInfo = await this.checkPluginUpdate(pluginId);
      if (!updateInfo || !updateInfo.availableVersion) {
        return { success: false, error: 'No updates available' };
      }

      return this.installPlugin(plugin.name, { force: true }, progressCallback);
    } catch (_error) {
      this.logger.error('Plugin update failed:', _error);
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Update failed',
      };
    }
  }

  /**
   * Check for plugin updates
   */
  async checkPluginUpdate(pluginId: string): Promise<PluginUpdateInfo | null> {
    try {
      const plugin = this.pluginConfigs.find((p) => p.id === pluginId);
      if (!plugin) return null;

      const latestVersion = await this.getLatestVersion(
        plugin.name,
        plugin.registry
      );
      if (!latestVersion) return null;

      const updateType = this.compareVersions(
        plugin.installedVersion || plugin.version,
        latestVersion
      );
      if (!updateType) return null;

      return {
        pluginId,
        currentVersion: plugin.installedVersion || plugin.version,
        availableVersion: latestVersion,
        updateType,
        breakingChanges: updateType === 'major',
      };
    } catch (_error) {
      this.logger.error('Failed to check plugin update:', _error);
      return null;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(
    pluginId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = this.pluginConfigs.find((p) => p.id === pluginId);
      if (!plugin) {
        return { success: false, error: 'Plugin not found' };
      }

      plugin.enabled = true;
      plugin.status = 'enabled';
      plugin.updatedAt = new Date();

      await this.savePlugins(this.pluginConfigs);
      return { success: true };
    } catch (_error) {
      this.logger.error('Failed to enable plugin:', _error);
      return {
        success: false,
        error:
          _error instanceof Error ? _error.message : 'Failed to enable plugin',
      };
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(
    pluginId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = this.pluginConfigs.find((p) => p.id === pluginId);
      if (!plugin) {
        return { success: false, error: 'Plugin not found' };
      }

      plugin.enabled = false;
      plugin.status = 'disabled';
      plugin.updatedAt = new Date();

      await this.savePlugins(this.pluginConfigs);
      return { success: true };
    } catch (_error) {
      this.logger.error('Failed to disable plugin:', _error);
      return {
        success: false,
        error:
          _error instanceof Error ? _error.message : 'Failed to disable plugin',
      };
    }
  }

  /**
   * Get all plugin configurations
   */
  getPluginConfigs(): NPMPluginConfig[] {
    return this.pluginConfigs;
  }

  /**
   * Read package metadata from installed plugin
   */
  private async readPackageMetadata(
    installPath: string,
    packageName: string
  ): Promise<PluginMetadata> {
    try {
      const packageJsonPath = path.join(
        installPath,
        'node_modules',
        packageName,
        'package.json'
      );
      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, 'utf8')
      );

      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description || '',
        author: packageJson.author || '',
        license: packageJson.license,
        homepage: packageJson.homepage,
        repository: packageJson.repository,
        keywords: packageJson.keywords,
        dependencies: packageJson.dependencies,
        peerDependencies: packageJson.peerDependencies,
        engines: packageJson.engines,
      };
    } catch (_error) {
      this.logger.error('Failed to read package metadata:', _error);
      throw _error;
    }
  }

  /**
   * Extract permissions from package metadata
   */
  private extractPermissions(
    metadata: PluginMetadata
  ): PluginPermissions | undefined {
    const permissions: PluginPermissions = {};

    if (
      metadata.dependencies &&
      ('fs' in metadata.dependencies || 'fs-extra' in metadata.dependencies)
    ) {
      permissions.filesystem = { read: ['*'], write: [] };
    }

    if (
      metadata.dependencies &&
      ('axios' in metadata.dependencies ||
        'node-fetch' in metadata.dependencies)
    ) {
      permissions.network = { allowAllHosts: true };
    }

    return Object.keys(permissions).length > 0 ? permissions : undefined;
  }

  /**
   * Generate unique plugin ID
   */
  private generatePluginId(packageName: string): string {
    return packageName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  }

  /**
   * Get latest version of a package
   */
  private async getLatestVersion(
    packageName: string,
    registry?: string
  ): Promise<string | null> {
    try {
      const args = ['view', packageName, 'version'];
      if (registry) {
        args.push('--registry', registry);
      }

      return new Promise((resolve) => {
        const npmProcess = spawn('npm', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';

        npmProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        npmProcess.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            resolve(null);
          }
        });

        npmProcess.on('error', () => {
          resolve(null);
        });
      });
    } catch (_error) {
      return null;
    }
  }

  /**
   * Compare versions and determine update type
   */
  private compareVersions(
    current: string,
    latest: string
  ): 'patch' | 'minor' | 'major' | null {
    try {
      const currentParts = current.split('.').map(Number);
      const latestParts = latest.split('.').map(Number);

      if (latestParts[0] > currentParts[0]) return 'major';
      if (
        latestParts[0] === currentParts[0] &&
        latestParts[1] > currentParts[1]
      )
        return 'minor';
      if (
        latestParts[0] === currentParts[0] &&
        latestParts[1] === currentParts[1] &&
        latestParts[2] > currentParts[2]
      )
        return 'patch';

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate package integrity using npm audit
   */
  async validatePackageSecurity(
    packageName: string,
    version?: string
  ): Promise<{
    safe: boolean;
    vulnerabilities?: Array<{ severity: string; title: string }>;
  }> {
    try {
      const args = ['audit', '--json'];
      const testPackage = version ? `${packageName}@${version}` : packageName;

      return new Promise((resolve) => {
        const npmProcess = spawn('npm', [...args, testPackage], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';

        npmProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        npmProcess.on('close', () => {
          try {
            const auditResult = JSON.parse(stdout);
            const vulnerabilities = auditResult.vulnerabilities || {};
            const vulnArray = Object.values(vulnerabilities).map(
              (vuln: NPMVulnerability) => ({
                severity: vuln.severity,
                title: vuln.title || vuln.name,
              })
            );

            resolve({
              safe: vulnArray.length === 0,
              vulnerabilities: vulnArray,
            });
          } catch {
            resolve({ safe: true });
          }
        });

        npmProcess.on('error', () => {
          this.logger.warn(`Failed to audit package ${packageName}`);
          resolve({ safe: true });
        });
      });
    } catch (_error) {
      this.logger.error('Package security validation failed:', _error);
      return { safe: true };
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.searchCache.clear();
    this.logger.info('Cleared all NPM service caches');
  }
}
