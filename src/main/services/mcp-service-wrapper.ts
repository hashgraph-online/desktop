/**
 * Wrapper service for MCP functionality that can work without Electron
 */

import type {
  MCPServerProvider,
  MCPServerConfig,
  ServiceDependencies,
} from '../interfaces/services';
import { Logger } from '../utils/logger';

/**
 * Service wrapper that provides MCP functionality with optional Electron dependencies
 */
export class MCPServiceWrapper implements MCPServerProvider {
  private logger: Logger;
  private actualMCPService?: any;
  private mockProvider?: MCPServerProvider;

  constructor(dependencies?: ServiceDependencies) {
    this.logger = new Logger({ module: 'MCPServiceWrapper' });
    this.mockProvider = dependencies?.mcpServerProvider;
  }

  /**
   * Initialize the actual MCP service if running in Electron
   */
  private async initializeActualService(): Promise<void> {
    if (this.actualMCPService || this.mockProvider) {
      return;
    }

    try {
      const { MCPService } = await import('./mcp-service');
      this.actualMCPService = MCPService.getInstance();
      this.logger.info('Initialized actual MCPService for Electron environment');
    } catch (error) {
      this.logger.warn('MCPService not available, using mock implementation for testing');
    }
  }

  async loadServers(): Promise<MCPServerConfig[]> {
    if (this.mockProvider) {
      return this.mockProvider.loadServers();
    }

    await this.initializeActualService();
    
    if (this.actualMCPService) {
      return this.actualMCPService.loadServers();
    }

    this.logger.warn('No MCP service available, returning empty server list');
    return [];
  }

  async getServerById(id: string): Promise<MCPServerConfig | null> {
    if (this.mockProvider) {
      return this.mockProvider.getServerById(id);
    }

    await this.initializeActualService();
    
    if (this.actualMCPService) {
      return this.actualMCPService.getServerById(id);
    }

    return null;
  }

  async saveServer(config: MCPServerConfig): Promise<void> {
    if (this.mockProvider) {
      return this.mockProvider.saveServer(config);
    }

    await this.initializeActualService();
    
    if (this.actualMCPService) {
      return this.actualMCPService.saveServer(config);
    }

    this.logger.warn('No MCP service available, cannot save server');
  }

  async deleteServer(id: string): Promise<void> {
    if (this.mockProvider) {
      return this.mockProvider.deleteServer(id);
    }

    await this.initializeActualService();
    
    if (this.actualMCPService) {
      return this.actualMCPService.deleteServer(id);
    }

    this.logger.warn('No MCP service available, cannot delete server');
  }

  /**
   * Check if running in a testable environment
   */
  isTestEnvironment(): boolean {
    return !!this.mockProvider || !this.actualMCPService;
  }

  /**
   * Get the underlying service instance (for compatibility)
   */
  getUnderlyingService(): any {
    return this.actualMCPService || this.mockProvider;
  }
}