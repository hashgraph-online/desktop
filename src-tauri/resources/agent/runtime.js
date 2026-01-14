"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeRuntime = void 0;
var conversational_agent_1 = require("@hashgraphonline/conversational-agent");
var attachments_1 = require("./attachments");
var inscription_1 = require("./inscription");
var wallet_1 = require("./wallet");
var logging_1 = require("./logging");
var inscriber_helpers_1 = require("../inscriber-helpers");
var BridgeRuntime = /** @class */ (function () {
    function BridgeRuntime(deps) {
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
    BridgeRuntime.prototype.dispatch = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime;
            var _a;
            return __generator(this, function (_b) {
                startTime = Date.now();
                this.deps.logBridgeEvent('bridge_dispatch_start', {
                    action: request.action,
                    requestId: request.id,
                });
                switch (request.action) {
                    case 'initialize':
                        return [2 /*return*/, this.wrapResponse(request, startTime, this.handleInitialize(request.payload))];
                    case 'sendMessage':
                        return [2 /*return*/, this.wrapResponse(request, startTime, this.handleSendMessage(request.payload))];
                    case 'status':
                        return [2 /*return*/, this.wrapResponse(request, startTime, Promise.resolve(this.handleStatus()))];
                    case 'disconnect':
                        return [2 /*return*/, this.wrapResponse(request, startTime, this.handleDisconnect())];
                    default:
                        return [2 /*return*/, this.wrapResponse(request, startTime, Promise.resolve({
                                id: (_a = request.id) !== null && _a !== void 0 ? _a : null,
                                success: false,
                                error: "Unknown action: ".concat(String(request.action)),
                            }))];
                }
                return [2 /*return*/];
            });
        });
    };
    BridgeRuntime.prototype.wrapResponse = function (request, startTime, responsePromise) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, responsePromise];
                    case 1:
                        response = _a.sent();
                        this.deps.logBridgeEvent('bridge_dispatch_success', {
                            action: request.action,
                            requestId: request.id,
                            durationMs: Date.now() - startTime,
                            success: response.success,
                        });
                        return [2 /*return*/, response];
                    case 2:
                        error_1 = _a.sent();
                        this.deps.logBridgeEvent('bridge_dispatch_failure', {
                            action: request.action,
                            requestId: request.id,
                            durationMs: Date.now() - startTime,
                            error: error_1.message,
                        });
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    BridgeRuntime.prototype.handleInitialize = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var options, instance, error_2, errorMessage, errorStack;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!payload) {
                            return [2 /*return*/, {
                                    id: null,
                                    success: false,
                                    error: 'Missing initialize payload',
                                }];
                        }
                        options = this.buildAgentOptions(payload);
                        instance = new conversational_agent_1.ConversationalAgent(options);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, instance.initialize()];
                    case 2:
                        _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _c.sent();
                        errorMessage = (_a = error_2.message) !== null && _a !== void 0 ? _a : String(error_2);
                        errorStack = (_b = error_2.stack) !== null && _b !== void 0 ? _b : 'No stack trace available';
                        this.deps.writeStderr('Bridge initialize error', {
                            message: errorMessage,
                            stack: errorStack,
                            error: String(error_2),
                        });
                        return [2 /*return*/, {
                                id: null,
                                success: false,
                                data: null,
                                error: "Initialization failed: ".concat(errorMessage),
                            }];
                    case 4:
                        this.agent = instance;
                        this.deps.writeStderr('Bridge initialize success');
                        return [2 /*return*/, {
                                id: null,
                                success: true,
                                data: { initialized: true },
                            }];
                }
            });
        });
    };
    BridgeRuntime.prototype.handleSendMessage = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var history, attachments, normalizedAttachments, pageContext, result, submission, content, augmentedHistory, normalizedResult, responsePayload, normalizedRecord, metadataRecord, inscriptionRecord, nestedResultRecord, hashLinkBlockRecord, hashLinkAttributes;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!this.agent) {
                            return [2 /*return*/, {
                                    id: null,
                                    success: false,
                                    error: 'Agent not initialized',
                                }];
                        }
                        if (!payload) {
                            return [2 /*return*/, {
                                    id: null,
                                    success: false,
                                    error: 'Missing message payload',
                                }];
                        }
                        history = this.normalizeHistory(payload.chatHistory);
                        attachments = Array.isArray(payload.attachments)
                            ? payload.attachments
                            : [];
                        normalizedAttachments = (0, attachments_1.normalizeAttachments)(attachments);
                        pageContext = (0, attachments_1.extractPageContext)(attachments);
                        if (!payload.formSubmission) return [3 /*break*/, 2];
                        submission = this.buildFormSubmission(payload.formSubmission, history);
                        return [4 /*yield*/, this.agent.processFormSubmission(submission)];
                    case 1:
                        result = _d.sent();
                        return [3 /*break*/, 5];
                    case 2: return [4 /*yield*/, this.buildMessageContent(payload, normalizedAttachments)];
                    case 3:
                        content = _d.sent();
                        augmentedHistory = this.applyPageContext(history, pageContext);
                        return [4 /*yield*/, this.agent.processMessage(content, augmentedHistory)];
                    case 4:
                        result = _d.sent();
                        _d.label = 5;
                    case 5: return [4 /*yield*/, this.inscriptionService.ensureJsonTopicMetadata(result)];
                    case 6:
                        result = _d.sent();
                        normalizedResult = this.inscriptionService.rewriteHashLinkTopic(result);
                        responsePayload = this.toResponsePayload(normalizedResult, attachments);
                        normalizedRecord = (0, inscriber_helpers_1.toRecord)(responsePayload.response);
                        metadataRecord = normalizedRecord
                            ? (_a = (0, inscriber_helpers_1.toRecord)(normalizedRecord.metadata)) !== null && _a !== void 0 ? _a : undefined
                            : undefined;
                        inscriptionRecord = normalizedRecord
                            ? (_b = (0, inscriber_helpers_1.toRecord)(normalizedRecord.inscription)) !== null && _b !== void 0 ? _b : undefined
                            : undefined;
                        nestedResultRecord = normalizedRecord
                            ? (_c = (0, inscriber_helpers_1.toRecord)(normalizedRecord.result)) !== null && _c !== void 0 ? _c : undefined
                            : undefined;
                        hashLinkBlockRecord = normalizedRecord
                            ? (0, inscriber_helpers_1.toRecord)(normalizedRecord.hashLinkBlock)
                            : null;
                        hashLinkAttributes = hashLinkBlockRecord
                            ? (0, inscriber_helpers_1.toRecord)(hashLinkBlockRecord.attributes)
                            : undefined;
                        this.deps.logBridgeEvent('agent_process_result_payload', normalizedRecord !== null && normalizedRecord !== void 0 ? normalizedRecord : {});
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
                        return [2 /*return*/, {
                                id: null,
                                success: true,
                                data: responsePayload,
                            }];
                }
            });
        });
    };
    BridgeRuntime.prototype.handleDisconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.agent) {
                            return [2 /*return*/, {
                                    id: null,
                                    success: true,
                                    data: { disconnected: true },
                                }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (!(typeof this.agent.cleanup === 'function')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.agent.cleanup()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        this.deps.writeStderr('Bridge disconnect cleanup error', error_3);
                        return [3 /*break*/, 5];
                    case 5:
                        this.agent = null;
                        return [2 /*return*/, {
                                id: null,
                                success: true,
                                data: { disconnected: true },
                            }];
                }
            });
        });
    };
    BridgeRuntime.prototype.handleStatus = function () {
        return {
            id: null,
            success: true,
            data: { connected: Boolean(this.agent) },
        };
    };
    BridgeRuntime.prototype.buildAgentOptions = function (payload) {
        var _a, _b;
        var normalizeNetwork = function (network) {
            if (typeof network === 'string') {
                var candidate = network.toLowerCase();
                if (candidate === 'mainnet') {
                    return 'mainnet';
                }
                if (candidate === 'testnet') {
                    return 'testnet';
                }
            }
            return 'testnet';
        };
        var normalizeOperationalMode = function (mode) {
            if (typeof mode === 'string') {
                var candidate = mode.toLowerCase();
                if (candidate === 'returnbytes') {
                    return 'returnBytes';
                }
                if (candidate === 'autonomous') {
                    return 'autonomous';
                }
            }
            return 'returnBytes';
        };
        var normalizeLlmProvider = function (provider) {
            if (typeof provider !== 'string') {
                return undefined;
            }
            var normalized = provider.trim().toLowerCase();
            if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'openrouter') {
                return normalized;
            }
            return undefined;
        };
        var accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
        var privateKey = typeof payload.privateKey === 'string' ? payload.privateKey.trim() : '';
        var openAIApiKey = typeof payload.openAIApiKey === 'string'
            ? payload.openAIApiKey.trim()
            : '';
        var openAIModelName = typeof payload.openAIModelName === 'string' &&
            payload.openAIModelName.trim().length > 0
            ? payload.openAIModelName
            : undefined;
        var llmProvider = normalizeLlmProvider(payload.llmProvider);
        var userAccountId = typeof payload.userAccountId === 'string' &&
            payload.userAccountId.trim().length > 0
            ? payload.userAccountId
            : undefined;
        var operationalMode = normalizeOperationalMode(payload.operationalMode);
        var disableLogging = (_a = payload.disableLogging) !== null && _a !== void 0 ? _a : false;
        var openRouterApiKey = typeof payload.openRouterApiKey === 'string' &&
            payload.openRouterApiKey.trim().length > 0
            ? payload.openRouterApiKey
            : undefined;
        var openRouterBaseURL = typeof payload.openRouterBaseURL === 'string' &&
            payload.openRouterBaseURL.trim().length > 0
            ? payload.openRouterBaseURL
            : undefined;
        var additionalPlugins = [];
        if (Array.isArray(payload.additionalPlugins)) {
            for (var _i = 0, _c = payload.additionalPlugins; _i < _c.length; _i++) {
                var pluginConfig = _c[_i];
                if (pluginConfig.pluginType === 'swarm') {
                    additionalPlugins.push(new conversational_agent_1.SwarmPlugin(pluginConfig.config));
                }
                // Add other plugin types here
            }
        }
        var options = {
            accountId: accountId,
            privateKey: privateKey,
            network: normalizeNetwork(payload.network),
            openAIApiKey: openAIApiKey,
            openAIModelName: openAIModelName,
            llmProvider: llmProvider,
            userAccountId: userAccountId,
            operationalMode: operationalMode,
            verbose: (_b = payload.verbose) !== null && _b !== void 0 ? _b : true,
            disableLogging: disableLogging,
            openRouterApiKey: openRouterApiKey,
            openRouterBaseURL: openRouterBaseURL,
            additionalPlugins: additionalPlugins,
        };
        var mcpServers = Array.isArray(payload.mcpServers)
            ? payload.mcpServers
            : undefined;
        var disabledPlugins = Array.isArray(payload.disabledPlugins)
            ? Array.from(new Set(payload.disabledPlugins.filter(function (value) {
                return typeof value === 'string' && value.trim().length > 0;
            })))
            : undefined;
        if (mcpServers && mcpServers.length > 0) {
            options.mcpServers = mcpServers;
        }
        if (disabledPlugins && disabledPlugins.length > 0) {
            options.disabledPlugins = disabledPlugins;
        }
        return options;
    };
    BridgeRuntime.prototype.normalizeHistory = function (history) {
        if (!Array.isArray(history)) {
            return [];
        }
        return history
            .map(function (entry) {
            var content = typeof entry.content === 'string' ? entry.content : '';
            var type = entry.type === 'system' ? 'system' : entry.type === 'ai' ? 'ai' : 'human';
            return { type: type, content: content };
        })
            .filter(function (entry) { return entry.content.trim().length > 0; });
    };
    BridgeRuntime.prototype.buildFormSubmission = function (submission, history) {
        var _a, _b;
        var partialInput = submission.partialInput && typeof submission.partialInput === 'object'
            ? submission.partialInput
            : undefined;
        var mutableHistory = history.length > 0
            ? history.map(function (entry) { return ({ type: entry.type, content: entry.content }); })
            : undefined;
        return {
            formId: submission.formId,
            toolName: submission.toolName,
            parameters: (_a = submission.data) !== null && _a !== void 0 ? _a : {},
            timestamp: (_b = submission.timestamp) !== null && _b !== void 0 ? _b : Date.now(),
            context: {
                originalPrompt: submission.originalPrompt,
                partialInput: partialInput,
                chatHistory: mutableHistory,
            },
        };
    };
    BridgeRuntime.prototype.buildMessageContent = function (payload, attachments) {
        return __awaiter(this, void 0, void 0, function () {
            var content, managerCandidate, storeManager, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        content = typeof payload.content === 'string' ? payload.content : '';
                        if (attachments.length === 0) {
                            return [2 /*return*/, content];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        managerCandidate = this.agent.contentStoreManager;
                        storeManager = asContentStoreManager(managerCandidate);
                        return [4 /*yield*/, this.attachmentProcessor.processAttachments(content, attachments, storeManager)];
                    case 2:
                        content = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        this.deps.writeStderr('Attachment processing failed', error_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, content];
                }
            });
        });
    };
    BridgeRuntime.prototype.applyPageContext = function (history, context) {
        if (!context) {
            return history;
        }
        var contextPrompt = (0, attachments_1.buildPageContextPrompt)(context);
        if (contextPrompt.trim().length === 0) {
            return history;
        }
        return __spreadArray(__spreadArray([], history, true), [{ type: 'system', content: contextPrompt }], false);
    };
    BridgeRuntime.prototype.toResponsePayload = function (result, attachments) {
        var _a;
        return {
            response: __assign(__assign({}, result), { metadata: (_a = result.metadata) !== null && _a !== void 0 ? _a : null }),
            attachments: attachments,
        };
    };
    return BridgeRuntime;
}());
exports.BridgeRuntime = BridgeRuntime;
var getStringField = function (value, key) {
    var record = (0, inscriber_helpers_1.toRecord)(value);
    if (!record) {
        return undefined;
    }
    var candidate = record[key];
    return typeof candidate === 'string' ? candidate : undefined;
};
var asContentStoreManager = function (value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    if ('storeContentIfLarge' in value &&
        typeof value.storeContentIfLarge === 'function') {
        return value;
    }
    return undefined;
};
