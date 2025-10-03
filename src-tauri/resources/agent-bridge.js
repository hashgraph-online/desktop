#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const module_1 = require("module");
const node_crypto_1 = require("node:crypto");
const conversational_agent_1 = require("@hashgraphonline/conversational-agent");
const standards_agent_kit_1 = require("@hashgraphonline/standards-agent-kit");
const inscriber_helpers_1 = require("./inscriber-helpers");
const bridgeRequire = (0, module_1.createRequire)(__filename);
let AgentConstructor = null;
let agent = null;
const attachmentProcessor = new conversational_agent_1.AttachmentProcessor();
const BRIDGE_TIMEOUT_MS = 60000;
const COMPLETED_TRANSACTION_MARKER = '__COMPLETED_TX';
const BRIDGE_TIMEOUT_OVERRIDES = {
    wallet_inscribe_start: 5 * 60 * 1000,
    wallet_execute_tx: 2 * 60 * 1000,
};
const pendingBridgeRequests = new Map();
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const redirectStdout = function (chunk, encoding, callback) {
    if (typeof encoding === 'function') {
        return process.stderr.write(chunk, encoding);
    }
    return process.stderr.write(chunk, encoding, callback);
};
process.stdout.write = redirectStdout;
const forwardConsoleToStderr = (...args) => {
    const message = args
        .map((arg) => {
        if (typeof arg === 'string') {
            return arg;
        }
        try {
            return JSON.stringify(arg);
        }
        catch {
            return String(arg);
        }
    })
        .join(' ');
    process.stderr.write(`${message}\n`);
};
console.log = forwardConsoleToStderr;
console.info = forwardConsoleToStderr;
console.warn = forwardConsoleToStderr;
const logBridgeEvent = (event, details) => {
    if (details) {
        forwardConsoleToStderr(`[bridge] ${event}`, details);
        return;
    }
    forwardConsoleToStderr(`[bridge] ${event}`);
};
const summarizeKeys = (value) => {
    const record = (0, inscriber_helpers_1.toRecord)(value);
    if (!record) {
        return undefined;
    }
    return Object.keys(record).slice(0, 20);
};
const resolveBridgeResponse = (payload) => {
    const entry = pendingBridgeRequests.get(payload.id);
    if (!entry) {
        return;
    }
    pendingBridgeRequests.delete(payload.id);
    if (payload.success) {
        entry.resolve(payload);
        return;
    }
    entry.reject(new Error(payload.error ?? 'Bridge request failed'));
};
const sendBridgeRequest = (action, payload) => {
    const requestId = (0, node_crypto_1.randomUUID)();
    const timeoutMs = BRIDGE_TIMEOUT_OVERRIDES[action] ?? BRIDGE_TIMEOUT_MS;
    const envelope = {
        bridgeRequest: {
            id: requestId,
            action,
            payload,
        },
    };
    logBridgeEvent('bridge_request_start', {
        action,
        requestId,
        timeoutMs,
        payloadKeys: Object.keys(payload),
    });
    originalStdoutWrite(`${JSON.stringify(envelope)}\n`);
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            if (!pendingBridgeRequests.delete(requestId)) {
                return;
            }
            const duration = Date.now() - startTime;
            logBridgeEvent('bridge_request_timeout', {
                action,
                requestId,
                durationMs: duration,
                timeoutMs,
            });
            reject(new Error(`Bridge request timed out: ${action}`));
        }, timeoutMs);
        timeout.unref?.();
        pendingBridgeRequests.set(requestId, {
            resolve: (value) => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;
                const dataRecord = (0, inscriber_helpers_1.toRecord)(value.data);
                logBridgeEvent('bridge_request_success', {
                    action,
                    requestId,
                    durationMs: duration,
                    hasData: Boolean(dataRecord),
                    dataKeys: dataRecord
                        ? Object.keys(dataRecord).slice(0, 20)
                        : undefined,
                });
                resolve(value);
            },
            reject: (error) => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;
                logBridgeEvent('bridge_request_failure', {
                    action,
                    requestId,
                    durationMs: duration,
                    error: error.message,
                });
                reject(error);
            },
        });
    });
};
const configureInscriberBridge = () => {
    try {
        standards_agent_kit_1.InscriberBuilder.setWalletInfoResolver(async () => {
            const response = await sendBridgeRequest('wallet_status', {});
            const record = (0, inscriber_helpers_1.toRecord)(response.data);
            if (!record) {
                return null;
            }
            const connected = record.connected === true;
            if (!connected) {
                return null;
            }
            const accountId = record.accountId;
            const networkValue = record.network;
            if (typeof accountId !== 'string' ||
                (networkValue !== 'mainnet' && networkValue !== 'testnet')) {
                return null;
            }
            return {
                accountId,
                network: networkValue,
            };
        });
        standards_agent_kit_1.InscriberBuilder.setWalletExecutor(async (base64, network) => {
            const response = await sendBridgeRequest('wallet_execute_tx', {
                base64,
                network,
            });
            const record = (0, inscriber_helpers_1.toRecord)(response.data);
            if (!record) {
                throw new Error('Wallet execution missing payload');
            }
            const transactionId = record.transactionId;
            if (typeof transactionId !== 'string') {
                throw new Error('Wallet execution missing transactionId');
            }
            return { transactionId };
        });
    }
    catch (error) {
        forwardConsoleToStderr('Inscriber builder configuration failed', error);
    }
};
configureInscriberBridge();
const configureWalletBridgeProvider = () => {
    try {
        (0, conversational_agent_1.setWalletBridgeProvider)({
            status: async () => {
                try {
                    const response = await sendBridgeRequest('wallet_status', {});
                    const record = (0, inscriber_helpers_1.toRecord)(response.data) ?? {};
                    const connected = record.connected === true;
                    const accountId = typeof record.accountId === 'string' &&
                        record.accountId.trim().length > 0
                        ? record.accountId
                        : undefined;
                    const network = record.network === 'mainnet' || record.network === 'testnet'
                        ? record.network
                        : undefined;
                    return {
                        connected,
                        accountId,
                        network,
                    };
                }
                catch (error) {
                    forwardConsoleToStderr('wallet status bridge failed', error);
                    return {
                        connected: false,
                        accountId: undefined,
                        network: undefined,
                    };
                }
            },
            executeBytes: async (base64, network) => {
                const response = await sendBridgeRequest('wallet_execute_tx', {
                    base64,
                    network,
                });
                const record = (0, inscriber_helpers_1.toRecord)(response.data);
                if (!record || typeof record.transactionId !== 'string') {
                    throw new Error('Wallet execution missing transactionId');
                }
                return { transactionId: record.transactionId };
            },
            startInscription: async (request, network) => {
                const requestRecord = (0, inscriber_helpers_1.toRecord)(request) ?? {};
                logBridgeEvent('wallet_inscribe_start_request', {
                    network,
                    requestKeys: Object.keys(requestRecord),
                });
                const response = await sendBridgeRequest('wallet_inscribe_start', {
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
                logBridgeEvent('wallet_inscribe_start_response_payload', pendingPayload);
                return pendingPayload;
            },
        });
    }
    catch (error) {
        forwardConsoleToStderr('Failed to configure wallet bridge provider', error);
    }
};
configureWalletBridgeProvider();
const decodeAttachment = (attachment) => {
    try {
        return Buffer.from(attachment.data, 'base64').toString('utf8');
    }
    catch (error) {
        forwardConsoleToStderr('Attachment decode failed', error);
        return null;
    }
};
const extractPageContextFromAttachments = (attachments) => {
    const candidate = attachments.find((attachment) => attachment.name.toLowerCase() === 'page-context.json');
    if (!candidate) {
        return null;
    }
    const decoded = decodeAttachment(candidate);
    if (!decoded) {
        return null;
    }
    try {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    }
    catch (error) {
        forwardConsoleToStderr('Page context parse failed', error);
    }
    return null;
};
const buildPageContextPrompt = (context) => {
    const sections = ['Context extracted from the active browser tab:'];
    const pushLine = (label, value) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            sections.push(`${label}: ${value.trim()}`);
        }
    };
    pushLine('URL', context.url);
    pushLine('Title', context.title);
    pushLine('Host', context.host);
    pushLine('Description', context.description);
    pushLine('Selection', context.selection);
    if (Array.isArray(context.favicons)) {
        const favicons = context.favicons
            .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
            .slice(0, 6);
        if (favicons.length > 0) {
            sections.push(`Favicons: ${favicons.join(', ')}`);
        }
    }
    return sections.join('\n');
};
function writeResponse(response) {
    originalStdoutWrite(`${JSON.stringify(response)}\n`);
}
function resolveAgent() {
    if (AgentConstructor) {
        return AgentConstructor;
    }
    const moduleSpecifier = '@hashgraphonline/conversational-agent';
    const candidates = [
        () => bridgeRequire(moduleSpecifier),
        () => {
            const resolved = bridgeRequire.resolve(moduleSpecifier, {
                paths: [
                    process.cwd(),
                    path_1.default.join(__dirname, '..'),
                    path_1.default.join(__dirname, '..', '..'),
                ],
            });
            return bridgeRequire(resolved);
        },
    ];
    for (const candidate of candidates) {
        try {
            const module = candidate();
            AgentConstructor = module.ConversationalAgent;
            return AgentConstructor;
        }
        catch (error) {
            if (candidates.indexOf(candidate) === candidates.length - 1) {
                const message = error.message ?? String(error);
                console.error(JSON.stringify({
                    type: 'fatal',
                    error: `Failed to resolve conversational agent package: ${message}`,
                }));
                process.exit(1);
            }
        }
    }
    throw new Error('ConversationalAgent resolution failed unexpectedly');
}
function normalizeHistory(history) {
    if (!history) {
        return [];
    }
    return history.map((entry) => ({
        type: entry?.type === 'ai'
            ? 'ai'
            : entry?.type === 'system'
                ? 'system'
                : 'human',
        content: typeof entry.content === 'string' ? entry.content : '',
    }));
}
function normalizeNetwork(network) {
    const lower = (network || '').toLowerCase();
    if (lower === 'mainnet') {
        return 'mainnet';
    }
    if (lower !== 'testnet' && lower !== 'previewnet') {
        forwardConsoleToStderr('Unknown network supplied, defaulting to testnet', lower);
    }
    return 'testnet';
}
function normalizeOperationalMode(mode) {
    if (mode === 'autonomous') {
        return 'autonomous';
    }
    return 'returnBytes';
}
function normalizeLlmProvider(provider) {
    if (provider === 'openai' ||
        provider === 'anthropic' ||
        provider === 'openrouter') {
        return provider;
    }
    return undefined;
}
async function handleInitialize(payload) {
    if (!payload) {
        return {
            id: null,
            success: false,
            error: 'Missing initialization payload',
        };
    }
    try {
        await agent?.cleanup();
    }
    catch (error) {
        forwardConsoleToStderr('Agent cleanup failed', error);
    }
    const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
    const openAIApiKey = typeof payload.openAIApiKey === 'string' ? payload.openAIApiKey.trim() : '';
    if (accountId.length === 0 || openAIApiKey.length === 0) {
        return {
            id: null,
            success: false,
            error: 'Account ID and OpenAI API key are required',
        };
    }
    const AgentCtor = resolveAgent();
    const operationalMode = normalizeOperationalMode(payload.operationalMode);
    const privateKey = typeof payload.privateKey === 'string' ? payload.privateKey : '';
    const openAIModelName = typeof payload.openAIModelName === 'string'
        ? payload.openAIModelName
        : undefined;
    const userAccountId = typeof payload.userAccountId === 'string' &&
        payload.userAccountId.trim().length > 0
        ? payload.userAccountId
        : accountId;
    const disableLogging = typeof payload.disableLogging === 'boolean'
        ? payload.disableLogging
        : undefined;
    const openRouterApiKey = typeof payload.openRouterApiKey === 'string'
        ? payload.openRouterApiKey
        : undefined;
    const openRouterBaseURL = typeof payload.openRouterBaseURL === 'string'
        ? payload.openRouterBaseURL
        : undefined;
    const mcpServers = Array.isArray(payload.mcpServers)
        ? payload.mcpServers
        : undefined;
    const disabledPlugins = Array.isArray(payload.disabledPlugins)
        ? Array.from(new Set(payload.disabledPlugins.filter((value) => typeof value === 'string' && value.trim().length > 0)))
        : undefined;
    const options = {
        accountId,
        privateKey,
        network: normalizeNetwork(payload.network),
        openAIApiKey,
        openAIModelName,
        llmProvider: normalizeLlmProvider(payload.llmProvider),
        userAccountId,
        operationalMode,
        verbose: payload.verbose ?? true,
        disableLogging,
        openRouterApiKey,
        openRouterBaseURL,
    };
    if (mcpServers && mcpServers.length > 0) {
        options.mcpServers = mcpServers;
    }
    if (disabledPlugins && disabledPlugins.length > 0) {
        options.disabledPlugins = disabledPlugins;
    }
    const instance = new AgentCtor(options);
    try {
        await instance.initialize();
    }
    catch (error) {
        const failure = {
            id: null,
            success: false,
            data: null,
            error: `Initialization failed: ${error.message ?? String(error)}`,
        };
        forwardConsoleToStderr('Bridge initialize error', failure.error);
        writeResponse(failure);
        return failure;
    }
    agent = instance;
    const success = {
        id: null,
        success: true,
        data: { initialized: true },
    };
    forwardConsoleToStderr('Bridge initialize success');
    writeResponse(success);
    return success;
}
function buildFormSubmission(submission, history) {
    const partialInput = submission.partialInput && typeof submission.partialInput === 'object'
        ? submission.partialInput
        : undefined;
    const normalizedHistory = history.map((entry) => ({
        type: entry.type === 'system' ? 'system' : entry.type === 'ai' ? 'ai' : 'human',
        content: entry.content,
    }));
    const mutableHistory = normalizedHistory.length > 0
        ? normalizedHistory.map((entry) => ({ ...entry }))
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
function extractContent(payload) {
    if (typeof payload.content === 'string') {
        return payload.content;
    }
    return '';
}
function toResponsePayload(result, attachments) {
    return {
        response: {
            ...result,
            metadata: result.metadata ?? null,
        },
        attachments,
    };
}
async function handleSendMessage(payload) {
    if (!agent) {
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
    const history = normalizeHistory(payload.chatHistory);
    const attachments = Array.isArray(payload.attachments)
        ? payload.attachments
        : [];
    const normalizedAttachments = attachments
        .map((attachment) => {
        if (!attachment ||
            typeof attachment.name !== 'string' ||
            typeof attachment.data !== 'string') {
            return null;
        }
        const type = typeof attachment.type === 'string' && attachment.type.length > 0
            ? attachment.type
            : 'application/octet-stream';
        const size = typeof attachment.size === 'number' && Number.isFinite(attachment.size)
            ? attachment.size
            : 0;
        return {
            name: attachment.name,
            data: attachment.data,
            type,
            size,
        };
    })
        .filter((attachment) => Boolean(attachment));
    const pageContext = extractPageContextFromAttachments(attachments);
    let result;
    if (payload.formSubmission) {
        const submission = buildFormSubmission(payload.formSubmission, history);
        result = await agent.processFormSubmission(submission);
    }
    else {
        let content = extractContent(payload);
        if (normalizedAttachments.length > 0) {
            try {
                const managerCandidate = agent.contentStoreManager;
                const storeManager = managerCandidate && typeof managerCandidate === 'object'
                    ? managerCandidate
                    : undefined;
                content = await attachmentProcessor.processAttachments(content, normalizedAttachments, storeManager);
            }
            catch (error) {
                forwardConsoleToStderr('Attachment processing failed', error);
            }
        }
        const augmentedHistory = [...history];
        if (pageContext) {
            const contextPrompt = buildPageContextPrompt(pageContext);
            if (contextPrompt.trim().length > 0) {
                augmentedHistory.push({ type: 'system', content: contextPrompt });
            }
        }
        result = await agent.processMessage(content, augmentedHistory);
    }
    const normalizedResult = result;
    const normalizedRecord = (0, inscriber_helpers_1.toRecord)(normalizedResult);
    logBridgeEvent('agent_process_result_payload', normalizedRecord ?? {});
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
    logBridgeEvent('agent_process_result', {
        hasJsonTopicId: Boolean((0, inscriber_helpers_1.getStringField)(normalizedRecord, 'jsonTopicId')),
        jsonTopicId: (0, inscriber_helpers_1.getStringField)(normalizedRecord, 'jsonTopicId'),
        metadataKeys: summarizeKeys(metadataRecord),
        inscriptionKeys: summarizeKeys(inscriptionRecord),
        resultKeys: summarizeKeys(nestedResultRecord),
        hashLinkBlockKeys: summarizeKeys(hashLinkAttributes),
    });
    const responsePayload = toResponsePayload(normalizedResult, attachments);
    return {
        id: null,
        success: true,
        data: responsePayload,
    };
}
async function handleDisconnect() {
    if (agent &&
        typeof agent.cleanup === 'function') {
        await agent.cleanup();
    }
    agent = null;
    return {
        id: null,
        success: true,
        data: { disconnected: true },
    };
}
function handleStatus() {
    return {
        id: null,
        success: true,
        data: { connected: agent !== null },
    };
}
async function dispatchRequest(request) {
    switch (request.action) {
        case 'initialize':
            return handleInitialize(request.payload);
        case 'sendMessage':
            return handleSendMessage(request.payload);
        case 'disconnect':
            return handleDisconnect();
        case 'status':
            return handleStatus();
        default:
            return {
                id: request.id ?? null,
                success: false,
                error: `Unknown action: ${request.action}`,
            };
    }
}
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let delimiterIndex = buffer.indexOf('\n');
    while (delimiterIndex >= 0) {
        const segment = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 1);
        const trimmed = segment.trim();
        if (trimmed.length === 0) {
            delimiterIndex = buffer.indexOf('\n');
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch (error) {
            writeResponse({
                id: null,
                success: false,
                error: `Invalid JSON request: ${error.message ?? String(error)}`,
            });
            delimiterIndex = buffer.indexOf('\n');
            continue;
        }
        const parsedRecord = (0, inscriber_helpers_1.toRecord)(parsed);
        if (parsedRecord && parsedRecord.bridgeResponse) {
            const responseRecord = (0, inscriber_helpers_1.toRecord)(parsedRecord.bridgeResponse);
            if (responseRecord && typeof responseRecord.id === 'string') {
                resolveBridgeResponse(responseRecord);
            }
            delimiterIndex = buffer.indexOf('\n');
            continue;
        }
        if (!parsedRecord || typeof parsedRecord.action !== 'string') {
            writeResponse({
                id: null,
                success: false,
                error: 'Invalid request payload',
            });
            delimiterIndex = buffer.indexOf('\n');
            continue;
        }
        const action = parsedRecord.action;
        if (action !== 'initialize' &&
            action !== 'sendMessage' &&
            action !== 'status' &&
            action !== 'disconnect') {
            writeResponse({
                id: null,
                success: false,
                error: `Unknown action: ${String(action)}`,
            });
            delimiterIndex = buffer.indexOf('\n');
            continue;
        }
        const request = {
            id: typeof parsedRecord.id === 'number' ? parsedRecord.id : undefined,
            action,
            payload: parsedRecord.payload,
        };
        dispatchRequest(request)
            .then((response) => {
            writeResponse({ ...response, id: response.id ?? request.id ?? null });
        })
            .catch((error) => {
            writeResponse({
                id: request.id ?? null,
                success: false,
                error: error.message ?? String(error),
            });
        });
        delimiterIndex = buffer.indexOf('\n');
    }
});
process.stdin.on('end', () => {
    if (buffer.trim().length === 0) {
        process.exit(0);
        return;
    }
    try {
        const parsed = JSON.parse(buffer.trim());
        const parsedRecord = (0, inscriber_helpers_1.toRecord)(parsed);
        if (parsedRecord && parsedRecord.bridgeResponse) {
            const responseRecord = (0, inscriber_helpers_1.toRecord)(parsedRecord.bridgeResponse);
            if (responseRecord && typeof responseRecord.id === 'string') {
                resolveBridgeResponse(responseRecord);
            }
            process.exit(0);
            return;
        }
        if (!parsedRecord || typeof parsedRecord.action !== 'string') {
            writeResponse({
                id: null,
                success: false,
                error: 'Invalid request payload',
            });
            process.exit(1);
            return;
        }
        const action = parsedRecord.action;
        if (action !== 'initialize' &&
            action !== 'sendMessage' &&
            action !== 'status' &&
            action !== 'disconnect') {
            writeResponse({
                id: null,
                success: false,
                error: `Unknown action: ${String(action)}`,
            });
            process.exit(1);
            return;
        }
        const request = {
            id: typeof parsedRecord.id === 'number' ? parsedRecord.id : undefined,
            action,
            payload: parsedRecord.payload,
        };
        dispatchRequest(request)
            .then((response) => {
            writeResponse({ ...response, id: response.id ?? request.id ?? null });
            process.exit(response.success ? 0 : 1);
        })
            .catch((error) => {
            writeResponse({
                id: request.id ?? null,
                success: false,
                error: error.message ?? String(error),
            });
            process.exit(1);
        });
    }
    catch (error) {
        writeResponse({
            id: null,
            success: false,
            error: `Invalid JSON request: ${error.message ?? String(error)}`,
        });
        process.exit(1);
    }
});
