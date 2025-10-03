#!/usr/bin/env node

import path from 'path';
import { createRequire } from 'module';
import { randomUUID } from 'node:crypto';
import {
  AttachmentProcessor,
  ConversationalAgent,
  setWalletBridgeProvider,
  type ConversationalAgentOptions,
} from '@hashgraphonline/conversational-agent';
import type { StartInscriptionResult } from '@hashgraphonline/conversational-agent';
import { InscriberBuilder } from '@hashgraphonline/standards-agent-kit';
import {
  deriveInscriptionContext,
  getStringField,
  toRecord,
} from './inscriber-helpers';

interface AttachmentDescriptor {
  readonly name: string;
  readonly data: string;
  readonly type: string;
  readonly size: number;
}

type AttachmentData = {
  name: string;
  data: string;
  type: string;
  size: number;
};

interface FormSubmissionPayload {
  readonly formId: string;
  readonly toolName: string;
  readonly data?: Record<string, unknown>;
  readonly timestamp?: number;
  readonly originalPrompt?: string;
  readonly partialInput?: unknown;
}

interface AgentInitializePayload {
  readonly accountId?: string;
  readonly privateKey?: string;
  readonly network?: string;
  readonly openAIApiKey?: string;
  readonly openAIModelName?: string;
  readonly llmProvider?: string;
  readonly userAccountId?: string;
  readonly operationalMode?: string;
  readonly mcpServers?: Array<Record<string, unknown>>;
  readonly verbose?: boolean;
  readonly disableLogging?: boolean;
  readonly openRouterApiKey?: string;
  readonly openRouterBaseURL?: string;
  readonly disabledPlugins?: ReadonlyArray<string>;
}

interface AgentMessagePayload {
  readonly sessionId?: string;
  readonly content?: string;
  readonly chatHistory?: ReadonlyArray<AgentHistoryEntry>;
  readonly attachments?: ReadonlyArray<AttachmentDescriptor>;
  readonly formSubmission?: FormSubmissionPayload;
}

interface BridgeRequest {
  readonly id?: number;
  readonly action: 'initialize' | 'sendMessage' | 'status' | 'disconnect';
  readonly payload?: AgentInitializePayload | AgentMessagePayload;
}

interface BridgeResponse {
  readonly id: number | null;
  readonly success: boolean;
  readonly data?: Record<string, unknown> | null;
  readonly error?: string;
}

interface AgentResponsePayload {
  readonly response: AgentProcessResult;
  readonly attachments: ReadonlyArray<AttachmentDescriptor>;
}

type AgentHistoryEntry = {
  readonly type?: string;
  readonly content?: string;
};

type AgentProcessResult = {
  readonly message?: string;
  readonly output?: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly transactionId?: string;
  readonly scheduleId?: string;
  readonly notes?: string | string[];
  readonly formMessage?: unknown;
  readonly hashLinkBlock?: Record<string, unknown>;
  readonly [key: string]: unknown;
};

type AgentFormSubmission = {
  formId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  context?: {
    originalPrompt?: string;
    partialInput?: Record<string, unknown>;
    chatHistory?: Array<{
      type: 'human' | 'ai' | 'system';
      content: string;
    }>;
  };
};

type AgentModule = {
  readonly ConversationalAgent: typeof ConversationalAgent;
};

const bridgeRequire = createRequire(__filename);
let AgentConstructor: typeof ConversationalAgent | null = null;
let agent: ConversationalAgent | null = null;
const attachmentProcessor = new AttachmentProcessor();

const BRIDGE_TIMEOUT_MS = 60000;
const COMPLETED_TRANSACTION_MARKER = '__COMPLETED_TX';
const BRIDGE_TIMEOUT_OVERRIDES: Record<string, number> = {
  wallet_inscribe_start: 5 * 60 * 1000,
  wallet_execute_tx: 2 * 60 * 1000,
};

type BridgeResponsePayload = {
  readonly id: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
};

const pendingBridgeRequests = new Map<
  string,
  {
    resolve: (value: BridgeResponsePayload) => void;
    reject: (error: Error) => void;
  }
>();

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

const redirectStdout: typeof process.stdout.write = function (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void
): boolean {
  if (typeof encoding === 'function') {
    return process.stderr.write(chunk, encoding);
  }
  return process.stderr.write(chunk, encoding, callback);
};

process.stdout.write = redirectStdout;

const forwardConsoleToStderr = (...args: unknown[]): void => {
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  process.stderr.write(`${message}\n`);
};

console.log = forwardConsoleToStderr;
console.info = forwardConsoleToStderr;
console.warn = forwardConsoleToStderr;

const logBridgeEvent = (
  event: string,
  details?: Record<string, unknown>
): void => {
  if (details) {
    forwardConsoleToStderr(`[bridge] ${event}`, details);
    return;
  }
  forwardConsoleToStderr(`[bridge] ${event}`);
};

const summarizeKeys = (value: unknown): string[] | undefined => {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }
  return Object.keys(record).slice(0, 20);
};

const resolveBridgeResponse = (payload: BridgeResponsePayload): void => {
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

const sendBridgeRequest = (
  action: string,
  payload: Record<string, unknown>
): Promise<BridgeResponsePayload> => {
  const requestId = randomUUID();
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

  return new Promise<BridgeResponsePayload>((resolve, reject) => {
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
        const dataRecord = toRecord(value.data);
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
          error: (error as Error).message,
        });
        reject(error);
      },
    });
  });
};

const configureInscriberBridge = (): void => {
  try {
    InscriberBuilder.setWalletInfoResolver(async () => {
      const response = await sendBridgeRequest('wallet_status', {});
      const record = toRecord(response.data);
      if (!record) {
        return null;
      }

      const connected = record.connected === true;
      if (!connected) {
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

      return {
        accountId,
        network: networkValue,
      };
    });

    InscriberBuilder.setWalletExecutor(
      async (base64: string, network: string) => {
        const response = await sendBridgeRequest('wallet_execute_tx', {
          base64,
          network,
        });
        const record = toRecord(response.data);
        if (!record) {
          throw new Error('Wallet execution missing payload');
        }

        const transactionId = record.transactionId;
        if (typeof transactionId !== 'string') {
          throw new Error('Wallet execution missing transactionId');
        }

        return { transactionId };
      }
    );
  } catch (error) {
    forwardConsoleToStderr('Inscriber builder configuration failed', error);
  }
};

configureInscriberBridge();

const configureWalletBridgeProvider = (): void => {
  try {
    setWalletBridgeProvider({
      status: async () => {
        try {
          const response = await sendBridgeRequest('wallet_status', {});
          const record = toRecord(response.data) ?? {};
          const connected = record.connected === true;
          const accountId =
            typeof record.accountId === 'string' &&
            record.accountId.trim().length > 0
              ? record.accountId
              : undefined;
          const network =
            record.network === 'mainnet' || record.network === 'testnet'
              ? record.network
              : undefined;
          return {
            connected,
            accountId,
            network,
          };
        } catch (error) {
          forwardConsoleToStderr('wallet status bridge failed', error);
          return {
            connected: false,
            accountId: undefined,
            network: undefined,
          };
        }
      },
      executeBytes: async (base64: string, network: string) => {
        const response = await sendBridgeRequest('wallet_execute_tx', {
          base64,
          network,
        });
        const record = toRecord(response.data);
        if (!record || typeof record.transactionId !== 'string') {
          throw new Error('Wallet execution missing transactionId');
        }
        return { transactionId: record.transactionId };
      },
      startInscription: async (
        request: Record<string, unknown>,
        network: 'mainnet' | 'testnet'
      ): Promise<StartInscriptionResult> => {
        const requestRecord = toRecord(request) ?? {};
        logBridgeEvent('wallet_inscribe_start_request', {
          network,
          requestKeys: Object.keys(requestRecord),
        });

        const response = await sendBridgeRequest('wallet_inscribe_start', {
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

        logBridgeEvent(
          'wallet_inscribe_start_response_payload',
          pendingPayload
        );

        return pendingPayload as unknown as StartInscriptionResult;
      },
    });
  } catch (error) {
    forwardConsoleToStderr('Failed to configure wallet bridge provider', error);
  }
};

configureWalletBridgeProvider();

const decodeAttachment = (attachment: AttachmentDescriptor): string | null => {
  try {
    return Buffer.from(attachment.data, 'base64').toString('utf8');
  } catch (error) {
    forwardConsoleToStderr('Attachment decode failed', error);
    return null;
  }
};

const extractPageContextFromAttachments = (
  attachments: ReadonlyArray<AttachmentDescriptor>
): Record<string, unknown> | null => {
  const candidate = attachments.find(
    (attachment) => attachment.name.toLowerCase() === 'page-context.json'
  );

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
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    forwardConsoleToStderr('Page context parse failed', error);
  }

  return null;
};

const buildPageContextPrompt = (context: Record<string, unknown>): string => {
  const sections: string[] = ['Context extracted from the active browser tab:'];

  const pushLine = (label: string, value: unknown) => {
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
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0
      )
      .slice(0, 6);
    if (favicons.length > 0) {
      sections.push(`Favicons: ${favicons.join(', ')}`);
    }
  }

  return sections.join('\n');
};

function writeResponse(response: BridgeResponse): void {
  originalStdoutWrite(`${JSON.stringify(response)}\n`);
}

function resolveAgent(): typeof ConversationalAgent {
  if (AgentConstructor) {
    return AgentConstructor;
  }

  const moduleSpecifier = '@hashgraphonline/conversational-agent';
  const candidates: Array<() => AgentModule> = [
    () => bridgeRequire(moduleSpecifier) as AgentModule,
    () => {
      const resolved = bridgeRequire.resolve(moduleSpecifier, {
        paths: [
          process.cwd(),
          path.join(__dirname, '..'),
          path.join(__dirname, '..', '..'),
        ],
      });
      return bridgeRequire(resolved) as AgentModule;
    },
  ];

  for (const candidate of candidates) {
    try {
      const module = candidate();
      AgentConstructor = module.ConversationalAgent;
      return AgentConstructor;
    } catch (error) {
      if (candidates.indexOf(candidate) === candidates.length - 1) {
        const message = (error as Error).message ?? String(error);
        console.error(
          JSON.stringify({
            type: 'fatal',
            error: `Failed to resolve conversational agent package: ${message}`,
          })
        );
        process.exit(1);
      }
    }
  }

  throw new Error('ConversationalAgent resolution failed unexpectedly');
}

function normalizeHistory(
  history: ReadonlyArray<AgentHistoryEntry> | undefined
): Array<{
  readonly type: 'human' | 'ai' | 'system';
  readonly content: string;
}> {
  if (!history) {
    return [];
  }

  return history.map((entry) => ({
    type:
      entry?.type === 'ai'
        ? 'ai'
        : entry?.type === 'system'
        ? 'system'
        : 'human',
    content: typeof entry.content === 'string' ? entry.content : '',
  }));
}

function normalizeNetwork(network?: string): 'mainnet' | 'testnet' {
  const lower = (network || '').toLowerCase();
  if (lower === 'mainnet') {
    return 'mainnet';
  }
  if (lower !== 'testnet' && lower !== 'previewnet') {
    forwardConsoleToStderr(
      'Unknown network supplied, defaulting to testnet',
      lower
    );
  }
  return 'testnet';
}

function normalizeOperationalMode(mode?: string): 'autonomous' | 'returnBytes' {
  if (mode === 'autonomous') {
    return 'autonomous';
  }
  return 'returnBytes';
}

function normalizeLlmProvider(
  provider?: string
): 'openai' | 'anthropic' | 'openrouter' | undefined {
  if (
    provider === 'openai' ||
    provider === 'anthropic' ||
    provider === 'openrouter'
  ) {
    return provider;
  }
  return undefined;
}

async function handleInitialize(
  payload: AgentInitializePayload | undefined
): Promise<BridgeResponse> {
  if (!payload) {
    return {
      id: null,
      success: false,
      error: 'Missing initialization payload',
    };
  }

  try {
    await agent?.cleanup();
  } catch (error) {
    forwardConsoleToStderr('Agent cleanup failed', error);
  }

  const accountId =
    typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
  const openAIApiKey =
    typeof payload.openAIApiKey === 'string' ? payload.openAIApiKey.trim() : '';

  if (accountId.length === 0 || openAIApiKey.length === 0) {
    return {
      id: null,
      success: false,
      error: 'Account ID and OpenAI API key are required',
    };
  }

  const AgentCtor = resolveAgent();
  const operationalMode = normalizeOperationalMode(payload.operationalMode);
  const privateKey =
    typeof payload.privateKey === 'string' ? payload.privateKey : '';
  const openAIModelName =
    typeof payload.openAIModelName === 'string'
      ? payload.openAIModelName
      : undefined;
  const userAccountId =
    typeof payload.userAccountId === 'string' &&
    payload.userAccountId.trim().length > 0
      ? payload.userAccountId
      : accountId;
  const disableLogging =
    typeof payload.disableLogging === 'boolean'
      ? payload.disableLogging
      : undefined;
  const openRouterApiKey =
    typeof payload.openRouterApiKey === 'string'
      ? payload.openRouterApiKey
      : undefined;
  const openRouterBaseURL =
    typeof payload.openRouterBaseURL === 'string'
      ? payload.openRouterBaseURL
      : undefined;
  const mcpServers = Array.isArray(payload.mcpServers)
    ? payload.mcpServers
    : undefined;
  const disabledPlugins = Array.isArray(payload.disabledPlugins)
    ? Array.from(
        new Set(
          payload.disabledPlugins.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0
          )
        )
      )
    : undefined;

  const options: ConversationalAgentOptions = {
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
    (options as unknown as { mcpServers?: unknown }).mcpServers = mcpServers;
  }
  if (disabledPlugins && disabledPlugins.length > 0) {
    (
      options as ConversationalAgentOptions & { disabledPlugins?: string[] }
    ).disabledPlugins = disabledPlugins;
  }

  const instance = new AgentCtor(options);

  try {
    await instance.initialize();
  } catch (error) {
    const failure: BridgeResponse = {
      id: null,
      success: false,
      data: null,
      error: `Initialization failed: ${
        (error as Error).message ?? String(error)
      }`,
    };
    forwardConsoleToStderr('Bridge initialize error', failure.error);
    writeResponse(failure);
    return failure;
  }
  agent = instance;

  const success: BridgeResponse = {
    id: null,
    success: true,
    data: { initialized: true } as Record<string, unknown>,
  };
  forwardConsoleToStderr('Bridge initialize success');
  writeResponse(success);
  return success;
}

function buildFormSubmission(
  submission: FormSubmissionPayload,
  history: ReadonlyArray<{
    readonly type: 'human' | 'ai' | 'system';
    readonly content: string;
  }>
): AgentFormSubmission {
  const partialInput =
    submission.partialInput && typeof submission.partialInput === 'object'
      ? (submission.partialInput as Record<string, unknown>)
      : undefined;

  const normalizedHistory = history.map<{
    type: 'human' | 'ai' | 'system';
    content: string;
  }>((entry) => ({
    type:
      entry.type === 'system' ? 'system' : entry.type === 'ai' ? 'ai' : 'human',
    content: entry.content,
  }));

  const mutableHistory =
    normalizedHistory.length > 0
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

function extractContent(payload: AgentMessagePayload): string {
  if (typeof payload.content === 'string') {
    return payload.content;
  }
  return '';
}

function toResponsePayload(
  result: AgentProcessResult,
  attachments: ReadonlyArray<AttachmentDescriptor>
): AgentResponsePayload {
  return {
    response: {
      ...result,
      metadata: result.metadata ?? null,
    },
    attachments,
  };
}

async function handleSendMessage(
  payload: AgentMessagePayload | undefined
): Promise<BridgeResponse> {
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

  const history = normalizeHistory(
    payload.chatHistory as AgentHistoryEntry[] | undefined
  );
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : [];
  const normalizedAttachments: AttachmentData[] = attachments
    .map((attachment) => {
      if (
        !attachment ||
        typeof attachment.name !== 'string' ||
        typeof attachment.data !== 'string'
      ) {
        return null;
      }

      const type =
        typeof attachment.type === 'string' && attachment.type.length > 0
          ? attachment.type
          : 'application/octet-stream';
      const size =
        typeof attachment.size === 'number' && Number.isFinite(attachment.size)
          ? attachment.size
          : 0;

      return {
        name: attachment.name,
        data: attachment.data,
        type,
        size,
      } satisfies AttachmentData;
    })
    .filter((attachment): attachment is AttachmentData => Boolean(attachment));

  const pageContext = extractPageContextFromAttachments(attachments);

  let result: AgentProcessResult;

  if (payload.formSubmission) {
    const submission = buildFormSubmission(payload.formSubmission, history);
    result = await agent.processFormSubmission(submission);
  } else {
    let content = extractContent(payload);

    if (normalizedAttachments.length > 0) {
      try {
        const managerCandidate = (
          agent as ConversationalAgent & {
            contentStoreManager?: unknown;
          }
        ).contentStoreManager;

        const storeManager =
          managerCandidate && typeof managerCandidate === 'object'
            ? managerCandidate
            : undefined;

        content = await attachmentProcessor.processAttachments(
          content,
          normalizedAttachments,
          storeManager
        );
      } catch (error) {
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
  const normalizedRecord = toRecord(normalizedResult);
  logBridgeEvent('agent_process_result_payload', normalizedRecord ?? {});
  const metadataRecord = normalizedRecord
    ? toRecord(normalizedRecord.metadata) ?? undefined
    : undefined;
  const inscriptionRecord = normalizedRecord
    ? toRecord(normalizedRecord.inscription) ?? undefined
    : undefined;
  const nestedResultRecord = normalizedRecord
    ? toRecord(normalizedRecord.result) ?? undefined
    : undefined;
  const hashLinkBlockRecord = normalizedRecord
    ? toRecord(normalizedRecord.hashLinkBlock)
    : null;
  const hashLinkAttributes = hashLinkBlockRecord
    ? toRecord(hashLinkBlockRecord.attributes)
    : undefined;

  logBridgeEvent('agent_process_result', {
    hasJsonTopicId: Boolean(getStringField(normalizedRecord, 'jsonTopicId')),
    jsonTopicId: getStringField(normalizedRecord, 'jsonTopicId'),
    metadataKeys: summarizeKeys(metadataRecord),
    inscriptionKeys: summarizeKeys(inscriptionRecord),
    resultKeys: summarizeKeys(nestedResultRecord),
    hashLinkBlockKeys: summarizeKeys(hashLinkAttributes),
  });

  const responsePayload = toResponsePayload(normalizedResult, attachments);

  return {
    id: null,
    success: true,
    data: responsePayload as unknown as Record<string, unknown>,
  };
}

async function handleDisconnect(): Promise<BridgeResponse> {
  if (
    agent &&
    typeof (agent as { cleanup?: () => Promise<void> }).cleanup === 'function'
  ) {
    await (agent as { cleanup: () => Promise<void> }).cleanup();
  }
  agent = null;
  return {
    id: null,
    success: true,
    data: { disconnected: true },
  };
}

function handleStatus(): BridgeResponse {
  return {
    id: null,
    success: true,
    data: { connected: agent !== null },
  };
}

async function dispatchRequest(
  request: BridgeRequest
): Promise<BridgeResponse> {
  switch (request.action) {
    case 'initialize':
      return handleInitialize(request.payload as AgentInitializePayload);
    case 'sendMessage':
      return handleSendMessage(request.payload as AgentMessagePayload);
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
process.stdin.on('data', (chunk: string) => {
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch (error) {
      writeResponse({
        id: null,
        success: false,
        error: `Invalid JSON request: ${
          (error as Error).message ?? String(error)
        }`,
      });
      delimiterIndex = buffer.indexOf('\n');
      continue;
    }

    const parsedRecord = toRecord(parsed);
    if (parsedRecord && parsedRecord.bridgeResponse) {
      const responseRecord = toRecord(parsedRecord.bridgeResponse);
      if (responseRecord && typeof responseRecord.id === 'string') {
        resolveBridgeResponse(responseRecord as BridgeResponsePayload);
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
    if (
      action !== 'initialize' &&
      action !== 'sendMessage' &&
      action !== 'status' &&
      action !== 'disconnect'
    ) {
      writeResponse({
        id: null,
        success: false,
        error: `Unknown action: ${String(action)}`,
      });
      delimiterIndex = buffer.indexOf('\n');
      continue;
    }

    const request: BridgeRequest = {
      id: typeof parsedRecord.id === 'number' ? parsedRecord.id : undefined,
      action,
      payload: parsedRecord.payload as
        | AgentInitializePayload
        | AgentMessagePayload
        | undefined,
    };

    dispatchRequest(request)
      .then((response) => {
        writeResponse({ ...response, id: response.id ?? request.id ?? null });
      })
      .catch((error) => {
        writeResponse({
          id: request.id ?? null,
          success: false,
          error: (error as Error).message ?? String(error),
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
    const parsed = JSON.parse(buffer.trim()) as unknown;
    const parsedRecord = toRecord(parsed);

    if (parsedRecord && parsedRecord.bridgeResponse) {
      const responseRecord = toRecord(parsedRecord.bridgeResponse);
      if (responseRecord && typeof responseRecord.id === 'string') {
        resolveBridgeResponse(responseRecord as BridgeResponsePayload);
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
    if (
      action !== 'initialize' &&
      action !== 'sendMessage' &&
      action !== 'status' &&
      action !== 'disconnect'
    ) {
      writeResponse({
        id: null,
        success: false,
        error: `Unknown action: ${String(action)}`,
      });
      process.exit(1);
      return;
    }

    const request: BridgeRequest = {
      id: typeof parsedRecord.id === 'number' ? parsedRecord.id : undefined,
      action,
      payload: parsedRecord.payload as
        | AgentInitializePayload
        | AgentMessagePayload
        | undefined,
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
          error: (error as Error).message ?? String(error),
        });
        process.exit(1);
      });
  } catch (error) {
    writeResponse({
      id: null,
      success: false,
      error: `Invalid JSON request: ${
        (error as Error).message ?? String(error)
      }`,
    });
    process.exit(1);
  }
});
