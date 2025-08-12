declare module 'electron-log' {
  export interface LogFunctions {
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    verbose(...args: any[]): void;
    debug(...args: any[]): void;
    silly(...args: any[]): void;
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
    [key: string]: any;
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