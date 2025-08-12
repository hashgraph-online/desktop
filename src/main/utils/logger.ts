import { ILogger, LoggerOptions, LogLevel } from '@hashgraphonline/standards-sdk';

/**
 * Simple logger implementation for Electron main process
 * Replaces pino-based Logger which requires worker threads
 */
export class Logger implements ILogger {
  private moduleContext: string;
  private level: LogLevel;
  private silent: boolean;

  constructor(options: LoggerOptions = {}) {
    this.moduleContext = options.module || 'app';
    this.level = options.level || 'info';
    this.silent = options.silent || false;
  }

  /**
   * Log debug level message
   */
  debug(...args: unknown[]): void {
    if (!this.silent && this.shouldLog('debug')) {
      console.log(`[${this.moduleContext}] DEBUG:`, ...args);
    }
  }

  /**
   * Log info level message
   */
  info(...args: unknown[]): void {
    if (!this.silent && this.shouldLog('info')) {
      console.log(`[${this.moduleContext}] INFO:`, ...args);
    }
  }

  /**
   * Log warn level message
   */
  warn(...args: unknown[]): void {
    if (!this.silent && this.shouldLog('warn')) {
      console.warn(`[${this.moduleContext}] WARN:`, ...args);
    }
  }

  /**
   * Log error level message
   */
  error(...args: unknown[]): void {
    if (!this.silent && this.shouldLog('error')) {
      console.error(`[${this.moduleContext}] ERROR:`, ...args);
    }
  }

  /**
   * Log trace level message
   */
  trace(...args: unknown[]): void {
    if (!this.silent && this.shouldLog('debug')) {
      console.log(`[${this.moduleContext}] TRACE:`, ...args);
    }
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set silent mode
   */
  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  /**
   * Set module context
   */
  setModule(module: string): void {
    this.moduleContext = module;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}
