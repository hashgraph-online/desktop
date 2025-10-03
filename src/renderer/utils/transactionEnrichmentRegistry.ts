/**
 * Registry for handling post-execution transaction enrichment
 * Maps transaction types to their enrichment and success message handlers
 */

import { ParsedTransaction } from '../types/transaction';
import { Transaction } from '@hashgraphonline/standards-sdk';

interface EntityMapping {
  detailsField: string;
  transactionTypeField?: string;
  transactionTypeProperty?: string;
}

const ENTITY_MAPPINGS: Record<string, EntityMapping> = {
  TOKENCREATION: {
    detailsField: 'createdTokenId',
    transactionTypeField: 'tokenCreation',
    transactionTypeProperty: 'tokenId',
  },
  CRYPTOCREATEACCOUNT: {
    detailsField: 'createdAccountId',
    transactionTypeField: 'cryptoCreateAccount',
    transactionTypeProperty: 'accountId',
  },
  CONTRACTCREATEINSTANCE: {
    detailsField: 'createdContractId',
    transactionTypeField: 'contractCreate',
    transactionTypeProperty: 'contractId',
  },
  CONSENSUSCREATETOPIC: {
    detailsField: 'createdTopicId',
    transactionTypeField: 'consensusCreateTopic',
    transactionTypeProperty: 'topicId',
  },
  CONSENSUSSUBMITMESSAGE: {
    detailsField: 'topicId',
    transactionTypeField: 'consensusSubmitMessage',
    transactionTypeProperty: 'topicId',
  },
  CONSENSUSUPDATETOPIC: {
    detailsField: 'updatedTopicId',
    transactionTypeField: 'consensusUpdateTopic',
    transactionTypeProperty: 'topicId',
  },
  CONSENSUSDELETETOPIC: {
    detailsField: 'deletedTopicId',
    transactionTypeField: 'consensusDeleteTopic',
    transactionTypeProperty: 'topicId',
  },
  SCHEDULECREATE: {
    detailsField: 'createdScheduleId',
    transactionTypeField: 'scheduleCreate',
    transactionTypeProperty: 'scheduleId',
  },
  FILECREATE: {
    detailsField: 'createdFileId',
    transactionTypeField: 'fileCreate',
    transactionTypeProperty: 'fileId',
  },
  DEFAULT: {
    detailsField: 'entityId',
  },
};

function enrichWithEntityId(
  parsedTransaction: ParsedTransaction,
  entityId: string,
  transactionType: string,
  originalTransactionDetails?: ParsedTransaction | null
): void {
  const mapping =
    ENTITY_MAPPINGS[transactionType.toUpperCase()] || ENTITY_MAPPINGS.DEFAULT;

  parsedTransaction.details[mapping.detailsField] = entityId;

  if (mapping.transactionTypeField && mapping.transactionTypeProperty) {
    const fieldName = mapping.transactionTypeField as keyof ParsedTransaction;
    const propertyName = mapping.transactionTypeProperty;

    if (fieldName === 'consensusCreateTopic') {
      const existingData =
        originalTransactionDetails?.consensusCreateTopic ||
        parsedTransaction.consensusCreateTopic ||
        {};
      parsedTransaction.consensusCreateTopic = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'tokenCreation') {
      const existingData =
        originalTransactionDetails?.tokenCreation ||
        parsedTransaction.tokenCreation ||
        {};
      parsedTransaction.tokenCreation = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'cryptoCreateAccount') {
      const existingData =
        originalTransactionDetails?.cryptoCreateAccount ||
        parsedTransaction.cryptoCreateAccount ||
        {};
      parsedTransaction.cryptoCreateAccount = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'contractCreate') {
      const existingData =
        originalTransactionDetails?.contractCreate ||
        parsedTransaction.contractCreate ||
        {};
      parsedTransaction.contractCreate = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'consensusSubmitMessage') {
      const existingData =
        originalTransactionDetails?.consensusSubmitMessage ||
        parsedTransaction.consensusSubmitMessage ||
        {};
      parsedTransaction.consensusSubmitMessage = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'consensusUpdateTopic') {
      const existingData =
        originalTransactionDetails?.consensusUpdateTopic ||
        parsedTransaction.consensusUpdateTopic ||
        {};
      parsedTransaction.consensusUpdateTopic = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'consensusDeleteTopic') {
      const existingData =
        originalTransactionDetails?.consensusDeleteTopic ||
        parsedTransaction.consensusDeleteTopic ||
        {};
      parsedTransaction.consensusDeleteTopic = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'scheduleCreate') {
      const existingData =
        originalTransactionDetails?.scheduleCreate ||
        parsedTransaction.scheduleCreate ||
        {};
      parsedTransaction.scheduleCreate = {
        ...existingData,
        [propertyName]: entityId,
      };
    } else if (fieldName === 'fileCreate') {
      const existingData =
        originalTransactionDetails?.fileCreate ||
        parsedTransaction.fileCreate ||
        {};
      parsedTransaction.fileCreate = {
        ...existingData,
        [propertyName]: entityId,
      };
    }
  }
}

export interface TransactionEnrichmentHandler {
  enrich: (
    parsedTransaction: ParsedTransaction,
    mirrorTransaction: Transaction,
    originalTransactionDetails?: ParsedTransaction | null
  ) => void;
  generateSuccessMessage: (
    transaction: ParsedTransaction,
    transactionId: string
  ) => string;
}

const tokenCreationHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'TOKENCREATION',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const tokenId = transaction.details.createdTokenId;
    return tokenId
      ? `Token created successfully! Token ID: ${tokenId}`
      : `Token creation transaction completed. Transaction ID: ${transactionId}`;
  },
};

const tokenMintHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `Token minting completed successfully!`,
};

const tokenBurnHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `Token burning completed successfully!`,
};

const cryptoCreateAccountHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CRYPTOCREATEACCOUNT',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const accountId = transaction.details.createdAccountId;
    return accountId
      ? `Account created successfully! Account ID: ${accountId}`
      : `Account creation transaction completed. Transaction ID: ${transactionId}`;
  },
};

const contractCreateHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CONTRACTCREATEINSTANCE',
        originalTransactionDetails
      );

      parsedTransaction.contractCall = {
        contractId: mirrorTransaction.entity_id,
        gas: 0,
        amount: 0,
      };
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const contractId = transaction.details.createdContractId;
    return contractId
      ? `Smart contract deployed successfully! Contract ID: ${contractId}`
      : `Contract deployment transaction completed. Transaction ID: ${transactionId}`;
  },
};

const contractCallHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () =>
    `Smart contract execution completed successfully!`,
};

const consensusCreateTopicHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CONSENSUSCREATETOPIC',
        originalTransactionDetails
      );
    } else if (originalTransactionDetails?.consensusCreateTopic) {
      parsedTransaction.consensusCreateTopic =
        originalTransactionDetails.consensusCreateTopic;
    } else {
      parsedTransaction.consensusCreateTopic =
        parsedTransaction.consensusCreateTopic || {};
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const createdTopicId = transaction.details.createdTopicId;
    return createdTopicId
      ? `Topic created successfully! Topic ID: ${createdTopicId}`
      : `Topic creation transaction completed. Transaction ID: ${transactionId}`;
  },
};

const consensusSubmitMessageHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CONSENSUSSUBMITMESSAGE',
        originalTransactionDetails
      );

      if (parsedTransaction.consensusSubmitMessage) {
        if (!parsedTransaction.consensusSubmitMessage.message) {
          parsedTransaction.consensusSubmitMessage.message =
            'Message submitted successfully';
        }
        if (!parsedTransaction.consensusSubmitMessage.messageEncoding) {
          parsedTransaction.consensusSubmitMessage.messageEncoding = 'utf8';
        }
      }
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const topicId = transaction.consensusSubmitMessage?.topicId;
    return topicId
      ? `Message submitted to topic ${topicId} successfully!`
      : `Topic message submitted successfully. Transaction ID: ${transactionId}`;
  },
};

const consensusUpdateTopicHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CONSENSUSUPDATETOPIC',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const updatedTopicId = transaction.details.updatedTopicId;
    return updatedTopicId
      ? `Topic ${updatedTopicId} updated successfully!`
      : `Topic update transaction completed. Transaction ID: ${transactionId}`;
  },
};

const consensusDeleteTopicHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'CONSENSUSDELETETOPIC',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const deletedTopicId = transaction.details.deletedTopicId;
    return deletedTopicId
      ? `Topic ${deletedTopicId} deleted successfully!`
      : `Topic deletion transaction completed. Transaction ID: ${transactionId}`;
  },
};

const cryptoTransferHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: (transaction, transactionId) => {
    if (transaction.tokenTransfers && transaction.tokenTransfers.length > 0) {
      const tokenCount = transaction.tokenTransfers.length;
      return `Token transfer completed successfully! (${tokenCount} token${
        tokenCount > 1 ? 's' : ''
      } transferred)`;
    } else if (transaction.transfers && transaction.transfers.length > 0) {
      return `HBAR transfer completed successfully!`;
    }
    return `Transfer transaction completed. Transaction ID: ${transactionId}`;
  },
};

const scheduleCreateHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'SCHEDULECREATE',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const scheduleId = transaction.details.createdScheduleId;
    return scheduleId
      ? `Schedule created successfully! Schedule ID: ${scheduleId}`
      : `Schedule creation transaction completed. Transaction ID: ${transactionId}`;
  },
};

const scheduleSignHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `Schedule signing completed successfully!`,
};

const scheduleDeleteHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `Schedule deletion completed successfully!`,
};

const fileCreateHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'FILECREATE',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    const fileId = transaction.details.createdFileId;
    return fileId
      ? `File created successfully! File ID: ${fileId}`
      : `File creation transaction completed. Transaction ID: ${transactionId}`;
  },
};

const fileAppendHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `File append completed successfully!`,
};

const fileUpdateHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `File update completed successfully!`,
};

const fileDeleteHandler: TransactionEnrichmentHandler = {
  enrich: () => {},
  generateSuccessMessage: () => `File deletion completed successfully!`,
};

const defaultHandler: TransactionEnrichmentHandler = {
  enrich: (
    parsedTransaction,
    mirrorTransaction,
    originalTransactionDetails
  ) => {
    if (mirrorTransaction.entity_id) {
      enrichWithEntityId(
        parsedTransaction,
        mirrorTransaction.entity_id,
        'DEFAULT',
        originalTransactionDetails
      );
    }
  },
  generateSuccessMessage: (transaction, transactionId) => {
    return `${
      transaction.humanReadableType || 'Transaction'
    } completed successfully. Transaction ID: ${transactionId}`;
  },
};

export const TRANSACTION_ENRICHMENT_REGISTRY: Record<
  string,
  TransactionEnrichmentHandler
> = {
  TOKENCREATION: tokenCreationHandler,
  TOKENMINT: tokenMintHandler,
  TOKENBURN: tokenBurnHandler,

  CRYPTOCREATEACCOUNT: cryptoCreateAccountHandler,

  CONTRACTCREATEINSTANCE: contractCreateHandler,
  CONTRACTCALL: contractCallHandler,

  CONSENSUSCREATETOPIC: consensusCreateTopicHandler,
  CONSENSUSSUBMITMESSAGE: consensusSubmitMessageHandler,
  CONSENSUSUPDATETOPIC: consensusUpdateTopicHandler,
  CONSENSUSDELETETOPIC: consensusDeleteTopicHandler,

  CRYPTOTRANSFER: cryptoTransferHandler,

  SCHEDULECREATE: scheduleCreateHandler,
  SCHEDULESIGN: scheduleSignHandler,
  SCHEDULEDELETE: scheduleDeleteHandler,

  FILECREATE: fileCreateHandler,
  FILEAPPEND: fileAppendHandler,
  FILEUPDATE: fileUpdateHandler,
  FILEDELETE: fileDeleteHandler,
};

export const getTransactionEnrichmentHandler = (
  transactionType: string
): TransactionEnrichmentHandler => {
  return (
    TRANSACTION_ENRICHMENT_REGISTRY[transactionType.toUpperCase()] ||
    defaultHandler
  );
};
