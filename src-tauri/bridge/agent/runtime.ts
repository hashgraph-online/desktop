import {
  AttachmentProcessor,
  BasePlugin,
  ConversationalAgent,
  SwarmConfig,
  SwarmPlugin,
} from '@hashgraphonline/conversational-agent';
import type {
  AttachmentData,
  ConversationalAgentOptions,
  WalletNetwork,
} from './types';
import type {
  AgentFormSubmission,
  AgentHistoryEntry,
  AgentInitializePayload,
  AgentMessagePayload,
  AgentProcessResult,
  AgentResponsePayload,
  AttachmentDescriptor,
  BridgeRequest,
  BridgeResponse,
} from './types';
import { buildPageContextPrompt, extractPageContext, normalizeAttachments } from './attachments';
import { InscriptionService, toDashedTransactionId } from './inscription';
import { configureWalletBridge } from './wallet';
import { summarizeKeys } from './logging';
import type { BridgeChannel } from './bridge-channel';
import { toRecord } from '../inscriber-helpers';
import type { ContentStoreManager } from '@hashgraphonline/conversational-agent/dist/types/services/content-store-manager';

type ChatHistoryItem = {
  type: 'human' | 'ai' | 'system';
  content: string;
};

type LogBridgeEvent = (event: string, details?: Record<string, unknown>) => void;
type WriteStderr = (...args: unknown[]) => void;

type ConversationalAgentInstance = InstanceType<typeof ConversationalAgent>;

export interface BridgeRuntimeDependencies {
  readonly channel: BridgeChannel;
  readonly logBridgeEvent: LogBridgeEvent;
  readonly writeStderr: WriteStderr;
}

export class BridgeRuntime {
  private agent: ConversationalAgentInstance | null = null;
  private readonly attachmentProcessor = new AttachmentProcessor();
  private readonly inscriptionService: InscriptionService;

  constructor(private readonly deps: BridgeRuntimeDependencies) {
    this.inscriptionService = new InscriptionService(deps.logBridgeEvent);
    configureWalletBridge({
      channel: deps.channel,
      logBridgeEvent: deps.logBridgeEvent,
      writeStderr: deps.writeStderr,
    });
  }

  async dispatch(request: BridgeRequest): Promise<BridgeResponse> {
    const startTime = Date.now();
    this.deps.logBridgeEvent('bridge_dispatch_start', {
      action: request.action,
      requestId: request.id,
    });

    switch (request.action) {
      case 'initialize':
        return this.wrapResponse(
          request,
          startTime,
          this.handleInitialize(request.payload as AgentInitializePayload | undefined)
        );
      case 'sendMessage':
        return this.wrapResponse(
          request,
          startTime,
          this.handleSendMessage(request.payload as AgentMessagePayload | undefined)
        );
      case 'status':
        return this.wrapResponse(request, startTime, Promise.resolve(this.handleStatus()));
      case 'disconnect':
        return this.wrapResponse(request, startTime, this.handleDisconnect());
      default:
        return this.wrapResponse(
          request,
          startTime,
          Promise.resolve({
            id: request.id ?? null,
            success: false,
            error: `Unknown action: ${String(request.action)}`,
          })
        );
    }
  }

  private async wrapResponse(
    request: BridgeRequest,
    startTime: number,
    responsePromise: Promise<BridgeResponse>
  ): Promise<BridgeResponse> {
    try {
      const response = await responsePromise;
      this.deps.logBridgeEvent('bridge_dispatch_success', {
        action: request.action,
        requestId: request.id,
        durationMs: Date.now() - startTime,
        success: response.success,
      });
      return response;
    } catch (error) {
      this.deps.logBridgeEvent('bridge_dispatch_failure', {
        action: request.action,
        requestId: request.id,
        durationMs: Date.now() - startTime,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async handleInitialize(
    payload: AgentInitializePayload | undefined
  ): Promise<BridgeResponse> {
    if (!payload) {
      return {
        id: null,
        success: false,
        error: 'Missing initialize payload',
      };
    }

    const options = this.buildAgentOptions(payload);

    const instance = new ConversationalAgent(options);

    try {
      await instance.initialize();
    } catch (error) {
      const errorMessage = (error as Error).message ?? String(error);
      const errorStack = (error as Error).stack ?? 'No stack trace available';

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

  private async handleSendMessage(
    payload: AgentMessagePayload | undefined
  ): Promise<BridgeResponse> {
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
    const normalizedAttachments = normalizeAttachments(attachments);
    const pageContext = extractPageContext(attachments);

    let result: AgentProcessResult;

    if (payload.formSubmission) {
      const submission = this.buildFormSubmission(payload.formSubmission, history);
      result = await this.agent.processFormSubmission(submission);
    } else {
      const content = await this.buildMessageContent(payload, normalizedAttachments);
      const augmentedHistory = this.applyPageContext(history, pageContext);
      result = await this.agent.processMessage(content, augmentedHistory);
    }

    result = await this.inscriptionService.ensureJsonTopicMetadata(result);
    const normalizedResult = this.inscriptionService.rewriteHashLinkTopic(result);
    const responsePayload = this.toResponsePayload(normalizedResult, attachments);

    const normalizedRecord = toRecord(responsePayload.response);
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

    this.deps.logBridgeEvent('agent_process_result_payload', normalizedRecord ?? {});
    this.deps.logBridgeEvent('agent_process_result', {
      hasJsonTopicId: Boolean(getStringField(normalizedRecord, 'jsonTopicId')),
      jsonTopicId: getStringField(normalizedRecord, 'jsonTopicId'),
      metadataKeys: summarizeKeys(metadataRecord),
      inscriptionKeys: summarizeKeys(inscriptionRecord),
      resultKeys: summarizeKeys(nestedResultRecord),
      hashLinkBlockKeys: summarizeKeys(hashLinkAttributes),
      hasHashLinkBlock: Boolean(hashLinkBlockRecord),
      fullMetadata: metadataRecord,
    });

    return {
      id: null,
      success: true,
      data: responsePayload as unknown as Record<string, unknown>,
    };
  }

  private async handleDisconnect(): Promise<BridgeResponse> {
    if (!this.agent) {
      return {
        id: null,
        success: true,
        data: { disconnected: true } as Record<string, unknown>,
      };
    }

    try {
      if (typeof (this.agent as { cleanup?: () => Promise<void> }).cleanup === 'function') {
        await (this.agent as { cleanup: () => Promise<void> }).cleanup();
      }
    } catch (error) {
      this.deps.writeStderr('Bridge disconnect cleanup error', error);
    }

    this.agent = null;
    return {
      id: null,
      success: true,
      data: { disconnected: true } as Record<string, unknown>,
    };
  }

  private handleStatus(): BridgeResponse {
    return {
      id: null,
      success: true,
      data: { connected: Boolean(this.agent) } as Record<string, unknown>,
    };
  }

  private buildAgentOptions(
    payload: AgentInitializePayload
  ): ConversationalAgentOptions {
    const normalizeNetwork = (network?: string): 'mainnet' | 'testnet' => {
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

    const normalizeOperationalMode = (
      mode?: string
    ): 'autonomous' | 'returnBytes' => {
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

    const normalizeLlmProvider = (
      provider?: string
    ): 'openai' | 'anthropic' | 'openrouter' | undefined => {
      if (typeof provider !== 'string') {
        return undefined;
      }
      const normalized = provider.trim().toLowerCase();
      if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'openrouter') {
        return normalized;
      }
      return undefined;
    };

    const accountId =
      typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
    const privateKey =
      typeof payload.privateKey === 'string' ? payload.privateKey.trim() : '';
    const openAIApiKey =
      typeof payload.openAIApiKey === 'string'
        ? payload.openAIApiKey.trim()
        : '';
    const openAIModelName =
      typeof payload.openAIModelName === 'string' &&
      payload.openAIModelName.trim().length > 0
        ? payload.openAIModelName
        : undefined;
    const llmProvider = normalizeLlmProvider(payload.llmProvider);
    const userAccountId =
      typeof payload.userAccountId === 'string' &&
      payload.userAccountId.trim().length > 0
        ? payload.userAccountId
        : undefined;
    const operationalMode = normalizeOperationalMode(payload.operationalMode);
    const disableLogging = payload.disableLogging ?? false;
    const openRouterApiKey =
      typeof payload.openRouterApiKey === 'string' &&
      payload.openRouterApiKey.trim().length > 0
        ? payload.openRouterApiKey
        : undefined;
    const openRouterBaseURL =
      typeof payload.openRouterBaseURL === 'string' &&
      payload.openRouterBaseURL.trim().length > 0
        ? payload.openRouterBaseURL
        : undefined;
        
    const additionalPlugins: BasePlugin[] = [];
    if (Array.isArray(payload.additionalPlugins)) {
      for (const pluginConfig of payload.additionalPlugins) {
        if (pluginConfig.pluginType === 'swarm') {
          additionalPlugins.push(new SwarmPlugin(pluginConfig.config as unknown as SwarmConfig));
        }
        // Add other plugin types here
      }
    }    

    const options: ConversationalAgentOptions = {
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
      additionalPlugins,
    };

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

    if (mcpServers && mcpServers.length > 0) {
      (options as unknown as { mcpServers?: unknown }).mcpServers = mcpServers;
    }
    if (disabledPlugins && disabledPlugins.length > 0) {
      (
        options as ConversationalAgentOptions & { disabledPlugins?: string[] }
      ).disabledPlugins = disabledPlugins;
    }

    return options;
  }

  private normalizeHistory(
    history: ReadonlyArray<AgentHistoryEntry> | undefined
  ): ChatHistoryItem[] {
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .map<ChatHistoryItem>((entry) => {
        const content = typeof entry.content === 'string' ? entry.content : '';
        const type: ChatHistoryItem['type'] =
          entry.type === 'system' ? 'system' : entry.type === 'ai' ? 'ai' : 'human';
        return { type, content };
      })
      .filter((entry) => entry.content.trim().length > 0);
  }

  private buildFormSubmission(
    submission: FormSubmissionPayload,
    history: ChatHistoryItem[]
  ): AgentFormSubmission {
    const partialInput =
      submission.partialInput && typeof submission.partialInput === 'object'
        ? (submission.partialInput as Record<string, unknown>)
        : undefined;

    const mutableHistory =
      history.length > 0
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

  private async buildMessageContent(
    payload: AgentMessagePayload,
    attachments: AttachmentData[]
  ): Promise<string> {
    let content = typeof payload.content === 'string' ? payload.content : '';

    if (attachments.length === 0) {
      return content;
    }

    try {
      const managerCandidate = (this.agent as unknown as {
        contentStoreManager?: unknown;
      }).contentStoreManager;

      const storeManager = asContentStoreManager(managerCandidate);

      content = await this.attachmentProcessor.processAttachments(
        content,
        attachments,
        storeManager
      );
    } catch (error) {
      this.deps.writeStderr('Attachment processing failed', error);
    }

    return content;
  }

  private applyPageContext(
    history: ChatHistoryItem[],
    context: Record<string, unknown> | null
  ): ChatHistoryItem[] {
    if (!context) {
      return history;
    }

    const contextPrompt = buildPageContextPrompt(context);
    if (contextPrompt.trim().length === 0) {
      return history;
    }

    return [...history, { type: 'system', content: contextPrompt }];
  }

  private toResponsePayload(
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
}

type FormSubmissionPayload = NonNullable<AgentMessagePayload['formSubmission']>;

const getStringField = (
  value: unknown,
  key: string
): string | undefined => {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }
  const candidate = record[key];
  return typeof candidate === 'string' ? candidate : undefined;
};

const asContentStoreManager = (
  value: unknown
): ContentStoreManager | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (
    'storeContentIfLarge' in value &&
    typeof (value as { storeContentIfLarge?: unknown }).storeContentIfLarge === 'function'
  ) {
    return value as ContentStoreManager;
  }
  return undefined;
};
