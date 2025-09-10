import { ipcMain } from 'electron';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/config-service';
import { HCS10ConnectionService } from '../services/hcs10-connection-service';
import { Registration, RegistrationSearchOptions, ProfileType, AIAgentProfile } from '@hashgraphonline/standards-sdk';
import { getHCS10Client } from '../services/hcs10-client-factory';

interface AgentRegistration {
  accountId: string;
  profile?: AIAgentProfile;
  metadata?: AIAgentProfile;
  [key: string]: unknown;
}

const logger = new Logger({ module: 'HCS10DiscoveryHandlers' });
const configService = ConfigService.getInstance();
const connectionService = HCS10ConnectionService.getInstance();

const registration = new (class extends Registration {})();
let hcs10Client: any | null = null;

/**
 * Gets or creates HCS10Client instance
 */
async function getClient(): Promise<any> { if (!hcs10Client) hcs10Client = await getHCS10Client(); return hcs10Client; }

/**
 * Registers IPC handlers for HCS-10 agent discovery functionality
 */
export function registerHCS10DiscoveryHandlers(): void {
  /**
   * Handler for discovering agents
   */
  ipcMain.handle('hcs10:discover-agents', async (event, args) => {
    try {
      logger.info('Discovering agents', args);

      const { filters = {}, pagination = {} } = args;
      const config = await configService.load();
      const network = config.hedera?.network || 'testnet';

      const searchOptions: RegistrationSearchOptions = {
        network,
        tags: filters.capabilities,
      };

      const result = await registration.findRegistrations(searchOptions);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch agents');
      }

      let agents: AgentRegistration[] = (result.registrations ||
        []) as unknown as AgentRegistration[];

      const excludePatterns = [
        'test',
        'bob',
        'alice',
        'demo',
        'example',
        'sample',
        'staging',
        'dev',
      ];

      agents = agents.filter((agent: AgentRegistration) => {
        const profile = agent.profile || agent.metadata || {};
        const name = (
          (profile as AIAgentProfile).display_name ||
          (profile as AIAgentProfile).alias ||
          ''
        ).toLowerCase();
        const accountId = (agent.accountId || '').toLowerCase();

        const shouldExclude = excludePatterns.some(
          (pattern) => name.includes(pattern) || accountId.includes(pattern)
        );

        return !shouldExclude;
      });

      if (filters.profileType && filters.profileType !== 'all') {
        const targetType =
          filters.profileType === 'agent' ? 'AI_AGENT' : 'PERSONAL';
        agents = agents.filter((agent: AgentRegistration) => {
          const profile = agent.profile || agent.metadata || {};
          return (
            (profile as AIAgentProfile).type ===
            ProfileType[targetType as keyof typeof ProfileType]
          );
        });
      }

      if (filters.hasProfileImage === true) {
        agents = agents.filter((agent: AgentRegistration) => {
          const profile = agent.profile || agent.metadata || {};
          return !!(profile as AIAgentProfile).profileImage;
        });
      }

      const { page = 1, limit = 20 } = pagination;
      const start = (page - 1) * limit;
      const paginatedAgents = agents.slice(start, start + limit);

      return {
        success: true,
        data: {
          agents: paginatedAgents,
          pagination: {
            page,
            limit,
            total: agents.length,
            totalPages: Math.ceil(agents.length / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Failed to discover agents:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to discover agents',
      };
    }
  });

  /**
   * Handler for searching agents
   */
  ipcMain.handle('hcs10:search-agents', async (event, args) => {
    try {
      logger.info('Searching agents', args);

      const { query, capabilities } = args;
      const config = await configService.load();
      const network = config.hedera?.network || 'testnet';

      const searchOptions: RegistrationSearchOptions = {
        network,
        tags: capabilities,
      };

      const result = await registration.findRegistrations(searchOptions);

      if (!result.success) {
        throw new Error(result.error || 'Failed to search agents');
      }

      const queryLower = query.toLowerCase();
      const excludePatterns = [
        'test',
        'bob',
        'alice',
        'demo',
        'example',
        'sample',
        'staging',
        'dev',
      ];

      const filteredAgents = (
        (result.registrations || []) as unknown as AgentRegistration[]
      ).filter((agent: AgentRegistration) => {
        const profile = agent.profile || agent.metadata || {};
        const displayName = (
          (profile as AIAgentProfile).display_name ||
          (profile as AIAgentProfile).alias ||
          ''
        ).toLowerCase();
        const bio = (profile as AIAgentProfile).bio || '';
        const accountId = (agent.accountId || '').toLowerCase();

        const shouldExclude = excludePatterns.some(
          (pattern) =>
            displayName.includes(pattern) || accountId.includes(pattern)
        );

        if (shouldExclude) return false;

        return (
          displayName.includes(queryLower) ||
          bio.includes(queryLower) ||
          accountId.includes(queryLower)
        );
      });

      return {
        success: true,
        data: {
          agents: filteredAgents,
          metadata: {
            query,
            capabilities,
            totalResults: filteredAgents.length,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to search agents:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search agents',
      };
    }
  });

  /**
   * Handler for getting agent profile
   */
  ipcMain.handle('hcs10:get-agent-profile', async (event, args) => {
    try {
      logger.info('Getting agent profile', args);

      const { accountId } = args;
      const config = await configService.load();
      const network = config.hedera?.network || 'testnet';

      const searchOptions: RegistrationSearchOptions = {
        network,
        accountId,
      };

      const result = await registration.findRegistrations(searchOptions);

      if (
        result.success &&
        result.registrations &&
        result.registrations.length > 0
      ) {
        const profile = result.registrations[0].metadata || {};
        return {
          success: true,
          data: profile,
        };
      }

      try {
        const client = await getHCS10Client();
        const profileResult = await client.retrieveProfile(accountId);

        if (profileResult.success && profileResult.profile) {
          return {
            success: true,
            data: profileResult.profile,
          };
        }
      } catch (clientError) {
        logger.warn('Failed to retrieve profile directly:', clientError);
      }

      return {
        success: false,
        error: 'Profile not found',
      };
    } catch (error) {
      logger.error('Failed to get agent profile:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get agent profile',
      };
    }
  });

  /**
   * Handler for sending connection request
   */
  ipcMain.handle('hcs10:send-connection-request', async (event, args) => {
    try {
      logger.info('Sending connection request', args);

      const result = await connectionService.sendConnectionRequest(
        args.targetAccountId,
        args.message
      );

      return result;
    } catch (error) {
      logger.error('Failed to send connection request:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send connection request',
      };
    }
  });

  /**
   * Handler for getting connections
   */
  ipcMain.handle('hcs10:get-connections', async (event, args) => {
    try {
      const connections = await connectionService.getConnections(args?.status);

      return {
        success: true,
        data: connections,
      };
    } catch (error) {
      logger.error('Failed to get connections:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get connections',
      };
    }
  });

  /**
   * Handler for accepting connection
   */
  ipcMain.handle('hcs10:accept-connection', async (event, args) => {
    try {
      logger.info('Accepting connection', args);

      const result = await connectionService.acceptConnection(
        args.connectionId
      );

      return result;
    } catch (error) {
      logger.error('Failed to accept connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to accept connection',
      };
    }
  });

  /**
   * Handler for rejecting connection
   */
  ipcMain.handle('hcs10:reject-connection', async (event, args) => {
    try {
      logger.info('Rejecting connection', args);

      const result = await connectionService.rejectConnection(
        args.connectionId
      );

      return result;
    } catch (error) {
      logger.error('Failed to reject connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reject connection',
      };
    }
  });

  /**
   * Handler for removing connection
   */
  ipcMain.handle('hcs10:remove-connection', async (event, args) => {
    try {
      logger.info('Removing connection', args);

      const result = await connectionService.removeConnection(
        args.connectionId
      );

      return result;
    } catch (error) {
      logger.error('Failed to remove connection:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove connection',
      };
    }
  });

  /**
   * Handler for refreshing connections from network
   */
  ipcMain.handle('hcs10:refresh-connections', async () => {
    try {
      logger.info('Refreshing connections from network');

      await connectionService.refreshConnections();

      return {
        success: true,
        data: { message: 'Connections refreshed successfully' },
      };
    } catch (error) {
      logger.error('Failed to refresh connections:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to refresh connections',
      };
    }
  });

  logger.info('HCS-10 discovery handlers registered');
}
