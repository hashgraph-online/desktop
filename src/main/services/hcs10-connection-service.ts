import { Logger } from '../utils/logger';
import { ConfigService } from './config-service';
import { EventEmitter } from 'events';
import {
  HCS10Client,
  Logger as SDKLogger,
  ConnectionsManager,
  Connection as SDKConnection,
} from '@hashgraphonline/standards-sdk';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local Connection interface for desktop app
 */
interface Connection {
  id: string;
  accountId: string;
  profile?: UserProfile;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing';
  createdAt: Date;
  updatedAt?: Date;
  topicId?: string;
  message?: string;
}

interface UserProfile {
  displayName?: string;
  avatar?: string;
  bio?: string;
  publicKey?: string;
  metadata?: Record<string, unknown>;
}

interface HCS10ConnectionResult {
  success: boolean;
  connection?: Connection;
  error?: string;
  message?: string;
}

/**
 * Service for managing HCS-10 agent connections
 * Thin wrapper around ConnectionsManager from standards-sdk
 */
export class HCS10ConnectionService extends EventEmitter {
  private static instance: HCS10ConnectionService;
  private logger: Logger;
  private configService: ConfigService;
  private hcs10Client: HCS10Client | null = null;
  private connectionsManager: ConnectionsManager | null = null;

  private constructor() {
    super();
    this.logger = new Logger({ module: 'HCS10ConnectionService' });
    this.configService = ConfigService.getInstance();
    this.initializeClient();
  }

  /**
   * Gets the singleton instance of HCS10ConnectionService
   */
  static getInstance(): HCS10ConnectionService {
    if (!this.instance) {
      this.instance = new HCS10ConnectionService();
    }
    return this.instance;
  }

  /**
   * Initializes the HCS10 client
   */
  private async initializeClient(): Promise<void> {
    try {
      const config = await this.configService.load();

      if (!config.hedera?.accountId || !config.hedera?.privateKey) {
        this.logger.warn('Hedera credentials not configured');
        return;
      }

      this.hcs10Client = new HCS10Client({
        network: config.hedera.network || 'testnet',
        operatorId: config.hedera.accountId,
        operatorPrivateKey: config.hedera.privateKey,
        logLevel: 'info',
        prettyPrint: false,
      });

      this.connectionsManager = new ConnectionsManager({
        baseClient: this.hcs10Client,
        logLevel: 'info',
        silent: false,
      });

      this.logger.info(
        'HCS10 client and ConnectionsManager initialized for connections'
      );
    } catch (error) {
      this.logger.error('Failed to initialize HCS10 client:', error);
    }
  }

  /**
   * Sends a connection request to another agent
   * Uses HCS10Client.submitConnectionRequest from the SDK
   */
  async sendConnectionRequest(
    targetAccountId: string,
    message?: string
  ): Promise<HCS10ConnectionResult> {
    try {
      if (!this.hcs10Client) {
        await this.initializeClient();
      }

      if (!this.hcs10Client) {
        return {
          success: false,
          error:
            'HCS10 client not initialized. Please configure Hedera credentials.',
        };
      }

      this.logger.info('Sending connection request', {
        to: targetAccountId,
        message,
      });

      const targetProfile = await this.hcs10Client.retrieveProfile(targetAccountId);
      if (!targetProfile.success || !targetProfile.profile?.inboundTopicId) {
        return {
          success: false,
          error: 'Target agent profile or inbound topic not found',
        };
      }

      const result = await this.hcs10Client.submitConnectionRequest(
        targetProfile.profile.inboundTopicId,
        message || 'Connection request'
      );

      this.emit('connectionSent', {
        targetAccountId,
        message,
        inboundTopicId: targetProfile.profile.inboundTopicId,
      });

      this.logger.info('Connection request sent successfully', {
        to: targetAccountId,
        inboundTopicId: targetProfile.profile.inboundTopicId,
      });

      await this.refreshConnections();

      return {
        success: true,
        message: `Connection request sent to ${targetProfile.profile.inboundTopicId}`,
      };
    } catch (error) {
      this.logger.error('Failed to send connection request:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send connection request',
      };
    }
  }

  /**
   * Accepts a connection request
   * Uses HCS10Client.handleConnectionRequest for actual acceptance
   */
  async acceptConnection(connectionId: string): Promise<HCS10ConnectionResult> {
    try {
      if (!this.hcs10Client || !this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.hcs10Client || !this.connectionsManager) {
        return {
          success: false,
          error: 'HCS10 client not initialized.',
        };
      }

      const connection =
        this.connectionsManager.getConnectionByTopicId(connectionId);

      if (!connection) {
        return {
          success: false,
          error: 'Connection not found',
        };
      }

      const config = await this.configService.load();
      const accountId = config.hedera?.accountId;

      if (!accountId) {
        return {
          success: false,
          error: 'Account ID not configured',
        };
      }

      const ourProfile = await this.hcs10Client.retrieveProfile(accountId);
      if (!ourProfile.success || !ourProfile.profile?.inboundTopicId) {
        return {
          success: false,
          error: 'Could not find our inbound topic',
        };
      }

      const result = await this.hcs10Client.handleConnectionRequest(
        ourProfile.profile.inboundTopicId,
        connection.targetAccountId,
        connection.connectionRequestId || 0
      );

      this.emit('connectionAccepted', connection);
      this.logger.info('Connection accepted', { connectionId });

      return {
        success: true,
        message: `Connection accepted with topic ID: ${result.connectionTopicId}`,
      };
    } catch (error) {
      this.logger.error('Failed to accept connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to accept connection',
      };
    }
  }

  /**
   * Rejects a connection request
   * Note: HCS-10 protocol doesn't have explicit rejection - typically you just don't respond
   */
  async rejectConnection(connectionId: string): Promise<HCS10ConnectionResult> {
    try {
      if (!this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.connectionsManager) {
        return {
          success: false,
          error: 'ConnectionsManager not initialized.',
        };
      }

      const connection =
        this.connectionsManager.getConnectionByTopicId(connectionId);

      if (!connection) {
        return {
          success: false,
          error: 'Connection not found',
        };
      }

      if (connection.connectionRequestId) {
        this.connectionsManager.markConnectionRequestProcessed(
          connection.connectionTopicId,
          connection.connectionRequestId
        );
      }

      this.emit('connectionRejected', connection);
      this.logger.info('Connection rejected', { connectionId });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to reject connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reject connection',
      };
    }
  }

  /**
   * Removes a connection
   * Note: ConnectionsManager doesn't have a direct remove method,
   * but connections are typically closed rather than removed
   */
  async removeConnection(connectionId: string): Promise<HCS10ConnectionResult> {
    try {
      if (!this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.connectionsManager) {
        return {
          success: false,
          error: 'ConnectionsManager not initialized.',
        };
      }

      const connection =
        this.connectionsManager.getConnectionByTopicId(connectionId);

      if (!connection) {
        return {
          success: false,
          error: 'Connection not found',
        };
      }

      this.emit('connectionRemoved', connection);
      this.logger.info('Connection removal requested', { connectionId });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to remove connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove connection',
      };
    }
  }

  /**
   * Fetches connections from the network using ConnectionsManager
   */
  private async fetchConnectionsFromNetwork(): Promise<SDKConnection[]> {
    try {
      if (!this.connectionsManager || !this.hcs10Client) {
        await this.initializeClient();
        if (!this.connectionsManager || !this.hcs10Client) {
          throw new Error('ConnectionsManager not initialized');
        }
      }

      const config = await this.configService.load();
      const accountId = config.hedera?.accountId;

      if (!accountId) {
        this.logger.warn('No account ID configured for fetching connections');
        return [];
      }

      this.logger.info('Fetching connections from network', { accountId });

      const networkConnections =
        await this.connectionsManager.fetchConnectionData(accountId);

      this.logger.info('Fetched connections from network', {
        count: networkConnections.length,
        accountId,
      });

      this.emit('connectionsUpdated', networkConnections.length);
      return networkConnections;
    } catch (error) {
      this.logger.error('Failed to fetch connections from network:', error);
      throw error;
    }
  }

  /**
   * Transforms an SDK Connection to the local Connection interface
   */
  private async transformSDKConnectionToLocal(
    sdkConnection: SDKConnection
  ): Promise<Connection> {
    let status: 'pending' | 'accepted' | 'rejected';
    switch (sdkConnection.status) {
      case 'pending':
      case 'needs_confirmation':
        status = 'pending';
        break;
      case 'established':
        status = 'accepted';
        break;
      case 'closed':
        status = 'rejected';
        break;
      default:
        status = 'pending';
    }

    let direction: 'incoming' | 'outgoing';

    if (sdkConnection.needsConfirmation || sdkConnection.status === 'needs_confirmation') {
      direction = 'incoming';
    } else if (sdkConnection.isPending || sdkConnection.status === 'pending') {
      direction = 'outgoing';
    } else if (sdkConnection.status === 'established') {
      if (sdkConnection.connectionRequestId && !sdkConnection.inboundRequestId) {
        direction = 'outgoing';
      } else if (sdkConnection.inboundRequestId && !sdkConnection.connectionRequestId) {
        direction = 'incoming';
      } else {
        direction = 'incoming';
      }
    } else {
      direction = 'incoming';
    }

    return {
      id: sdkConnection.connectionTopicId || uuidv4(),
      accountId: sdkConnection.targetAccountId,
      profile: sdkConnection.profileInfo,
      status,
      direction,
      createdAt: sdkConnection.created,
      updatedAt: sdkConnection.lastActivity,
      topicId: sdkConnection.connectionTopicId,
      message: sdkConnection.memo,
    };
  }

  /**
   * Gets all connections - delegates to ConnectionsManager
   */
  async getConnections(
    status?: 'pending' | 'accepted' | 'rejected'
  ): Promise<Connection[]> {
    try {
      if (!this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.connectionsManager) {
        this.logger.warn('ConnectionsManager not initialized');
        return [];
      }

      let sdkConnections: SDKConnection[];

      if (status === 'pending') {
        sdkConnections = this.connectionsManager.getPendingRequests();
      } else if (status === 'accepted') {
        sdkConnections = this.connectionsManager.getActiveConnections();
      } else {
        sdkConnections = this.connectionsManager.getAllConnections();
      }

      return Promise.all(
        sdkConnections.map((conn) =>
          this.transformSDKConnectionToLocal(conn)
        )
      );
    } catch (error) {
      this.logger.error('Failed to get connections:', error);
      return [];
    }
  }

  /**
   * Gets a specific connection by ID
   */
  async getConnection(connectionId: string): Promise<Connection | undefined> {
    try {
      if (!this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.connectionsManager) {
        return undefined;
      }

      let sdkConnection =
        this.connectionsManager.getConnectionByTopicId(connectionId);
      if (!sdkConnection) {
        sdkConnection =
          this.connectionsManager.getConnectionByAccountId(connectionId);
      }

      if (sdkConnection) {
        return await this.transformSDKConnectionToLocal(sdkConnection);
      }

      return undefined;
    } catch (error) {
      this.logger.error('Failed to get connection:', error);
      return undefined;
    }
  }

  /**
   * Refreshes connections from external sources
   */
  async refreshConnections(): Promise<void> {
    try {
      this.logger.info('Refreshing connections from network');

      if (!this.connectionsManager) {
        await this.initializeClient();
      }

      if (!this.connectionsManager) {
        throw new Error('ConnectionsManager not initialized');
      }

      this.connectionsManager.clearAll();
      const connections = await this.fetchConnectionsFromNetwork();

      this.logger.info('Connections refreshed from network', {
        count: connections.length,
      });
      this.emit('connectionsRefreshed', connections.length);
    } catch (error) {
      this.logger.error('Failed to refresh connections:', error);
      throw error;
    }
  }

  /**
   * Clears all connections
   */
  clearConnections(): void {
    if (this.connectionsManager) {
      this.connectionsManager.clearAll();
    }
    this.logger.info('All connections cleared');
  }

  /**
   * Gets the underlying ConnectionsManager instance
   * Useful for direct access to advanced functionality
   */
  getConnectionsManager(): ConnectionsManager | null {
    return this.connectionsManager;
  }
}
