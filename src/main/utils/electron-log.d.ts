type LogArgument = string | number | boolean | Error | Record<string, unknown> | unknown[];

declare module 'electron-log' {
  export interface LogFunctions {
    error(...args: LogArgument[]): void;
    warn(...args: LogArgument[]): void;
    info(...args: LogArgument[]): void;
    verbose(...args: LogArgument[]): void;
    debug(...args: LogArgument[]): void;
    silly(...args: LogArgument[]): void;
  }

  export interface Transport {
    level: string | false;
    format?: string;
    fileName?: string;
  }

  export interface Transports {
    console: Transport;
    file: Transport;
    ipc: Transport;
    remote: Transport;
  }

  export interface Variables {
    [key: string]: unknown;
  }

  export interface ElectronLog extends LogFunctions {
    transports: Transports;
    variables: Variables;
    create(options?: { logId?: string }): ElectronLog;
  }

  const log: ElectronLog;
  export default log;
}

declare module 'electron-log/renderer' {
  import { ElectronLog } from 'electron-log';
  const log: ElectronLog;
  export default log;
}