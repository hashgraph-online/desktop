import { MirrorNodeService } from '../../../src/main/services/mirror-node-service';

jest.mock('../../../src/main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HederaMirrorNode: jest.fn(),
  Logger: jest.fn()
}));

describe('MirrorNodeService', () => {
  let service: MirrorNodeService;
  let mockHederaMirrorNode: any;
  let mockLogger: any;

  const testScheduleId = '0.0.12345';
  const testTimestamp = '1234567890.123456789';
  const testTokenId = '0.0.67890';

  beforeEach(() => {
    jest.clearAllMocks();

    (MirrorNodeService as any).instance = null;

    const { HederaMirrorNode, Logger } = require('@hashgraphonline/standards-sdk');
    mockHederaMirrorNode = HederaMirrorNode;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    Logger.mockImplementation(() => mockLogger);

    service = MirrorNodeService.getInstance();
  });

  const createMockMirrorNodeInstance = () => {
    const mockMirrorNodeInstance = {
      getScheduleInfo: jest.fn(),
      getScheduledTransactionStatus: jest.fn(),
      getTransactionByTimestamp: jest.fn(),
      getTokenInfo: jest.fn()
    };

    mockHederaMirrorNode.mockImplementation(() => mockMirrorNodeInstance);
    return mockMirrorNodeInstance;
  };

  const getLatestMockMirrorNodeInstance = () => {
    const callCount = mockHederaMirrorNode.mock.calls.length;
    if (callCount === 0) {
      return createMockMirrorNodeInstance();
    }
    return mockHederaMirrorNode.mock.results[callCount - 1].value;
  };

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = MirrorNodeService.getInstance();
      const instance2 = MirrorNodeService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MirrorNodeService);
    });

    test('should create new instance when called first time', () => {
      const instance = MirrorNodeService.getInstance();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(MirrorNodeService);
    });
  });

  describe('getMirrorNode', () => {
    test('should create mirror node for testnet by default', () => {
      const mockInstance = createMockMirrorNodeInstance();
      const mirrorNode = (service as any).getMirrorNode();

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('testnet', mockLogger);
      expect(mirrorNode).toBe(mockInstance);
    });

    test('should create mirror node for specified network', () => {
      const mockInstance = createMockMirrorNodeInstance();
      const mirrorNode = (service as any).getMirrorNode('mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('mainnet', mockLogger);
      expect(mirrorNode).toBe(mockInstance);
    });

    test('should cache mirror node instances by network', () => {
      const mockInstance1 = createMockMirrorNodeInstance();
      const mirrorNode1 = (service as any).getMirrorNode('testnet');
      const mirrorNode2 = (service as any).getMirrorNode('testnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledTimes(1);
      expect(mirrorNode1).toBe(mockInstance1);
      expect(mirrorNode2).toBe(mockInstance1);
    });

    test('should create separate instances for different networks', () => {
      const mockInstance1 = createMockMirrorNodeInstance();
      const testnetNode = (service as any).getMirrorNode('testnet');

      const mockInstance2 = createMockMirrorNodeInstance();
      const mainnetNode = (service as any).getMirrorNode('mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledTimes(2);
      expect(testnetNode).toBe(mockInstance1);
      expect(mainnetNode).toBe(mockInstance2);
      expect(testnetNode).not.toBe(mainnetNode);
    });
  });

  describe('getScheduleInfo', () => {
    const mockScheduleInfo = {
      scheduleId: testScheduleId,
      creatorAccountId: '0.0.123',
      payerAccountId: '0.0.456',
      scheduledTransaction: 'mock-transaction-data'
    };

    test('should proxy getScheduleInfo call to mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduleInfo.mockResolvedValue(mockScheduleInfo);

      const result = await service.getScheduleInfo(testScheduleId);

      expect(mockMirrorNodeInstance.getScheduleInfo).toHaveBeenCalledWith(testScheduleId);
      expect(result).toBe(mockScheduleInfo);
    });

    test('should use testnet by default', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduleInfo.mockResolvedValue(mockScheduleInfo);

      await service.getScheduleInfo(testScheduleId);

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('testnet', mockLogger);
    });

    test('should use specified network', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduleInfo.mockResolvedValue(mockScheduleInfo);

      await service.getScheduleInfo(testScheduleId, 'mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('mainnet', mockLogger);
    });

    test('should handle errors from mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      const mirrorError = new Error('Mirror node error');
      mockMirrorNodeInstance.getScheduleInfo.mockRejectedValue(mirrorError);

      await expect(service.getScheduleInfo(testScheduleId))
        .rejects.toThrow('Mirror node error');
    });
  });

  describe('getScheduledTransactionStatus', () => {
    const mockStatus = {
      executed: true,
      executedDate: new Date('2024-01-01T00:00:00Z'),
      deleted: false
    };

    test('should proxy getScheduledTransactionStatus call to mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduledTransactionStatus.mockResolvedValue(mockStatus);

      const result = await service.getScheduledTransactionStatus(testScheduleId);

      expect(mockMirrorNodeInstance.getScheduledTransactionStatus).toHaveBeenCalledWith(testScheduleId);
      expect(result).toEqual(mockStatus);
    });

    test('should use testnet by default', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduledTransactionStatus.mockResolvedValue(mockStatus);

      await service.getScheduledTransactionStatus(testScheduleId);

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('testnet', mockLogger);
    });

    test('should use specified network', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getScheduledTransactionStatus.mockResolvedValue(mockStatus);

      await service.getScheduledTransactionStatus(testScheduleId, 'mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('mainnet', mockLogger);
    });

    test('should handle errors from mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      const mirrorError = new Error('Mirror node error');
      mockMirrorNodeInstance.getScheduledTransactionStatus.mockRejectedValue(mirrorError);

      await expect(service.getScheduledTransactionStatus(testScheduleId))
        .rejects.toThrow('Mirror node error');
    });
  });

  describe('getTransactionByTimestamp', () => {
    const mockTransaction = {
      transactionId: '0.0.123@123456789.000000000',
      type: 'CRYPTOTRANSFER',
      result: 'SUCCESS',
      consensusTimestamp: testTimestamp
    };

    test('should proxy getTransactionByTimestamp call to mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTransactionByTimestamp.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionByTimestamp(testTimestamp);

      expect(mockMirrorNodeInstance.getTransactionByTimestamp).toHaveBeenCalledWith(testTimestamp);
      expect(result).toBe(mockTransaction);
    });

    test('should use testnet by default', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTransactionByTimestamp.mockResolvedValue(mockTransaction);

      await service.getTransactionByTimestamp(testTimestamp);

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('testnet', mockLogger);
    });

    test('should use specified network', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTransactionByTimestamp.mockResolvedValue(mockTransaction);

      await service.getTransactionByTimestamp(testTimestamp, 'mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('mainnet', mockLogger);
    });

    test('should handle errors from mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      const mirrorError = new Error('Mirror node error');
      mockMirrorNodeInstance.getTransactionByTimestamp.mockRejectedValue(mirrorError);

      await expect(service.getTransactionByTimestamp(testTimestamp))
        .rejects.toThrow('Mirror node error');
    });
  });

  describe('getTokenInfo', () => {
    const mockTokenInfo = {
      tokenId: testTokenId,
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 8,
      totalSupply: '1000000000',
      treasuryAccountId: '0.0.123'
    };

    test('should proxy getTokenInfo call to mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTokenInfo.mockResolvedValue(mockTokenInfo);

      const result = await service.getTokenInfo(testTokenId);

      expect(mockMirrorNodeInstance.getTokenInfo).toHaveBeenCalledWith(testTokenId);
      expect(result).toBe(mockTokenInfo);
    });

    test('should use testnet by default', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTokenInfo.mockResolvedValue(mockTokenInfo);

      await service.getTokenInfo(testTokenId);

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('testnet', mockLogger);
    });

    test('should use specified network', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      mockMirrorNodeInstance.getTokenInfo.mockResolvedValue(mockTokenInfo);

      await service.getTokenInfo(testTokenId, 'mainnet');

      expect(mockHederaMirrorNode).toHaveBeenCalledWith('mainnet', mockLogger);
    });

    test('should handle errors from mirror node', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();
      const mirrorError = new Error('Mirror node error');
      mockMirrorNodeInstance.getTokenInfo.mockRejectedValue(mirrorError);

      await expect(service.getTokenInfo(testTokenId))
        .rejects.toThrow('Mirror node error');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle multiple network operations', async () => {
      const mockTestnetNode = createMockMirrorNodeInstance();
      await service.getScheduleInfo(testScheduleId);

      const mockMainnetNode = createMockMirrorNodeInstance();
      await service.getTransactionByTimestamp(testTimestamp, 'mainnet');

      mockTestnetNode.getScheduleInfo.mockResolvedValue({ scheduleId: testScheduleId });
      mockTestnetNode.getTokenInfo.mockResolvedValue({ tokenId: testTokenId });

      mockMainnetNode.getTransactionByTimestamp.mockResolvedValue({ timestamp: testTimestamp });

      const scheduleInfo = await service.getScheduleInfo(testScheduleId);
      const tokenInfo = await service.getTokenInfo(testTokenId);

      const transaction = await service.getTransactionByTimestamp(testTimestamp, 'mainnet');

      expect(scheduleInfo).toEqual({ scheduleId: testScheduleId });
      expect(tokenInfo).toEqual({ tokenId: testTokenId });
      expect(transaction).toEqual({ timestamp: testTimestamp });
    });

    test('should reuse cached mirror node instances', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();

      mockMirrorNodeInstance.getScheduleInfo.mockResolvedValue({ scheduleId: testScheduleId });
      mockMirrorNodeInstance.getTokenInfo.mockResolvedValue({ tokenId: testTokenId });
      mockMirrorNodeInstance.getTransactionByTimestamp.mockResolvedValue({ timestamp: testTimestamp });

      await service.getScheduleInfo(testScheduleId, 'testnet');
      expect(mockHederaMirrorNode).toHaveBeenCalledTimes(1);

      await service.getTokenInfo(testTokenId, 'testnet');
      expect(mockHederaMirrorNode).toHaveBeenCalledTimes(1);

      const mockMainnetInstance = createMockMirrorNodeInstance();
      mockMainnetInstance.getTransactionByTimestamp.mockResolvedValue({ timestamp: testTimestamp });

      await service.getTransactionByTimestamp(testTimestamp, 'mainnet');
      expect(mockHederaMirrorNode).toHaveBeenCalledTimes(2);
    });

    test('should handle mixed successful and failed operations', async () => {
      const mockMirrorNodeInstance = createMockMirrorNodeInstance();

      mockMirrorNodeInstance.getScheduleInfo.mockResolvedValue({ scheduleId: testScheduleId });

      const mirrorError = new Error('Network timeout');
      mockMirrorNodeInstance.getTokenInfo.mockRejectedValue(mirrorError);

      const scheduleInfo = await service.getScheduleInfo(testScheduleId);
      expect(scheduleInfo).toEqual({ scheduleId: testScheduleId });

      await expect(service.getTokenInfo(testTokenId))
        .rejects.toThrow('Network timeout');
    });
  });
});
