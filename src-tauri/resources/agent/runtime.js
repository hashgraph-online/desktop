"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeRuntime = void 0;
const conversational_agent_1 = require("@hashgraphonline/conversational-agent");
const attachments_1 = require("./attachments");
const inscription_1 = require("./inscription");
const wallet_1 = require("./wallet");
const logging_1 = require("./logging");
const inscriber_helpers_1 = require("../inscriber-helpers");
class BridgeRuntime {
    constructor(deps) {
        this.deps = deps;
        this.agent = null;
        this.attachmentProcessor = new conversational_agent_1.AttachmentProcessor();
        this.inscriptionService = new inscription_1.InscriptionService(deps.logBridgeEvent);
        (0, wallet_1.configureWalletBridge)({
            channel: deps.channel,
            logBridgeEvent: deps.logBridgeEvent,
            writeStderr: deps.writeStderr,
        });
    }
    async dispatch(request) {
        const startTime = Date.now();
        this.deps.logBridgeEvent('bridge_dispatch_start', {
            action: request.action,
            requestId: request.id,
        });
        switch (request.action) {
            case 'initialize':
                return this.wrapResponse(request, startTime, this.handleInitialize(request.payload));
            case 'sendMessage':
                return this.wrapResponse(request, startTime, this.handleSendMessage(request.payload));
            case 'status':
                return this.wrapResponse(request, startTime, Promise.resolve(this.handleStatus()));
            case 'disconnect':
                return this.wrapResponse(request, startTime, this.handleDisconnect());
            default:
                return this.wrapResponse(request, startTime, Promise.resolve({
                    id: request.id ?? null,
                    success: false,
                    error: `Unknown action: ${String(request.action)}`,
                }));
        }
    }
    async wrapResponse(request, startTime, responsePromise) {
        try {
            const response = await responsePromise;
            this.deps.logBridgeEvent('bridge_dispatch_success', {
                action: request.action,
                requestId: request.id,
                durationMs: Date.now() - startTime,
                success: response.success,
            });
            return response;
        }
        catch (error) {
            this.deps.logBridgeEvent('bridge_dispatch_failure', {
                action: request.action,
                requestId: request.id,
                durationMs: Date.now() - startTime,
                error: error.message,
            });
            throw error;
        }
    }
    async handleInitialize(payload) {
        if (!payload) {
            return {
                id: null,
                success: false,
                error: 'Missing initialize payload',
            };
        }
        const options = this.buildAgentOptions(payload);
        const instance = new conversational_agent_1.ConversationalAgent(options);
        try {
            await instance.initialize();
        }
        catch (error) {
            const errorMessage = error.message ?? String(error);
            const errorStack = error.stack ?? 'No stack trace available';
            this.deps.writeStderr('Bridge initialize error', {
                message: errorMessage,
                stack: errorStack,
                error: String(error),
            });
            return {
                id: null,
                success: false,
                data: null,
                error: `Initialization failed: ${errorMessage}`,
            };
        }
        this.agent = instance;
        this.deps.writeStderr('Bridge initialize success');
        return {
            id: null,
            success: true,
            data: { initialized: true },
        };
    }
    async handleSendMessage(payload) {
        if (!this.agent) {
            return {
                id: null,
                success: false,
                error: 'Agent not initialized',
            };
        }
        if (!payload) {
            return {
                id: null,
                success: false,
                error: 'Missing message payload',
            };
        }
        const history = this.normalizeHistory(payload.chatHistory);
        const attachments = Array.isArray(payload.attachments)
            ? payload.attachments
            : [];
        const normalizedAttachments = (0, attachments_1.normalizeAttachments)(attachments);
        const pageContext = (0, attachments_1.extractPageContext)(attachments);
        let result;
        if (payload.formSubmission) {
            const submission = this.buildFormSubmission(payload.formSubmission, history);
            result = await this.agent.processFormSubmission(submission);
        }
        else {
            const content = await this.buildMessageContent(payload, normalizedAttachments);
            const augmentedHistory = this.applyPageContext(history, pageContext);
            result = await this.agent.processMessage(content, augmentedHistory);
        }
        result = await this.inscriptionService.ensureJsonTopicMetadata(result);
        const normalizedResult = this.inscriptionService.rewriteHashLinkTopic(result);
        const responsePayload = this.toResponsePayload(normalizedResult, attachments);
        const normalizedRecord = (0, inscriber_helpers_1.toRecord)(responsePayload.response);
        const metadataRecord = normalizedRecord
            ? (0, inscriber_helpers_1.toRecord)(normalizedRecord.metadata) ?? undefined
            : undefined;
        const inscriptionRecord = normalizedRecord
            ? (0, inscriber_helpers_1.toRecord)(normalizedRecord.inscription) ?? undefined
            : undefined;
        const nestedResultRecord = normalizedRecord
            ? (0, inscriber_helpers_1.toRecord)(normalizedRecord.result) ?? undefined
            : undefined;
        const hashLinkBlockRecord = normalizedRecord
            ? (0, inscriber_helpers_1.toRecord)(normalizedRecord.hashLinkBlock)
            : null;
        const hashLinkAttributes = hashLinkBlockRecord
            ? (0, inscriber_helpers_1.toRecord)(hashLinkBlockRecord.attributes)
            : undefined;
        this.deps.logBridgeEvent('agent_process_result_payload', normalizedRecord ?? {});
        this.deps.logBridgeEvent('agent_process_result', {
            hasJsonTopicId: Boolean(getStringField(normalizedRecord, 'jsonTopicId')),
            jsonTopicId: getStringField(normalizedRecord, 'jsonTopicId'),
            metadataKeys: (0, logging_1.summarizeKeys)(metadataRecord),
            inscriptionKeys: (0, logging_1.summarizeKeys)(inscriptionRecord),
            resultKeys: (0, logging_1.summarizeKeys)(nestedResultRecord),
            hashLinkBlockKeys: (0, logging_1.summarizeKeys)(hashLinkAttributes),
            hasHashLinkBlock: Boolean(hashLinkBlockRecord),
            fullMetadata: metadataRecord,
        });
        return {
            id: null,
            success: true,
            data: responsePayload,
        };
    }
    async handleDisconnect() {
        if (!this.agent) {
            return {
                id: null,
                success: true,
                data: { disconnected: true },
            };
        }
        try {
            if (typeof this.agent.cleanup === 'function') {
                await this.agent.cleanup();
            }
        }
        catch (error) {
            this.deps.writeStderr('Bridge disconnect cleanup error', error);
        }
        this.agent = null;
        return {
            id: null,
            success: true,
            data: { disconnected: true },
        };
    }
    handleStatus() {
        return {
            id: null,
            success: true,
            data: { connected: Boolean(this.agent) },
        };
    }
    buildAgentOptions(payload) {
        const normalizeNetwork = (network) => {
            if (typeof network === 'string') {
                const candidate = network.toLowerCase();
                if (candidate === 'mainnet') {
                    return 'mainnet';
                }
                if (candidate === 'testnet') {
                    return 'testnet';
                }
            }
            return 'testnet';
        };
        const normalizeOperationalMode = (mode) => {
            if (typeof mode === 'string') {
                const candidate = mode.toLowerCase();
                if (candidate === 'returnbytes') {
                    return 'returnBytes';
                }
                if (candidate === 'autonomous') {
                    return 'autonomous';
                }
            }
            return 'returnBytes';
        };
        const normalizeLlmProvider = (provider) => {
            if (typeof provider !== 'string') {
                return undefined;
            }
            const normalized = provider.trim().toLowerCase();
            if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'openrouter') {
                return normalized;
            }
            return undefined;
        };
        const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
        const privateKey = typeof payload.privateKey === 'string' ? payload.privateKey.trim() : '';
        const openAIApiKey = typeof payload.openAIApiKey === 'string'
            ? payload.openAIApiKey.trim()
            : '';
        const openAIModelName = typeof payload.openAIModelName === 'string' &&
            payload.openAIModelName.trim().length > 0
            ? payload.openAIModelName
            : undefined;
        const llmProvider = normalizeLlmProvider(payload.llmProvider);
        const userAccountId = typeof payload.userAccountId === 'string' &&
            payload.userAccountId.trim().length > 0
            ? payload.userAccountId
            : undefined;
        const operationalMode = normalizeOperationalMode(payload.operationalMode);
        const disableLogging = payload.disableLogging ?? false;
        const openRouterApiKey = typeof payload.openRouterApiKey === 'string' &&
            payload.openRouterApiKey.trim().length > 0
            ? payload.openRouterApiKey
            : undefined;
        const openRouterBaseURL = typeof payload.openRouterBaseURL === 'string' &&
            payload.openRouterBaseURL.trim().length > 0
            ? payload.openRouterBaseURL
            : undefined;
        const options = {
            accountId,
            privateKey,
            network: normalizeNetwork(payload.network),
            openAIApiKey,
            openAIModelName,
            llmProvider,
            userAccountId,
            operationalMode,
            verbose: payload.verbose ?? true,
            disableLogging,
            openRouterApiKey,
            openRouterBaseURL,
        };
        const mcpServers = Array.isArray(payload.mcpServers)
            ? payload.mcpServers
            : undefined;
        const disabledPlugins = Array.isArray(payload.disabledPlugins)
            ? Array.from(new Set(payload.disabledPlugins.filter((value) => typeof value === 'string' && value.trim().length > 0)))
            : undefined;
        if (mcpServers && mcpServers.length > 0) {
            options.mcpServers = mcpServers;
        }
        if (disabledPlugins && disabledPlugins.length > 0) {
            options.disabledPlugins = disabledPlugins;
        }
        return options;
    }
    normalizeHistory(history) {
        if (!Array.isArray(history)) {
            return [];
        }
        return history
            .map((entry) => {
            const content = typeof entry.content === 'string' ? entry.content : '';
            const type = entry.type === 'system' ? 'system' : entry.type === 'ai' ? 'ai' : 'human';
            return { type, content };
        })
            .filter((entry) => entry.content.trim().length > 0);
    }
    buildFormSubmission(submission, history) {
        const partialInput = submission.partialInput && typeof submission.partialInput === 'object'
            ? submission.partialInput
            : undefined;
        const mutableHistory = history.length > 0
            ? history.map((entry) => ({ type: entry.type, content: entry.content }))
            : undefined;
        return {
            formId: submission.formId,
            toolName: submission.toolName,
            parameters: submission.data ?? {},
            timestamp: submission.timestamp ?? Date.now(),
            context: {
                originalPrompt: submission.originalPrompt,
                partialInput,
                chatHistory: mutableHistory,
            },
        };
    }
    async buildMessageContent(payload, attachments) {
        let content = typeof payload.content === 'string' ? payload.content : '';
        if (attachments.length === 0) {
            return content;
        }
        try {
            const managerCandidate = this.agent.contentStoreManager;
            const storeManager = asContentStoreManager(managerCandidate);
            content = await this.attachmentProcessor.processAttachments(content, attachments, storeManager);
        }
        catch (error) {
            this.deps.writeStderr('Attachment processing failed', error);
        }
        return content;
    }
    applyPageContext(history, context) {
        if (!context) {
            return history;
        }
        const contextPrompt = (0, attachments_1.buildPageContextPrompt)(context);
        if (contextPrompt.trim().length === 0) {
            return history;
        }
        return [...history, { type: 'system', content: contextPrompt }];
    }
    toResponsePayload(result, attachments) {
        return {
            response: {
                ...result,
                metadata: result.metadata ?? null,
            },
            attachments,
        };
    }
}
exports.BridgeRuntime = BridgeRuntime;
const getStringField = (value, key) => {
    const record = (0, inscriber_helpers_1.toRecord)(value);
    if (!record) {
        return undefined;
    }
    const candidate = record[key];
    return typeof candidate === 'string' ? candidate : undefined;
};
const asContentStoreManager = (value) => {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    if ('storeContentIfLarge' in value &&
        typeof value.storeContentIfLarge === 'function') {
        return value;
    }
    return undefined;
};
