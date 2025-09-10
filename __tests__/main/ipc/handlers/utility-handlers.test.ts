import { ipcMain } from 'electron';
import { setupMirrorNodeHandlers, setupTransactionParserHandlers, setupUpdateHandlers, setupOpenRouterHandlers } from '../../../../src/main/ipc/handlers/utility-handlers';
import { MirrorNodeService } from '../../../../src/main/services/mirror-node-service';
import { TransactionParserService } from '../../../../src/main/services/transaction-parser-service';
import { UpdateService } from '../../../../src/main/services/update-service';
import { OpenRouterService } from '../../../../src/main/services/open-router-service';
import { Logger } from '../../../../src/main/utils/logger';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getVersion: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
}));

jest.mock('../../../../src/main/services/mirror-node-service');
jest.mock('../../../../src/main/services/transaction-parser-service');
jest.mock('../../../../src/main/services/update-service');
jest.mock('../../../../src/main/services/open-router-service');
jest.mock('../../../../src/main/utils/logger');
jest.mock('../../../../src/main/ipc/handlers/shared-handler-utils', () => ({
  handleIPCError: jest.fn(),
  createSuccessResponse: jest.fn(),
}));

describe('Utility IPC Handlers', () => {
  let mockIpcMain: jest.Mocked<typeof ipcMain>;
  let mockMirrorNodeService: jest.Mocked<MirrorNodeService>;
  let mockTransactionParserService: jest.Mocked<TransactionParserService>;
  let mockUpdateService: jest.Mocked<UpdateService>;
  let mockOpenRouterService: jest.Mocked<OpenRouterService>;
  let mockHandleIPCError: jest.Mock;
  let mockCreateSuccessResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;
    mockMirrorNodeService = {
      getScheduleInfo: jest.fn(),
      getScheduledTransactionStatus: jest.fn(),
      getTransactionByTimestamp: jest.fn(),
      getTokenInfo: jest.fn(),
    } as any;

    mockTransactionParserService = {
      validateTransactionBytes: jest.fn(),
      parseTransactionBytes: jest.fn(),
      extractStringField: jest.fn(),
      extractNumberField: jest.fn(),
    } as any;

    mockUpdateService = {
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      getCurrentVersion: jest.fn(),
      getUpdateInfo: jest.fn(),
    } as any;

    mockOpenRouterService = {
      getModels: jest.fn(),
      getModel: jest.fn(),
    } as any;

    (MirrorNodeService.getInstance as jest.Mock).mockReturnValue(mockMirrorNodeService);
    (TransactionParserService.getInstance as jest.Mock).mockReturnValue(mockTransactionParserService);
    (UpdateService.getInstance as jest.Mock).mockReturnValue(mockUpdateService);
    (OpenRouterService.getInstance as jest.Mock).mockReturnValue(mockOpenRouterService);

    const utils = require('../../../../src/main/ipc/handlers/shared-handler-utils');
    mockHandleIPCError = utils.handleIPCError;
    mockCreateSuccessResponse = utils.createSuccessResponse;
  });

  describe('setupMirrorNodeHandlers', () => {
    beforeEach(() => {
      setupMirrorNodeHandlers();
    });

    test('should register mirror node handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(4);
      expect(mockIpcMain.handle).toHaveBeenCalledWith('mirrorNode:getScheduleInfo', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('mirrorNode:getScheduledTransactionStatus', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('mirrorNode:getTransactionByTimestamp', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('mirrorNode:getTokenInfo', expect.any(Function));
    });

    test('should handle getScheduleInfo successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getScheduleInfo')?.[1];
      const mockScheduleInfo = { scheduleId: 'test-schedule' };

      mockMirrorNodeService.getScheduleInfo.mockResolvedValue(mockScheduleInfo);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockScheduleInfo });

      const result = await handler(null, 'test-schedule-id', 'testnet');

      expect(mockMirrorNodeService.getScheduleInfo).toHaveBeenCalledWith('test-schedule-id', 'testnet');
      expect(mockCreateSuccessResponse).toHaveBeenCalledWith(mockScheduleInfo);
      expect(result).toEqual({ success: true, data: mockScheduleInfo });
    });

    test('should handle getScheduleInfo error', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getScheduleInfo')?.[1];
      const error = new Error('Schedule not found');

      mockMirrorNodeService.getScheduleInfo.mockRejectedValue(error);
      mockHandleIPCError.mockReturnValue({ success: false, error: 'Failed to fetch schedule info' });

      const result = await handler(null, 'invalid-schedule-id');

      expect(mockHandleIPCError).toHaveBeenCalledWith(error, 'Failed to fetch schedule info');
      expect(result).toEqual({ success: false, error: 'Failed to fetch schedule info' });
    });

    test('should handle getScheduledTransactionStatus successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getScheduledTransactionStatus')?.[1];
      const mockStatus = { status: 'EXECUTED' };

      mockMirrorNodeService.getScheduledTransactionStatus.mockResolvedValue(mockStatus);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockStatus });

      const result = await handler(null, 'test-schedule-id', 'mainnet');

      expect(mockMirrorNodeService.getScheduledTransactionStatus).toHaveBeenCalledWith('test-schedule-id', 'mainnet');
      expect(result).toEqual({ success: true, data: mockStatus });
    });

    test('should handle getTransactionByTimestamp successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getTransactionByTimestamp')?.[1];
      const mockTransactions = [{ transactionId: 'test-tx' }];

      mockMirrorNodeService.getTransactionByTimestamp.mockResolvedValue(mockTransactions);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockTransactions });

      const result = await handler(null, '1234567890.123456789', 'testnet');

      expect(mockMirrorNodeService.getTransactionByTimestamp).toHaveBeenCalledWith('1234567890.123456789', 'testnet');
      expect(result).toEqual({ success: true, data: mockTransactions });
    });

    test('should handle getTokenInfo successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getTokenInfo')?.[1];
      const mockTokenInfo = { tokenId: '0.0.12345', name: 'Test Token' };

      mockMirrorNodeService.getTokenInfo.mockResolvedValue(mockTokenInfo);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockTokenInfo });

      const result = await handler(null, '0.0.12345', 'mainnet');

      expect(mockMirrorNodeService.getTokenInfo).toHaveBeenCalledWith('0.0.12345', 'mainnet');
      expect(result).toEqual({ success: true, data: mockTokenInfo });
    });
  });

  describe('setupTransactionParserHandlers', () => {
    beforeEach(() => {
      setupTransactionParserHandlers();
    });

    test('should register transaction parser handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(4);
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transactionParser:validate', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transactionParser:parse', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transactionParser:extractString', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transactionParser:extractNumber', expect.any(Function));
    });

    test('should handle validate successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'transactionParser:validate')?.[1];
      const mockValidation = { valid: true, format: 'base64' };

      mockTransactionParserService.validateTransactionBytes.mockResolvedValue(mockValidation);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockValidation });

      const result = await handler(null, 'SGVsbG8gV29ybGQ=');

      expect(mockTransactionParserService.validateTransactionBytes).toHaveBeenCalledWith('SGVsbG8gV29ybGQ=');
      expect(result).toEqual({ success: true, data: mockValidation });
    });

    test('should handle parse successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'transactionParser:parse')?.[1];
      const mockParsedData = { transactionId: 'test-tx', type: 'CONTRACT_CALL' };

      mockTransactionParserService.parseTransactionBytes.mockResolvedValue(mockParsedData);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockParsedData });

      const result = await handler(null, 'SGVsbG8gV29ybGQ=', { extractNumbers: true });

      expect(mockTransactionParserService.parseTransactionBytes).toHaveBeenCalledWith('SGVsbG8gV29ybGQ=', { extractNumbers: true });
      expect(result).toEqual({ success: true, data: mockParsedData });
    });

    test('should handle extractString successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'transactionParser:extractString')?.[1];
      const mockStringValue = 'extracted string';

      mockTransactionParserService.extractStringField.mockResolvedValue(mockStringValue);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockStringValue });

      const result = await handler(null, 'SGVsbG8gV29ybGQ=', 'memo', 'utf8');

      expect(mockTransactionParserService.extractStringField).toHaveBeenCalledWith('SGVsbG8gV29ybGQ=', 'memo', 'utf8');
      expect(result).toEqual({ success: true, data: mockStringValue });
    });

    test('should handle extractNumber successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'transactionParser:extractNumber')?.[1];
      const mockNumberValue = 12345;

      mockTransactionParserService.extractNumberField.mockResolvedValue(mockNumberValue);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockNumberValue });

      const result = await handler(null, 'SGVsbG8gV29ybGQ=', 'amount');

      expect(mockTransactionParserService.extractNumberField).toHaveBeenCalledWith('SGVsbG8gV29ybGQ=', 'amount');
      expect(result).toEqual({ success: true, data: mockNumberValue });
    });
  });

  describe('setupUpdateHandlers', () => {
    beforeEach(() => {
      setupUpdateHandlers();
    });

    test('should register update handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(4);
      expect(mockIpcMain.handle).toHaveBeenCalledWith('update:checkForUpdates', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('update:downloadUpdate', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('update:getCurrentVersion', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('update:getUpdateInfo', expect.any(Function));
    });

    test('should handle checkForUpdates successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:checkForUpdates')?.[1];
      const mockUpdateInfo = { version: '1.2.0', releaseNotes: 'New features' };

      mockUpdateService.checkForUpdates.mockResolvedValue(mockUpdateInfo);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockUpdateInfo });

      const result = await handler(null);

      expect(mockUpdateService.checkForUpdates).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockUpdateInfo });
    });

    test('should handle downloadUpdate successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:downloadUpdate')?.[1];
      const mockDownloadResult = { downloaded: true, size: 1024000 };

      mockUpdateService.downloadUpdate.mockResolvedValue(mockDownloadResult);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockDownloadResult });

      const result = await handler(null);

      expect(mockUpdateService.downloadUpdate).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockDownloadResult });
    });

    test('should handle getCurrentVersion successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:getCurrentVersion')?.[1];
      const mockVersion = '1.0.0';

      mockUpdateService.getCurrentVersion.mockReturnValue(mockVersion);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockVersion });

      const result = await handler(null);

      expect(mockUpdateService.getCurrentVersion).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockVersion });
    });

    test('should handle getUpdateInfo successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:getUpdateInfo')?.[1];
      const mockUpdateInfo = { version: '1.2.0', downloaded: false };

      mockUpdateService.getUpdateInfo.mockReturnValue(mockUpdateInfo);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockUpdateInfo });

      const result = await handler(null);

      expect(mockUpdateService.getUpdateInfo).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockUpdateInfo });
    });
  });

  describe('setupOpenRouterHandlers', () => {
    beforeEach(() => {
      setupOpenRouterHandlers();
    });

    test('should register OpenRouter handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(2);
      expect(mockIpcMain.handle).toHaveBeenCalledWith('openRouter:getModels', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('openRouter:getModel', expect.any(Function));
    });

    test('should handle getModels successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'openRouter:getModels')?.[1];
      const mockModels = [{ id: 'openai/gpt-4', name: 'GPT-4' }];

      mockOpenRouterService.getModels.mockResolvedValue(mockModels);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockModels });

      const result = await handler(null, { forceRefresh: true });

      expect(mockOpenRouterService.getModels).toHaveBeenCalledWith({ forceRefresh: true });
      expect(result).toEqual({ success: true, data: mockModels });
    });

    test('should handle getModel successfully', async () => {
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'openRouter:getModel')?.[1];
      const mockModel = { id: 'openai/gpt-4', name: 'GPT-4', contextLength: 8192 };

      mockOpenRouterService.getModel.mockResolvedValue(mockModel);
      mockCreateSuccessResponse.mockReturnValue({ success: true, data: mockModel });

      const result = await handler(null, 'openai/gpt-4');

      expect(mockOpenRouterService.getModel).toHaveBeenCalledWith('openai/gpt-4');
      expect(result).toEqual({ success: true, data: mockModel });
    });
  });

  describe('Error Handling', () => {
    test('should handle mirror node service errors', async () => {
      setupMirrorNodeHandlers();
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'mirrorNode:getScheduleInfo')?.[1];
      const error = new Error('Service unavailable');

      mockMirrorNodeService.getScheduleInfo.mockRejectedValue(error);
      mockHandleIPCError.mockReturnValue({ success: false, error: 'Failed to fetch schedule info' });

      const result = await handler(null, 'test-schedule-id');

      expect(mockHandleIPCError).toHaveBeenCalledWith(error, 'Failed to fetch schedule info');
      expect(result).toEqual({ success: false, error: 'Failed to fetch schedule info' });
    });

    test('should handle transaction parser service errors', async () => {
      setupTransactionParserHandlers();
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'transactionParser:validate')?.[1];
      const error = new Error('Invalid transaction format');

      mockTransactionParserService.validateTransactionBytes.mockRejectedValue(error);
      mockHandleIPCError.mockReturnValue({ success: false, error: 'Failed to validate transaction' });

      const result = await handler(null, 'invalid-bytes');

      expect(mockHandleIPCError).toHaveBeenCalledWith(error, 'Failed to validate transaction');
    });

    test('should handle update service errors', async () => {
      setupUpdateHandlers();
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:checkForUpdates')?.[1];
      const error = new Error('Network error');

      mockUpdateService.checkForUpdates.mockRejectedValue(error);
      mockHandleIPCError.mockReturnValue({ success: false, error: 'Failed to check for updates' });

      const result = await handler(null);

      expect(mockHandleIPCError).toHaveBeenCalledWith(error, 'Failed to check for updates');
    });

    test('should handle OpenRouter service errors', async () => {
      setupOpenRouterHandlers();
      const handler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'openRouter:getModels')?.[1];
      const error = new Error('API rate limited');

      mockOpenRouterService.getModels.mockRejectedValue(error);
      mockHandleIPCError.mockReturnValue({ success: false, error: 'Failed to fetch models' });

      const result = await handler(null);

      expect(mockHandleIPCError).toHaveBeenCalledWith(error, 'Failed to fetch models');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete mirror node workflow', async () => {
      setupMirrorNodeHandlers();

      const mockScheduleInfo = { scheduleId: 'test-schedule', executed: true };
      const mockTransactionStatus = { status: 'EXECUTED' };
      const mockTransactions = [{ transactionId: 'test-tx' }];
      const mockTokenInfo = { tokenId: '0.0.12345', name: 'Test Token' };

      mockMirrorNodeService.getScheduleInfo.mockResolvedValue(mockScheduleInfo);
      mockMirrorNodeService.getScheduledTransactionStatus.mockResolvedValue(mockTransactionStatus);
      mockMirrorNodeService.getTransactionByTimestamp.mockResolvedValue(mockTransactions);
      mockMirrorNodeService.getTokenInfo.mockResolvedValue(mockTokenInfo);

      mockCreateSuccessResponse.mockImplementation((data) => ({ success: true, data }));

      const handlers = mockIpcMain.handle.mock.calls;

      const scheduleHandler = handlers.find(call => call[0] === 'mirrorNode:getScheduleInfo')?.[1];
      const statusHandler = handlers.find(call => call[0] === 'mirrorNode:getScheduledTransactionStatus')?.[1];
      const transactionHandler = handlers.find(call => call[0] === 'mirrorNode:getTransactionByTimestamp')?.[1];
      const tokenHandler = handlers.find(call => call[0] === 'mirrorNode:getTokenInfo')?.[1];

      const scheduleResult = await scheduleHandler(null, 'test-schedule-id', 'testnet');
      const statusResult = await statusHandler(null, 'test-schedule-id', 'mainnet');
      const transactionResult = await transactionHandler(null, '1234567890.123456789', 'testnet');
      const tokenResult = await tokenHandler(null, '0.0.12345', 'mainnet');

      expect(scheduleResult).toEqual({ success: true, data: mockScheduleInfo });
      expect(statusResult).toEqual({ success: true, data: mockTransactionStatus });
      expect(transactionResult).toEqual({ success: true, data: mockTransactions });
      expect(tokenResult).toEqual({ success: true, data: mockTokenInfo });
    });

    test('should handle transaction parser workflow', async () => {
      setupTransactionParserHandlers();

      const transactionBytes = 'SGVsbG8gV29ybGQ=';
      const mockValidation = { valid: true, format: 'base64' };
      const mockParsedData = { transactionId: 'test-tx', type: 'CONTRACT_CALL' };
      const mockStringValue = 'memo text';
      const mockNumberValue = 1000000;

      mockTransactionParserService.validateTransactionBytes.mockResolvedValue(mockValidation);
      mockTransactionParserService.parseTransactionBytes.mockResolvedValue(mockParsedData);
      mockTransactionParserService.extractStringField.mockResolvedValue(mockStringValue);
      mockTransactionParserService.extractNumberField.mockResolvedValue(mockNumberValue);

      mockCreateSuccessResponse.mockImplementation((data) => ({ success: true, data }));

      const handlers = mockIpcMain.handle.mock.calls;

      const validateHandler = handlers.find(call => call[0] === 'transactionParser:validate')?.[1];
      const parseHandler = handlers.find(call => call[0] === 'transactionParser:parse')?.[1];
      const stringHandler = handlers.find(call => call[0] === 'transactionParser:extractString')?.[1];
      const numberHandler = handlers.find(call => call[0] === 'transactionParser:extractNumber')?.[1];

      const validateResult = await validateHandler(null, transactionBytes);
      const parseResult = await parseHandler(null, transactionBytes, { extractNumbers: true });
      const stringResult = await stringHandler(null, transactionBytes, 'memo', 'utf8');
      const numberResult = await numberHandler(null, transactionBytes, 'amount');

      expect(validateResult).toEqual({ success: true, data: mockValidation });
      expect(parseResult).toEqual({ success: true, data: mockParsedData });
      expect(stringResult).toEqual({ success: true, data: mockStringValue });
      expect(numberResult).toEqual({ success: true, data: mockNumberValue });
    });
  });
});

