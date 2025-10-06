export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  name: string;
  mode: string;
  topicId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  isActive: boolean;
  messages: ChatMessage[];
}

export interface EntityAssociation {
  id?: number;
  entityId: string;
  entityName: string;
  entityType: string;
  transactionId?: string | null;
  sessionId?: string | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}
