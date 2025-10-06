"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureWalletBridge = void 0;
const conversational_agent_1 = require("@hashgraphonline/conversational-agent");
const standards_agent_kit_1 = require("@hashgraphonline/standards-agent-kit");
const inscriber_helpers_1 = require("../inscriber-helpers");
const inscription_1 = require("./inscription");
const buildWalletProvider = (channel, logBridgeEvent, writeStderr) => ({
    status: async () => {
        try {
            const response = await channel.send('wallet_status', {});
            const record = (0, inscriber_helpers_1.toRecord)(response.data) ?? {};
            const connected = record.connected === true;
            const accountId = typeof record.accountId === 'string' && record.accountId.trim().length > 0
                ? record.accountId
                : undefined;
            const network = record.network === 'mainnet' || record.network === 'testnet'
                ? record.network
                : undefined;
            return { connected, accountId, network };
        }
        catch (error) {
            writeStderr('wallet status bridge failed', error);
            return { connected: false, accountId: undefined, network: undefined };
        }
    },
    executeBytes: async (base64, network) => {
        const response = await channel.send('wallet_execute_tx', {
            base64,
            network,
        });
        const record = (0, inscriber_helpers_1.toRecord)(response.data);
        if (!record || typeof record.transactionId !== 'string') {
            throw new Error('Wallet execution missing transactionId');
        }
        return { transactionId: (0, inscription_1.toDashedTransactionId)(record.transactionId) };
    },
    startInscription: async (request, network) => {
        const requestRecord = (0, inscriber_helpers_1.toRecord)(request) ?? {};
        logBridgeEvent('wallet_inscribe_start_request', {
            network,
            requestKeys: Object.keys(requestRecord),
        });
        const response = await channel.send('wallet_inscribe_start', {
            request: requestRecord,
            network,
        });
        const record = (0, inscriber_helpers_1.toRecord)(response.data);
        if (!record) {
            throw new Error('Wallet inscription missing payload');
        }
        logBridgeEvent('wallet_inscribe_start_response_payload', record);
        const transactionBytes = typeof record.transactionBytes === 'string'
            ? record.transactionBytes.trim()
            : '';
        if (!transactionBytes) {
            throw new Error('Failed to start inscription (no transaction bytes)');
        }
        const pendingPayload = {
            transactionBytes,
            quote: record.quote === true,
        };
        const dashedTxId = typeof record.tx_id === 'string'
            ? (0, inscription_1.toDashedTransactionId)(record.tx_id)
            : undefined;
        if (dashedTxId) {
            pendingPayload.tx_id = dashedTxId;
        }
        return pendingPayload;
    },
    fetchInscription: async (transactionId, network) => {
        logBridgeEvent('wallet_inscribe_fetch_request', {
            transactionId,
            network,
        });
        const response = await channel.send('wallet_inscribe_fetch', {
            transaction_id: transactionId,
            network,
        });
        const record = (0, inscriber_helpers_1.toRecord)(response.data);
        logBridgeEvent('wallet_inscribe_fetch_response', {
            hasJsonTopicId: Boolean((0, inscriber_helpers_1.getStringField)(record, 'jsonTopicId') ||
                (0, inscriber_helpers_1.getStringField)(record, 'json_topic_id')),
            ...record,
        });
        return record;
    },
});
const configureWalletBridge = ({ channel, logBridgeEvent, writeStderr, }) => {
    try {
        const provider = buildWalletProvider(channel, logBridgeEvent, writeStderr);
        (0, conversational_agent_1.setWalletBridgeProvider)(provider);
        standards_agent_kit_1.InscriberBuilder.setWalletInfoResolver(async () => {
            const response = await channel.send('wallet_status', {});
            const record = (0, inscriber_helpers_1.toRecord)(response.data);
            if (!record || record.connected !== true) {
                return null;
            }
            const accountId = record.accountId;
            const networkValue = record.network;
            if (typeof accountId !== 'string' ||
                (networkValue !== 'mainnet' && networkValue !== 'testnet')) {
                return null;
            }
            return { accountId, network: networkValue };
        });
        standards_agent_kit_1.InscriberBuilder.setWalletExecutor(async (base64, network) => {
            const response = await channel.send('wallet_execute_tx', { base64, network });
            const record = (0, inscriber_helpers_1.toRecord)(response.data);
            if (!record || typeof record.transactionId !== 'string') {
                throw new Error('Wallet execution missing transactionId');
            }
            return { transactionId: (0, inscription_1.toDashedTransactionId)(record.transactionId) };
        });
    }
    catch (error) {
        writeStderr('Failed to configure wallet bridge provider', error);
    }
};
exports.configureWalletBridge = configureWalletBridge;
