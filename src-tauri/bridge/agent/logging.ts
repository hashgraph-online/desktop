import { Logger } from '@hashgraphonline/standards-sdk';
import type { BridgeResponse } from './types';

export type WriteJsonLine = (payload: unknown) => void;

export interface LoggingUtilities {
  readonly writeJsonLine: WriteJsonLine;
  readonly logBridgeEvent: (event: string, details?: Record<string, unknown>) => void;
  readonly writeStderr: (...args: unknown[]) => void;
}

const stringify = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const installLogging = (): LoggingUtilities => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const bridgeLogger = Logger.getInstance({ module: 'AgentBridge' });

  const writeStderr = (...args: unknown[]): void => {
    const message = args.map(stringify).join(' ');
    process.stdout.write(`${message}\n`);
    process.stderr.write(`${message}\n`);
    if (
      args.length >= 2 &&
      typeof args[0] === 'string' &&
      typeof args[1] === 'object' &&
      args[1] !== null
    ) {
      process.stdout.write(`${JSON.stringify(args[1])}\n`);
      process.stderr.write(`${JSON.stringify(args[1])}\n`);
    }
  };

  const redirectStdout: typeof process.stdout.write = function (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ): boolean {
    if (typeof encoding === 'function') {
      return process.stderr.write(chunk, encoding);
    }
    return process.stderr.write(chunk, encoding, callback);
  };

  process.stdout.write = redirectStdout;

  const writeJsonLine: WriteJsonLine = (payload) => {
    originalStdoutWrite(`${JSON.stringify(payload)}\n`);
  };

  const logBridgeEvent = (
    event: string,
    details?: Record<string, unknown>
  ): void => {
    if (details) {
      bridgeLogger.info(`[bridge] ${event}`, details);
      writeStderr(`[bridge] ${event}`, details);
      return;
    }
    bridgeLogger.info(`[bridge] ${event}`);
    writeStderr(`[bridge] ${event}`);
  };

  const forward = (...args: unknown[]): void => {
    writeStderr(...args);
  };

  console.log = forward;
  console.info = forward;
  console.warn = forward;
  console.error = forward;

  return { writeJsonLine, logBridgeEvent, writeStderr };
};

export const summarizeKeys = (value: unknown): string[] | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return Object.keys(value).slice(0, 20);
};

export const writeBridgeResponse = (
  writer: WriteJsonLine,
  response: BridgeResponse
): void => {
  writer(response);
};
