const mockFormatConverterRegistry = {
  register: jest.fn(),
};

module.exports = {
  FormatConverterRegistry: jest
    .fn()
    .mockImplementation(() => mockFormatConverterRegistry),
  TopicIdToHrlConverter: jest.fn(),
  StringNormalizationConverter: jest.fn(),
  EntityFormat: {
    ACCOUNT_ID: 'accountId',
    TOKEN_ID: 'tokenId',
    TOPIC_ID: 'topicId',
    CONTRACT_ID: 'contractId',
    SCHEDULE_ID: 'scheduleId',
  },
  EntityAssociation: class EntityAssociation {
    constructor(data) {
      Object.assign(this, data);
    }
  },
  EntityResolver: jest.fn().mockImplementation(() => ({
    extractEntities: jest.fn().mockResolvedValue([]),
    resolveEntity: jest.fn().mockResolvedValue(null),
    validateEntity: jest.fn().mockReturnValue(true),
  })),
  SafeConversationalAgent: jest.fn().mockImplementation(() => ({
    processMessage: jest.fn().mockResolvedValue({
      message: 'Test response',
      output: 'Test output',
      metadata: {
        transactionId: 'test-tx-id',
        scheduleId: 'test-schedule-id',
        notes: ['test note'],
        description: 'Test description',
      },
    }),
    setParameterPreprocessingCallback: jest.fn(),
  })),
};
