#!/usr/bin/env node

import { TransactionParser, Logger } from '@hashgraphonline/standards-sdk';

type BridgeAction = 'transaction_parser_validate' | 'transaction_parser_parse';

interface BridgeRequest {
  readonly id?: number;
  readonly action: BridgeAction;
  readonly payload?: {
    readonly transactionBytes?: string;
  };
}

interface BridgeResponse {
  readonly id: number | null;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

const logger = new Logger({ module: 'TransactionParserBridge' });

function validateTransactionBytes(transactionBytes: string | undefined) {
  if (!transactionBytes) {
    throw new Error('transactionBytes is required');
  }

  const result = TransactionParser.validateTransactionBytes(transactionBytes);

  if (typeof result === 'object' && result !== null && 'isValid' in result) {
    const validation = result as {
      isValid?: unknown;
      error?: unknown;
      details?: unknown;
    };

    return {
      isValid: Boolean(validation.isValid),
      error: typeof validation.error === 'string' ? validation.error : undefined,
      details:
        validation.details && typeof validation.details === 'object'
          ? (validation.details as Record<string, unknown>)
          : undefined,
    };
  }

  return {
    isValid: false,
    error: 'Invalid validation result format',
  };
}

function extractStringField(obj: Record<string, unknown>, field: string): string | undefined {
  const value = obj[field];
  return typeof value === 'string' ? value : undefined;
}

function extractNumberField(obj: Record<string, unknown>, field: string): number | undefined {
  const value = obj[field];
  return typeof value === 'number' ? value : undefined;
}

function isParsedTransaction(result: unknown): result is Record<string, unknown> {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const candidate = result as Record<string, unknown>;
  return typeof candidate.transactionId === 'string' && typeof candidate.transactionType === 'string';
}

async function parseTransactionBytes(transactionBytes: string | undefined) {
  if (!transactionBytes) {
    throw new Error('transactionBytes is required');
  }

  const result = await TransactionParser.parseTransactionBytes(transactionBytes);

  if (result === null || result === undefined) {
    return null;
  }

  if (isParsedTransaction(result)) {
    return result;
  }

  if (typeof result === 'object' && result !== null) {
    const record = result as Record<string, unknown>;
    const normalized: Record<string, unknown> = {
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

async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
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
  } catch (error) {
    logger.error('Transaction parser bridge error', error);
    return {
      id: request.id ?? null,
      success: false,
      error: (error as Error).message ?? String(error),
    };
  }
}

function respond(response: BridgeResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

const chunks: string[] = [];
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  chunks.push(chunk);
});

process.stdin.on('end', async () => {
  if (chunks.length === 0) {
    respond({ id: null, success: false, error: 'Empty request' });
    process.exit(1);
    return;
  }

  let request: BridgeRequest;
  try {
    request = JSON.parse(chunks.join('')) as BridgeRequest;
  } catch (error) {
    respond({ id: null, success: false, error: `Invalid JSON request: ${(error as Error).message ?? String(error)}` });
    process.exit(1);
    return;
  }

  const response = await handleRequest(request);
  respond(response);
  process.exit(response.success ? 0 : 1);
});
