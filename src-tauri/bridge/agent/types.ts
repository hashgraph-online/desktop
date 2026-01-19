import type {
  BasePlugin,
  ConversationalAgentOptions,
  StartInscriptionResult,
  WalletBridgeProvider,
  WalletNetwork,
} from '@hashgraphonline/conversational-agent';

export interface AttachmentDescriptor {
  readonly name: string;
  readonly data: string;
  readonly type: string;
  readonly size: number;
}

export interface AttachmentData {
  readonly name: string;
  readonly data: string;
  readonly type: string;
  readonly size: number;
}

export interface FormSubmissionPayload {
  readonly formId: string;
  readonly toolName: string;
  readonly data?: Record<string, unknown>;
  readonly timestamp?: number;
  readonly originalPrompt?: string;
  readonly partialInput?: unknown;
}

export interface AgentInitializePayload {
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
  readonly additionalPlugins?: Array<{ pluginType: string; config: Record<string, unknown>}>;
}

export interface AgentMessagePayload {
  readonly sessionId?: string;
  readonly content?: string;
  readonly chatHistory?: ReadonlyArray<AgentHistoryEntry>;
  readonly attachments?: ReadonlyArray<AttachmentDescriptor>;
  readonly formSubmission?: FormSubmissionPayload;
}

export interface BridgeRequest {
  readonly id?: number;
  readonly action: 'initialize' | 'sendMessage' | 'status' | 'disconnect';
  readonly payload?: AgentInitializePayload | AgentMessagePayload;
}

export interface BridgeResponse {
  readonly id: number | null;
  readonly success: boolean;
  readonly data?: Record<string, unknown> | null;
  readonly error?: string;
}

export interface BridgeResponsePayload {
  readonly id: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

export interface AgentResponsePayload {
  readonly response: AgentProcessResult;
  readonly attachments: ReadonlyArray<AttachmentDescriptor>;
}

export interface AgentFormSubmission {
  readonly formId: string;
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
  readonly timestamp: number;
  readonly context?: {
    readonly originalPrompt?: string;
    readonly partialInput?: Record<string, unknown>;
    readonly chatHistory?: Array<{
      readonly type: 'human' | 'ai' | 'system';
      readonly content: string;
    }>;
  };
}

export interface AgentHistoryEntry {
  readonly type?: string;
  readonly content?: string;
}

export interface AgentProcessResult {
  readonly message?: string;
  readonly output?: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly transactionId?: string;
  readonly scheduleId?: string;
  readonly notes?: string | string[];
  readonly formMessage?: unknown;
  readonly hashLinkBlock?: Record<string, unknown>;
  readonly inscription?: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly jsonTopicId?: string;
  readonly [key: string]: unknown;
}

export type { ConversationalAgentOptions, StartInscriptionResult, WalletBridgeProvider, WalletNetwork };
