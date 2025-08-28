import electronLog from 'electron-log';
import type { ILogger, LogLevel, LoggerOptions } from '@hashgraphonline/standards-sdk';

type LogArgument = string | number | boolean | Error | Record<string, unknown> | unknown[];

function serialize(args: LogArgument[], moduleContext: string): string {
  const parts: string[] = [`[${moduleContext}]`];
  for (const arg of args) {
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      parts.push(String(arg));
    } else if (arg instanceof Error) {
      parts.push(arg.message);
      if (arg.stack) parts.push('\n' + arg.stack);
    } else {
      try {
        parts.push(JSON.stringify(arg, null, 2));
      } catch {
        parts.push(String(arg));
      }
    }
  }
  return parts.join(' ');
}

export function createElectronLogger(options: LoggerOptions): ILogger {
  let moduleContext = options.module || 'app';
  let level: LogLevel = options.level || 'info';
  const log = electronLog.create({ logId: moduleContext });

  log.transports.file.fileName = 'conversational-agent.log';
  log.transports.file.level = level;
  log.transports.console.level = level;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] [{processType}] {text}';
  log.variables.module = moduleContext;

  if (process.env.NODE_ENV === 'test' || options.silent) {
    log.transports.file.level = false;
    log.transports.console.level = false;
  }

  return {
    debug: (...args: LogArgument[]) => log.debug(serialize(args, moduleContext)),
    info: (...args: LogArgument[]) => log.info(serialize(args, moduleContext)),
    warn: (...args: LogArgument[]) => log.warn(serialize(args, moduleContext)),
    error: (...args: LogArgument[]) => log.error(serialize(args, moduleContext)),
    trace: (...args: LogArgument[]) => log.debug('[TRACE] ' + serialize(args, moduleContext)),

    setLogLevel: (l: LogLevel) => {
      level = l;
      log.transports.file.level = l as LogLevel;
      log.transports.console.level = l as LogLevel;
    },
    getLevel: (): LogLevel => level,
    setSilent: (silent: boolean) => {
      if (silent) {
        log.transports.file.level = false;
        log.transports.console.level = false;
      } else {
        log.transports.file.level = level;
        log.transports.console.level = level;
      }
    },
    setModule: (module: string) => {
      moduleContext = module;
      log.variables.module = module;
    },
  };
}
