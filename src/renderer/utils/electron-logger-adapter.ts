/**
 * @fileoverview Electron logger adapter for the standards-sdk Logger interface
 * Avoids ThreadStream issues from pino.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  module?: string;
  level?: LogLevel;
  silent?: boolean;
}

export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  trace(...args: unknown[]): void;
  setLogLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  setSilent(silent: boolean): void;
  setModule(module: string): void;
}

/**
 * Adapter to use electron-log in the renderer process with the standards-sdk Logger interface
 */
export class ElectronRendererLoggerAdapter implements ILogger {
  private logger: Console & { transports?: { console?: { level: string } } };
  private moduleContext: string;
  private level: LogLevel;
  private silent = false;

  private static QUIET_MODULES = new Set<string>(['HCS-11', 'HCS-Browser']);

  constructor(options: LoggerOptions = {}) {
    this.moduleContext = options.module || 'renderer';
    this.level = options.level || 'info';

    this.logger = console;

    if (process.env.NODE_ENV === 'test' || options.silent) this.setSilent(true);
  }

  private formatMessage(args: unknown[]): string {
    const parts: string[] = [`[${this.moduleContext}]`];

    args.forEach((arg) => {
      if (
        typeof arg === 'string' ||
        typeof arg === 'number' ||
        typeof arg === 'boolean'
      ) {
        parts.push(String(arg));
      } else if (arg instanceof Error) {
        parts.push(arg.message);
        if (arg.stack) {
          parts.push('\n' + arg.stack);
        }
      } else {
        try {
          parts.push(JSON.stringify(arg, null, 2));
        } catch {
          parts.push(String(arg));
        }
      }
    });

    return parts.join(' ');
  }

  private shouldLog(callLevel: 'debug' | 'info' | 'warn' | 'error' | 'trace'): boolean {
    if (this.silent || this.level === 'silent') return false;

    const order: Record<LogLevel | 'trace', number> = {
      trace: 20, // treat trace like debug since SDK LogLevel has no 'trace'
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      silent: 99,
    } as const;
    const call = order[callLevel];
    const threshold = order[this.level];
    if (call < threshold) return false;

    if (
      ElectronRendererLoggerAdapter.QUIET_MODULES.has(this.moduleContext) &&
      (callLevel === 'debug' || callLevel === 'info' || callLevel === 'trace') &&
      !(this.level === 'debug')
    ) {
      return false;
    }

    return true;
  }

  debug(...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    this.logger.debug(this.formatMessage(args));
  }

  info(...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    this.logger.info(this.formatMessage(args));
  }

  warn(...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    this.logger.warn(this.formatMessage(args));
  }

  error(...args: unknown[]): void {
    if (!this.shouldLog('error')) return;
    this.logger.error(this.formatMessage(args));
  }

  trace(...args: unknown[]): void {
    if (!this.shouldLog('trace')) return;
    this.logger.debug('[TRACE]', this.formatMessage(args));
  }

  setLogLevel(level: LogLevel): void {
    this.level = level;
    if (this.logger.transports && this.logger.transports.console) {
      this.logger.transports.console.level = level as string;
    }
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  setModule(module: string): void {
    this.moduleContext = module;
  }
}

/**
 * Factory function for creating ElectronRendererLoggerAdapter instances
 */
export function createElectronRendererLogger(options: LoggerOptions): ILogger {
  return new ElectronRendererLoggerAdapter(options);
}
