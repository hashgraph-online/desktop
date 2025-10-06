import {
  deriveInscriptionContext,
  getStringField,
  toRecord,
} from '../inscriber-helpers';
import { getWalletBridgeProvider } from '@hashgraphonline/conversational-agent';
import type {
  AgentProcessResult,
  WalletBridgeProvider,
  WalletNetwork,
} from './types';

type LogBridgeEvent = (event: string, details?: Record<string, unknown>) => void;

const pickField = (
  record: Record<string, unknown> | null | undefined,
  keys: ReadonlyArray<string>
): string | undefined => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

export const toDashedTransactionId = (transactionId: string): string => {
  if (transactionId.includes('-')) {
    return transactionId;
  }

  const [account, rest] = transactionId.split('@');
  if (!account || !rest) {
    return transactionId;
  }

  const [seconds, nanos] = rest.split('.');
  if (!seconds) {
    return transactionId;
  }

  const normalizedNanos = (nanos ?? '0').padEnd(9, '0').slice(0, 9);
  return `${account}-${seconds}-${normalizedNanos}`;
};

export class InscriptionService {
  constructor(private readonly logBridgeEvent: LogBridgeEvent) {}

  async ensureJsonTopicMetadata(result: AgentProcessResult): Promise<AgentProcessResult> {
    const record = toRecord(result);
    if (!record) {
      return result;
    }

    const metadataRecord = toRecord(record.metadata);
    const inscriptionRecord =
      toRecord(record.inscription) ?? toRecord(metadataRecord?.inscription);
    const resultRecord =
      toRecord(record.result) ?? toRecord(metadataRecord?.result);
    const hashLinkBlockRecord = toRecord(record.hashLinkBlock);

    const { metadataTopicId } = deriveInscriptionContext(record);
    const hasJsonTopic = Boolean(
      metadataTopicId ||
        getStringField(inscriptionRecord, 'jsonTopicId') ||
        getStringField(resultRecord, 'jsonTopicId') ||
        getStringField(metadataRecord, 'jsonTopicId') ||
        getStringField(record, 'jsonTopicId')
    );

    if (hasJsonTopic) {
      return result;
    }

    const transactionId =
      pickField(inscriptionRecord, ['transactionId', 'tx_id']) ||
      pickField(resultRecord, ['transactionId', 'tx_id']) ||
      pickField(hashLinkBlockRecord, ['transactionId', 'tx_id']);

    this.logBridgeEvent('fetching inscription', {
      inscriptionRecord,
      resultRecord,
      hashLinkBlockRecord,
    });

    if (!transactionId) {
      this.logBridgeEvent('inscription_enrich_skip', {
        reason: 'missing_transaction_id',
      });
      return result;
    }

    const provider = this.resolveWalletProvider();
    if (!provider || typeof provider.fetchInscription !== 'function') {
      this.logBridgeEvent('inscription_enrich_skip', {
        reason: 'wallet_provider_unavailable',
      });
      return result;
    }

    const network = this.determineNetwork(record);

    let retrieved: Record<string, unknown> | null = null;
    try {
      retrieved = await provider.fetchInscription(transactionId, network);
      this.logBridgeEvent('inscription_enrich_fetch_result', {
        transactionId,
        network,
        ...retrieved,
        hasJsonTopicId: Boolean(
          getStringField(retrieved, 'jsonTopicId') ||
            getStringField(retrieved, 'json_topic_id')
        ),
        keys: retrieved ? Object.keys(retrieved).slice(0, 12) : [],
      });
    } catch (error) {
      this.logBridgeEvent('inscription_enrich_error', {
        transactionId,
        network,
        error: (error as Error).message,
      });
      return result;
    }

    if (!retrieved) {
      this.logBridgeEvent('inscription_enrich_skip', {
        reason: 'fetch_returned_null',
        transactionId,
        network,
      });
      return result;
    }

    const jsonTopicId = pickField(toRecord(retrieved), ['jsonTopicId', 'json_topic_id']);

    if (!jsonTopicId) {
      this.logBridgeEvent('inscription_enrich_skip', {
        reason: 'no_json_topic_id_in_fetch',
        transactionId,
        network,
        availableKeys: Object.keys(retrieved)
          .slice(0, 12)
          .filter((key) => typeof key === 'string'),
      });
      return result;
    }

    const resolvedImageTopic =
      pickField(toRecord(retrieved), ['topicId', 'topic_id']) ||
      getStringField(hashLinkBlockRecord, 'imageTopicId');

    const updatedRecord: Record<string, unknown> = {
      ...record,
      jsonTopicId,
    };

    updatedRecord['inscription'] = {
      ...(inscriptionRecord ?? {}),
      ...retrieved,
      jsonTopicId,
      imageTopicId: resolvedImageTopic,
    };

    if (resultRecord) {
      updatedRecord['result'] = {
        ...resultRecord,
        jsonTopicId,
        topicId: pickField(resultRecord, ['topicId', 'topic_id']) ?? jsonTopicId,
      };
    }

    if (metadataRecord) {
      updatedRecord['metadata'] = {
        ...metadataRecord,
        jsonTopicId,
      };
    }

    if (hashLinkBlockRecord) {
      const attributes = toRecord(hashLinkBlockRecord.attributes) ?? {};
      updatedRecord['hashLinkBlock'] = {
        ...hashLinkBlockRecord,
        attributes: {
          ...attributes,
          jsonTopicId,
          imageTopicId: resolvedImageTopic,
        },
      };
    }

    this.logBridgeEvent('inscription_enrich_success', {
      transactionId,
      network,
      jsonTopicId,
    });

    return updatedRecord as AgentProcessResult;
  }

  rewriteHashLinkTopic(result: AgentProcessResult): AgentProcessResult {
    const record = toRecord(result);
    if (!record) {
      return result;
    }

    const inscriptionRecord =
      toRecord(record.inscription) ??
      toRecord(toRecord(record.metadata)?.inscription);
    const resultRecord =
      toRecord(record.result) ?? toRecord(toRecord(record.metadata)?.result);
    const metadataRecord = toRecord(record.metadata);
    const hashLinkBlockRecord = toRecord(record.hashLinkBlock);
    const { metadataTopicId } = deriveInscriptionContext(record);

    const deriveJsonTopicIdFromHashLink = (): string | undefined => {
      if (!hashLinkBlockRecord) {
        return undefined;
      }

      const attributesRecord = toRecord(hashLinkBlockRecord.attributes);
      const attributeJson = getStringField(attributesRecord, 'jsonTopicId');
      if (attributeJson) {
        return attributeJson;
      }

      const hrlCandidate =
        getStringField(attributesRecord, 'hrl') ||
        getStringField(hashLinkBlockRecord, 'hrl') ||
        getStringField(hashLinkBlockRecord, 'hashLink');

      if (hrlCandidate) {
        const match = /^hcs:\/\/\d+\/(.+)$/.exec(hrlCandidate.trim());
        if (match && match[1]) {
          return match[1];
        }
      }

      return undefined;
    };

    let jsonTopicId =
      metadataTopicId ||
      pickField(inscriptionRecord, ['jsonTopicId']) ||
      pickField(resultRecord, ['jsonTopicId']) ||
      pickField(metadataRecord, ['jsonTopicId']);

    if (!jsonTopicId) {
      jsonTopicId = deriveJsonTopicIdFromHashLink();
    }

    if (!jsonTopicId) {
      this.logBridgeEvent('rewrite_hash_link_skip', {
        hasMetadataTopicId: Boolean(metadataTopicId),
        inscriptionKeys: inscriptionRecord ? Object.keys(inscriptionRecord) : [],
        resultKeys: resultRecord ? Object.keys(resultRecord) : [],
        resultType: typeof record.result,
        inscriptionType: typeof record.inscription,
        recordKeys: Object.keys(record),
        inscriptionSample: inscriptionRecord,
      });
      return result;
    }

    const imageTopicId = pickField(inscriptionRecord, ['topicId', 'topic_id']);
    const transactionId =
      pickField(inscriptionRecord, ['transactionId', 'tx_id']) ||
      pickField(resultRecord, ['transactionId', 'tx_id']);

    this.logBridgeEvent('rewrite_hash_link_input', {
      metadataTopicId,
      inscriptionTopicId: pickField(inscriptionRecord, ['topicId', 'topic_id']),
      inscriptionJsonTopicId: pickField(inscriptionRecord, ['jsonTopicId']),
      resultTopicId: pickField(resultRecord, ['topicId', 'topic_id']),
      resultJsonTopicId: pickField(resultRecord, ['jsonTopicId']),
      chosenJsonTopicId: jsonTopicId,
      imageTopicId,
    });

    const updated: Record<string, unknown> = { ...record, jsonTopicId };
    if (inscriptionRecord) {
      updated['inscription'] = {
        ...inscriptionRecord,
        topicId: jsonTopicId,
        topic_id: jsonTopicId,
        jsonTopicId,
        imageTopicId,
        transactionId,
        hrl: `hcs://1/${jsonTopicId}`,
      };
    }

    if (resultRecord) {
      updated['result'] = {
        ...resultRecord,
        topicId: jsonTopicId,
        topic_id: jsonTopicId,
        jsonTopicId,
      };
    }

    if (metadataRecord) {
      updated['metadata'] = {
        ...metadataRecord,
        jsonTopicId,
        transactionId,
      };
    }

    if (hashLinkBlockRecord) {
      const attributes = toRecord(hashLinkBlockRecord.attributes) ?? {};
      const previousTopic =
        getStringField(attributes, 'topicId') ||
        getStringField(attributes, 'topic_id');
      updated['hashLinkBlock'] = {
        ...hashLinkBlockRecord,
        attributes: {
          ...attributes,
          topicId: jsonTopicId,
          topic_id: jsonTopicId,
          jsonTopicId,
          imageTopicId:
            previousTopic && previousTopic !== jsonTopicId
              ? previousTopic
              : attributes.imageTopicId,
          transactionId,
          hrl: `hcs://1/${jsonTopicId}`,
        },
      };
    }

    const previousTopicId =
      getStringField(record, 'jsonTopicId') ||
      pickField(resultRecord, ['topicId', 'topic_id']) ||
      imageTopicId;

    if (previousTopicId !== jsonTopicId) {
      this.logBridgeEvent('rewrite_hash_link', {
        previousTopicId,
        jsonTopicId,
        imageTopicId,
      });
    }

    const replaceSummary = (value: unknown): unknown => {
      if (typeof value !== 'string') {
        return value;
      }
      return value
        .replace(/Topic ID: [^\n]+/g, `Topic ID: ${jsonTopicId}`)
        .replace(/HRL: [^\n]+/g, `HRL: hcs://1/${jsonTopicId}`);
    };

    Reflect.set(updated, 'message', replaceSummary(updated['message']));
    Reflect.set(updated, 'output', replaceSummary(updated['output']));

    return updated as AgentProcessResult;
  }

  private resolveWalletProvider():
    | (WalletBridgeProvider & {
        fetchInscription?: (
          transactionId: string,
          network: WalletNetwork
        ) => Promise<Record<string, unknown> | null>;
      })
    | null {
    return getWalletBridgeProvider() as
      | (WalletBridgeProvider & {
          fetchInscription?: (
            transactionId: string,
            network: WalletNetwork
          ) => Promise<Record<string, unknown> | null>;
        })
      | null;
  }

  private determineNetwork(record: Record<string, unknown>): WalletNetwork {
    const context = deriveInscriptionContext(record);
    const candidates = [
      getStringField(record, 'network'),
      getStringField(record, 'Network'),
      getStringField(context.inscriptionRecord, 'network'),
      getStringField(context.resultRecord, 'network'),
    ];

    for (const candidate of candidates) {
      if (candidate === 'mainnet') {
        return 'mainnet';
      }
      if (candidate === 'testnet') {
        return 'testnet';
      }
    }

    return 'testnet';
  }
}
