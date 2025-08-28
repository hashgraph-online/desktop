declare module 'events' {
  export class EventEmitter {
    emit(event: string, ...args: any[]): boolean;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    removeListener(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    listeners(event: string): Function[];
    listenerCount(event: string): number;
  }
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: string): string;
  export const constants: {
    W_OK: number;
    X_OK: number;
  };
  export const promises: {
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, data: string, encoding?: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    unlink(path: string): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
    access(path: string, mode?: number): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  };
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
}

declare module 'crypto' {
  export function randomBytes(size: number): Buffer;
  export function scrypt(password: string, salt: Buffer, keylen: number): Promise<Buffer>;
  export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer): any;
  export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer): any;
  export function createHash(algorithm: string): any;
}

declare module 'util' {
  export function promisify(fn: Function): Function;
}

declare module 'child_process' {
  export function spawn(command: string, args?: string[], options?: any): any;
  export function exec(command: string, options?: any): any;
  export interface ChildProcess {
    stdout?: { on(event: string, listener: Function): void };
    stderr?: { on(event: string, listener: Function): void };
    on(event: string, listener: Function): void;
  }
}

declare module 'os' {
  export function platform(): string;
  export function cwd(): string;
}

declare module 'url' {
  export function fileURLToPath(url: string): string;
}

declare global {
  const Buffer: {
    from(data: string, encoding: string): Buffer;
    concat(buffers: Buffer[]): Buffer;
  };
  
  interface Buffer {
    toString(encoding?: string): string;
  }

  const process: {
    env: Record<string, string | undefined>;
    platform: string;
    cwd(): string;
    versions: { node: string };
  };

  namespace NodeJS {
    type Timeout = ReturnType<typeof setTimeout>;
    type WritableStream = any;
    type ReadableStream = any;
    type Signals = string;
    interface ErrnoException extends Error {
      code?: string;
    }
  }
}
