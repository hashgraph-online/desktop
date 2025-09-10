import { HederaMirrorNode, Logger } from '@hashgraphonline/standards-sdk';

/**
 * Proxy service for HederaMirrorNode from standards-sdk
 * This runs in the main process to bypass CORS restrictions
 */
export class MirrorNodeService {
  private static instance: MirrorNodeService;
  private mirrorNodes: Map<string, HederaMirrorNode> = new Map();
  private logger: Logger;

  private constructor() {
    this.logger = new Logger({ module: 'MirrorNodeService' });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MirrorNodeService {
    if (!MirrorNodeService.instance) {
      MirrorNodeService.instance = new MirrorNodeService();
    }
    return MirrorNodeService.instance;
  }

  /**
   * Get or create mirror node instance for network
   */
  private getMirrorNode(
    network: 'mainnet' | 'testnet' = 'testnet'
  ): HederaMirrorNode {
    if (!this.mirrorNodes.has(network)) {
      this.mirrorNodes.set(network, new HederaMirrorNode(network, this.logger));
    }
    return this.mirrorNodes.get(network)!;
  }

  /**
   * Proxy getScheduleInfo from HederaMirrorNode
   */
  async getScheduleInfo(
    scheduleId: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<unknown> {
    const mirrorNode = this.getMirrorNode(network);
    return mirrorNode.getScheduleInfo(scheduleId);
  }

  /**
   * Proxy getScheduledTransactionStatus from HederaMirrorNode
   */
  async getScheduledTransactionStatus(
    scheduleId: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<{
    executed: boolean;
    executedDate?: Date;
    deleted: boolean;
  }> {
    const mirrorNode = this.getMirrorNode(network);
    return mirrorNode.getScheduledTransactionStatus(scheduleId);
  }

  /**
   * Proxy getTransactionByTimestamp from HederaMirrorNode
   */
  async getTransactionByTimestamp(
    timestamp: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<unknown> {
    const mirrorNode = this.getMirrorNode(network);
    return mirrorNode.getTransactionByTimestamp(timestamp);
  }

  /**
   * Proxy getTransaction (by ID or hash) from HederaMirrorNode
   */
  async getTransaction(
    transactionIdOrHash: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<unknown> {
    const mirrorNode = this.getMirrorNode(network);
    return mirrorNode.getTransaction(transactionIdOrHash);
  }

  /**
   * Proxy getTokenInfo from HederaMirrorNode
   */
  async getTokenInfo(
    tokenId: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<unknown> {
    const mirrorNode = this.getMirrorNode(network);
    return mirrorNode.getTokenInfo(tokenId);
  }
}

export default MirrorNodeService;
