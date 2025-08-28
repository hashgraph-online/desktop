import { Logger } from '../utils/logger';
import type { IMCPConnectionService } from '../interfaces/services';

interface MCPServerStatus {
  serverId: string;
  connected: boolean;
  status: string;
  tools?: unknown[];
  lastError?: string;
}

/**
 * Service for monitoring MCP connection status and health
 */
export class MCPConnectionService implements IMCPConnectionService {
  private logger: Logger;
  private agent: unknown | null = null;

  constructor() {
    this.logger = new Logger({ module: 'MCPConnectionService' });
  }

  /**
   * Set the agent instance for MCP operations
   */
  setAgent(agent: unknown): void {
    this.agent = agent;
  }

  /**
   * Get MCP connection status for all servers
   */
  async getMCPConnectionStatus(): Promise<Map<string, unknown> | null> {
    if (!this.agent) {
      this.logger.warn('Cannot get MCP status: agent not set');
      return null;
    }

    try {
      const agentWithMCP = this.agent as { getMCPConnectionStatus?: () => Map<string, unknown> };
      if (typeof agentWithMCP.getMCPConnectionStatus === 'function') {
        return agentWithMCP.getMCPConnectionStatus();
      }

      this.logger.debug('Agent does not support MCP connection status');
      return new Map();
    } catch (error) {
      this.logger.error('Failed to get MCP connection status:', error);
      return null;
    }
  }

  /**
   * Check if a specific MCP server is connected
   */
  async isMCPServerConnected(serverName: string): Promise<boolean> {
    if (!this.agent) {
      return false;
    }

    try {
      const agentWithMCP = this.agent as { isMCPServerConnected?: (serverName: string) => boolean };
      if (typeof agentWithMCP.isMCPServerConnected === 'function') {
        return agentWithMCP.isMCPServerConnected(serverName);
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check MCP server connection status for ${serverName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get summary of MCP connection status
   */
  async getMCPConnectionSummary(): Promise<{
    total: number;
    connected: number;
    pending: number;
    failed: number;
  }> {
    const status = await this.getMCPConnectionStatus();

    if (!status) {
      return { total: 0, connected: 0, pending: 0, failed: 0 };
    }

    let connected = 0;
    let pending = 0;
    let failed = 0;

    status.forEach((serverStatus: unknown) => {
      const typedStatus = serverStatus as MCPServerStatus;
      if (typedStatus.connected === true) {
        connected++;
      } else if (typedStatus.lastError) {
        failed++;
      } else {
        pending++;
      }
    });

    return {
      total: status.size,
      connected,
      pending,
      failed,
    };
  }
}