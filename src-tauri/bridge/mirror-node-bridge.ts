#!/usr/bin/env node

import { HederaMirrorNode, Logger } from '@hashgraphonline/standards-sdk';

type MirrorNetwork = 'mainnet' | 'testnet';

interface MirrorNodeSchedulePayload {
  readonly scheduleId?: string;
  readonly network?: MirrorNetwork;
}

interface MirrorNodeTimestampPayload {
  readonly timestamp?: string;
  readonly network?: MirrorNetwork;
}

interface MirrorNodeTransactionPayload {
  readonly transactionId?: string;
  readonly network?: MirrorNetwork;
}

type BridgePayload = MirrorNodeSchedulePayload | MirrorNodeTimestampPayload | MirrorNodeTransactionPayload;

interface BridgeRequest {
  readonly id?: number;
  readonly action:
    | 'mirror_node_get_schedule_info'
    | 'mirror_node_get_scheduled_transaction_status'
    | 'mirror_node_get_transaction_by_timestamp'
    | 'mirror_node_get_transaction'
    | 'mirror_node_get_token_info';
  readonly payload?: BridgePayload;
}

interface BridgeResponse {
  readonly id: number | null;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

const logger = new Logger({ module: 'MirrorNodeBridge' });

function assertSchedulePayload(payload: BridgePayload | undefined): asserts payload is MirrorNodeSchedulePayload {
  if (!payload || typeof (payload as MirrorNodeSchedulePayload).scheduleId !== 'string') {
    throw new Error('scheduleId is required');
  }
}

function assertTimestampPayload(payload: BridgePayload | undefined): asserts payload is MirrorNodeTimestampPayload {
  if (!payload || typeof (payload as MirrorNodeTimestampPayload).timestamp !== 'string') {
    throw new Error('timestamp is required');
  }
}

function assertTransactionPayload(payload: BridgePayload | undefined): asserts payload is MirrorNodeTransactionPayload {
  if (!payload || typeof (payload as MirrorNodeTransactionPayload).transactionId !== 'string') {
    throw new Error('transactionId is required');
  }
}

function resolveNetwork(network?: MirrorNetwork): MirrorNetwork {
  if (network === 'mainnet') {
    return 'mainnet';
  }
  return 'testnet';
}

function buildMirrorNode(network?: MirrorNetwork): HederaMirrorNode {
  return new HederaMirrorNode(resolveNetwork(network), logger);
}

async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
  try {
    switch (request.action) {
      case 'mirror_node_get_schedule_info': {
        assertSchedulePayload(request.payload);
        const schedulePayload = request.payload as MirrorNodeSchedulePayload;
        const scheduleId = schedulePayload.scheduleId!;
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
        const schedulePayload = request.payload as MirrorNodeSchedulePayload;
        const scheduleId = schedulePayload.scheduleId!;
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
        const timestampPayload = request.payload as MirrorNodeTimestampPayload;
        const timestamp = timestampPayload.timestamp!;
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
      const transactionPayload = request.payload as MirrorNodeTransactionPayload;
      const transactionId = transactionPayload.transactionId!;
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
      const tokenPayload = request.payload as MirrorNodeTransactionPayload;
      const tokenId = tokenPayload.transactionId!;
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
  } catch (error) {
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
