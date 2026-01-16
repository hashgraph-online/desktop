"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InscriptionService = exports.toDashedTransactionId = void 0;
const inscriber_helpers_1 = require("../inscriber-helpers");
const conversational_agent_1 = require("@hashgraphonline/conversational-agent");
const pickField = (record, keys) => {
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
const toDashedTransactionId = (transactionId) => {
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
exports.toDashedTransactionId = toDashedTransactionId;
class InscriptionService {
    logBridgeEvent;
    constructor(logBridgeEvent) {
        this.logBridgeEvent = logBridgeEvent;
    }
    async ensureJsonTopicMetadata(result) {
        const record = (0, inscriber_helpers_1.toRecord)(result);
        if (!record) {
            return result;
        }
        const metadataRecord = (0, inscriber_helpers_1.toRecord)(record.metadata);
        const inscriptionRecord = (0, inscriber_helpers_1.toRecord)(record.inscription) ?? (0, inscriber_helpers_1.toRecord)(metadataRecord?.inscription);
        const resultRecord = (0, inscriber_helpers_1.toRecord)(record.result) ?? (0, inscriber_helpers_1.toRecord)(metadataRecord?.result);
        const hashLinkBlockRecord = (0, inscriber_helpers_1.toRecord)(record.hashLinkBlock);
        const { metadataTopicId } = (0, inscriber_helpers_1.deriveInscriptionContext)(record);
        const hasJsonTopic = Boolean(metadataTopicId ||
            (0, inscriber_helpers_1.getStringField)(inscriptionRecord, 'jsonTopicId') ||
            (0, inscriber_helpers_1.getStringField)(resultRecord, 'jsonTopicId') ||
            (0, inscriber_helpers_1.getStringField)(metadataRecord, 'jsonTopicId') ||
            (0, inscriber_helpers_1.getStringField)(record, 'jsonTopicId'));
        if (hasJsonTopic) {
            return result;
        }
        const transactionId = pickField(inscriptionRecord, ['transactionId', 'tx_id']) ||
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
        let retrieved = null;
        try {
            retrieved = await provider.fetchInscription(transactionId, network);
            this.logBridgeEvent('inscription_enrich_fetch_result', {
                transactionId,
                network,
                ...retrieved,
                hasJsonTopicId: Boolean((0, inscriber_helpers_1.getStringField)(retrieved, 'jsonTopicId') ||
                    (0, inscriber_helpers_1.getStringField)(retrieved, 'json_topic_id')),
                keys: retrieved ? Object.keys(retrieved).slice(0, 12) : [],
            });
        }
        catch (error) {
            this.logBridgeEvent('inscription_enrich_error', {
                transactionId,
                network,
                error: error.message,
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
        const jsonTopicId = pickField((0, inscriber_helpers_1.toRecord)(retrieved), ['jsonTopicId', 'json_topic_id']);
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
        const resolvedImageTopic = pickField((0, inscriber_helpers_1.toRecord)(retrieved), ['topicId', 'topic_id']) ||
            (0, inscriber_helpers_1.getStringField)(hashLinkBlockRecord, 'imageTopicId');
        const updatedRecord = {
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
            const attributes = (0, inscriber_helpers_1.toRecord)(hashLinkBlockRecord.attributes) ?? {};
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
        return updatedRecord;
    }
    rewriteHashLinkTopic(result) {
        const record = (0, inscriber_helpers_1.toRecord)(result);
        if (!record) {
            return result;
        }
        const inscriptionRecord = (0, inscriber_helpers_1.toRecord)(record.inscription) ??
            (0, inscriber_helpers_1.toRecord)((0, inscriber_helpers_1.toRecord)(record.metadata)?.inscription);
        const resultRecord = (0, inscriber_helpers_1.toRecord)(record.result) ?? (0, inscriber_helpers_1.toRecord)((0, inscriber_helpers_1.toRecord)(record.metadata)?.result);
        const metadataRecord = (0, inscriber_helpers_1.toRecord)(record.metadata);
        const hashLinkBlockRecord = (0, inscriber_helpers_1.toRecord)(record.hashLinkBlock);
        const { metadataTopicId } = (0, inscriber_helpers_1.deriveInscriptionContext)(record);
        const deriveJsonTopicIdFromHashLink = () => {
            if (!hashLinkBlockRecord) {
                return undefined;
            }
            const attributesRecord = (0, inscriber_helpers_1.toRecord)(hashLinkBlockRecord.attributes);
            const attributeJson = (0, inscriber_helpers_1.getStringField)(attributesRecord, 'jsonTopicId');
            if (attributeJson) {
                return attributeJson;
            }
            const hrlCandidate = (0, inscriber_helpers_1.getStringField)(attributesRecord, 'hrl') ||
                (0, inscriber_helpers_1.getStringField)(hashLinkBlockRecord, 'hrl') ||
                (0, inscriber_helpers_1.getStringField)(hashLinkBlockRecord, 'hashLink');
            if (hrlCandidate) {
                const match = /^hcs:\/\/\d+\/(.+)$/.exec(hrlCandidate.trim());
                if (match && match[1]) {
                    return match[1];
                }
            }
            return undefined;
        };
        let jsonTopicId = metadataTopicId ||
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
        const transactionId = pickField(inscriptionRecord, ['transactionId', 'tx_id']) ||
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
        const updated = { ...record, jsonTopicId };
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
            const attributes = (0, inscriber_helpers_1.toRecord)(hashLinkBlockRecord.attributes) ?? {};
            const previousTopic = (0, inscriber_helpers_1.getStringField)(attributes, 'topicId') ||
                (0, inscriber_helpers_1.getStringField)(attributes, 'topic_id');
            updated['hashLinkBlock'] = {
                ...hashLinkBlockRecord,
                attributes: {
                    ...attributes,
                    topicId: jsonTopicId,
                    topic_id: jsonTopicId,
                    jsonTopicId,
                    imageTopicId: previousTopic && previousTopic !== jsonTopicId
                        ? previousTopic
                        : attributes.imageTopicId,
                    transactionId,
                    hrl: `hcs://1/${jsonTopicId}`,
                },
            };
        }
        const previousTopicId = (0, inscriber_helpers_1.getStringField)(record, 'jsonTopicId') ||
            pickField(resultRecord, ['topicId', 'topic_id']) ||
            imageTopicId;
        if (previousTopicId !== jsonTopicId) {
            this.logBridgeEvent('rewrite_hash_link', {
                previousTopicId,
                jsonTopicId,
                imageTopicId,
            });
        }
        const replaceSummary = (value) => {
            if (typeof value !== 'string') {
                return value;
            }
            return value
                .replace(/Topic ID: [^\n]+/g, `Topic ID: ${jsonTopicId}`)
                .replace(/HRL: [^\n]+/g, `HRL: hcs://1/${jsonTopicId}`);
        };
        Reflect.set(updated, 'message', replaceSummary(updated['message']));
        Reflect.set(updated, 'output', replaceSummary(updated['output']));
        return updated;
    }
    resolveWalletProvider() {
        return (0, conversational_agent_1.getWalletBridgeProvider)();
    }
    determineNetwork(record) {
        const context = (0, inscriber_helpers_1.deriveInscriptionContext)(record);
        const candidates = [
            (0, inscriber_helpers_1.getStringField)(record, 'network'),
            (0, inscriber_helpers_1.getStringField)(record, 'Network'),
            (0, inscriber_helpers_1.getStringField)(context.inscriptionRecord, 'network'),
            (0, inscriber_helpers_1.getStringField)(context.resultRecord, 'network'),
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
exports.InscriptionService = InscriptionService;
