import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { 
  MCPServerConfig,
  MCPFilesystemConfig,
  MCPGithubConfig,
  MCPPostgresConfig,
  MCPSqliteConfig,
  MCPCustomConfig
} from "../services/mcp-service";

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

  private async validateFilesystemServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const filesystemConfig = config.config as MCPFilesystemConfig;
    const { rootPath, allowedPaths, excludePaths } = filesystemConfig;

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
            message: `Excluded path "${excludePath}" is not absolute`,
            suggestion: 'Use absolute paths for better reliability',
          });
        }
      }
    }
  }

  private async validateGitHubServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const githubConfig = config.config as MCPGithubConfig;
    const { token, owner, repo } = githubConfig;

    if (!token || !this.isValidGitHubToken(token)) {
      errors.push({
        field: 'config.token',
        message: 'Invalid or missing GitHub token',
        code: ValidationErrorCode.GITHUB_TOKEN_INVALID,
        remediation: 'Generate a personal access token at https://github.com/settings/tokens',
      });
    }

    if (!owner) {
      errors.push({
        field: 'config.owner',
        message: 'GitHub owner is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
      });
    }

    if (!repo) {
      errors.push({
        field: 'config.repo',
        message: 'GitHub repository is required',
        code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
      });
    }
  }

  private async validatePostgresServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const postgresConfig = config.config as MCPPostgresConfig;
    const { host, port, database, username, password } = postgresConfig;

    if (!host) {
      errors.push({ field: 'config.host', message: 'Host is required', code: ValidationErrorCode.REQUIRED_FIELD_MISSING });
    }
    if (!port || port <= 0 || port > 65535) {
      errors.push({ field: 'config.port', message: 'Invalid port', code: ValidationErrorCode.INVALID_PORT });
    }
    if (!database) {
      errors.push({ field: 'config.database', message: 'Database is required', code: ValidationErrorCode.REQUIRED_FIELD_MISSING });
    }
    if (!username) {
      errors.push({ field: 'config.username', message: 'Username is required', code: ValidationErrorCode.REQUIRED_FIELD_MISSING });
    }
    if (password === undefined || password === null) {
      errors.push({ field: 'config.password', message: 'Password is required', code: ValidationErrorCode.REQUIRED_FIELD_MISSING });
    }
  }

  private async validateSQLiteServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const sqliteConfig = config.config as MCPSqliteConfig;
    const { path: dbPath } = sqliteConfig;

    if (!dbPath) {
      errors.push({ field: 'config.path', message: 'Database path is required', code: ValidationErrorCode.REQUIRED_FIELD_MISSING });
      return;
    }

    try {
      const stats = await fs.promises.stat(dbPath);
      if (!stats.isFile()) {
        warnings.push({ field: 'config.path', message: 'Path does not point to a file', suggestion: 'Ensure the path points to a .sqlite or .db file' });
      }
    } catch {
      const parentDir = path.dirname(dbPath);
      try {
        await fs.promises.access(parentDir, fs.constants.W_OK);
      } catch {
        errors.push({ field: 'config.path', message: 'Parent directory does not exist or is not writable', code: ValidationErrorCode.PERMISSION_DENIED, remediation: 'Ensure the parent directory exists and is writable' });
      }
    }
  }

  private async validateCustomServer(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const customConfig = config.config as MCPCustomConfig;
    const { command, args, env, cwd } = customConfig;

    if (!command) {
      errors.push({ field: 'config.command', message: 'Command is required for custom server', code: ValidationErrorCode.REQUIRED_FIELD_MISSING, remediation: 'Specify the command to execute the MCP server' });
      return;
    }

    const commandExists = await this.checkCommandExists(command);
    if (!commandExists) {
      errors.push({ field: 'config.command', message: `Command not found: ${command}`, code: ValidationErrorCode.COMMAND_NOT_FOUND, remediation: 'Ensure the command is installed and in your PATH, or use an absolute path' });
    }

    if (args && !Array.isArray(args)) {
      errors.push({ field: 'config.args', message: 'Arguments must be an array', code: ValidationErrorCode.INVALID_FORMAT, remediation: 'Convert arguments string to an array of strings' });
    }

    if (command === 'npx') {
      const arr = Array.isArray(args) ? args : [];
      const target = arr.find((a) => typeof a === 'string' && !a.startsWith('-')) as string | undefined;
      if (!target) {
        warnings.push({ field: 'config.args', message: 'npx is used without a package target', suggestion: 'Provide a package name (e.g., @mcp/openai) or github:owner/repo' });
      } else if (!target.startsWith('github:') && !this.isValidNpmPackageName(target)) {
        errors.push({ field: 'config.args', message: `Invalid npm package name for npx: ${target}`, code: ValidationErrorCode.INVALID_FORMAT, remediation: 'Use a lowercase npm package (e.g., mcp-reddit) or a GitHub spec (github:owner/repo)' });
      }
    }
    if (command === 'uvx' || command === 'pipx') {
      const arr = Array.isArray(args) ? args : [];
      const target = arr.find((a) => typeof a === 'string' && !a.startsWith('-')) as string | undefined;
      if (!target) {
        warnings.push({ field: 'config.args', message: `${command} is used without a package target`, suggestion: 'Provide a PyPI package name (e.g., chroma-mcp)' });
      }
    }

    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (!this.isValidEnvVarName(key)) {
          errors.push({ field: 'config.env', message: `Invalid environment variable name: ${key}`, code: ValidationErrorCode.INVALID_ENV_VAR, remediation: 'Environment variable names should contain only letters, numbers, and underscores' });
        }
        if (typeof value !== 'string') {
          errors.push({ field: 'config.env', message: `Environment variable ${key} must have a string value`, code: ValidationErrorCode.INVALID_FORMAT, remediation: 'Convert all environment variable values to strings' });
        }
      }
    }

    if (cwd) {
      try {
        const stats = await fs.promises.stat(cwd);
        if (!stats.isDirectory()) {
          errors.push({ field: 'config.cwd', message: 'Working directory must be a directory', code: ValidationErrorCode.INVALID_FORMAT, remediation: 'Ensure the path points to a directory, not a file' });
        }
      } catch {
        errors.push({ field: 'config.cwd', message: `Working directory does not exist: ${cwd}`, code: ValidationErrorCode.DIRECTORY_NOT_FOUND, remediation: 'Create the directory or use an existing path' });
      }
    }
  }

  private async validateCommandExecutability(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (config.type !== 'custom') {
      const npxExists = await this.checkCommandExists('npx');
      if (!npxExists) {
        errors.push({ field: 'system', message: 'npx command not found', code: ValidationErrorCode.NPX_NOT_AVAILABLE, remediation: 'Install Node.js and npm to use built-in MCP servers' });
      }
    }
  }

  private async validateMCPVersion(
    config: MCPServerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const versionInfo = await this.getMCPVersionInfo(config);

    if (!versionInfo.compatible) {
      warnings.push({ field: 'version', message: `MCP protocol version mismatch. Expected: ${this.SUPPORTED_MCP_VERSION}, Server: ${versionInfo.serverVersion || 'unknown'}`, suggestion: 'Update the MCP server to ensure compatibility' });
    }
  }

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

  private isValidGitHubToken(token: string): boolean {
    return /^(ghp|gho|ghu|ghs)_[a-zA-Z0-9]+$/.test(token);
  }

  private isValidPostgresConnectionString(connectionString: string): boolean {
    try {
      const url = new URL(connectionString);
      return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    } catch {
      return false;
    }
  }

  private isValidEnvVarName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  private isValidNpmPackageName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    if (/[A-Z]/.test(name)) return false;
    if (name.startsWith('@')) {
      const parts = name.split('/');
      if (parts.length !== 2) return false;
      const scope = parts[0].slice(1);
      const pkg = parts[1];
      const re = /^[a-z0-9][a-z0-9._-]*$/;
      return re.test(scope) && re.test(pkg);
    }
    const re = /^[a-z0-9][a-z0-9._-]*$/;
    return re.test(name);
  }

  private async getMCPVersionInfo(
    config: MCPServerConfig
  ): Promise<MCPVersionInfo> {
    return {
      protocolVersion: this.SUPPORTED_MCP_VERSION,
      serverVersion: this.SUPPORTED_MCP_VERSION,
      compatible: true,
    };
  }

  private getCacheKey(config: MCPServerConfig): string {
    return `${config.id}-${JSON.stringify(config.config)}`;
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  getErrorMessages(errors: ValidationError[]): string[] {
    return errors.map((error) => {
      let message = error.message;
      if (error.remediation) {
        message += `. ${error.remediation}`;
      }
      return message;
    });
  }

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
