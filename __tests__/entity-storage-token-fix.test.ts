/**
 * Tests for entity storage token fix - these tests define the expected behavior
 * for extracting entity IDs from transaction receipts instead of using LLM-based parsing
 */

interface EntityExtraction {
  id: string;
  name: string;
  type: string;
}

interface MockReceipt {
  tokenId?: { toString(): string };
  topicId?: { toString(): string };
  accountId?: { toString(): string };
  contractId?: { toString(): string };
  fileId?: { toString(): string };
  scheduleId?: { toString(): string };
}

interface MockAgentResponse {
  success: boolean;
  receipt?: MockReceipt;
  result?: {
    success: boolean;
    receipt?: MockReceipt;
  };
  message: string;
  error?: string;
}

/**
 * Enhanced entity extractor that uses receipt data instead of LLM parsing
 * This is the function we need to implement to fix the token storage issue
 */
function extractEntitiesFromReceipt(
  response: MockAgentResponse,
  userMessage: string
): EntityExtraction[] {
  const entities: EntityExtraction[] = [];
  
  if (!response.success || (!response.receipt && !response.result?.receipt)) {
    return entities;
  }

  const receipt = response.receipt || response.result?.receipt;
  if (!receipt) return entities;

  const extractNameFromMessage = (message: string): string => {
    const quotedMatch = message.match(/"([^"]+)"/);
    if (quotedMatch) return quotedMatch[1];

    const calledMatch = message.match(/called\s+([A-Za-z0-9#\s_-]+?)(?:\s|$)/i);
    if (calledMatch) return calledMatch[1].trim();

    const forMatch = message.match(/for\s+([A-Za-z0-9#\s_-]+)/i);
    if (forMatch) return forMatch[1].trim();

    const namedMatch = message.match(/(?:token|topic|account|contract)\s+([A-Za-z0-9#_-]+)/i);
    if (namedMatch) return namedMatch[1].trim();

    if (message.includes('new account')) return 'new account';

    return 'unnamed_entity';
  };

  const entityName = extractNameFromMessage(userMessage);

  if (receipt.tokenId) {
    entities.push({
      id: receipt.tokenId.toString(),
      name: entityName,
      type: 'token',
    });
  }

  if (receipt.topicId) {
    entities.push({
      id: receipt.topicId.toString(),
      name: entityName,
      type: 'topic',
    });
  }

  if (receipt.accountId) {
    entities.push({
      id: receipt.accountId.toString(),
      name: entityName,
      type: 'account',
    });
  }

  if (receipt.contractId) {
    entities.push({
      id: receipt.contractId.toString(),
      name: entityName,
      type: 'contract',
    });
  }

  if (receipt.fileId) {
    entities.push({
      id: receipt.fileId.toString(),
      name: entityName,
      type: 'file',
    });
  }

  if (receipt.scheduleId) {
    entities.push({
      id: receipt.scheduleId.toString(),
      name: entityName,
      type: 'schedule',
    });
  }

  return entities;
}

describe('Entity Storage Token Fix', () => {
  describe('Token Creation Entity Extraction', () => {
    test('should extract token ID from transaction receipt instead of treasury account', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: true,
        receipt: {
          tokenId: { toString: () => '0.0.12345678' }, // Newly created token ID
        },
        message: 'Successfully created fungible token "Forever" with initial supply 1000000',
      };

      const userMessage = 'Create a token called Forever';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toEqual({
        id: '0.0.12345678', // Should be the token ID, NOT treasury account
        name: 'Forever',
        type: 'token',
      });
    });

    test('should extract topic ID from transaction receipt for topic creation', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: true,
        receipt: {
          topicId: { toString: () => '0.0.6624888' }, // Newly created topic ID
        },
        message: 'Successfully created consensus topic for "Forever #1"',
      };

      const userMessage = 'Create a topic for Forever #1';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toEqual({
        id: '0.0.6624888', // Should be the topic ID from receipt
        name: 'Forever #1',
        type: 'topic',
      });
    });

    test('should extract account ID from transaction receipt for account creation', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: true,
        receipt: {
          accountId: { toString: () => '0.0.9876543' }, // Newly created account ID
        },
        message: 'Successfully created new account with initial balance 10 HBAR',
      };

      const userMessage = 'Create a new account';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toEqual({
        id: '0.0.9876543',
        name: 'new account', // Should extract from user message
        type: 'account',
      });
    });

    test('should return empty array if no receipt data available', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: false,
        error: 'Transaction failed',
        message: 'Failed to create token',
      };

      const userMessage = 'Create a token called Forever';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities).toHaveLength(0);
    });

    test('should handle structured response with embedded receipt data', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: true,
        result: {
          success: true,
          receipt: {
            tokenId: { toString: () => '0.0.55555' },
          },
        },
        message: 'Token "MyToken" created successfully',
      };

      const userMessage = 'Create token MyToken';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities).toHaveLength(1);
      expect(entities[0]).toEqual({
        id: '0.0.55555',
        name: 'MyToken',
        type: 'token',
      });
    });
  });

  describe('Entity Name Extraction', () => {
    test('should extract entity name from quoted strings in user message', () => {
      const mockAgentResponse: MockAgentResponse = {
        success: true,
        receipt: {
          tokenId: { toString: () => '0.0.12345' },
        },
        message: 'Token created successfully',
      };

      const userMessage = 'Create a token called "My Special Token"';

      const entities = extractEntitiesFromReceipt(mockAgentResponse, userMessage);

      expect(entities[0].name).toBe('My Special Token');
    });

    test('should extract entity name from common patterns', () => {
      const testCases = [
        { message: 'Create token Forever', expectedName: 'Forever' },
        { message: 'Create a topic for Forever #1', expectedName: 'Forever #1' },
        { message: 'Make a new account called TestAccount', expectedName: 'TestAccount' },
      ];

      for (const testCase of testCases) {
        const mockAgentResponse: MockAgentResponse = {
          success: true,
          receipt: {
            tokenId: { toString: () => '0.0.12345' },
          },
          message: 'Success',
        };

        const entities = extractEntitiesFromReceipt(mockAgentResponse, testCase.message);
        expect(entities[0].name).toBe(testCase.expectedName);
      }
    });
  });

  describe('Entity Type Detection', () => {
    test('should correctly determine entity type from receipt properties', () => {
      const testCases = [
        { receiptProperty: 'tokenId', expectedType: 'token' },
        { receiptProperty: 'topicId', expectedType: 'topic' },
        { receiptProperty: 'accountId', expectedType: 'account' },
        { receiptProperty: 'contractId', expectedType: 'contract' },
        { receiptProperty: 'fileId', expectedType: 'file' },
        { receiptProperty: 'scheduleId', expectedType: 'schedule' },
      ];

      for (const testCase of testCases) {
        const receipt = {
          [testCase.receiptProperty]: { toString: () => '0.0.12345' },
        } as MockReceipt;

        const mockAgentResponse: MockAgentResponse = {
          success: true,
          receipt,
          message: 'Success',
        };

        const entities = extractEntitiesFromReceipt(mockAgentResponse, 'Create something');
        expect(entities[0]?.type).toBe(testCase.expectedType);
      }
    });
  });
});