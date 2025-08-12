import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { MCPServerConfig } from '../services/MCPService';

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
  remediation?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export enum ValidationErrorCode {
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
  INVALID_ENV_VAR = 'INVALID_ENV_VAR',
  INVALID_PORT = 'INVALID_PORT',
  INVALID_URL = 'INVALID_URL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MCP_VERSION_MISMATCH = 'MCP_VERSION_MISMATCH',
  NPX_NOT_AVAILABLE = 'NPX_NOT_AVAILABLE',
  GITHUB_TOKEN_INVALID = 'GITHUB_TOKEN_INVALID',
  DATABASE_CONNECTION_STRING_INVALID = 'DATABASE_CONNECTION_STRING_INVALID',
}

interface MCPVersionInfo {
  protocolVersion: string;
  serverVersion?: string;
  compatible: boolean;
}

/**
 * Comprehensive validator for MCP server configurations
 */
export class MCPServerValidator {
  private logger: Logger;
  private validationCache: Map<
    string,
    { result: ValidationResult; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly SUPPORTED_MCP_VERSION = '1.0.0';

  constructor() {
    this.logger = new Logger({ module: 'MCPServerValidator' });
  }

  /**
   * Validate MCP server configuration
   */
  async validate(config: MCPServerConfig): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(config);
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached validation result');
      return cached.result;
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateBasicFields(config, errors, warnings);

    switch (config.type) {
      case 'filesystem':
        await this.validateFilesystemServer(config, errors, warnings);
        break;
      case 'github':
        await this.validateGitHubServer(config, errors, warnings);
        break;
      case 'postgres':
        await this.validatePostgresServer(config, errors, warnings);
        break;
      case 'sqlite':
        await this.validateSQLiteServer(config, errors, warnings);
        break;
      case 'custom':
        await this.validateCustomServer(config, errors, warnings);
        break;
    }

    await this.validateCommandExecutability(config, errors, warnings);

    await this.validateMCPVersion(config, errors, warnings);

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
    };

    this.validationCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  /**
   * Validate basic required fields
   */
  private validateBasicFields(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!config.name || config.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Server name is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Please provide a descriptive name for the MCP server',
      });
    }

    if (!config.type) {
      errors.push({
        field: 'type',
        message: 'Server type is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation:
          'Select one of the supported server types: filesystem, github, postgres, sqlite, or custom',
      });
    }

    if (!config.id) {
      errors.push({
        field: 'id',
        message: 'Server ID is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'A unique ID will be generated automatically when saving',
      });
    }

    if (config.name && !/^[\w\s\-\.]+$/.test(config.name)) {
      warnings.push({
        field: 'name',
        message: 'Server name contains special characters',
        suggestion:
          'Consider using only letters, numbers, spaces, hyphens, and dots for better compatibility',
      });
    }
  }

  /**
   * Validate filesystem server configuration
   */
  private async validateFilesystemServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const { rootPath, allowedPaths, excludePaths } = config.config;

    if (!rootPath) {
      errors.push({
        field: 'config.rootPath',
        message: 'Root path is required for filesystem server',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation:
          'Specify the root directory that the MCP server should have access to',
      });
      return;
    }

    try {
      const stats = await fs.promises.stat(rootPath);
      if (!stats.isDirectory()) {
        errors.push({
          field: 'config.rootPath',
          message: 'Root path must be a directory',
          code: ValidationErrorCode.INVALID_FORMAT,
          remediation: 'Ensure the path points to a directory, not a file',
        });
      }
    } catch (error) {
      errors.push({
        field: 'config.rootPath',
        message: `Root path does not exist or is not accessible: ${rootPath}`,
        code: ValidationErrorCode.DIRECTORY_NOT_FOUND,
        remediation: 'Create the directory or check file system permissions',
      });
    }

    if (allowedPaths && Array.isArray(allowedPaths)) {
      for (const allowedPath of allowedPaths) {
        if (!path.isAbsolute(allowedPath)) {
          warnings.push({
            field: 'config.allowedPaths',
            message: `Allowed path "${allowedPath}" is not absolute`,
            suggestion: 'Use absolute paths for better reliability',
          });
        }
      }
    }

    if (excludePaths && Array.isArray(excludePaths)) {
      for (const excludePath of excludePaths) {
        if (!path.isAbsolute(excludePath)) {
          warnings.push({
            field: 'config.excludePaths',
            message: `Exclude path "${excludePath}" is not absolute`,
            suggestion: 'Use absolute paths for better reliability',
          });
        }
      }
    }
  }

  /**
   * Validate GitHub server configuration
   */
  private async validateGitHubServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const { token, owner, repo } = config.config;

    if (!token) {
      errors.push({
        field: 'config.token',
        message: 'GitHub personal access token is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation:
          'Generate a personal access token at https://github.com/settings/tokens',
      });
    } else if (!this.isValidGitHubToken(token)) {
      errors.push({
        field: 'config.token',
        message: 'Invalid GitHub token format',
        code: ValidationErrorCode.GITHUB_TOKEN_INVALID,
        remediation:
          'GitHub tokens should start with "ghp_", "gho_", "ghu_", or "ghs_"',
      });
    }

    if (owner && !/^[\w\-\.]+$/.test(owner)) {
      errors.push({
        field: 'config.owner',
        message: 'Invalid GitHub username/organization format',
        code: ValidationErrorCode.INVALID_FORMAT,
        remediation: 'Use only letters, numbers, hyphens, and dots',
      });
    }

    if (repo && !/^[\w\-\.]+$/.test(repo)) {
      errors.push({
        field: 'config.repo',
        message: 'Invalid repository name format',
        code: ValidationErrorCode.INVALID_FORMAT,
        remediation: 'Use only letters, numbers, hyphens, and dots',
      });
    }
  }

  /**
   * Validate PostgreSQL server configuration
   */
  private async validatePostgresServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const { host, port, database, username, password } = config.config;

    if (!host) {
      errors.push({
        field: 'config.host',
        message: 'Database host is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Specify the PostgreSQL server hostname or IP address',
      });
    }

    if (!port || typeof port !== 'number') {
      errors.push({
        field: 'config.port',
        message: 'Valid port number is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Default PostgreSQL port is 5432',
      });
    } else if (port < 1 || port > 65535) {
      errors.push({
        field: 'config.port',
        message: 'Port must be between 1 and 65535',
        code: ValidationErrorCode.INVALID_PORT,
        remediation: 'Use a valid port number (typically 5432 for PostgreSQL)',
      });
    }

    if (!database) {
      errors.push({
        field: 'config.database',
        message: 'Database name is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Specify the PostgreSQL database to connect to',
      });
    }

    if (!username) {
      errors.push({
        field: 'config.username',
        message: 'Database username is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Provide the PostgreSQL username for authentication',
      });
    }

    if (!password) {
      warnings.push({
        field: 'config.password',
        message: 'No password provided',
        suggestion: 'Consider using password authentication for security',
      });
    }

    if (host && port && database && username) {
      const connectionString = `postgresql://${username}:${
        password || ''
      }@${host}:${port}/${database}`;
      if (!this.isValidPostgresConnectionString(connectionString)) {
        errors.push({
          field: 'config',
          message: 'Invalid PostgreSQL connection configuration',
          code: ValidationErrorCode.DATABASE_CONNECTION_STRING_INVALID,
          remediation: 'Check all connection parameters are properly formatted',
        });
      }
    }
  }

  /**
   * Validate SQLite server configuration
   */
  private async validateSQLiteServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const { path: dbPath } = config.config;

    if (!dbPath) {
      errors.push({
        field: 'config.path',
        message: 'Database file path is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Specify the path to the SQLite database file',
      });
      return;
    }

    try {
      const stats = await fs.promises.stat(dbPath);
      if (stats.isDirectory()) {
        errors.push({
          field: 'config.path',
          message: 'Path must be a file, not a directory',
          code: ValidationErrorCode.INVALID_FORMAT,
          remediation: 'Specify the full path to the .db or .sqlite file',
        });
      }
    } catch (error) {
      warnings.push({
        field: 'config.path',
        message: 'Database file does not exist',
        suggestion: 'A new database file will be created at this path',
      });

      const parentDir = path.dirname(dbPath);
      try {
        await fs.promises.access(parentDir, fs.constants.W_OK);
      } catch {
        errors.push({
          field: 'config.path',
          message: 'Parent directory does not exist or is not writable',
          code: ValidationErrorCode.PERMISSION_DENIED,
          remediation: 'Ensure the parent directory exists and is writable',
        });
      }
    }
  }

  /**
   * Validate custom server configuration
   */
  private async validateCustomServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const { command, args, env, cwd } = config.config;

    if (!command) {
      errors.push({
        field: 'config.command',
        message: 'Command is required for custom server',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
        remediation: 'Specify the command to execute the MCP server',
      });
      return;
    }

    const commandExists = await this.checkCommandExists(command);
    if (!commandExists) {
      errors.push({
        field: 'config.command',
        message: `Command not found: ${command}`,
        code: ValidationErrorCode.COMMAND_NOT_FOUND,
        remediation:
          'Ensure the command is installed and in your PATH, or use an absolute path',
      });
    }

    if (args && !Array.isArray(args)) {
      errors.push({
        field: 'config.args',
        message: 'Arguments must be an array',
        code: ValidationErrorCode.INVALID_FORMAT,
        remediation: 'Convert arguments string to an array of strings',
      });
    }

    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (!this.isValidEnvVarName(key)) {
          errors.push({
            field: 'config.env',
            message: `Invalid environment variable name: ${key}`,
            code: ValidationErrorCode.INVALID_ENV_VAR,
            remediation:
              'Environment variable names should contain only letters, numbers, and underscores',
          });
        }
        if (typeof value !== 'string') {
          errors.push({
            field: 'config.env',
            message: `Environment variable ${key} must have a string value`,
            code: ValidationErrorCode.INVALID_FORMAT,
            remediation: 'Convert all environment variable values to strings',
          });
        }
      }
    }

    if (cwd) {
      try {
        const stats = await fs.promises.stat(cwd);
        if (!stats.isDirectory()) {
          errors.push({
            field: 'config.cwd',
            message: 'Working directory must be a directory',
            code: ValidationErrorCode.INVALID_FORMAT,
            remediation: 'Ensure the path points to a directory, not a file',
          });
        }
      } catch {
        errors.push({
          field: 'config.cwd',
          message: `Working directory does not exist: ${cwd}`,
          code: ValidationErrorCode.DIRECTORY_NOT_FOUND,
          remediation: 'Create the directory or use an existing path',
        });
      }
    }
  }

  /**
   * Validate command executability
   */
  private async validateCommandExecutability(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (config.type !== 'custom') {
      const npxExists = await this.checkCommandExists('npx');
      if (!npxExists) {
        errors.push({
          field: 'system',
          message: 'npx command not found',
          code: ValidationErrorCode.NPX_NOT_AVAILABLE,
          remediation: 'Install Node.js and npm to use built-in MCP servers',
        });
      }
    }
  }

  /**
   * Validate MCP protocol version compatibility
   */
  private async validateMCPVersion(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const versionInfo = await this.getMCPVersionInfo(config);

    if (!versionInfo.compatible) {
      warnings.push({
        field: 'version',
        message: `MCP protocol version mismatch. Expected: ${
          this.SUPPORTED_MCP_VERSION
        }, Server: ${versionInfo.serverVersion || 'unknown'}`,
        suggestion: 'Update the MCP server to ensure compatibility',
      });
    }
  }

  /**
   * Check if a command exists in the system
   */
  private async checkCommandExists(command: string): Promise<boolean> {
    try {
      if (path.isAbsolute(command)) {
        await fs.promises.access(command, fs.constants.X_OK);
        return true;
      }

      const isWindows = process.platform === 'win32';
      const checkCommand = isWindows ? `where ${command}` : `which ${command}`;

      await execAsync(checkCommand);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate GitHub token format
   */
  private isValidGitHubToken(token: string): boolean {
    return /^(ghp|gho|ghu|ghs)_[a-zA-Z0-9]+$/.test(token);
  }

  /**
   * Validate PostgreSQL connection string
   */
  private isValidPostgresConnectionString(connectionString: string): boolean {
    try {
      const url = new URL(connectionString);
      return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    } catch {
      return false;
    }
  }

  /**
   * Validate environment variable name
   */
  private isValidEnvVarName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Get MCP version information (placeholder)
   */
  private async getMCPVersionInfo(
    config: MCPServerConfig
  ): Promise<MCPVersionInfo> {
    return {
      protocolVersion: this.SUPPORTED_MCP_VERSION,
      serverVersion: this.SUPPORTED_MCP_VERSION,
      compatible: true,
    };
  }

  /**
   * Generate cache key for validation results
   */
  private getCacheKey(config: MCPServerConfig): string {
    return `${config.id}-${JSON.stringify(config.config)}`;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get validation errors as user-friendly messages
   */
  getErrorMessages(errors: ValidationError[]): string[] {
    return errors.map((error) => {
      let message = error.message;
      if (error.remediation) {
        message += `. ${error.remediation}`;
      }
      return message;
    });
  }

  /**
   * Get validation warnings as user-friendly messages
   */
  getWarningMessages(warnings: ValidationWarning[]): string[] {
    return warnings.map((warning) => {
      let message = warning.message;
      if (warning.suggestion) {
        message += `. ${warning.suggestion}`;
      }
      return message;
    });
  }
}
