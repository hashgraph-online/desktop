import { getTransactionEnrichmentHandler } from '../../src/renderer/utils/transactionEnrichmentRegistry';
import { ParsedTransaction } from '../../src/renderer/types/transaction';
import { Transaction as HederaTransaction } from '@hashgraphonline/standards-sdk/dist/es/services/types';

describe('Transaction Enrichment Registry', () => {
  const mockMirrorTransaction: HederaTransaction = {
    entity_id: '0.0.12345',
    transaction_id: 'test-transaction',
  } as HederaTransaction;

  describe('CONSENSUSCREATETOPIC enrichment', () => {
    it('should enrich both details.createdTopicId and consensusCreateTopic.topicId', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const originalTransactionDetails: ParsedTransaction = {
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        transfers: [],
        tokenTransfers: [],
        consensusCreateTopic: {
          memo: 'Test topic',
          adminKey: 'test-key',
        },
      };

      const handler = getTransactionEnrichmentHandler('CONSENSUSCREATETOPIC');
      handler.enrich(parsedTransaction, mockMirrorTransaction, originalTransactionDetails);

      expect(parsedTransaction.details.createdTopicId).toBe('0.0.12345');
      
      expect(parsedTransaction.consensusCreateTopic).toBeDefined();
      expect(parsedTransaction.consensusCreateTopic?.topicId).toBe('0.0.12345');
      expect(parsedTransaction.consensusCreateTopic?.memo).toBe('Test topic');
      expect(parsedTransaction.consensusCreateTopic?.adminKey).toBe('test-key');
    });

    it('should preserve original data when no entity_id present', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const originalTransactionDetails: ParsedTransaction = {
        type: 'CONSENSUSCREATETOPIC',
        details: {},
        transfers: [],
        tokenTransfers: [],
        consensusCreateTopic: {
          memo: 'Test topic',
          adminKey: 'test-key',
        },
      };

      const mirrorTransactionNoEntity = { ...mockMirrorTransaction, entity_id: undefined } as HederaTransaction;
      
      const handler = getTransactionEnrichmentHandler('CONSENSUSCREATETOPIC');
      handler.enrich(parsedTransaction, mirrorTransactionNoEntity, originalTransactionDetails);

      expect(parsedTransaction.details.createdTopicId).toBeUndefined();
      expect(parsedTransaction.consensusCreateTopic?.memo).toBe('Test topic');
      expect(parsedTransaction.consensusCreateTopic?.adminKey).toBe('test-key');
      expect(parsedTransaction.consensusCreateTopic?.topicId).toBeUndefined();
    });
  });

  describe('TOKENCREATION enrichment', () => {
    it('should enrich both details.createdTokenId and tokenCreation.tokenId', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'TOKENCREATION',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const originalTransactionDetails: ParsedTransaction = {
        type: 'TOKENCREATION',
        details: {},
        transfers: [],
        tokenTransfers: [],
        tokenCreation: {
          tokenName: 'Test Token',
          tokenSymbol: 'TEST',
          initialSupply: '1000',
        },
      };

      const handler = getTransactionEnrichmentHandler('TOKENCREATION');
      handler.enrich(parsedTransaction, mockMirrorTransaction, originalTransactionDetails);

      expect(parsedTransaction.details.createdTokenId).toBe('0.0.12345');
      expect(parsedTransaction.tokenCreation?.tokenId).toBe('0.0.12345');
      expect(parsedTransaction.tokenCreation?.tokenName).toBe('Test Token');
      expect(parsedTransaction.tokenCreation?.tokenSymbol).toBe('TEST');
    });
  });

  describe('CRYPTOCREATEACCOUNT enrichment', () => {
    it('should enrich both details.createdAccountId and cryptoCreateAccount.accountId', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'CRYPTOCREATEACCOUNT',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const originalTransactionDetails: ParsedTransaction = {
        type: 'CRYPTOCREATEACCOUNT',
        details: {},
        transfers: [],
        tokenTransfers: [],
        cryptoCreateAccount: {
          initialBalance: '100',
          memo: 'Test account',
        },
      };

      const handler = getTransactionEnrichmentHandler('CRYPTOCREATEACCOUNT');
      handler.enrich(parsedTransaction, mockMirrorTransaction, originalTransactionDetails);

      expect(parsedTransaction.details.createdAccountId).toBe('0.0.12345');
      expect(parsedTransaction.cryptoCreateAccount?.accountId).toBe('0.0.12345');
      expect(parsedTransaction.cryptoCreateAccount?.initialBalance).toBe('100');
      expect(parsedTransaction.cryptoCreateAccount?.memo).toBe('Test account');
    });
  });

  describe('CONTRACTCREATEINSTANCE enrichment', () => {
    it('should enrich both details.createdContractId and contractCreate.contractId', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'CONTRACTCREATEINSTANCE',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const originalTransactionDetails: ParsedTransaction = {
        type: 'CONTRACTCREATEINSTANCE',
        details: {},
        transfers: [],
        tokenTransfers: [],
        contractCreate: {
          initialBalance: '50',
          memo: 'Test contract',
        },
      };

      const handler = getTransactionEnrichmentHandler('CONTRACTCREATEINSTANCE');
      handler.enrich(parsedTransaction, mockMirrorTransaction, originalTransactionDetails);

      expect(parsedTransaction.details.createdContractId).toBe('0.0.12345');
      expect(parsedTransaction.contractCreate?.contractId).toBe('0.0.12345');
      expect(parsedTransaction.contractCreate?.initialBalance).toBe('50');
      expect(parsedTransaction.contractCall?.contractId).toBe('0.0.12345');
    });
  });

  describe('Success message generation', () => {
    it('should generate appropriate success messages for each transaction type', () => {
      const tests = [
        {
          type: 'CONSENSUSCREATETOPIC',
          transaction: {
            type: 'CONSENSUSCREATETOPIC',
            details: { createdTopicId: '0.0.12345' },
            transfers: [],
            tokenTransfers: [],
          } as ParsedTransaction,
          expectedMessage: 'Topic created successfully! Topic ID: 0.0.12345'
        },
        {
          type: 'TOKENCREATION',
          transaction: {
            type: 'TOKENCREATION',
            details: { createdTokenId: '0.0.54321' },
            transfers: [],
            tokenTransfers: [],
          } as ParsedTransaction,
          expectedMessage: 'Token created successfully! Token ID: 0.0.54321'
        },
        {
          type: 'CRYPTOCREATEACCOUNT',
          transaction: {
            type: 'CRYPTOCREATEACCOUNT',
            details: { createdAccountId: '0.0.98765' },
            transfers: [],
            tokenTransfers: [],
          } as ParsedTransaction,
          expectedMessage: 'Account created successfully! Account ID: 0.0.98765'
        },
      ];

      tests.forEach(({ type, transaction, expectedMessage }) => {
        const handler = getTransactionEnrichmentHandler(type);
        const message = handler.generateSuccessMessage(transaction, 'test-transaction-id');
        expect(message).toBe(expectedMessage);
      });
    });
  });

  describe('Default handler', () => {
    it('should handle unknown transaction types gracefully', () => {
      const parsedTransaction: ParsedTransaction = {
        type: 'UNKNOWN_TYPE',
        details: {},
        transfers: [],
        tokenTransfers: [],
      };

      const handler = getTransactionEnrichmentHandler('UNKNOWN_TYPE');
      handler.enrich(parsedTransaction, mockMirrorTransaction);

      expect(parsedTransaction.details.entityId).toBe('0.0.12345');
    });
  });
});