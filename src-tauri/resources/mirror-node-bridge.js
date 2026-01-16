"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const standards_sdk_1 = require("@hashgraphonline/standards-sdk");
const logger = new standards_sdk_1.Logger({ module: 'MirrorNodeBridge' });
function assertSchedulePayload(payload) {
    if (!payload || typeof payload.scheduleId !== 'string') {
        throw new Error('scheduleId is required');
    }
}
function assertTimestampPayload(payload) {
    if (!payload || typeof payload.timestamp !== 'string') {
        throw new Error('timestamp is required');
    }
}
function assertTransactionPayload(payload) {
    if (!payload || typeof payload.transactionId !== 'string') {
        throw new Error('transactionId is required');
    }
}
function resolveNetwork(network) {
    if (network === 'mainnet') {
        return 'mainnet';
    }
    return 'testnet';
}
function buildMirrorNode(network) {
    return new standards_sdk_1.HederaMirrorNode(resolveNetwork(network), logger);
}
async function handleRequest(request) {
    try {
        switch (request.action) {
            case 'mirror_node_get_schedule_info': {
                assertSchedulePayload(request.payload);
                const schedulePayload = request.payload;
                const scheduleId = schedulePayload.scheduleId;
                const service = buildMirrorNode(schedulePayload.network);
                const info = await service.getScheduleInfo(scheduleId);
                return {
                    id: request.id ?? null,
                    success: true,
                    data: info ?? null,
                };
            }
            case 'mirror_node_get_scheduled_transaction_status': {
                assertSchedulePayload(request.payload);
                const schedulePayload = request.payload;
                const scheduleId = schedulePayload.scheduleId;
                const service = buildMirrorNode(schedulePayload.network);
                const status = await service.getScheduledTransactionStatus(scheduleId);
                return {
                    id: request.id ?? null,
                    success: true,
                    data: status,
                };
            }
            case 'mirror_node_get_transaction_by_timestamp': {
                assertTimestampPayload(request.payload);
                const timestampPayload = request.payload;
                const timestamp = timestampPayload.timestamp;
                const service = buildMirrorNode(timestampPayload.network);
                const transactions = await service.getTransactionByTimestamp(timestamp);
                return {
                    id: request.id ?? null,
                    success: true,
                    data: { transactions: transactions ?? [] },
                };
            }
            case 'mirror_node_get_transaction': {
                assertTransactionPayload(request.payload);
                const transactionPayload = request.payload;
                const transactionId = transactionPayload.transactionId;
                const service = buildMirrorNode(transactionPayload.network);
                const transaction = await service.getTransaction(transactionId);
                return {
                    id: request.id ?? null,
                    success: true,
                    data: { transaction: transaction ?? null },
                };
            }
            case 'mirror_node_get_token_info': {
                assertTransactionPayload(request.payload);
                const tokenPayload = request.payload;
                const tokenId = tokenPayload.transactionId;
                const service = buildMirrorNode(tokenPayload.network);
                const tokenInfo = await service.getTokenInfo(tokenId);
                return {
                    id: request.id ?? null,
                    success: true,
                    data: tokenInfo ?? null,
                };
            }
            default: {
                return {
                    id: request.id ?? null,
                    success: false,
                    error: `Unknown action: ${request.action}`,
                };
            }
        }
    }
    catch (error) {
        return {
            id: request.id ?? null,
            success: false,
            error: error.message ?? String(error),
        };
    }
}
function respond(response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
}
const chunks = [];
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    chunks.push(chunk);
});
process.stdin.on('end', async () => {
    if (chunks.length === 0) {
        respond({ id: null, success: false, error: 'Empty request' });
        process.exit(1);
        return;
    }
    let request;
    try {
        request = JSON.parse(chunks.join(''));
    }
    catch (error) {
        respond({ id: null, success: false, error: `Invalid JSON request: ${error.message ?? String(error)}` });
        process.exit(1);
        return;
    }
    const response = await handleRequest(request);
    respond(response);
    process.exit(response.success ? 0 : 1);
});
