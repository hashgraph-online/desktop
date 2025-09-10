import { Logger } from '@hashgraphonline/standards-sdk';

type EventName =
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'wallet_approve'
  | 'wallet_reject'
  | 'wallet_error'
  | 'wallet_network_mismatch';

export interface TelemetryPayload {
  [key: string]: unknown;
}

class TelemetryService {
  private logger = new Logger({ module: 'Telemetry' });

  emit(event: EventName, payload: TelemetryPayload = {}): void {
    this.logger.info(`telemetry:${event}`, { ...payload, ts: Date.now() });
  }
}

export const telemetry = new TelemetryService();

