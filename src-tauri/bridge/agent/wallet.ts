import { setWalletBridgeProvider } from '@hashgraphonline/conversational-agent';
import { InscriberBuilder } from '@hashgraphonline/standards-agent-kit';
import { getStringField, toRecord } from '../inscriber-helpers';
import {
  StartInscriptionResult,
  WalletBridgeProvider,
  WalletNetwork,
} from './types';
import { toDashedTransactionId } from './inscription';
import type { BridgeChannel } from './bridge-channel';

type LogBridgeEvent = (event: string, details?: Record<string, unknown>) => void;
type WriteStderr = (...args: unknown[]) => void;

interface WalletBridgeConfig {
  readonly channel: BridgeChannel;
  readonly logBridgeEvent: LogBridgeEvent;
  readonly writeStderr: WriteStderr;
}

const buildWalletProvider = (
  channel: BridgeChannel,
  logBridgeEvent: LogBridgeEvent,
  writeStderr: WriteStderr
): WalletBridgeProvider & {
  fetchInscription?: (
    transactionId: string,
    network: WalletNetwork
  ) => Promise<Record<string, unknown> | null>;
} => ({
  status: async () => {
    try {
      const response = await channel.send('wallet_status', {});
      const record = toRecord(response.data) ?? {};
      const connected = record.connected === true;
      const accountId =
        typeof record.accountId === 'string' && record.accountId.trim().length > 0
          ? record.accountId
          : undefined;
      const network =
        record.network === 'mainnet' || record.network === 'testnet'
          ? record.network
          : undefined;
      return { connected, accountId, network };
    } catch (error) {
      writeStderr('wallet status bridge failed', error);
      return { connected: false, accountId: undefined, network: undefined };
    }
  },
  executeBytes: async (base64: string, network: string) => {
    const response = await channel.send('wallet_execute_tx', {
      base64,
      network,
    });
    const record = toRecord(response.data);
    if (!record || typeof record.transactionId !== 'string') {
      throw new Error('Wallet execution missing transactionId');
    }
    return { transactionId: toDashedTransactionId(record.transactionId) };
  },
  startInscription: async (
    request: Record<string, unknown>,
    network: WalletNetwork
  ): Promise<StartInscriptionResult> => {
    const requestRecord = toRecord(request) ?? {};
    logBridgeEvent('wallet_inscribe_start_request', {
      network,
      requestKeys: Object.keys(requestRecord),
    });

    const response = await channel.send('wallet_inscribe_start', {
      request: requestRecord,
      network,
    });
    const record = toRecord(response.data);
    if (!record) {
      throw new Error('Wallet inscription missing payload');
    }

    logBridgeEvent('wallet_inscribe_start_response_payload', record);

    const transactionBytes =
      typeof record.transactionBytes === 'string'
        ? record.transactionBytes.trim()
        : '';
    if (!transactionBytes) {
      throw new Error('Failed to start inscription (no transaction bytes)');
    }

    const pendingPayload: Record<string, unknown> = {
      transactionBytes,
      quote: record.quote === true,
    };

    const dashedTxId =
      typeof record.tx_id === 'string'
        ? toDashedTransactionId(record.tx_id)
        : undefined;

    if (dashedTxId) {
      pendingPayload.tx_id = dashedTxId;
    }

    return pendingPayload as unknown as StartInscriptionResult;
  },
  fetchInscription: async (
    transactionId: string,
    network: WalletNetwork
  ): Promise<Record<string, unknown> | null> => {
    logBridgeEvent('wallet_inscribe_fetch_request', {
      transactionId,
      network,
    });

    const response = await channel.send('wallet_inscribe_fetch', {
      transaction_id: transactionId,
      network,
    });

    const record = toRecord(response.data);
    logBridgeEvent('wallet_inscribe_fetch_response', {
      hasJsonTopicId: Boolean(
        getStringField(record, 'jsonTopicId') ||
          getStringField(record, 'json_topic_id')
      ),
      ...record,
    });

    return record;
  },
});

export const configureWalletBridge = ({
  channel,
  logBridgeEvent,
  writeStderr,
}: WalletBridgeConfig): void => {
  try {
    const provider = buildWalletProvider(channel, logBridgeEvent, writeStderr);
    setWalletBridgeProvider(provider);

    InscriberBuilder.setWalletInfoResolver(async () => {
      const response = await channel.send('wallet_status', {});
      const record = toRecord(response.data);
      if (!record || record.connected !== true) {
        return null;
      }

      const accountId = record.accountId;
      const networkValue = record.network;
      if (
        typeof accountId !== 'string' ||
        (networkValue !== 'mainnet' && networkValue !== 'testnet')
      ) {
        return null;
      }

      return { accountId, network: networkValue };
    });

    InscriberBuilder.setWalletExecutor(async (base64: string, network: string) => {
      const response = await channel.send('wallet_execute_tx', { base64, network });
      const record = toRecord(response.data);
      if (!record || typeof record.transactionId !== 'string') {
        throw new Error('Wallet execution missing transactionId');
      }
      return { transactionId: toDashedTransactionId(record.transactionId) };
    });
  } catch (error) {
    writeStderr('Failed to configure wallet bridge provider', error);
  }
};
