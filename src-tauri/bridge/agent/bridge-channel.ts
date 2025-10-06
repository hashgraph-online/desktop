import { randomUUID } from 'node:crypto';
import { toRecord } from '../inscriber-helpers';
import type { BridgeResponsePayload } from './types';
import type { WriteJsonLine } from './logging';

type LogBridgeEvent = (event: string, details?: Record<string, unknown>) => void;

const BRIDGE_TIMEOUT_MS = 60000;
const BRIDGE_TIMEOUT_OVERRIDES: Record<string, number> = {
  wallet_inscribe_start: 5 * 60 * 1000,
  wallet_execute_tx: 2 * 60 * 1000,
  wallet_inscribe_fetch: 2 * 60 * 1000,
};

export class BridgeChannel {
  private readonly pending = new Map<
    string,
    {
      resolve: (value: BridgeResponsePayload) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(
    private readonly writeJsonLine: WriteJsonLine,
    private readonly logBridgeEvent: LogBridgeEvent
  ) {}

  send(action: string, payload: Record<string, unknown>): Promise<BridgeResponsePayload> {
    const requestId = randomUUID();
    const timeoutMs = BRIDGE_TIMEOUT_OVERRIDES[action] ?? BRIDGE_TIMEOUT_MS;

    this.logBridgeEvent('bridge_request_start', {
      action,
      requestId,
      timeoutMs,
      payloadKeys: Object.keys(payload),
    });

    this.writeJsonLine({
      bridgeRequest: {
        id: requestId,
        action,
        payload,
      },
    });

    return new Promise<BridgeResponsePayload>((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        if (!this.pending.delete(requestId)) {
          return;
        }
        const duration = Date.now() - startTime;
        this.logBridgeEvent('bridge_request_timeout', {
          action,
          requestId,
          durationMs: duration,
          timeoutMs,
        });
        reject(new Error(`Bridge request timed out: ${action}`));
      }, timeoutMs);

      timeout.unref?.();

      this.pending.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          const dataRecord = toRecord(value.data);
          this.logBridgeEvent('bridge_request_success', {
            action,
            requestId,
            durationMs: duration,
            hasData: Boolean(dataRecord),
            dataKeys: dataRecord ? Object.keys(dataRecord).slice(0, 20) : undefined,
          });
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          this.logBridgeEvent('bridge_request_failure', {
            action,
            requestId,
            durationMs: duration,
            error: error.message,
          });
          reject(error);
        },
      });
    });
  }

  handleBridgeResponse(envelope: unknown): boolean {
    const record = toRecord(envelope);
    if (!record || !record.bridgeResponse) {
      return false;
    }

    const responseRecord = toRecord(record.bridgeResponse);
    if (!responseRecord || typeof responseRecord.id !== 'string') {
      return false;
    }

    const entry = this.pending.get(responseRecord.id);
    if (!entry) {
      return true;
    }

    this.pending.delete(responseRecord.id);

    const payload: BridgeResponsePayload = {
      id: responseRecord.id,
      success: responseRecord.success === true,
      data: responseRecord.data,
      error:
        typeof responseRecord.error === 'string'
          ? responseRecord.error
          : undefined,
    };

    if (payload.success) {
      entry.resolve(payload);
    } else {
      entry.reject(new Error(payload.error ?? 'Bridge request failed'));
    }

    return true;
  }
}
