import { HCS10DiscoveryService } from '../../src/main/services/HCS10DiscoveryService';
import { Logger } from '../../src/main/utils/logger';
import { ConfigService } from '../../src/main/services/ConfigService';
import { EventEmitter } from 'events';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  HCS10Client: jest.fn().mockImplementation(() => ({
    retrieveProfile: jest.fn(),
  })),
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  AIAgentCapability: {},
}));
jest.mock('../../src/main/services/ConfigService');
jest.mock('../../src/main/utils/logger');

describe('HCS10DiscoveryService', () => {
  let service: HCS10DiscoveryService;
  let mockConfig: { hedera: { accountId: string; privateKey: string; network: string } };
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockConfig = {
      hedera: {
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        network: 'testnet'
      }
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<Logger>;
    (ConfigService.getInstance as jest.Mock).mockReturnValue({
      load: jest.fn().mockResolvedValue(mockConfig)
    });

    service = HCS10DiscoveryService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
    (HCS10DiscoveryService as unknown as { instance: HCS10DiscoveryService | null }).instance = null;
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = HCS10DiscoveryService.getInstance();
      const instance2 = HCS10DiscoveryService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should extend EventEmitter', () => {
      expect(service).toBeInstanceOf(EventEmitter);
    });
  });

  describe('discoverAgents', () => {
    test('should discover agents with default pagination', async () => {
      const _mockAgents = [
        { accountId: '0.0.111', name: 'Agent 1' },
        { accountId: '0.0.222', name: 'Agent 2' }
      ];

      const result = await service.discoverAgents();

      expect(result.agents).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    test('should apply filters when provided', async () => {
      const filters = {
        capabilities: [1, 2],
        hasProfileImage: true
      };

      const result = await service.discoverAgents(filters);

      expect(result.filters).toEqual(filters);
    });

    test('should handle custom pagination', async () => {
      const pagination = { page: 2, limit: 10 };

      const result = await service.discoverAgents({}, pagination);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('searchAgents', () => {
    test('should search agents by query string', async () => {
      const query = 'test agent';
      const capabilities = [1, 2];

      const result = await service.searchAgents(query, capabilities);

      expect(result.query).toBe(query);
      expect(result.capabilities).toEqual(capabilities);
      expect(result.agents).toBeDefined();
    });

    test('should handle empty query', async () => {
      const result = await service.searchAgents('');

      expect(result.query).toBe('');
      expect(result.agents).toBeDefined();
    });
  });

  describe('getAgentProfile', () => {
    test('should retrieve agent profile successfully', async () => {
      const accountId = '0.0.123456';
      const mockProfile = {
        success: true,
        profile: {
          accountId,
          name: 'Test Agent',
          description: 'Test description'
        }
      };

      const { HCS10Client } = await import('@hashgraphonline/standards-sdk');
      const mockClientInstance = {
        retrieveProfile: jest.fn().mockResolvedValue(mockProfile)
      };
      (HCS10Client as jest.Mock).mockImplementation(() => mockClientInstance);

      const result = await service.getAgentProfile(accountId);

      expect(mockClientInstance.retrieveProfile).toHaveBeenCalledWith(accountId);
      expect(result).toEqual(mockProfile);
    });

    test('should handle profile retrieval failure', async () => {
      const accountId = '0.0.123456';
      
      const { HCS10Client } = await import('@hashgraphonline/standards-sdk');
      const mockClientInstance = {
        retrieveProfile: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      (HCS10Client as jest.Mock).mockImplementation(() => mockClientInstance);

      const result = await service.getAgentProfile(accountId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should emit profileRetrieved event on success', async () => {
      const accountId = '0.0.123456';
      const mockProfile = {
        success: true,
        profile: { accountId, name: 'Test Agent' }
      };

      const { HCS10Client } = await import('@hashgraphonline/standards-sdk');
      const mockClientInstance = {
        retrieveProfile: jest.fn().mockResolvedValue(mockProfile)
      };
      (HCS10Client as jest.Mock).mockImplementation(() => mockClientInstance);

      const eventSpy = jest.fn();
      service.on('profileRetrieved', eventSpy);

      await service.getAgentProfile(accountId);

      expect(eventSpy).toHaveBeenCalledWith({
        accountId,
        profile: mockProfile.profile
      });
    });
  });

  describe('cacheProfiles', () => {
    test('should cache profiles for offline access', async () => {
      const profiles = [
        { accountId: '0.0.111', name: 'Agent 1' },
        { accountId: '0.0.222', name: 'Agent 2' }
      ];

      await service.cacheProfiles(profiles);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cached profiles for offline access',
        { count: profiles.length }
      );
    });

    test('should handle empty profiles array', async () => {
      await service.cacheProfiles([]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cached profiles for offline access',
        { count: 0 }
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle configuration loading errors', async () => {
      (ConfigService.getInstance().load as jest.Mock).mockRejectedValue(
        new Error('Config load failed')
      );

      const result = await service.getAgentProfile('0.0.123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Config load failed');
    });

    test('should handle missing Hedera credentials', async () => {
      (ConfigService.getInstance().load as jest.Mock).mockResolvedValue({
        hedera: {}
      });

      const result = await service.getAgentProfile('0.0.123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing Hedera credentials');
    });
  });
});