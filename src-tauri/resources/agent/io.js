"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBridgeIO = void 0;
const inscriber_helpers_1 = require("../inscriber-helpers");
const writeResponse = (writeJsonLine, response, requestId) => {
    writeJsonLine({ ...response, id: response.id ?? requestId ?? null });
};
const startBridgeIO = (runtime, channel, writeJsonLine, writeStderr) => {
    let buffer = '';
    const processLine = (line) => {
        if (!line.trim()) {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (error) {
            const response = {
                id: null,
                success: false,
                error: `Invalid JSON request: ${error.message ?? String(error)}`,
            };
            writeJsonLine(response);
            return;
        }
        if (channel.handleBridgeResponse(parsed)) {
            return;
        }
        const record = (0, inscriber_helpers_1.toRecord)(parsed);
        if (!record || typeof record.action !== 'string') {
            const response = {
                id: null,
                success: false,
                error: 'Invalid request payload',
            };
            writeJsonLine(response);
            return;
        }
        if (record.action !== 'initialize' &&
            record.action !== 'sendMessage' &&
            record.action !== 'status' &&
            record.action !== 'disconnect') {
            const response = {
                id: null,
                success: false,
                error: `Unknown action: ${String(record.action)}`,
            };
            writeJsonLine(response);
            return;
        }
        const request = {
            id: typeof record.id === 'number' ? record.id : undefined,
            action: record.action,
            payload: record.payload,
        };
        runtime
            .dispatch(request)
            .then((response) => {
            writeResponse(writeJsonLine, response, request.id);
        })
            .catch((error) => {
            const failure = {
                id: request.id ?? null,
                success: false,
                error: error.message ?? String(error),
            };
            writeJsonLine(failure);
        });
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
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
exports.startBridgeIO = startBridgeIO;
