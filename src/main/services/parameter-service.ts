import { Logger } from '../utils/logger';
import {
  EntityFormat,
  FormatConverterRegistry,
} from '@hashgraphonline/conversational-agent';
import type { IParameterService } from '../interfaces/services';
import type { EntityAssociation } from '@hashgraphonline/conversational-agent';
import { NetworkType } from '@hashgraphonline/standards-sdk';

/**
 * Service for processing tool parameters and applying entity format conversions
 */
export class ParameterService implements IParameterService {
  private logger: Logger;
  private formatConverterRegistry: FormatConverterRegistry;
  private networkType: NetworkType;

  constructor(
    formatConverterRegistry: FormatConverterRegistry,
    networkType: NetworkType
  ) {
    this.logger = new Logger({ module: 'ParameterService' });
    this.formatConverterRegistry = formatConverterRegistry;
    this.networkType = networkType;
  }

  /**
   * Unified preprocessing entrypoint (DRY):
   * - Optional AI-driven resolution via provided entityResolver
   * - Deterministic post-pass for safe format enforcement
   */
  async preprocessParameters(
    toolName: string,
    parameters: Record<string, unknown>,
    entities: EntityAssociation[] = [],
    options?: {
      entityResolver?: {
        resolveReferences: (
          message: string,
          entities: EntityAssociation[]
        ) => Promise<string>;
      };
      sessionId?: string;
      preferences?: Record<string, string>;
    }
  ): Promise<Record<string, unknown>> {
    const sessionId = options?.sessionId;
    const entityResolver = options?.entityResolver;
    const preferences = options?.preferences;

    let working: Record<string, unknown> = { ...parameters };

    if (entityResolver && entities.length > 0) {
      try {
        this.logger.info('AI-driven preprocessing phase', {
          toolName,
          entityCount: entities.length,
          sessionId,
        });

        const aiProcessed: Record<string, unknown> = { ...working };
        for (const [paramName, paramValue] of Object.entries(working)) {
          if (typeof paramValue === 'string') {
            const resolved = await entityResolver.resolveReferences(
              paramValue,
              entities
            );
            const converted = await this.convertParameterEntities(
              resolved,
              entities,
              preferences
            );
            aiProcessed[paramName] = converted;
          } else if (Array.isArray(paramValue)) {
            const out: unknown[] = [];
            for (const item of paramValue) {
              if (typeof item === 'string') {
                const resolved = await entityResolver.resolveReferences(
                  item,
                  entities
                );
                const converted = await this.convertParameterEntities(
                  resolved,
                  entities,
                  preferences
                );
                out.push(converted);
              } else {
                out.push(item);
              }
            }
            aiProcessed[paramName] = out;
          }
        }
        working = aiProcessed;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        this.logger.warn(
          'AI phase failed; continuing with deterministic pass',
          {
            toolName,
            error: message,
          }
        );
      }
    }

    try {
      const processed: Record<string, unknown> = { ...working };
      for (const [paramName, paramValue] of Object.entries(working)) {
        if (typeof paramValue === 'string') {
          const converted = await this.convertParameterEntities(
            paramValue,
            entities,
            preferences
          );
          processed[paramName] = converted;
        } else if (Array.isArray(paramValue)) {
          const out: unknown[] = [];
          for (const item of paramValue) {
            if (typeof item === 'string') {
              const converted = await this.convertParameterEntities(
                item,
                entities,
                preferences
              );
              out.push(converted);
            } else {
              out.push(item);
            }
          }
          processed[paramName] = out;
        }
      }
      working = processed;
    } catch (e) {
      this.logger.warn('Deterministic post-pass failed', {
        toolName,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }

    return working;
  }

  /**
   * Attach unified preprocessing callback directly to the agent.
   */
  attachToAgent(
    agent: unknown,
    deps?: {
      getSessionId?: () => string | null;
      getEntities?: (sessionId: string | null) => Promise<EntityAssociation[]>;
      entityResolver?: {
        resolveReferences: (
          message: string,
          entities: EntityAssociation[]
        ) => Promise<string>;
      };
    }
  ): void {
    const getSessionId = deps?.getSessionId ?? (() => null);
    const getEntities =
      deps?.getEntities ?? (async () => [] as EntityAssociation[]);
    const entityResolver = deps?.entityResolver;

    const maybe = agent as {
      setParameterPreprocessingCallback?: (
        callback: (
          toolName: string,
          parameters: Record<string, unknown>,
          toolContext?: {
            entityResolutionPreferences?: Record<string, string>;
          }
        ) => Promise<Record<string, unknown>>
      ) => void;
      getAgent?: () => unknown;
    };

    const attach = (target: unknown): boolean => {
      const t = target as {
        setParameterPreprocessingCallback?: (
          callback: (
            toolName: string,
            parameters: Record<string, unknown>,
            toolContext?: {
              entityResolutionPreferences?: Record<string, string>;
            }
          ) => Promise<Record<string, unknown>>
        ) => void;
      };
      if (typeof t.setParameterPreprocessingCallback === 'function') {
        t.setParameterPreprocessingCallback(
          async (
            toolName: string,
            parameters: Record<string, unknown>
          ): Promise<Record<string, unknown>> => {
            const sessionId = getSessionId();
            const entities = await getEntities(sessionId);
            return this.preprocessParameters(toolName, parameters, entities, {
              entityResolver,
              sessionId: sessionId ?? undefined,
            });
          }
        );
        this.logger.info('Parameter preprocessing callback attached');
        return true;
      }
      return false;
    };

    if (!attach(agent) && typeof maybe.getAgent === 'function') {
      const underlying = maybe.getAgent();
      if (underlying) {
        void attach(underlying);
      }
    }
  }

  /**
   * Preprocess tool parameters by applying format conversions based on tool's entity resolution preferences
   */
  async preprocessToolParameters(
    toolName: string,
    parameters: Record<string, unknown>,
    entities?: EntityAssociation[],
    sessionId?: string
  ): Promise<Record<string, unknown>> {
    try {

      if (!entities || entities.length === 0) {
        this.logger.info(
          'Tool parameter preprocessing skipped - no entities provided:',
          {
            toolName,
            originalParams: Object.keys(parameters),
          }
        );
        return parameters;
      }

      const processedParameters = { ...parameters };
      const preferences: Record<string, string> | undefined = undefined;
      let hasChanges = false;

      for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (typeof paramValue === 'string') {
          const convertedValue = await this.convertParameterEntities(
            paramValue,
            entities,
            preferences
          );

          if (convertedValue !== paramValue) {
            processedParameters[paramName] = convertedValue;
            hasChanges = true;

            this.logger.info('Parameter entity conversion applied:', {
              toolName,
              paramName,
              original: paramValue,
              converted: convertedValue,
            });
          }
        } else if (Array.isArray(paramValue)) {
          const originalArray = paramValue as unknown[];
          const convertedArray: unknown[] = [];
          let arrayChanged = false;

          for (const item of originalArray) {
            if (typeof item === 'string') {
              const convertedItem = await this.convertParameterEntities(
                item,
                entities,
                preferences
              );

              convertedArray.push(convertedItem);

              if (convertedItem !== item) {
                arrayChanged = true;
                this.logger.info('Parameter array item conversion applied:', {
                  toolName,
                  paramName,
                  original: item,
                  converted: convertedItem,
                });
              }
            } else {
              convertedArray.push(item);
            }
          }

          if (arrayChanged) {
            processedParameters[paramName] = convertedArray;
            hasChanges = true;
          }
        }
      }

      this.logger.info('Tool parameter preprocessing completed:', {
        toolName,
        originalParams: Object.keys(parameters),
        hasChanges,
        sessionId,
      });

      return processedParameters;
    } catch (error) {
      this.logger.warn('Tool parameter preprocessing failed:', {
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return parameters;
    }
  }

  /**
   * Convert entity references in a parameter value based on tool preferences
   */
  async convertParameterEntities(
    parameterValue: string,
    entities: EntityAssociation[],
    preferences?: Record<string, string>
  ): Promise<string> {
    let convertedValue = parameterValue;

    for (const entity of entities) {
      const containsEntityId = convertedValue.includes(entity.entityId);
      const containsEntityName = convertedValue.includes(entity.entityName);

      if (!containsEntityId && !containsEntityName) {
        continue;
      }

      let targetFormat: EntityFormat | null = null;

      if (entity.entityType === EntityFormat.TOPIC_ID) {
        if (
          preferences?.inscription === 'hrl' ||
          preferences?.topic === 'hrl'
        ) {
          targetFormat = EntityFormat.HRL;
        } else if (
          preferences?.inscription === 'topicId' ||
          preferences?.topic === 'topicId'
        ) {
          targetFormat = EntityFormat.TOPIC_ID;
        }
      } else if (entity.entityType === EntityFormat.TOKEN_ID) {
        if (preferences?.token === 'tokenId') {
          targetFormat = EntityFormat.TOKEN_ID;
        } else if (preferences?.token === 'symbol') {
          targetFormat = EntityFormat.SYMBOL;
        }
      } else if (entity.entityType === EntityFormat.ACCOUNT_ID) {
        if (
          preferences?.account === 'accountId' ||
          preferences?.supplyKey === 'accountId' ||
          preferences?.adminKey === 'accountId'
        ) {
          targetFormat = EntityFormat.ACCOUNT_ID;
        } else if (preferences?.account === 'alias') {
          targetFormat = EntityFormat.ALIAS;
        }
      }

      if (targetFormat) {
        try {
          const convertedEntityValue =
            await this.formatConverterRegistry.convertEntity(
              entity.entityId,
              targetFormat,
              {
                networkType: this.networkType,
                sessionId: 'unknown',
                toolPreferences: preferences,
              }
            );

          if (containsEntityId) {
            convertedValue = convertedValue.replace(
              new RegExp(`\\b${entity.entityId.replace(/\./g, '\\.')}\\b`, 'g'),
              convertedEntityValue
            );
          }

          if (containsEntityName) {
            convertedValue = convertedValue.replace(
              new RegExp(
                `\\b${entity.entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                'g'
              ),
              convertedEntityValue
            );
          }

          this.logger.info('Applied format conversion to parameter:', {
            entityId: entity.entityId,
            entityType: entity.entityType,
            targetFormat,
            convertedValue: convertedEntityValue,
            parameterValue: convertedValue,
          });
        } catch (error) {
          this.logger.warn('Format conversion failed for parameter:', {
            entityId: entity.entityId,
            targetFormat,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return convertedValue;
  }
}
