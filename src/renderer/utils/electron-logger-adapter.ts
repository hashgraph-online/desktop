/**
 * @fileoverview Electron logger adapter for the standards-sdk Logger interface
 * Avoids ThreadStream issues from pino.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace';

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

  constructor(options: LoggerOptions = {}) {
    this.moduleContext = options.module || 'renderer';
    this.level = options.level || 'info';

    this.logger = console;

    if (process.env.NODE_ENV === 'test' || options.silent) {
      this.setSilent(true);
    }
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

  debug(...args: unknown[]): void {
    this.logger.debug(this.formatMessage(args));
  }

  info(...args: unknown[]): void {
    this.logger.info(this.formatMessage(args));
  }

  warn(...args: unknown[]): void {
    this.logger.warn(this.formatMessage(args));
  }

  error(...args: unknown[]): void {
    this.logger.error(this.formatMessage(args));
  }

  trace(...args: unknown[]): void {
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

  setSilent(_silent: boolean): void {
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
