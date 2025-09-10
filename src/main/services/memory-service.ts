import { Logger } from '../utils/logger';
import { EntityService } from './entity-service';
import type { IMemoryService } from '../interfaces/services';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import { SafeConversationalAgent } from './safe-conversational-agent';
import {
  FormatConverterRegistry,
  EntityFormat,
} from '@hashgraphonline/conversational-agent';
import { NetworkType } from '@hashgraphonline/standards-sdk';

/**
 * Service for managing entity memory and associations
 */
export class MemoryService implements IMemoryService {
  private logger: Logger;
  private entityService: EntityService;
  private agent: SafeConversationalAgent | null = null;
  private formatConverterRegistry: FormatConverterRegistry;
  private network: NetworkType;
  private sessionIdProvider?: () => string | null;

  constructor(entityService: EntityService, networkType: NetworkType) {
    this.logger = new Logger({ module: 'MemoryService' });
    this.entityService = entityService;
    this.formatConverterRegistry = new FormatConverterRegistry();
    this.network = networkType;
  }

  /**
   * Set the agent instance for memory operations
   */
  setAgent(agent: SafeConversationalAgent): void {
    this.agent = agent;
  }

  /**
   * Provide a callback to retrieve the current session ID for DB persistence.
   */
  setSessionIdProvider(provider: () => string | null): void {
    this.sessionIdProvider = provider;
  }

  /**
   * Store entity association in memory for later resolution
   */
  async storeEntityAssociation(
    entityId: string,
    entityName: string,
    transactionId?: string
  ): Promise<EntityFormat | undefined> {
    try {
      if (!this.agent) {
        this.logger.warn('Cannot store entity association: Agent not set');
        return;
      }

      const entityFormat =
        await this.formatConverterRegistry.detectEntityFormat(entityId, {
          networkType: this.network,
          sessionId: 'unknown',
        });
      const isKnownHederaId =
        entityFormat === EntityFormat.TOKEN_ID ||
        entityFormat === EntityFormat.TOPIC_ID ||
        entityFormat === EntityFormat.ACCOUNT_ID ||
        entityFormat === EntityFormat.CONTRACT_ID;
      if (!isKnownHederaId) {
        this.logger.info(
          'Skipping non-ID entity association for strict types',
          {
            entityName,
            entityType: entityFormat,
            entityId,
            reason: 'entityId is not a Hedera entity ID',
          }
        );
        return undefined;
      }

      if (this.agent.memoryManager) {
        const sessionId = this.sessionIdProvider
          ? this.sessionIdProvider() || undefined
          : undefined;
        this.agent.memoryManager.storeEntityAssociation(
          entityId,
          entityName,
          entityFormat as unknown as string,
          transactionId,
          sessionId
        );
        this.logger.info('Stored entity association:', {
          entityName,
          entityType: entityFormat,
          entityId,
          transactionId,
          sessionId,
        });
        return entityFormat;
      } else {
        this.logger.warn('Memory manager not available for entity storage');
      }
    } catch (error) {
      this.logger.error('Failed to store entity association:', error);
    }
    return undefined;
  }

  /**
   * Get stored entities, optionally filtered by type
   */
  getStoredEntities(entityType?: string): EntityAssociation[] {
    try {
      if (!this.agent) {
        this.logger.warn('Cannot get stored entities: Agent not set');
        return [];
      }

      if (this.agent.memoryManager) {
        const entities =
          this.agent.memoryManager.getEntityAssociations(entityType);
        return entities || [];
      }
    } catch (error) {
      this.logger.warn('Failed to get stored entities:', error);
    }

    return [];
  }

  /**
   * Find entity by name, optionally filtered by type
   */
  async findEntityByName(
    name: string,
    entityType?: string
  ): Promise<EntityAssociation | null> {
    try {
      const entities = this.getStoredEntities(entityType);
      const matches = entities.filter(
        (entity) =>
          entity.entityName &&
          entity.entityName.toLowerCase().includes(name.toLowerCase())
      );

      if (matches.length > 0) {
        return matches.reduce((most, current) =>
          current.createdAt > most.createdAt ? current : most
        );
      }
    } catch (error) {
      this.logger.warn('Failed to find entity by name:', error);
    }

    return null;
  }

  /**
   * Get most recent entity of a specific type
   */
  getMostRecentEntity(entityType: string): EntityAssociation | null {
    try {
      const entities = this.getStoredEntities(entityType);
      if (entities.length === 0) return null;

      return entities.reduce((most, current) =>
        current.createdAt > most.createdAt ? current : most
      );
    } catch (error) {
      this.logger.warn('Failed to get most recent entity:', error);
    }

    return null;
  }

  /**
   * Check if entity exists by ID
   */
  entityExists(entityId: string): boolean {
    try {
      const entities = this.getStoredEntities();
      return entities.some((entity) => entity.entityId === entityId);
    } catch (error) {
      this.logger.warn('Failed to check entity existence:', error);
    }

    return false;
  }

  /**
   * Handle entity creation events
   */
  private async handleEntityCreation(event: {
    entityId: string;
    entityName: string;
    transactionId?: string;
  }): Promise<void> {
    this.logger.info('Entity creation event received:', event);
    const detectedFormat = await this.storeEntityAssociation(
      event.entityId,
      event.entityName,
      event.transactionId
    );
    const entityFormat =
      detectedFormat ??
      (await this.formatConverterRegistry.detectEntityFormat(event.entityId, {
        networkType: this.network,
        sessionId: 'unknown',
      }));
    const sessionId = this.sessionIdProvider
      ? this.sessionIdProvider() || undefined
      : undefined;
    await this.entityService.storeEntity(
      event.entityId,
      event.entityName,
      entityFormat as unknown as string,
      event.transactionId,
      sessionId
    );

    this.logger.info(
      `Entity stored successfully: ${event.entityName} (${entityFormat}) -> ${event.entityId}`
    );
  }

  /**
   * Setup entity creation handlers for inscription tools
   */
  setupEntityHandlers(conversationalAgent: SafeConversationalAgent): void {
    try {
      const inscribePlugin = conversationalAgent.inscribePlugin;
      const tools: unknown[] = inscribePlugin.getTools();

      for (const tool of tools) {
        if (
          tool &&
          typeof tool === 'object' &&
          'setEntityCreationHandler' in tool
        ) {
          const toolWithHandler = tool as {
            setEntityCreationHandler: (
              handler: (event: {
                entityId: string;
                entityName: string;
                entityType: string;
                transactionId?: string;
              }) => Promise<void>
            ) => void;
            name?: string;
          };

          if (typeof toolWithHandler.setEntityCreationHandler === 'function') {
            toolWithHandler.setEntityCreationHandler(
              this.handleEntityCreation.bind(this)
            );
            const toolName = toolWithHandler.name ?? 'Unknown Tool';
            this.logger.info(`Connected entity handler for tool: ${toolName}`);
          }
        }
      }

      this.logger.info(
        `Entity handlers setup complete for ${tools.length} inscription tools`
      );
    } catch (error) {
      this.logger.error('Failed to setup entity handlers:', error);
    }
  }

  /**
   * Load stored entities into memory on startup
   */
  async loadStoredEntities(
    conversationalAgent: SafeConversationalAgent,
    sessionId?: string
  ): Promise<void> {
    try {
      let result:
        | { success: boolean; data?: EntityAssociation[]; error?: string }
        | undefined;

      if (sessionId) {
        result = await this.entityService.getEntitiesBySession(sessionId);
      } else {
        result = await this.entityService.loadAllActiveEntities();
      }

      if (!result.success || !result.data) {
        this.logger.warn(
          'No stored entities found or failed to load for session'
        );
        return;
      }

      if (
        conversationalAgent.memoryManager
      ) {
        for (const entity of result.data) {
          conversationalAgent.memoryManager.storeEntityAssociation(
            entity.entityId,
            entity.entityName,
            entity.entityType,
            entity.transactionId || undefined,
            entity.sessionId || undefined
          );
        }

        this.logger.info(
          `Loaded ${result.data.length} stored entities into memory`
        );
      } else {
        this.logger.warn(
          'Agent memory manager not available for entity loading'
        );
      }
    } catch (error) {
      this.logger.error('Failed to load stored entities:', error);
    }
  }
}
