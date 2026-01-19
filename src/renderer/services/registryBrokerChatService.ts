/**
 * Registry Broker Chat Service
 *
 * Provides chat functionality via the HOL Registry Broker API.
 * Handles session creation, message sending, and history retrieval.
 */

const DEFAULT_BASE_URL = 'https://hol.org/registry/api/v1';

interface ChatSession {
  sessionId: string;
  agentUaid?: string;
  agentName?: string;
  createdAt?: string;
  encryption?: {
    supported: boolean;
    status?: string;
  };
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageResult {
  success: boolean;
  response?: {
    content?: string;
    messageId?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

interface ChatHistoryResult {
  success: boolean;
  messages?: ChatMessage[];
  error?: string;
}

interface CreateSessionResult {
  success: boolean;
  session?: ChatSession;
  error?: string;
}

interface CreateSessionApiResponse {
  sessionId?: string;
  encryption?: {
    supported?: boolean;
    status?: string;
  };
}

interface SendMessageApiResponse {
  content?: string;
  messageId?: string;
  response?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface ChatHistoryApiResponse {
  entries?: Array<{
    id?: string;
    role?: string;
    content?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
  messages?: Array<{
    id?: string;
    role?: string;
    content?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
}

class ChatServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChatServiceError';
    this.status = status;
  }
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error || errorBody.message) {
        errorMessage = errorBody.error || errorBody.message;
      }
    } catch {
      // Use default error message
    }
    throw new ChatServiceError(errorMessage, response.status);
  }

  return response.json() as Promise<T>;
}

/**
 * Create a new chat session with an agent
 */
export async function createChatSession(
  agentUaid: string,
  options: {
    senderUaid?: string;
    historyTtlSeconds?: number;
    encryptionRequested?: boolean;
  } = {},
  baseUrl?: string
): Promise<CreateSessionResult> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const body: Record<string, unknown> = {
      uaid: agentUaid,
    };

    if (options.senderUaid) {
      body.senderUaid = options.senderUaid;
    }
    if (options.historyTtlSeconds !== undefined) {
      body.historyTtlSeconds = options.historyTtlSeconds;
    }
    if (options.encryptionRequested !== undefined) {
      body.encryptionRequested = options.encryptionRequested;
    }

    const response = await fetchJson<CreateSessionApiResponse>(
      `${url}/chat/session`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      success: true,
      session: {
        sessionId: response.sessionId ?? '',
        agentUaid,
        createdAt: new Date().toISOString(),
        encryption: response.encryption
          ? {
              supported: response.encryption.supported ?? false,
              status: response.encryption.status,
            }
          : undefined,
      },
    };
  } catch (error) {
    const message =
      error instanceof ChatServiceError
        ? `Chat service error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

/**
 * Send a message in a chat session
 */
export async function sendChatMessage(
  sessionId: string,
  message: string,
  options: {
    uaid?: string;
    agentUrl?: string;
    streaming?: boolean;
  } = {},
  baseUrl?: string
): Promise<SendMessageResult> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const body: Record<string, unknown> = {
      sessionId,
      message,
    };

    if (options.uaid) {
      body.uaid = options.uaid;
    }
    if (options.agentUrl) {
      body.agentUrl = options.agentUrl;
    }
    if (options.streaming !== undefined) {
      body.streaming = options.streaming;
    }

    const response = await fetchJson<SendMessageApiResponse>(
      `${url}/chat/message`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      success: true,
      response: {
        content: response.content ?? response.response ?? '',
        messageId: response.messageId,
        timestamp: response.timestamp ?? new Date().toISOString(),
        metadata: response.metadata,
      },
    };
  } catch (error) {
    const message =
      error instanceof ChatServiceError
        ? `Chat service error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
  sessionId: string,
  options: {
    limit?: number;
    before?: string;
    after?: string;
  } = {},
  baseUrl?: string
): Promise<ChatHistoryResult> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const params = new URLSearchParams();

    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.before) {
      params.set('before', options.before);
    }
    if (options.after) {
      params.set('after', options.after);
    }

    const queryString = params.toString();
    const endpoint = `${url}/chat/session/${encodeURIComponent(sessionId)}/history${queryString ? `?${queryString}` : ''}`;

    const response = await fetchJson<ChatHistoryApiResponse>(endpoint, {
      method: 'GET',
    });

    const entries = response.entries ?? response.messages ?? [];
    const messages: ChatMessage[] = entries.map((entry) => ({
      id: entry.id,
      role: (entry.role as 'user' | 'assistant' | 'system') ?? 'assistant',
      content: entry.content ?? '',
      timestamp: entry.timestamp,
      metadata: entry.metadata,
    }));

    return { success: true, messages };
  } catch (error) {
    const message =
      error instanceof ChatServiceError
        ? `Chat service error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

/**
 * End a chat session
 */
export async function endChatSession(
  sessionId: string,
  baseUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;

    await fetch(`${url}/chat/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof ChatServiceError
        ? `Chat service error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

/**
 * Send a connection request to an agent via broker
 * This creates a session and sends an initial connection message
 */
export async function sendConnectionRequest(
  targetUaid: string,
  options: {
    senderUaid?: string;
    message?: string;
  } = {},
  baseUrl?: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const sessionResult = await createChatSession(
      targetUaid,
      {
        senderUaid: options.senderUaid,
        encryptionRequested: false,
      },
      baseUrl
    );

    if (!sessionResult.success || !sessionResult.session) {
      return { success: false, error: sessionResult.error };
    }

    const sessionId = sessionResult.session.sessionId;

    if (options.message) {
      const messageResult = await sendChatMessage(
        sessionId,
        options.message,
        { uaid: targetUaid },
        baseUrl
      );

      if (!messageResult.success) {
        return {
          success: false,
          error: `Session created but failed to send message: ${messageResult.error}`,
          sessionId,
        };
      }
    }

    return { success: true, sessionId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export { ChatServiceError };
