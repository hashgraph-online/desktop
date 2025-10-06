import type { BridgeChannel } from './bridge-channel';
import type { BridgeRequest, BridgeResponse } from './types';
import { toRecord } from '../inscriber-helpers';
import type { WriteJsonLine } from './logging';
import type { BridgeRuntime } from './runtime';

type WriteStderr = (...args: unknown[]) => void;

const writeResponse = (
  writeJsonLine: WriteJsonLine,
  response: BridgeResponse,
  requestId: number | undefined
): void => {
  writeJsonLine({ ...response, id: response.id ?? requestId ?? null });
};

export const startBridgeIO = (
  runtime: BridgeRuntime,
  channel: BridgeChannel,
  writeJsonLine: WriteJsonLine,
  writeStderr: WriteStderr
): void => {
  let buffer = '';

  const processLine = (line: string): void => {
    if (!line.trim()) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const response: BridgeResponse = {
        id: null,
        success: false,
        error: `Invalid JSON request: ${(error as Error).message ?? String(error)}`,
      };
      writeJsonLine(response);
      return;
    }

    if (channel.handleBridgeResponse(parsed)) {
      return;
    }

    const record = toRecord(parsed);
    if (!record || typeof record.action !== 'string') {
      const response: BridgeResponse = {
        id: null,
        success: false,
        error: 'Invalid request payload',
      };
      writeJsonLine(response);
      return;
    }

    if (
      record.action !== 'initialize' &&
      record.action !== 'sendMessage' &&
      record.action !== 'status' &&
      record.action !== 'disconnect'
    ) {
      const response: BridgeResponse = {
        id: null,
        success: false,
        error: `Unknown action: ${String(record.action)}`,
      };
      writeJsonLine(response);
      return;
    }

    const request: BridgeRequest = {
      id: typeof record.id === 'number' ? record.id : undefined,
      action: record.action,
      payload: record.payload as BridgeRequest['payload'],
    };

    runtime
      .dispatch(request)
      .then((response) => {
        writeResponse(writeJsonLine, response, request.id);
      })
      .catch((error) => {
        const failure: BridgeResponse = {
          id: request.id ?? null,
          success: false,
          error: (error as Error).message ?? String(error),
        };
        writeJsonLine(failure);
      });
  };

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let delimiterIndex = buffer.indexOf('\n');
    while (delimiterIndex !== -1) {
      const line = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 1);
      processLine(line);
      delimiterIndex = buffer.indexOf('\n');
    }
  });

  process.stdin.on('end', () => {
    if (buffer.trim().length > 0) {
      processLine(buffer.trim());
    }
  });

  process.stdin.on('error', (error) => {
    writeStderr('Bridge stdin error', error);
  });
};
