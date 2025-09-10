import { ipcMain } from 'electron';
import { Logger } from '../utils/logger';
import { HCS10ConnectionService } from '../services/hcs10-connection-service';
import { getHCS10Client } from '../services/hcs10-client-factory';

const logger = new Logger({ module: 'HCS10ChatHandlers' });
const connectionService = HCS10ConnectionService.getInstance();

let hcs10Client: any | null = null;

/**
 * Gets or creates HCS10Client instance
 */
async function getClient(): Promise<any> {
  if (!hcs10Client) hcs10Client = await getHCS10Client();
  return hcs10Client;
}

/**
 * Registers IPC handlers for HCS-10 chat functionality
 */
export function registerHCS10ChatHandlers(): void {
  /**
   * Handler for getting conversations (agents and connection requests)
   */
  ipcMain.handle('hcs10:get-conversations', async (event, args) => {
    try {
      logger.info('Getting conversations', args);

      const { network } = args;

      await connectionService.refreshConnections();

      const activeConnections =
        await connectionService.getConnections('accepted');

      const agents = activeConnections.map((conn) => ({
        id: conn.topicId || conn.id,
        accountId: conn.accountId,
        name: conn.profile?.displayName || conn.accountId || 'Unknown Agent',
        type: 'active' as const,
        lastMessage: conn.message,
        timestamp: conn.updatedAt ? new Date(conn.updatedAt) : new Date(),
        profile: {
          displayName: conn.profile?.displayName || conn.accountId,
          isAI: true,
          isRegistryBroker: false,
        },
        network,
        connectionTopicId: conn.topicId,
      }));

      const pendingConnections =
        await connectionService.getConnections('pending');
      const connectionRequests = pendingConnections
        .filter((conn) => conn.direction === 'incoming')
        .map((conn) => ({
          id: conn.id,
          requesting_account_id: conn.accountId,
          sequence_number: Date.now(),
          memo: conn.message || '',
          operator_id: conn.accountId,
        }));

      const pendingRequestCount = connectionRequests.length;

      logger.info(
        `Returning ${agents.length} agents and ${connectionRequests.length} requests`
      );
      return {
        success: true,
        agents,
        connectionRequests,
        pendingRequestCount,
      };
    } catch (error) {
      logger.error('Failed to get conversations:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get conversations',
      };
    }
  });

  /**
   * Handler for getting messages from a topic
   */
  ipcMain.handle('hcs10:get-messages', async (event, args) => {
    try {
      logger.info('Getting messages', args);

      const { topicId } = args;

      if (!topicId) {
        return {
          success: false,
          error: 'Topic ID is required',
        };
      }

      const client = await getClient();
      const result = await client.getMessageStream(topicId);

      const messages = (result.messages || []).map(
        (msg: any, index: number) => ({
          data: msg.data || msg.contents || msg.message || '',
          contents: msg.contents || msg.message || '',
          message: msg.contents || msg.message || '',
          op: msg.op,
          schedule_id: msg.schedule_id || msg.scheduleId,
          operator_id: msg.operator_id || msg.operatorId || msg.sender,
          sequence_number: msg.sequence_number || msg.sequenceNumber || index,
          topic_id: msg.topic_id || msg.topicId || topicId,
          created: msg.created || msg.timestamp,
          consensus_timestamp:
            msg.consensus_timestamp ||
            msg.consensusTimestamp ||
            msg.created ||
            msg.timestamp,
          transactionId: msg.transaction_id || msg.transactionId,
          runningHash: msg.running_hash || msg.runningHash,
          p: msg.p,
          m: msg.m,
          _originalMessage: msg,
        })
      );

      return {
        success: true,
        messages,
      };
    } catch (error) {
      logger.error('Failed to get messages:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get messages',
      };
    }
  });

  /**
   * Handler for sending a message
   */
  ipcMain.handle('hcs10:send-message', async (event, args) => {
    try {
      logger.info('Sending message', {
        topicId: args.topicId,
        messageLength: args.message?.length,
        hasAttachments: args.attachments?.length > 0,
      });

      const { topicId, message, attachments } = args;

      if (!topicId || !message) {
        return {
          success: false,
          error: 'Topic ID and message are required',
        };
      }

      const client = await getClient();

      let messageContent = message;

      if (attachments && attachments.length > 0) {
        const fileNames = attachments.map((file: any) => file.name).join(', ');
        messageContent += `\n\nAttachments: ${fileNames}`;
      }

      const result = await client.sendMessage(topicId, messageContent);

      if (result) {
        return {
          success: true,
          transactionId: 'submitted',
        };
      } else {
        return {
          success: false,
          error: 'Failed to send message',
        };
      }
    } catch (error) {
      logger.error('Failed to send message:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  });

  /**
   * Handler for connecting to an agent
   */
  ipcMain.handle('hcs10:connect-to-agent', async (event, args) => {
    try {
      logger.info('Connecting to agent', args);

      const { targetAccountId } = args;

      const result = await connectionService.sendConnectionRequest(
        targetAccountId,
        'Connection request from HCS-10 Chat'
      );

      return result;
    } catch (error) {
      logger.error('Failed to connect to agent:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to connect to agent',
      };
    }
  });

  /**
   * Handler for accepting a connection request
   */
  ipcMain.handle('hcs10:accept-request', async (event, args) => {
    try {
      logger.info('Accepting connection request', args);

      const { requestId } = args;

      const result = await connectionService.acceptConnection(requestId);

      return result;
    } catch (error) {
      logger.error('Failed to accept connection request:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to accept connection request',
      };
    }
  });

  /**
   * Handler for rejecting a connection request
   */
  ipcMain.handle('hcs10:reject-request', async (event, args) => {
    try {
      logger.info('Rejecting connection request', args);

      const { requestId } = args;

      const result = await connectionService.rejectConnection(requestId);

      return result;
    } catch (error) {
      logger.error('Failed to reject connection request:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to reject connection request',
      };
    }
  });

  /**
   * Handler for getting active agents only
   */
  ipcMain.handle('hcs10:get-active-agents', async (event, args) => {
    try {
      logger.info('Getting active agents');

      await connectionService.refreshConnections();

      const activeConnections =
        await connectionService.getConnections('accepted');

      const agents = activeConnections.map((conn) => ({
        id: conn.topicId || conn.id,
        accountId: conn.accountId,
        name: conn.profile?.displayName || conn.accountId || 'Unknown Agent',
        type: 'active' as const,
        lastMessage: conn.message,
        timestamp: conn.updatedAt ? new Date(conn.updatedAt) : new Date(),
        profile: {
          displayName: conn.profile?.displayName || conn.accountId,
          isAI: true,
          isRegistryBroker: false,
        },
        network: 'testnet',
        connectionTopicId: conn.topicId,
      }));

      logger.info(`Returning ${agents.length} active agents`);
      return {
        success: true,
        agents,
      };
    } catch (error) {
      logger.error('Failed to get active agents:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get active agents',
      };
    }
  });

  /**
   * Handler for getting connection requests only
   */
  ipcMain.handle('hcs10:get-connection-requests', async (event, args) => {
    try {
      logger.info('Getting connection requests');

      await connectionService.refreshConnections();

      const pendingConnections =
        await connectionService.getConnections('pending');

      const connectionRequests = pendingConnections
        .filter((conn) => conn.direction === 'incoming')
        .map((conn) => ({
          id: conn.id,
          requesting_account_id: conn.accountId,
          sequence_number: Date.now(),
          memo: conn.message || '',
          operator_id: conn.accountId,
        }));

      logger.info(`Returning ${connectionRequests.length} connection requests`);
      return {
        success: true,
        requests: connectionRequests,
      };
    } catch (error) {
      logger.error('Failed to get connection requests:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get connection requests',
      };
    }
  });

  /**
   * Handler for refreshing agents list
   */
  ipcMain.handle('hcs10:refresh-agents', async (event, args) => {
    try {
      logger.info('Refreshing agents list');

      await connectionService.refreshConnections();

      return {
        success: true,
        message: 'Agents refreshed successfully',
      };
    } catch (error) {
      logger.error('Failed to refresh agents:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to refresh agents',
      };
    }
  });

  logger.info('HCS-10 chat handlers registered');
}
