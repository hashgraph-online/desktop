import { MessageService } from '../../../src/main/services/message-service';
import type { ChatHistory, SessionContext } from '../../../src/main/interfaces/services';
import { SafeConversationalAgent } from '../../../src/main/services/safe-conversational-agent';

jest.mock('@hashgraphonline/conversational-agent', () => ({
  EntityResolver: jest.fn().mockImplementation(() => ({
    extractEntities: jest.fn().mockResolvedValue([]),
  })),
  AttachmentProcessor: jest.fn().mockImplementation(() => ({
    processAttachments: jest.fn().mockResolvedValue('Processed content'),
  })),
}));

const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLoggerInstance)
}));

jest.mock('../../../src/main/services/safe-conversational-agent', () => ({
  SafeConversationalAgent: jest.fn().mockImplementation(() => ({
    processMessage: jest.fn().mockResolvedValue({
      role: 'assistant',
      content: 'Test response',
      metadata: {
        test: 'metadata',
        transactionId: 'test-tx-id',
        scheduleId: 'test-schedule-id',
        notes: ['test note'],
        description: 'Test description'
      }
    }),
    memoryManager: {
      getEntityAssociations: jest.fn().mockReturnValue([
        {
          entityId: '0.0.123456',
          entityType: 'accountId',
          entityName: 'TestAccount',
          usage: 'recent',
          hrl: 'account:0.0.123456'
        }
      ])
    }
  }))
}));


jest.mock('../../../src/main/services/transaction-processor', () => ({
  TransactionProcessor: jest.fn().mockImplementation(() => ({
    processTransactionData: jest.fn().mockResolvedValue({
      transactionBytes: 'test-bytes',
      parsedTransaction: { type: 'transfer' }
    })
  }))
}));



describe('MessageService', () => {
  let messageService: MessageService;
  let mockAgent: any;
  let mockEntityResolver: any;
  let mockParameterService: any;
  let mockTransactionProcessor: any;
  let mockAttachmentProcessor: any;

  const mockSessionContext: SessionContext = {
    sessionId: 'test-session-123',
    mode: 'personal',
    topicId: '0.0.123456'
  };

  const mockChatHistory: ChatHistory[] = [
    {
      type: 'human',
      content: 'Hello agent',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      type: 'ai',
      content: 'Hello! How can I help you?',
      timestamp: new Date('2024-01-01T10:00:05Z')
    }
  ];

  const mockAttachments = [
    {
      name: 'test.txt',
      data: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
      type: 'text/plain',
      size: 11
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    messageService = new MessageService();

    (messageService as any).logger = mockLoggerInstance;

    const { SafeConversationalAgent } = require('../../../src/main/services/safe-conversational-agent');
    const { EntityResolver, AttachmentProcessor } = require('@hashgraphonline/conversational-agent');
    const { TransactionProcessor } = require('../../../src/main/services/transaction-processor');

    mockAgent = new SafeConversationalAgent();
    if (!mockAgent.processMessage) {
      mockAgent.processMessage = jest.fn().mockResolvedValue({
        message: 'Test response',
        output: 'Test output',
        metadata: {
          test: 'metadata',
          transactionId: 'test-tx-id',
          scheduleId: 'test-schedule-id',
          notes: ['test note'],
          description: 'Test description'
        }
      });
    }
    mockAgent.memoryManager = {
      getEntityAssociations: jest.fn().mockReturnValue([])
    };

    mockEntityResolver = new EntityResolver();
    if (!mockEntityResolver.extractEntities) {
      mockEntityResolver.extractEntities = jest.fn().mockResolvedValue([]);
    }
    mockParameterService = null;
    mockTransactionProcessor = {
      processTransactionData: jest.fn().mockResolvedValue({
        transactionBytes: 'test-bytes',
        parsedTransaction: { type: 'transfer' }
      }),
    };

    mockAttachmentProcessor = new AttachmentProcessor();
    if (!mockAttachmentProcessor.processAttachments) {
      (mockAttachmentProcessor as any).processAttachments = jest
        .fn()
        .mockResolvedValue('Processed content');
    }

    (messageService as any).transactionProcessor = mockTransactionProcessor;
    (messageService as any).attachmentProcessor = mockAttachmentProcessor;

    messageService.setAgent(mockAgent);
    messageService.setEntityResolver(mockEntityResolver);
  });

  describe('Service Setup', () => {
    test('should create MessageService instance', () => {
      expect(messageService).toBeInstanceOf(MessageService);
    });

    test('should set agent', () => {
      const newAgent = new SafeConversationalAgent();
      messageService.setAgent(newAgent);
      expect(messageService).toBeDefined();
    });

    test('should set entity resolver', () => {
      const newResolver = new (require('@hashgraphonline/conversational-agent').EntityResolver)();
    messageService.setEntityResolver(newResolver);
      expect(messageService).toBeDefined();
    });


    test('should set session context', () => {
      messageService.setSessionContext(mockSessionContext);
      expect(messageService).toBeDefined();
    });

    test('should set entity stored callback', () => {
      const callback = jest.fn();
      messageService.setOnEntityStored(callback);
      expect(messageService).toBeDefined();
    });
  });

  describe('Message Sending', () => {
    test('should send message successfully', async () => {
      const result = await messageService.sendMessage('Hello agent', mockChatHistory);

      console.log('Final result:', JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.role).toBe('assistant'); // This is set by the MessageService
      expect(result.response?.content).toBe('Test response'); // This comes from response.message
      expect(result.response?.metadata).toBeDefined();
      expect(result.response?.metadata?.transactionId).toBe('test-tx-id');
      expect(result.response?.metadata?.transactionBytes).toBe('test-bytes');
      expect(result.response?.metadata?.parsedTransaction).toEqual({ type: 'transfer' });
    });

    test('should send message without chat history', async () => {
      const result = await messageService.sendMessage('Simple message');

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.content).toBe('Test response');
    });

    test('should handle agent not initialized', async () => {
      const newService = new MessageService();

      const result = await newService.sendMessage('Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent not initialized');
      expect(result.response).toBeUndefined();
    });

    test('should handle agent processing error', async () => {
      mockAgent.processMessage.mockRejectedValueOnce(new Error('Processing failed'));

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed');
    });

    test('should handle schema validation error', async () => {
      mockAgent.processMessage.mockResolvedValueOnce({
        error: 'Received tool input did not match expected schema',
        message: '',
        output: ''
      });

      const result = await messageService.sendMessage('Invalid transfer request');

      expect(result.success).toBe(true);
      expect(result.response?.content).toContain('rephrasing your request');
      expect(result.response?.metadata?.isError).toBe(true);
    });

    test('should include entity associations in history', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue([
        {
          entityId: '0.0.123456',
          entityType: 'accountId',
          entityName: 'TestAccount',
        },
      ]);

      const result = await messageService.sendMessage('Test with entities');

      expect(result.success).toBe(true);
      const call = (mockAgent.processMessage as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('Test with entities');
      expect(Array.isArray(call[1])).toBe(true);
      const historyArg = call[1] as Array<{ type?: string; content?: string }>;
      expect(
        historyArg.some(
          (h) => h.type === 'system' && /\[entity-association\]/.test(h.content || '')
        )
      ).toBe(true);
    });

    test('should handle empty entity associations', async () => {
      mockAgent.memoryManager.getEntityAssociations.mockReturnValue([]);

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
      const call = (mockAgent.processMessage as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('Test message');
      expect(Array.isArray(call[1])).toBe(true);
    });

    test('should handle missing memory manager', async () => {
      mockAgent.memoryManager = null;

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
    });
  });

  describe('Message with Attachments', () => {
    test('should send message with attachments', async () => {
      mockAttachmentProcessor.processAttachments.mockResolvedValue(
        'Processed content with attachments'
      );

      const result = await messageService.sendMessageWithAttachments(
        'Process this file',
        mockChatHistory,
        mockAttachments
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(mockAttachmentProcessor.processAttachments).toHaveBeenCalledWith(
        'Process this file',
        mockAttachments,
        undefined
      );
    });

    test('should handle attachment processing error', async () => {
      mockAttachmentProcessor.processAttachments.mockRejectedValue(
        new Error('Attachment processing failed')
      );

      const result = await messageService.sendMessageWithAttachments(
        'Process file',
        [],
        mockAttachments
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Attachment processing failed');
    });
  });

  describe('Form Submission', () => {
    test('should process form submission', async () => {
      const formSubmission = {
        formId: 'test-form',
        data: { amount: '1', recipient: '0.0.123456' },
        timestamp: Date.now(),
        toolName: 'transfer'
      };

      const result = await messageService.processFormSubmission(formSubmission);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.content).toBe('Test response');
    });

    test('should handle form submission error', async () => {
      mockAgent.processMessage.mockRejectedValueOnce(new Error('Form processing failed'));

      const formSubmission = {
        formId: 'test-form',
        data: { field: 'value' },
        timestamp: Date.now(),
        toolName: 'test-tool'
      };

      const result = await messageService.processFormSubmission(formSubmission);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Form processing failed');
    });
  });

  describe('Entity Extraction', () => {
    test('should extract and store entities', async () => {
      const mockEntities = [
        {
          id: '0.0.123456',
          name: 'TestAccount',
          type: 'accountId'
        }
      ];

      (mockEntityResolver.extractEntities as jest.Mock).mockResolvedValue(
        mockEntities
      );

      const onEntityStored = jest.fn();
      messageService.setOnEntityStored(onEntityStored);

      const result = await messageService.sendMessage('Extract entities from this');

      expect(result.success).toBe(true);
      expect(mockEntityResolver.extractEntities).toHaveBeenCalled();
      expect(onEntityStored).toHaveBeenCalledWith(
        '0.0.123456',
        'TestAccount',
        'accountId',
        'test-tx-id'
      );
    });

    test('should handle entity extraction error', async () => {
      (mockEntityResolver.extractEntities as jest.Mock).mockRejectedValue(
        new Error('Extraction failed')
      );

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
    });

    test('should skip entity extraction when entity resolver is not set', async () => {
      const newService = new MessageService();
      newService.setAgent(mockAgent);
      (newService as any).logger = mockLoggerInstance;
      (newService as any).transactionProcessor = mockTransactionProcessor;
      (newService as any).attachmentProcessor = mockAttachmentProcessor;

      const result = await newService.sendMessage('Test message');

      expect(result.success).toBe(true);
    });

    test('should skip entity storage when callback is not set', async () => {
      (mockEntityResolver.extractEntities as jest.Mock).mockResolvedValue([
        { id: '0.0.123456', name: 'Test', type: 'accountId' },
      ]);

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
      expect(mockEntityResolver.extractEntities).toHaveBeenCalled();
    });

    test('should skip entity extraction on error responses', async () => {
      mockAgent.processMessage.mockResolvedValueOnce({
        error: 'Agent error',
        message: 'Error occurred',
        output: 'Error output'
      });

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
      expect(result.response?.metadata?.isError).toBe(true);
      expect(mockEntityResolver.extractEntities).not.toHaveBeenCalled();
    });
  });

  describe('Chat History Processing', () => {
    test('should convert chat history to agent format', async () => {
      const result = await messageService.sendMessage('Test', mockChatHistory);

      expect(result.success).toBe(true);
      expect(mockAgent.processMessage).toHaveBeenCalledWith(
        'Test',
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Hello agent'
          }),
          expect.objectContaining({
            role: 'assistant',
            content: 'Hello! How can I help you?'
          })
        ])
      );
    });

    test('should handle empty chat history', async () => {
      const result = await messageService.sendMessage('Test', []);

      expect(result.success).toBe(true);
      expect(mockAgent.processMessage).toHaveBeenCalledWith(
        'Test',
        expect.any(Array)
      );
    });

    test('should handle chat history with system messages', async () => {
      const historyWithSystem = [
        ...mockChatHistory,
        {
          type: 'system' as const,
          content: 'System prompt',
          timestamp: new Date()
        }
      ];

      const result = await messageService.sendMessage('Test', historyWithSystem);

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle transaction processing error gracefully', async () => {
      mockTransactionProcessor.processTransactionData.mockRejectedValue(
        new Error('Transaction processing failed')
      );

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(true);
      expect(result.response?.metadata?.transactionBytes).toBeUndefined();
    });

    test('should handle unexpected errors', async () => {
      mockAgent.processMessage.mockRejectedValue('String error');

      const result = await messageService.sendMessage('Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send message');
    });
  });
});
