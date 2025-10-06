#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const standards_sdk_1 = require("@hashgraphonline/standards-sdk");
const logger = new standards_sdk_1.Logger({ module: 'TransactionParserBridge' });
function validateTransactionBytes(transactionBytes) {
    if (!transactionBytes) {
        throw new Error('transactionBytes is required');
    }
    const result = standards_sdk_1.TransactionParser.validateTransactionBytes(transactionBytes);
    if (typeof result === 'object' && result !== null && 'isValid' in result) {
        const validation = result;
        return {
            isValid: Boolean(validation.isValid),
            error: typeof validation.error === 'string' ? validation.error : undefined,
            details: validation.details && typeof validation.details === 'object'
                ? validation.details
                : undefined,
        };
    }
    return {
        isValid: false,
        error: 'Invalid validation result format',
    };
}
function extractStringField(obj, field) {
    const value = obj[field];
    return typeof value === 'string' ? value : undefined;
}
function extractNumberField(obj, field) {
    const value = obj[field];
    return typeof value === 'number' ? value : undefined;
}
function isParsedTransaction(result) {
    if (typeof result !== 'object' || result === null) {
        return false;
    }
    const candidate = result;
    return typeof candidate.transactionId === 'string' && typeof candidate.transactionType === 'string';
}
async function parseTransactionBytes(transactionBytes) {
    if (!transactionBytes) {
        throw new Error('transactionBytes is required');
    }
    const result = await standards_sdk_1.TransactionParser.parseTransactionBytes(transactionBytes);
    if (result === null || result === undefined) {
        return null;
    }
    if (isParsedTransaction(result)) {
        return result;
    }
    if (typeof result === 'object' && result !== null) {
        const record = result;
        const normalized = {
            transactionId: extractStringField(record, 'transactionId') ?? 'unknown',
            transactionType: extractStringField(record, 'transactionType') ?? 'unknown',
        };
        const fee = extractNumberField(record, 'fee');
        if (typeof fee === 'number') {
            normalized.fee = fee;
        }
        const memo = extractStringField(record, 'memo');
        if (memo) {
            normalized.memo = memo;
        }
        for (const [key, value] of Object.entries(record)) {
            if (key !== 'transactionId' && key !== 'transactionType') {
                normalized[key] = value;
            }
        }
        return normalized;
    }
    throw new Error(`Unexpected parse result type: ${typeof result}`);
}
async function handleRequest(request) {
    try {
        switch (request.action) {
            case 'transaction_parser_validate': {
                const validation = validateTransactionBytes(request.payload?.transactionBytes);
                return { id: request.id ?? null, success: true, data: validation };
            }
            case 'transaction_parser_parse': {
                const parsed = await parseTransactionBytes(request.payload?.transactionBytes);
                return { id: request.id ?? null, success: true, data: parsed };
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
        logger.error('Transaction parser bridge error', error);
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
