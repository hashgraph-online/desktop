import {
  TRANSACTION_ENRICHMENT_REGISTRY,
  getTransactionEnrichmentHandler,
  type TransactionEnrichmentHandler,
} from '../../../src/renderer/utils/transactionEnrichmentRegistry';

jest.mock('../../../src/renderer/types/transaction', () => ({
  ParsedTransaction: jest.fn(),
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Transaction: jest.fn(),
}));

describe('TransactionEnrichmentRegistry', () => {
  describe('getTransactionEnrichmentHandler', () => {
    test('should return correct handler for known transaction types', () => {
      const tokenCreationHandler = getTransactionEnrichmentHandler('TOKENCREATION');
      expect(tokenCreationHandler).toBeDefined();
      expect(typeof tokenCreationHandler.enrich).toBe('function');
      expect(typeof tokenCreationHandler.generateSuccessMessage).toBe('function');

      const cryptoCreateHandler = getTransactionEnrichmentHandler('CRYPTOCREATEACCOUNT');
      expect(cryptoCreateHandler).toBeDefined();

      const contractCreateHandler = getTransactionEnrichmentHandler('CONTRACTCREATEINSTANCE');
      expect(contractCreateHandler).toBeDefined();

      const consensusCreateHandler = getTransactionEnrichmentHandler('CONSENSUSCREATETOPIC');
      expect(consensusCreateHandler).toBeDefined();
    });

    test('should return default handler for unknown transaction types', () => {
      const unknownHandler = getTransactionEnrichmentHandler('UNKNOWN_TRANSACTION');
      const defaultHandler = getTransactionEnrichmentHandler('DEFAULT');

      expect(unknownHandler).toBe(defaultHandler);
    });

    test('should be case insensitive', () => {
      const uppercaseHandler = getTransactionEnrichmentHandler('TOKENCREATION');
      const lowercaseHandler = getTransactionEnrichmentHandler('tokencreation');
      const mixedCaseHandler = getTransactionEnrichmentHandler('TokenCreation');

      expect(uppercaseHandler).toBe(lowercaseHandler);
      expect(lowercaseHandler).toBe(mixedCaseHandler);
    });

    test('should handle empty string', () => {
      const emptyHandler = getTransactionEnrichmentHandler('');
      const defaultHandler = getTransactionEnrichmentHandler('DEFAULT');

      expect(emptyHandler).toBe(defaultHandler);
    });
  });

  describe('TRANSACTION_ENRICHMENT_REGISTRY', () => {
    test('should contain all expected transaction types', () => {
      const expectedTypes = [
        'TOKENCREATION',
        'TOKENMINT',
        'TOKENBURN',
        'CRYPTOCREATEACCOUNT',
        'CONTRACTCREATEINSTANCE',
        'CONTRACTCALL',
        'CONSENSUSCREATETOPIC',
        'CONSENSUSSUBMITMESSAGE',
        'CONSENSUSUPDATETOPIC',
        'CONSENSUSDELETETOPIC',
        'CRYPTOTRANSFER',
        'SCHEDULECREATE',
        'SCHEDULESIGN',
        'SCHEDULEDELETE',
        'FILECREATE',
        'FILEAPPEND',
        'FILEUPDATE',
        'FILEDELETE'
      ];

      expectedTypes.forEach(type => {
        expect(TRANSACTION_ENRICHMENT_REGISTRY[type]).toBeDefined();
        expect(typeof TRANSACTION_ENRICHMENT_REGISTRY[type].enrich).toBe('function');
        expect(typeof TRANSACTION_ENRICHMENT_REGISTRY[type].generateSuccessMessage).toBe('function');
      });
    });

    test('should have consistent handler structure', () => {
      Object.values(TRANSACTION_ENRICHMENT_REGISTRY).forEach((handler: TransactionEnrichmentHandler) => {
        expect(typeof handler.enrich).toBe('function');
        expect(typeof handler.generateSuccessMessage).toBe('function');
      });
    });
  });

  describe('Token Creation Handler', () => {
    const tokenCreationHandler = TRANSACTION_ENRICHMENT_REGISTRY.TOKENCREATION;

    test('should enrich token creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        tokenCreation: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.123456'
      };

      tokenCreationHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdTokenId).toBe('0.0.123456');
      expect(parsedTransaction.tokenCreation.tokenId).toBe('0.0.123456');
    });

    test('should generate success message with token ID', () => {
      const transaction = {
        details: {
          createdTokenId: '0.0.123456'
        }
      };

      const message = tokenCreationHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('Token created successfully! Token ID: 0.0.123456');
    });

    test('should generate success message without token ID', () => {
      const transaction = {
        details: {}
      };

      const message = tokenCreationHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('Token creation transaction completed. Transaction ID: 0.0.123456-1234567890-123456789');
    });

    test('should preserve existing tokenCreation data', () => {
      const parsedTransaction = {
        details: {},
        tokenCreation: {
          name: 'Test Token',
          symbol: 'TEST'
        }
      };

      const mirrorTransaction = {
        entity_id: '0.0.123456'
      };

      tokenCreationHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.tokenCreation.name).toBe('Test Token');
      expect(parsedTransaction.tokenCreation.symbol).toBe('TEST');
      expect(parsedTransaction.tokenCreation.tokenId).toBe('0.0.123456');
    });
  });

  describe('Crypto Create Account Handler', () => {
    const cryptoCreateHandler = TRANSACTION_ENRICHMENT_REGISTRY.CRYPTOCREATEACCOUNT;

    test('should enrich account creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        cryptoCreateAccount: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.789012'
      };

      cryptoCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdAccountId).toBe('0.0.789012');
      expect(parsedTransaction.cryptoCreateAccount.accountId).toBe('0.0.789012');
    });

    test('should generate success message with account ID', () => {
      const transaction = {
        details: {
          createdAccountId: '0.0.789012'
        }
      };

      const message = cryptoCreateHandler.generateSuccessMessage(transaction, '0.0.789012-1234567890-123456789');

      expect(message).toBe('Account created successfully! Account ID: 0.0.789012');
    });

    test('should generate success message without account ID', () => {
      const transaction = {
        details: {}
      };

      const message = cryptoCreateHandler.generateSuccessMessage(transaction, '0.0.789012-1234567890-123456789');

      expect(message).toBe('Account creation transaction completed. Transaction ID: 0.0.789012-1234567890-123456789');
    });
  });

  describe('Contract Create Handler', () => {
    const contractCreateHandler = TRANSACTION_ENRICHMENT_REGISTRY.CONTRACTCREATEINSTANCE;

    test('should enrich contract creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        contractCreate: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.345678'
      };

      contractCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdContractId).toBe('0.0.345678');
      expect(parsedTransaction.contractCreate.contractId).toBe('0.0.345678');
    });

    test('should add contractCall information', () => {
      const parsedTransaction = {
        details: {},
        contractCreate: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.345678'
      };

      contractCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.contractCall).toEqual({
        contractId: '0.0.345678',
        gas: 0,
        amount: 0
      });
    });

    test('should generate success message with contract ID', () => {
      const transaction = {
        details: {
          createdContractId: '0.0.345678'
        }
      };

      const message = contractCreateHandler.generateSuccessMessage(transaction, '0.0.345678-1234567890-123456789');

      expect(message).toBe('Smart contract deployed successfully! Contract ID: 0.0.345678');
    });
  });

  describe('Consensus Create Topic Handler', () => {
    const consensusCreateHandler = TRANSACTION_ENRICHMENT_REGISTRY.CONSENSUSCREATETOPIC;

    test('should enrich topic creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        consensusCreateTopic: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.456789'
      };

      consensusCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdTopicId).toBe('0.0.456789');
      expect(parsedTransaction.consensusCreateTopic.topicId).toBe('0.0.456789');
    });

    test('should preserve existing consensusCreateTopic data', () => {
      const parsedTransaction = {
        details: {},
        consensusCreateTopic: {
          memo: 'Test Topic',
          autoRenewPeriod: 2592000
        }
      };

      const mirrorTransaction = {
        entity_id: '0.0.456789'
      };

      consensusCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.consensusCreateTopic.memo).toBe('Test Topic');
      expect(parsedTransaction.consensusCreateTopic.autoRenewPeriod).toBe(2592000);
      expect(parsedTransaction.consensusCreateTopic.topicId).toBe('0.0.456789');
    });

    test('should handle case without entity_id', () => {
      const parsedTransaction = {
        details: {},
        consensusCreateTopic: {
          memo: 'Test Topic'
        }
      };

      const mirrorTransaction = {};

      consensusCreateHandler.enrich(parsedTransaction, mirrorTransaction, null);

      expect(parsedTransaction.consensusCreateTopic.memo).toBe('Test Topic');
      expect(parsedTransaction.details.createdTopicId).toBeUndefined();
    });

    test('should generate success message with topic ID', () => {
      const transaction = {
        details: {
          createdTopicId: '0.0.456789'
        }
      };

      const message = consensusCreateHandler.generateSuccessMessage(transaction, '0.0.456789-1234567890-123456789');

      expect(message).toBe('Topic created successfully! Topic ID: 0.0.456789');
    });
  });

  describe('Consensus Submit Message Handler', () => {
    const consensusSubmitHandler = TRANSACTION_ENRICHMENT_REGISTRY.CONSENSUSSUBMITMESSAGE;

    test('should enrich message submission with entity ID', () => {
      const parsedTransaction = {
        details: {},
        consensusSubmitMessage: {
          message: 'Test message'
        }
      };

      const mirrorTransaction = {
        entity_id: '0.0.567890'
      };

      consensusSubmitHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.topicId).toBe('0.0.567890');
      expect(parsedTransaction.consensusSubmitMessage.topicId).toBe('0.0.567890');
      expect(parsedTransaction.consensusSubmitMessage.messageEncoding).toBe('utf8');
    });

    test('should add default message and encoding if missing', () => {
      const parsedTransaction = {
        details: {},
        consensusSubmitMessage: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.567890'
      };

      consensusSubmitHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.consensusSubmitMessage.message).toBe('Message submitted successfully');
      expect(parsedTransaction.consensusSubmitMessage.messageEncoding).toBe('utf8');
    });

    test('should preserve existing message and encoding', () => {
      const parsedTransaction = {
        details: {},
        consensusSubmitMessage: {
          message: 'Custom message',
          messageEncoding: 'base64'
        }
      };

      const mirrorTransaction = {
        entity_id: '0.0.567890'
      };

      consensusSubmitHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.consensusSubmitMessage.message).toBe('Custom message');
      expect(parsedTransaction.consensusSubmitMessage.messageEncoding).toBe('base64');
    });

    test('should generate success message with topic ID', () => {
      const transaction = {
        consensusSubmitMessage: {
          topicId: '0.0.567890'
        }
      };

      const message = consensusSubmitHandler.generateSuccessMessage(transaction, '0.0.567890-1234567890-123456789');

      expect(message).toBe('Message submitted to topic 0.0.567890 successfully!');
    });

    test('should generate success message without topic ID', () => {
      const transaction = {
        consensusSubmitMessage: {}
      };

      const message = consensusSubmitHandler.generateSuccessMessage(transaction, '0.0.567890-1234567890-123456789');

      expect(message).toBe('Topic message submitted successfully. Transaction ID: 0.0.567890-1234567890-123456789');
    });
  });

  describe('Crypto Transfer Handler', () => {
    const cryptoTransferHandler = TRANSACTION_ENRICHMENT_REGISTRY.CRYPTOTRANSFER;

    test('should generate success message for token transfers', () => {
      const transaction = {
        tokenTransfers: [
          { tokenId: '0.0.123', amount: 100 },
          { tokenId: '0.0.456', amount: 200 }
        ]
      };

      const message = cryptoTransferHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('Token transfer completed successfully! (2 tokens transferred)');
    });

    test('should generate success message for single token transfer', () => {
      const transaction = {
        tokenTransfers: [
          { tokenId: '0.0.123', amount: 100 }
        ]
      };

      const message = cryptoTransferHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('Token transfer completed successfully! (1 token transferred)');
    });

    test('should generate success message for HBAR transfers', () => {
      const transaction = {
        transfers: [
          { account: '0.0.123', amount: 100000000 }
        ],
        tokenTransfers: []
      };

      const message = cryptoTransferHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('HBAR transfer completed successfully!');
    });

    test('should generate default success message', () => {
      const transaction = {
        transfers: [],
        tokenTransfers: []
      };

      const message = cryptoTransferHandler.generateSuccessMessage(transaction, '0.0.123456-1234567890-123456789');

      expect(message).toBe('Transfer transaction completed. Transaction ID: 0.0.123456-1234567890-123456789');
    });
  });

  describe('Schedule Create Handler', () => {
    const scheduleCreateHandler = TRANSACTION_ENRICHMENT_REGISTRY.SCHEDULECREATE;

    test('should enrich schedule creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        scheduleCreate: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.678901'
      };

      scheduleCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdScheduleId).toBe('0.0.678901');
      expect(parsedTransaction.scheduleCreate.scheduleId).toBe('0.0.678901');
    });

    test('should generate success message with schedule ID', () => {
      const transaction = {
        details: {
          createdScheduleId: '0.0.678901'
        }
      };

      const message = scheduleCreateHandler.generateSuccessMessage(transaction, '0.0.678901-1234567890-123456789');

      expect(message).toBe('Schedule created successfully! Schedule ID: 0.0.678901');
    });
  });

  describe('File Create Handler', () => {
    const fileCreateHandler = TRANSACTION_ENRICHMENT_REGISTRY.FILECREATE;

    test('should enrich file creation with entity ID', () => {
      const parsedTransaction = {
        details: {},
        fileCreate: {}
      };

      const mirrorTransaction = {
        entity_id: '0.0.789012'
      };

      fileCreateHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.createdFileId).toBe('0.0.789012');
      expect(parsedTransaction.fileCreate.fileId).toBe('0.0.789012');
    });

    test('should generate success message with file ID', () => {
      const transaction = {
        details: {
          createdFileId: '0.0.789012'
        }
      };

      const message = fileCreateHandler.generateSuccessMessage(transaction, '0.0.789012-1234567890-123456789');

      expect(message).toBe('File created successfully! File ID: 0.0.789012');
    });
  });

  describe('Default Handler', () => {
    const defaultHandler = getTransactionEnrichmentHandler('UNKNOWN_TYPE'); // This should return the default handler

    test('should enrich with entity ID using default mapping', () => {
      const parsedTransaction = {
        details: {},
        humanReadableType: 'Custom Transaction'
      };

      const mirrorTransaction = {
        entity_id: '0.0.999999'
      };

      defaultHandler.enrich(parsedTransaction, mirrorTransaction);

      expect(parsedTransaction.details.entityId).toBe('0.0.999999');
    });

    test('should generate success message with transaction type', () => {
      const transaction = {
        humanReadableType: 'Custom Transaction'
      };

      const message = defaultHandler.generateSuccessMessage(transaction, '0.0.999999-1234567890-123456789');

      expect(message).toBe('Custom Transaction completed successfully. Transaction ID: 0.0.999999-1234567890-123456789');
    });

    test('should generate success message with default type', () => {
      const transaction = {};

      const message = defaultHandler.generateSuccessMessage(transaction, '0.0.999999-1234567890-123456789');

      expect(message).toBe('Transaction completed successfully. Transaction ID: 0.0.999999-1234567890-123456789');
    });
  });

  describe('Simple Handlers', () => {
    test('should have simple no-op enrich functions', () => {
      const simpleHandlers = [
        'TOKENMINT',
        'TOKENBURN',
        'CONTRACTCALL',
        'SCHEDULESIGN',
        'SCHEDULEDELETE',
        'FILEAPPEND',
        'FILEUPDATE',
        'FILEDELETE'
      ];

      simpleHandlers.forEach(type => {
        const handler = TRANSACTION_ENRICHMENT_REGISTRY[type];
        expect(handler).toBeDefined();

        const parsedTransaction = { details: {} };
        const mirrorTransaction = { entity_id: '0.0.123456' };
        handler.enrich(parsedTransaction, mirrorTransaction);

        expect(parsedTransaction.details.entityId).toBeUndefined();
      });
    });

    test('should generate simple success messages', () => {
      const simpleHandlers = [
        { type: 'TOKENMINT', message: 'Token minting completed successfully!' },
        { type: 'TOKENBURN', message: 'Token burning completed successfully!' },
        { type: 'CONTRACTCALL', message: 'Smart contract execution completed successfully!' },
        { type: 'SCHEDULESIGN', message: 'Schedule signing completed successfully!' },
        { type: 'SCHEDULEDELETE', message: 'Schedule deletion completed successfully!' },
        { type: 'FILEAPPEND', message: 'File append completed successfully!' },
        { type: 'FILEUPDATE', message: 'File update completed successfully!' },
        { type: 'FILEDELETE', message: 'File deletion completed successfully!' }
      ];

      simpleHandlers.forEach(({ type, message }) => {
        const handler = TRANSACTION_ENRICHMENT_REGISTRY[type];
        const result = handler.generateSuccessMessage({}, 'test-tx-id');
        expect(result).toBe(message);
      });
    });
  });

  describe('Handler Consistency', () => {
    test('should ensure all handlers have required methods', () => {
      Object.entries(TRANSACTION_ENRICHMENT_REGISTRY).forEach(([type, handler]) => {
        expect(typeof handler.enrich).toBe('function');
        expect(typeof handler.generateSuccessMessage).toBe('function');
      });
    });

    test('should ensure enrich methods handle null/undefined inputs gracefully', () => {
      const safeHandlers = ['TOKENMINT', 'TOKENBURN', 'SCHEDULESIGN', 'FILEAPPEND'];

      safeHandlers.forEach(type => {
        const handler = TRANSACTION_ENRICHMENT_REGISTRY[type];
        expect(() => {
          handler.enrich(null as any, null as any);
        }).not.toThrow();

        expect(() => {
          handler.enrich(undefined as any, undefined as any);
        }).not.toThrow();
      });
    });

    test('should ensure generateSuccessMessage methods handle null/undefined inputs gracefully', () => {
      const safeHandlers = ['TOKENMINT', 'TOKENBURN', 'SCHEDULESIGN', 'FILEAPPEND'];

      safeHandlers.forEach(type => {
        const handler = TRANSACTION_ENRICHMENT_REGISTRY[type];
        expect(() => {
          handler.generateSuccessMessage(null as any, null as any);
        }).not.toThrow();

        expect(() => {
          handler.generateSuccessMessage(undefined as any, undefined as any);
        }).not.toThrow();
      });
    });
  });
});
