import { Logger } from '../utils/logger';
import { EntityResolver } from '@hashgraphonline/conversational-agent';
import type {
  IMessageService,
  ChatHistory,
  AgentProcessResult,
  SessionContext,
} from '../interfaces/services';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import { SafeConversationalAgent } from './safe-conversational-agent';
import { ParameterService } from './parameter-service';
import { TransactionProcessor } from './transaction-processor';
import {
  AttachmentProcessor,
  type AttachmentData,
  type ContentStoreManager,
} from './attachment-processor';

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    transactionId?: string;
    scheduleId?: string;
    notes?: string[];
    transactionBytes?: string;
    [key: string]: unknown;
  };
}



/**
 * Service for processing messages and handling communication with the agent
 */
export class MessageService implements IMessageService {
  private logger: Logger;
  private agent: SafeConversationalAgent | null = null;
  private entityResolver: EntityResolver | null = null;
  private parameterService: ParameterService | null = null;
  private sessionContext: SessionContext | null = null;
  private transactionProcessor: TransactionProcessor;
  private attachmentProcessor: AttachmentProcessor;
  private onEntityStored?: (
    entityId: string,
    entityName: string,
    entityType: string,
    transactionId?: string
  ) => void;

  constructor() {
    this.logger = new Logger({ module: 'MessageService' });
    this.transactionProcessor = new TransactionProcessor();
    this.attachmentProcessor = new AttachmentProcessor();
  }

  /**
   * Set the agent instance for message processing
   */
  setAgent(agent: SafeConversationalAgent): void {
    this.agent = agent;
  }

  /**
   * Set the entity resolver for entity extraction
   */
  setEntityResolver(entityResolver: EntityResolver): void {
    this.entityResolver = entityResolver;
  }

  /**
   * Set the parameter service for parameter processing
   */
  setParameterService(parameterService: ParameterService): void {
    this.parameterService = parameterService;
  }

  /**
   * Set session context for message processing
   */
  setSessionContext(context: SessionContext): void {
    this.sessionContext = context;
  }

  /**
   * Set callback for entity storage events
   */
  setOnEntityStored(
    callback: (
      entityId: string,
      entityName: string,
      entityType: string,
      transactionId?: string
    ) => void
  ): void {
    this.onEntityStored = callback;
  }

  /**
   * Send message to agent
   */
  async sendMessage(
    content: string,
    chatHistory: ChatHistory[] = []
  ): Promise<{
    success: boolean;
    response?: AgentMessage;
    error?: string;
  }> {
    if (!this.agent) {
      return {
        success: false,
        error: 'Agent not initialized',
      };
    }

    try {
      this.logger.info('Sending message to agent', {
        originalContent: content,
        historyLength: chatHistory.length,
      });

      const baseHistory = chatHistory.map((h) => ({
        role: h.type === 'human' ? ('user' as const) : ('assistant' as const),
        content: h.content,
      }));

      let historyWithSystems: Array<Record<string, unknown>> =
        baseHistory as unknown as Array<Record<string, unknown>>;

      try {
        if (this.agent?.memoryManager) {
          const entities = this.agent.memoryManager.getEntityAssociations();
          if (entities && Array.isArray(entities) && entities.length > 0) {
            const recent = entities.slice(-5);
            const systemEntries = recent.map((e) => {
              const entity = e as unknown as {
                entityId?: string;
                entityType?: string;
                entityName?: string;
                usage?: string;
                hrl?: string;
              };
              const payload = {
                entityId: entity.entityId,
                entityType: entity.entityType,
                entityName: entity.entityName,
                ...(entity.usage ? { usage: entity.usage } : {}),
                ...(entity.hrl ? { hrl: entity.hrl } : {}),
              };
              return {
                type: 'system',
                content: `[entity-association] ${JSON.stringify(payload)}`,
              } as Record<string, unknown>;
            });
            historyWithSystems = [...historyWithSystems, ...systemEntries];
          }
        }
      } catch {}

      const response = await this.agent.processMessage(
        content,
        historyWithSystems
      );

      if (response.error) {
        this.logger.warn('Agent returned error:', response.error);

        if (
          response.error.includes(
            'Received tool input did not match expected schema'
          )
        ) {
          response.message =
            'I encountered an issue formatting the transfer request. Please try rephrasing your request, for example: "Send 1 HBAR to account 0.0.800"';
          response.output = response.message;
        }
      }

      const transactionData =
        await this.transactionProcessor.processTransactionData(null, response);

      const agentMessage: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response.error || response.message || response.output || '',
        timestamp: new Date(),
        metadata: {
          ...response.metadata,
          transactionId: response.transactionId,
          scheduleId: response.scheduleId,
          notes: response.notes,
          transactionBytes: transactionData.transactionBytes,
          parsedTransaction: transactionData.parsedTransaction,
          description: response.description,
          isError: !!response.error,
          formMessage: response.formMessage,
          hashLinkBlock:
            response.hashLinkBlock || response.metadata?.hashLinkBlock,
        },
      };

      if (this.entityResolver && !response.error) {
        try {
          const entities = await this.entityResolver.extractEntities(
            response,
            content
          );
          for (const entity of entities) {
            if (
              entity.id &&
              entity.name &&
              entity.type &&
              this.onEntityStored
            ) {
              this.onEntityStored(
                entity.id,
                entity.name,
                entity.type,
                response.transactionId
              );
            }
          }
        } catch (entityError) {
          this.logger.warn(
            'Failed to extract and store entities from response:',
            entityError
          );
        }
      }

      return {
        success: true,
        response: agentMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message';
      this.logger.error('Failed to send message:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sends a message to the agent with file attachments using content references
   */
  async sendMessageWithAttachments(
    content: string,
    chatHistory: ChatHistory[] = [],
    attachments: AttachmentData[] = []
  ): Promise<{
    success: boolean;
    response?: AgentMessage;
    error?: string;
  }> {
    if (!this.agent) {
      return {
        success: false,
        error: 'Agent not initialized',
      };
    }

    try {
      const contentStoreManager = this.agent.getContentStoreManager?.() as
        | ContentStoreManager
        | undefined;
      const processedContent =
        await this.attachmentProcessor.processAttachments(
          content,
          attachments,
          contentStoreManager
        );

      return await this.sendMessage(processedContent, chatHistory);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to send message with attachments';
      this.logger.error('Failed to send message with attachments:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process form submission from the UI
   */
  async processFormSubmission(
    formSubmission: {
      formId: string;
      data: Record<string, unknown>;
      timestamp: number;
      toolName: string;
      originalPrompt?: string;
      partialInput?: Record<string, unknown>;
    },
    chatHistory: ChatHistory[] = []
  ): Promise<{
    success: boolean;
    response?: AgentMessage;
    error?: string;
  }> {
    if (!this.agent) {
      return {
        success: false,
        error: 'Agent not initialized',
      };
    }

    try {
      const rawFormData = formSubmission?.data;
      const rawPartialInput = formSubmission?.partialInput;

      const safeFormData =
        rawFormData &&
        typeof rawFormData === 'object' &&
        !Array.isArray(rawFormData)
          ? (rawFormData as Record<string, unknown>)
          : {};
      const safePartialInput =
        rawPartialInput &&
        typeof rawPartialInput === 'object' &&
        !Array.isArray(rawPartialInput)
          ? (rawPartialInput as Record<string, unknown>)
          : {};

      const mergedParameters: Record<string, unknown> = {};

      if (safePartialInput && typeof safePartialInput === 'object') {
        Object.keys(safePartialInput).forEach((key) => {
          const value = safePartialInput[key];
          if (value !== undefined && value !== null) {
            mergedParameters[key] = value;
          }
        });
      }

      if (safeFormData && typeof safeFormData === 'object') {
        Object.keys(safeFormData).forEach((key) => {
          const value = safeFormData[key];
          if (value !== undefined && value !== null) {
            mergedParameters[key] = value;
          }
        });
      }

      const preprocessedParameters = this.parameterService
        ? await this.parameterService.preprocessToolParameters(
            formSubmission.toolName,
            mergedParameters
          )
        : mergedParameters;

      const enhancedParameters = {
        ...preprocessedParameters,
        withHashLinkBlocks: true,
        renderForm: false,
      };

      const toolExecutionMessage = JSON.stringify({
        type: 'TOOL_EXECUTION',
        toolName: formSubmission.toolName,
        parameters: enhancedParameters,
        formId: formSubmission.formId,
        originalPrompt:
          formSubmission.originalPrompt || `Execute ${formSubmission.toolName}`,
      });

      const standardizedSubmission = {
        formId: formSubmission.formId,
        toolName: formSubmission.toolName,
        parameters: enhancedParameters,
        timestamp: formSubmission.timestamp,
        context: {
          originalPrompt: formSubmission.originalPrompt,
          partialInput: formSubmission.partialInput,
          chatHistory: chatHistory.map((h) => ({
            type: h.type,
            content: h.content,
          })),
        },
      };

      const result = await (async () => {
        if (typeof this.agent.processFormSubmission === 'function') {
          return this.agent.processFormSubmission(standardizedSubmission);
        }
        return this.agent.processMessage(
          toolExecutionMessage,
          chatHistory.map((h) => ({
            role:
              h.type === 'human' ? ('user' as const) : ('assistant' as const),
            content: h.content,
          }))
        );
      })();

      const transactionData =
        await this.transactionProcessor.processTransactionData(null, result);

      const agentMessage: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: result.error || result.message || result.output || '',
        timestamp: new Date(),
        metadata: {
          transactionId: result.transactionId,
          scheduleId: result.scheduleId,
          notes: result.notes,
          transactionBytes: transactionData.transactionBytes,
          parsedTransaction: transactionData.parsedTransaction,
          description: result.description,
          isError: !!result.error,
          formMessage: result.formMessage,
          ...result.metadata,
        },
      };

      if (this.entityResolver && !result.error && this.onEntityStored) {
        try {
          const entities = await this.entityResolver.extractEntities(
            result,
            standardizedSubmission.context?.originalPrompt || ''
          );
          for (const entity of entities) {
            if (entity.id && entity.name && entity.type) {
              this.onEntityStored(
                entity.id,
                entity.name,
                entity.type,
                result.transactionId
              );
            }
          }
        } catch (entityError) {
          this.logger.warn(
            'Failed to extract and store entities from form submission:',
            entityError
          );
        }
      }

      return { success: true, response: agentMessage };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Form submission failed';
      this.logger.error('Form submission error:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract transaction bytes from message content
   */
  extractTransactionBytesFromMessage(messageContent: string): string | null {
    return this.transactionProcessor.extractTransactionBytesFromMessage(
      messageContent
    );
  }

  /**
   * Resolve entity references using context-aware format conversion
   */
  async resolveEntityReferences(
    userMessage: string,
    _toolContext?: { entityResolutionPreferences?: Record<string, string> }
  ): Promise<string> {
    try {
      if (!this.agent || !this.entityResolver) {
        return userMessage;
      }

      if (this.agent.memoryManager) {
        const entities = this.agent.memoryManager.getEntityAssociations();
        if (entities && this.parameterService) {
          const resolvedMessage = await this.entityResolver.resolveReferences(
            userMessage,
            entities
          );

          if (resolvedMessage !== userMessage) {
            this.logger.info('Resolved entity references:', {
              original: userMessage,
              resolved: resolvedMessage,
              entityCount: entities.length,
            });
          }

          return resolvedMessage;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to resolve entity references:', error);
    }

    return userMessage;
  }
}
