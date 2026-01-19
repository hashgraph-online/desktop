"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeChannel = void 0;
const node_crypto_1 = require("node:crypto");
const inscriber_helpers_1 = require("../inscriber-helpers");
const BRIDGE_TIMEOUT_MS = 60000;
const BRIDGE_TIMEOUT_OVERRIDES = {
    wallet_inscribe_start: 5 * 60 * 1000,
    wallet_execute_tx: 2 * 60 * 1000,
    wallet_inscribe_fetch: 2 * 60 * 1000,
};
class BridgeChannel {
    writeJsonLine;
    logBridgeEvent;
    pending = new Map();
    constructor(writeJsonLine, logBridgeEvent) {
        this.writeJsonLine = writeJsonLine;
        this.logBridgeEvent = logBridgeEvent;
    }
    send(action, payload) {
        const requestId = (0, node_crypto_1.randomUUID)();
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
        return new Promise((resolve, reject) => {
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
                    const dataRecord = (0, inscriber_helpers_1.toRecord)(value.data);
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
    handleBridgeResponse(envelope) {
        const record = (0, inscriber_helpers_1.toRecord)(envelope);
        if (!record || !record.bridgeResponse) {
            return false;
        }
        const responseRecord = (0, inscriber_helpers_1.toRecord)(record.bridgeResponse);
        if (!responseRecord || typeof responseRecord.id !== 'string') {
            return false;
        }
        const entry = this.pending.get(responseRecord.id);
        if (!entry) {
            return true;
        }
        this.pending.delete(responseRecord.id);
        const payload = {
            id: responseRecord.id,
            success: responseRecord.success === true,
            data: responseRecord.data,
            error: typeof responseRecord.error === 'string'
                ? responseRecord.error
                : undefined,
        };
        if (payload.success) {
            entry.resolve(payload);
        }
        else {
            entry.reject(new Error(payload.error ?? 'Bridge request failed'));
        }
        return true;
    }
}
exports.BridgeChannel = BridgeChannel;
