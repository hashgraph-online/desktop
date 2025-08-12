import electronLog from 'electron-log';
import type {
  ILogger,
  LogLevel,
  LoggerOptions,
} from '@hashgraphonline/standards-sdk';

/**
 * Adapter to use electron-log with the standards-sdk Logger interface
 */
export class ElectronLoggerAdapter implements ILogger {
  private logger: typeof electronLog;
  private moduleContext: string;
  private level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.moduleContext = options.module || 'app';
    this.level = options.level || 'info';

    this.logger = electronLog.create({ logId: this.moduleContext });

    this.logger.transports.file.fileName = 'conversational-agent.log';
    this.logger.transports.file.level = this.level;
    this.logger.transports.console.level = this.level;

    this.logger.transports.file.format =
      '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';
    this.logger.transports.console.format =
      '[{h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';

    this.logger.variables.module = this.moduleContext;

    if (process.env.NODE_ENV === 'test' || options.silent) {
      this.setSilent(true);
    }
  }

  private formatMessage(args: any[]): string {
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

  debug(...args: any[]): void {
    this.logger.debug(this.formatMessage(args));
  }

  info(...args: any[]): void {
    this.logger.info(this.formatMessage(args));
  }

  warn(...args: any[]): void {
    this.logger.warn(this.formatMessage(args));
  }

  error(...args: any[]): void {
    this.logger.error(this.formatMessage(args));
  }

  trace(...args: any[]): void {
    this.logger.debug('[TRACE]', this.formatMessage(args));
  }

  setLogLevel(level: LogLevel): void {
    this.level = level;
    this.logger.transports.file.level = level as any;
    this.logger.transports.console.level = level as any;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setSilent(silent: boolean): void {
    if (silent) {
      this.logger.transports.file.level = false;
      this.logger.transports.console.level = false;
    } else {
      this.logger.transports.file.level = this.level;
      this.logger.transports.console.level = this.level;
    }
  }

  setModule(module: string): void {
    this.moduleContext = module;
    this.logger.variables.module = module;
  }
}

/**
 * Factory function for creating ElectronLoggerAdapter instances
 */
export function createElectronLogger(options: LoggerOptions): ILogger {
  return new ElectronLoggerAdapter(options);
}
