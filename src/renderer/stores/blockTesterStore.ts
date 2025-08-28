import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';

import * as Handlebars from 'handlebars';
import {
  HCS12Client,
  BlockBuilder,
  Logger,
} from '@hashgraphonline/standards-sdk';
import {
  BlockTesterStore,
  BlockTesterState,
  WorkingBlock,
  ViewportSize,
  ExportFormat,
  ErrorLog,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BlockCategory,
  InscriptionState,
  ActionBinding,
  AttributeSchema,
} from '../types/block-tester.types';
import { useConfigStore } from './configStore';

/**
 * Template cache interface
 */
interface CachedTemplate {
  compiled: HandlebarsTemplateDelegate;
  template: string;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Initial inscription state
 */
const initialInscriptionState: InscriptionState = {
  isInscribing: false,
  inscriptionStatus: 'idle',
  inscriptionResult: undefined,
  inscriptionError: undefined,
  networkType: 'testnet',
};

/**
 * Initial state for the Block Tester store - Multi-block support
 */
const initialState: BlockTesterState = {
  blocks: [],
  activeBlockIndex: -1,
  nextBlockId: 1,

  blockStates: {},

  previewMode: 'desktop',
  errors: [],
  exportFormat: 'json',
  isLoading: false,
  inscription: initialInscriptionState,

  closedBlocks: [],
  maxRecentBlocks: 10,

  currentBlock: null,
  template: '',
  attributes: {},
  actions: {},
  lastSaved: null,
};

/**
 * Template cache with expiration
 */
const templateCache = new Map<string, CachedTemplate>();
let autoSaveInterval: NodeJS.Timeout | null = null;

/**
 * Generate a new error ID
 */
const generateErrorId = (): string => {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Template cache utility functions
 */
const getCachedTemplate = (
  template: string
): HandlebarsTemplateDelegate | null => {
  const cached = templateCache.get(template);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.compiled;
  }
  if (cached) {
    templateCache.delete(template);
  }
  return null;
};

const setCachedTemplate = (
  template: string,
  compiled: HandlebarsTemplateDelegate
): void => {
  const cacheEntry: CachedTemplate = {
    compiled,
    template,
    cachedAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
  templateCache.set(template, cacheEntry);

  if (templateCache.size > 50) {
    const entries = Array.from(templateCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    for (let i = 0; i < 10; i++) {
      templateCache.delete(entries[i][0]);
    }
  }
};

const clearTemplateCache = (): void => {
  templateCache.clear();
};

/**
 * Extract variables from a Handlebars template
 */
const extractTemplateVariables = (template: string): string[] => {
  const variables: string[] = [];
  const regex = /\{\{(?!#|\/)([^{}]+)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1].trim();
    if (variable && !variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
};

/**
 * Enhanced template validation using Handlebars
 */
const validateTemplateWithHandlebars = (
  template: string
): { isValid: boolean; error?: string } => {
  if (!template.trim()) {
    return { isValid: false, error: 'Template cannot be empty' };
  }

  try {
    const compiled =
      getCachedTemplate(template) || Handlebars.compile(template);
    if (!getCachedTemplate(template)) {
      setCachedTemplate(template, compiled);
    }
    return { isValid: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { isValid: false, error: errorMessage };
  }
};

/**
 * Create a new working block
 */
const createNewBlock = (): WorkingBlock => {
  const now = new Date();
  return {
    id: `block-${Date.now()}`,
    name: 'New Block',
    title: 'Untitled Block',
    description: 'A new custom block',
    category: 'custom' as BlockCategory,
    template: '<div>{{content}}</div>',
    templateSource: {
      type: 'inline',
      value: '<div>{{content}}</div>',
    },
    attributes: {},
    actions: {},
    keywords: [],
    created: now,
    modified: now,
  };
};

/**
 * Inscription utility functions
 */
const logger = new Logger({ module: 'BlockInscription', level: 'info' });

/**
 * Validate environment configuration for inscription
 */
const validateEnvironmentConfiguration = () => {
  const config = useConfigStore.getState().config;

  if (!config?.hedera?.accountId || !config?.hedera?.privateKey) {
    throw new Error(
      `Hedera credentials not configured. ` +
        `Please configure your account in Settings.`
    );
  }

  const accountId = config.hedera.accountId;
  if (!accountId.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Hedera Account ID must be in format 0.0.12345');
  }

  return {
    operatorId: accountId,
    operatorPrivateKey: config.hedera.privateKey,
  };
};

/**
 * Create HCS12Client instance
 */
const createHCS12Client = (networkType: string) => {
  const config = validateEnvironmentConfiguration();

  const network = networkType === 'mainnet' ? 'mainnet' : 'testnet';

  return new HCS12Client({
    network,
    ...config,
    logger,
  });
};

/**
 * Create BlockBuilder from WorkingBlock
 */
const createBlockBuilder = (block: WorkingBlock) => {
  const slug = block.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const blockBuilder = BlockBuilder.createDisplayBlock(
    slug || 'custom-block',
    block.name
  )
    .setDescription(block.description || '')
    .setIcon(block.icon || 'block')
    .setKeywords(block.keywords || [])
    .setTemplate(Buffer.from(block.template || ''));

  Object.entries(block.attributes || {}).forEach(
    ([key, attr]: [string, AttributeSchema]) => {
      const mappedType = (() => {
        switch (attr.type) {
          case 'number': return 'number';
          case 'boolean': return 'boolean';
          case 'array': return 'array';
          case 'object': return 'object';
          case 'string':
          case 'color':
          case 'url':
          case 'email':
          case 'textarea':
          default:
            return 'string';
        }
      })();
      
      blockBuilder.addAttribute(
        key,
        mappedType,
        attr.default || ''
      );
    }
  );

  return blockBuilder;
};

/**
 * Format inscription error for user display
 */
const formatInscriptionError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes('insufficient balance')) {
      return 'Insufficient HBAR balance. You need at least 0.1 HBAR for inscription.';
    }
    if (
      error.message.includes('WebSocket') ||
      error.message.includes('websocket')
    ) {
      return 'Unable to connect to inscription service. The service may be temporarily unavailable. Please try again later.';
    }
    if (error.message.includes('network')) {
      return 'Unable to connect to Hedera network. Check your internet connection.';
    }
    if (error.message.includes('credentials not configured')) {
      return 'Hedera credentials not configured. Please configure your account in Settings.';
    }
    return error.message;
  }

  return 'An unknown error occurred during inscription.';
};

/**
 * Legacy state interface for migration
 */
interface LegacyState {
  blocks?: unknown[];
  currentBlock?: {
    id?: string;
    name?: string;
    title?: string;
    description?: string;
    template?: string;
    created?: Date;
    [key: string]: unknown;
  };
  template?: string;
  attributes?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  lastSaved?: Date;
  previewMode?: string;
  errors?: unknown[];
  exportFormat?: string;
  inscription?: InscriptionState;
}

/**
 * Migrate from single-block to multi-block structure
 */
const migrateStoreState = (state: unknown): BlockTesterState => {
  const stateObj = state as LegacyState;
  if (stateObj.blocks && Array.isArray(stateObj.blocks)) {
    return state as BlockTesterState;
  }

  const legacyBlock = stateObj.currentBlock;
  const firstBlock: WorkingBlock = legacyBlock
    ? {
        id: legacyBlock.id || 'block-1',
        name: legacyBlock.name || 'Block 1',
        title: legacyBlock.title || 'Block 1',
        description: legacyBlock.description || '',
        category: 'custom' as const,
        template:
          stateObj.template || legacyBlock.template || '<div>{{content}}</div>',
        templateSource: {
          type: 'inline' as const,
          value: stateObj.template || legacyBlock.template || '<div>{{content}}</div>',
        },
        attributes: stateObj.attributes as Record<string, AttributeSchema> || {},
        actions: stateObj.actions as Record<string, ActionBinding> || {},
        keywords: [],
        created: legacyBlock.created || new Date(),
        modified: new Date(),
      }
    : {
        id: 'block-1',
        name: 'Block 1',
        title: 'Block 1',
        description: 'Initial block from migration',
        category: 'custom' as const,
        template: stateObj.template || '<div>{{content}}</div>',
        templateSource: {
          type: 'inline' as const,
          value: stateObj.template || '<div>{{content}}</div>',
        },
        attributes: stateObj.attributes as Record<string, AttributeSchema> || {},
        actions: stateObj.actions as Record<string, ActionBinding> || {},
        keywords: [],
        created: new Date(),
        modified: new Date(),
      };

  const initialValidation: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  return {
    blocks: [firstBlock],
    activeBlockIndex: 0,
    nextBlockId: 2,

    blockStates: {
      [firstBlock.id]: {
        template: firstBlock.template,
        attributes: firstBlock.attributes,
        actions: firstBlock.actions,
        lastSaved: stateObj.lastSaved || null,
        isDirty: false,
        validation: initialValidation,
      },
    },

    previewMode: (stateObj.previewMode as ViewportSize) || 'desktop',
    errors: (stateObj.errors as ErrorLog[]) || [],
    exportFormat: (stateObj.exportFormat as ExportFormat) || 'json',
    isLoading: false,
    inscription: stateObj.inscription || initialInscriptionState,

    closedBlocks: [],
    maxRecentBlocks: 10,

    currentBlock: firstBlock,
    template: firstBlock.template,
    attributes: firstBlock.attributes,
    actions: firstBlock.actions,
    lastSaved: stateObj.lastSaved || null,
  };
};

/**
 * Block Tester Zustand store following desktop app patterns
 */
export const useBlockTesterStore = create<BlockTesterStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        createBlock: (template = {}) =>
          set((state) => {
            const newBlock: WorkingBlock = {
              id: `block-${state.nextBlockId}`,
              name: template.name || `Block ${state.nextBlockId}`,
              title: template.title || `Block ${state.nextBlockId}`,
              description: template.description || '',
              category: template.category || 'custom',
              template: template.template || '<div>{{content}}</div>',
              templateSource: {
                type: 'inline',
                value: template.template || '<div>{{content}}</div>',
              },
              attributes: template.attributes || {},
              actions: template.actions || {},
              keywords: template.keywords || [],
              icon: template.icon,
              created: new Date(),
              modified: new Date(),
            };

            const initialValidation: ValidationResult = {
              isValid: true,
              errors: [],
              warnings: [],
            };

            return {
              blocks: [...state.blocks, newBlock],
              activeBlockIndex: state.blocks.length,
              nextBlockId: state.nextBlockId + 1,
              blockStates: {
                ...state.blockStates,
                [newBlock.id]: {
                  template: newBlock.template,
                  attributes: newBlock.attributes,
                  actions: newBlock.actions,
                  lastSaved: null,
                  isDirty: false,
                  validation: initialValidation,
                },
              },
              currentBlock: newBlock,
              template: newBlock.template,
              attributes: newBlock.attributes,
              actions: newBlock.actions,
              lastSaved: null,
            };
          }),

        duplicateBlock: (index: number) =>
          set((state) => {
            if (index < 0 || index >= state.blocks.length) return state;

            const originalBlock = state.blocks[index];
            const originalState = state.blockStates[originalBlock.id];

            const duplicatedBlock: WorkingBlock = {
              ...originalBlock,
              id: `block-${state.nextBlockId}`,
              name: `${originalBlock.name} Copy`,
              title: `${originalBlock.title} Copy`,
              created: new Date(),
              modified: new Date(),
            };

            return {
              blocks: [...state.blocks, duplicatedBlock],
              activeBlockIndex: state.blocks.length,
              nextBlockId: state.nextBlockId + 1,
              blockStates: {
                ...state.blockStates,
                [duplicatedBlock.id]: {
                  ...originalState,
                  lastSaved: null,
                  isDirty: false,
                },
              },
              currentBlock: duplicatedBlock,
              template: duplicatedBlock.template,
              attributes: duplicatedBlock.attributes,
              actions: duplicatedBlock.actions,
              lastSaved: null,
            };
          }),

        closeBlock: (index: number) =>
          set((state) => {
            if (
              state.blocks.length <= 1 ||
              index < 0 ||
              index >= state.blocks.length
            ) {
              return state; // Don't close if it's the last block or invalid index
            }

            const blockToClose = state.blocks[index];
            const newBlocks = state.blocks.filter((_, i) => i !== index);
            const newActiveIndex =
              index === state.activeBlockIndex
                ? Math.min(index, newBlocks.length - 1)
                : state.activeBlockIndex > index
                  ? state.activeBlockIndex - 1
                  : state.activeBlockIndex;

            const closedBlock = {
              block: blockToClose,
              closedAt: Date.now(),
            };

            const newActiveBlock = newBlocks[newActiveIndex];
            const newActiveState = newActiveBlock
              ? state.blockStates[newActiveBlock.id]
              : null;

            return {
              blocks: newBlocks,
              activeBlockIndex: newActiveIndex,
              closedBlocks: [closedBlock, ...state.closedBlocks].slice(
                0,
                state.maxRecentBlocks
              ),
              blockStates: Object.fromEntries(
                Object.entries(state.blockStates).filter(
                  ([id]) => id !== blockToClose.id
                )
              ),
              currentBlock: newActiveBlock || null,
              template: newActiveState?.template || '',
              attributes: newActiveState?.attributes || {},
              actions: newActiveState?.actions || {},
              lastSaved: newActiveState?.lastSaved || null,
            };
          }),

        switchToBlock: (index: number) =>
          set((state) => {
            if (index < 0 || index >= state.blocks.length) return state;

            const activeBlock = state.blocks[index];
            const activeState = state.blockStates[activeBlock.id];

            return {
              activeBlockIndex: index,
              currentBlock: activeBlock,
              template: activeState.template,
              attributes: activeState.attributes,
              actions: activeState.actions,
              lastSaved: activeState.lastSaved,
            };
          }),

        reorderBlocks: (fromIndex: number, toIndex: number) =>
          set((state) => {
            if (
              fromIndex === toIndex ||
              fromIndex < 0 ||
              fromIndex >= state.blocks.length ||
              toIndex < 0 ||
              toIndex >= state.blocks.length
            ) {
              return state;
            }

            const newBlocks = [...state.blocks];
            const [movedBlock] = newBlocks.splice(fromIndex, 1);
            newBlocks.splice(toIndex, 0, movedBlock);

            let newActiveIndex = state.activeBlockIndex;
            if (state.activeBlockIndex === fromIndex) {
              newActiveIndex = toIndex;
            } else if (
              fromIndex < state.activeBlockIndex &&
              toIndex >= state.activeBlockIndex
            ) {
              newActiveIndex = state.activeBlockIndex - 1;
            } else if (
              fromIndex > state.activeBlockIndex &&
              toIndex <= state.activeBlockIndex
            ) {
              newActiveIndex = state.activeBlockIndex + 1;
            }

            return {
              blocks: newBlocks,
              activeBlockIndex: newActiveIndex,
            };
          }),

        restoreClosedBlock: () =>
          set((state) => {
            const lastClosed = state.closedBlocks[0];
            if (!lastClosed) return state;

            const restoredBlock = lastClosed.block;
            const initialValidation: ValidationResult = {
              isValid: true,
              errors: [],
              warnings: [],
            };

            return {
              blocks: [...state.blocks, restoredBlock],
              activeBlockIndex: state.blocks.length,
              closedBlocks: state.closedBlocks.slice(1),
              blockStates: {
                ...state.blockStates,
                [restoredBlock.id]: {
                  template: restoredBlock.template,
                  attributes: restoredBlock.attributes,
                  actions: restoredBlock.actions,
                  lastSaved: null,
                  isDirty: false,
                  validation: initialValidation,
                },
              },
              currentBlock: restoredBlock,
              template: restoredBlock.template,
              attributes: restoredBlock.attributes,
              actions: restoredBlock.actions,
              lastSaved: null,
            };
          }),

        updateBlockTemplate: (blockId: string, template: string) =>
          set((state) => {
            if (!state.blockStates[blockId]) return state;

            const updatedBlockStates = {
              ...state.blockStates,
              [blockId]: {
                ...state.blockStates[blockId],
                template,
                isDirty: true,
              },
            };

            const updatedBlocks = state.blocks.map((block) =>
              block.id === blockId
                ? { ...block, template, modified: new Date() }
                : block
            );

            const isActiveBlock =
              state.blocks[state.activeBlockIndex]?.id === blockId;

            return {
              blocks: updatedBlocks,
              blockStates: updatedBlockStates,
              ...(isActiveBlock && { template }),
            };
          }),

        updateBlockAttributes: (
          blockId: string,
          attributes: Record<string, AttributeSchema>
        ) =>
          set((state) => {
            if (!state.blockStates[blockId]) return state;

            const updatedBlockStates = {
              ...state.blockStates,
              [blockId]: {
                ...state.blockStates[blockId],
                attributes,
                isDirty: true,
              },
            };

            const updatedBlocks = state.blocks.map((block) =>
              block.id === blockId
                ? { ...block, attributes, modified: new Date() }
                : block
            );

            const isActiveBlock =
              state.blocks[state.activeBlockIndex]?.id === blockId;

            return {
              blocks: updatedBlocks,
              blockStates: updatedBlockStates,
              ...(isActiveBlock && { attributes }),
            };
          }),

        updateBlockActions: (
          blockId: string,
          actions: Record<string, ActionBinding>
        ) =>
          set((state) => {
            if (!state.blockStates[blockId]) return state;

            const updatedBlockStates = {
              ...state.blockStates,
              [blockId]: {
                ...state.blockStates[blockId],
                actions,
                isDirty: true,
              },
            };

            const updatedBlocks = state.blocks.map((block) =>
              block.id === blockId
                ? { ...block, actions, modified: new Date() }
                : block
            );

            const isActiveBlock =
              state.blocks[state.activeBlockIndex]?.id === blockId;

            return {
              blocks: updatedBlocks,
              blockStates: updatedBlockStates,
              ...(isActiveBlock && { actions }),
            };
          }),

        updateBlock: (blockId: string, updates: Partial<WorkingBlock>) =>
          set((state) => {
            if (!state.blockStates[blockId]) return state;

            const blockIndex = state.blocks.findIndex((b) => b.id === blockId);
            if (blockIndex === -1) return state;

            const updatedBlock = {
              ...state.blocks[blockIndex],
              ...updates,
              modified: new Date(),
            };

            const updatedBlocks = state.blocks.map((block, index) =>
              index === blockIndex ? updatedBlock : block
            );

            let updatedBlockStates = state.blockStates;
            if (updates.template || updates.attributes || updates.actions) {
              updatedBlockStates = {
                ...state.blockStates,
                [blockId]: {
                  ...state.blockStates[blockId],
                  ...(updates.template && { template: updates.template }),
                  ...(updates.attributes && { attributes: updates.attributes }),
                  ...(updates.actions && { actions: updates.actions }),
                  isDirty: true,
                },
              };
            }

            if (updates.templateSource) {
              updatedBlockStates = {
                ...updatedBlockStates,
                [blockId]: {
                  ...updatedBlockStates[blockId],
                  templateSource: updates.templateSource,
                },
              };
            }

            const isActiveBlock = state.activeBlockIndex === blockIndex;

            return {
              blocks: updatedBlocks,
              blockStates: updatedBlockStates,
              ...(isActiveBlock && {
                currentBlock: updatedBlock,
                ...(updates.template && { template: updates.template }),
                ...(updates.attributes && { attributes: updates.attributes }),
                ...(updates.actions && { actions: updates.actions }),
              }),
            };
          }),

        markBlockDirty: (blockId: string) =>
          set((state) => {
            if (!state.blockStates[blockId]) return state;

            return {
              blockStates: {
                ...state.blockStates,
                [blockId]: {
                  ...state.blockStates[blockId],
                  isDirty: true,
                },
              },
            };
          }),

        validateActiveBlock: (): ValidationResult => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;

          const errors: ValidationError[] = [];
          const warnings: ValidationWarning[] = [];

          if (!activeBlock) {
            errors.push({
              field: 'block',
              message: 'No block is currently active',
              severity: 'error' as const,
            });
            return { isValid: false, errors, warnings };
          }

          const activeState = state.blockStates[activeBlock.id];
          if (!activeState) {
            errors.push({
              field: 'block',
              message: 'Block state not found',
              severity: 'error' as const,
            });
            return { isValid: false, errors, warnings };
          }

          const templateValidation = validateTemplateWithHandlebars(
            activeState.template
          );
          if (!templateValidation.isValid) {
            errors.push({
              field: 'template',
              message: templateValidation.error || 'Template validation failed',
              severity: 'error' as const,
            });
          }

          const templateVariables = extractTemplateVariables(
            activeState.template
          );
          const attributeKeys = Object.keys(activeState.attributes);

          const unusedAttributes = attributeKeys.filter(
            (key) => !templateVariables.includes(key) && key !== 'content'
          );
          if (unusedAttributes.length > 0) {
            warnings.push({
              field: 'attributes',
              message: `Unused attributes: ${unusedAttributes.join(', ')}`,
              suggestion: `Remove unused attributes or use them in the template`,
            });
          }

          const missingAttributes = templateVariables.filter(
            (variable) =>
              !attributeKeys.includes(variable) && variable !== 'content'
          );
          if (missingAttributes.length > 0) {
            warnings.push({
              field: 'template',
              message: `Missing attributes for template variables: ${missingAttributes.join(', ')}`,
              suggestion: `Add attributes for: ${missingAttributes.join(', ')}`,
            });
          }

          if (!activeBlock.name.trim()) {
            warnings.push({
              field: 'block',
              message: 'Block name is empty',
              suggestion: 'Add a descriptive name for your block',
            });
          }

          if (!activeBlock.description || !activeBlock.description.trim()) {
            warnings.push({
              field: 'block',
              message: 'Block description is empty',
              suggestion:
                'Add a description to help others understand your block',
            });
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
          };
        },

        getCurrentBlock: () => {
          const state = get();
          return state.activeBlockIndex >= 0
            ? state.blocks[state.activeBlockIndex]
            : null;
        },

        getCurrentTemplate: () => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          return activeBlock
            ? state.blockStates[activeBlock.id]?.template || ''
            : '';
        },

        getCurrentAttributes: () => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          return activeBlock
            ? state.blockStates[activeBlock.id]?.attributes || {}
            : {};
        },

        getCurrentActions: () => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          return activeBlock
            ? state.blockStates[activeBlock.id]?.actions || {}
            : {};
        },

        getActiveBlockState: () => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          return activeBlock ? state.blockStates[activeBlock.id] || null : null;
        },

        setBlock: (block: WorkingBlock) => {
          const state = get();
          if (state.activeBlockIndex >= 0) {
            set((state) => ({
              blocks: state.blocks.map((b, i) =>
                i === state.activeBlockIndex ? block : b
              ),
              blockStates: {
                ...state.blockStates,
                [block.id]: {
                  template: block.template,
                  attributes: block.attributes,
                  actions: block.actions,
                  lastSaved: null,
                  isDirty: false,
                  validation: { isValid: true, errors: [], warnings: [] },
                },
              },
              currentBlock: block,
              template: block.template,
              attributes: block.attributes,
              actions: block.actions,
              lastSaved: null,
            }));
          } else {
            get().createBlock(block);
          }
        },

        updateTemplate: (template: string) => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          if (activeBlock) {
            get().updateBlockTemplate(activeBlock.id, template);
          }
        },

        updateAttributes: (attributes: Record<string, AttributeSchema>) => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          if (activeBlock) {
            get().updateBlockAttributes(activeBlock.id, attributes);
          }
        },

        updateActions: (actions: Record<string, ActionBinding>) => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          if (activeBlock) {
            get().updateBlockActions(activeBlock.id, actions);
          }
        },

        saveBlock: () => {
          const state = get();
          const activeBlock =
            state.activeBlockIndex >= 0
              ? state.blocks[state.activeBlockIndex]
              : null;
          if (activeBlock) {
            const validation = get().validateActiveBlock();
            const updatedBlock = {
              ...activeBlock,
              modified: new Date(),
            };

            set((state) => ({
              blocks: state.blocks.map((b, i) =>
                i === state.activeBlockIndex ? updatedBlock : b
              ),
              blockStates: {
                ...state.blockStates,
                [activeBlock.id]: {
                  ...state.blockStates[activeBlock.id],
                  lastSaved: new Date(),
                  isDirty: false,
                },
              },
              currentBlock: updatedBlock,
              lastSaved: new Date(),
            }));

            if (validation.warnings.length > 0) {
              validation.warnings.forEach((warning) => {
                get().addError({
                  type: 'validation',
                  source: 'save',
                  message: `Warning: ${warning.message}`,
                });
              });
            }
          }
        },

        resetBlock: () => {
          const newBlock = createNewBlock();
          get().createBlock(newBlock);
        },

        validateBlock: (): ValidationResult => {
          return get().validateActiveBlock();
        },

        exportBlock: (format: ExportFormat): string => {
          const activeBlock = get().getCurrentBlock();
          const template = get().getCurrentTemplate();
          const attributes = get().getCurrentAttributes();
          const actions = get().getCurrentActions();

          if (!activeBlock) {
            throw new Error('No block to export');
          }

          const exportData = {
            ...activeBlock,
            template,
            attributes,
            actions,
          };

          switch (format) {
            case 'json':
              return JSON.stringify(exportData, null, 2);
            case 'hcs-1':
              return JSON.stringify(
                {
                  type: 'block',
                  data: exportData,
                },
                null,
                2
              );
            case 'html':
              try {
                return get().processTemplate(template, {
                  content: 'Sample content',
                  ...attributes,
                });
              } catch (_error) {
                let htmlContent = template;
                Object.entries(attributes).forEach(([key, value]) => {
                  const regex = new RegExp(`{{${key}}}`, 'g');
                  htmlContent = htmlContent.replace(regex, String(value));
                });
                return htmlContent;
              }
            case 'template':
              return template;
            default:
              return JSON.stringify(exportData, null, 2);
          }
        },

        importBlock: (data: string | object) => {
          try {
            const blockData =
              typeof data === 'string' ? JSON.parse(data) : data;

            const importedBlock: WorkingBlock = {
              id: blockData.id || `imported-${Date.now()}`,
              name: blockData.name || 'Imported Block',
              title: blockData.title || 'Imported Block',
              description: blockData.description || '',
              category: blockData.category || 'custom',
              template: blockData.template || '',
              templateSource: blockData.templateSource || {
                type: 'inline',
                value: blockData.template || '',
              },
              attributes: blockData.attributes || {},
              actions: blockData.actions || {},
              keywords: blockData.keywords || [],
              icon: blockData.icon,
              created: blockData.created
                ? new Date(blockData.created)
                : new Date(),
              modified: new Date(),
            };

            get().createBlock(importedBlock);
          } catch (error) {
            get().addError({
              type: 'import',
              source: 'import',
              message: `Failed to import block: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
        },

        setPreviewMode: (mode: ViewportSize) => set({ previewMode: mode }),

        addError: (error: Omit<ErrorLog, 'id' | 'timestamp'>) => {
          const newError: ErrorLog = {
            ...error,
            id: generateErrorId(),
            timestamp: new Date(),
          };
          set((state) => ({ errors: [...state.errors, newError] }));
        },

        removeError: (errorId: string) =>
          set((state) => ({
            errors: state.errors.filter((error) => error.id !== errorId),
          })),

        clearErrors: () => set({ errors: [] }),

        setLoading: (loading: boolean) => set({ isLoading: loading }),

        setExportFormat: (format: ExportFormat) =>
          set({ exportFormat: format }),

        processTemplate: (
          template: string,
          context: Record<string, unknown>
        ): string => {
          try {
            const compiled =
              getCachedTemplate(template) || Handlebars.compile(template);
            if (!getCachedTemplate(template)) {
              setCachedTemplate(template, compiled);
            }
            return compiled(context);
          } catch (error: unknown) {
            get().addError({
              type: 'template',
              source: 'processTemplate',
              message: `Template processing failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            throw error;
          }
        },

        clearTemplateCache: () => {
          clearTemplateCache();
        },

        getTemplateVariables: (template?: string): string[] => {
          const currentTemplate = template || get().getCurrentTemplate();
          return extractTemplateVariables(currentTemplate);
        },

        enableAutoSave: (intervalMs: number = 30000) => {
          if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
          }

          autoSaveInterval = setInterval(() => {
            const activeBlock = get().getCurrentBlock();
            if (activeBlock) {
              get().saveBlock();
            }
          }, intervalMs);
        },

        disableAutoSave: () => {
          if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
          }
        },

        inscribeBlock: async (block: WorkingBlock) => {
          set((state) => ({
            inscription: {
              ...state.inscription,
              isInscribing: true,
              inscriptionStatus: 'validating',
            },
          }));

          try {
            const validation = get().validateActiveBlock();
            if (!validation.isValid) {
              throw new Error(
                `Block validation failed: ${validation.errors[0]?.message}`
              );
            }

            const hcs12Client = createHCS12Client(
              get().inscription.networkType
            );
            const blockBuilder = createBlockBuilder(block);

            set((state) => ({
              inscription: {
                ...state.inscription,
                inscriptionStatus: 'submitting',
              },
            }));

            const _result = await hcs12Client.registerBlock(blockBuilder);
            const topicId = blockBuilder.getTopicId();
            
            const transactionId = `${topicId}-${Date.now()}`;

            set((state) => ({
              inscription: {
                ...state.inscription,
                inscriptionStatus: 'success',
                inscriptionResult: {
                  topicId,
                  hashLink: `hcs://12/${topicId}`,
                  transactionId: transactionId,
                },
              },
            }));

            const activeBlock = get().getCurrentBlock();
            if (activeBlock) {
              get().updateBlock(activeBlock.id, {
                templateSource: {
                  type: 'hcs',
                  topicId: topicId,
                  lastFetched: new Date(),
                },
              });
            }

            logger.info('Block inscription successful', {
              topicId,
              transactionId: transactionId,
            });
          } catch (error: unknown) {
            logger.error('Block inscription failed:', error);
            const errorMessage = formatInscriptionError(error);

            set((state) => ({
              inscription: {
                ...state.inscription,
                inscriptionStatus: 'error',
                inscriptionError: errorMessage,
              },
            }));

            get().addError({
              type: 'inscription',
              source: 'inscribeBlock',
              message: `Inscription failed: ${errorMessage}`,
            });
          } finally {
            set((state) => ({
              inscription: {
                ...state.inscription,
                isInscribing: false,
              },
            }));
          }
        },

        setNetworkType: (networkType: string) => {
          set((state) => ({
            inscription: {
              ...state.inscription,
              networkType,
            },
          }));
        },

        resetInscriptionState: () => {
          set((state) => ({
            inscription: {
              ...state.inscription,
              inscriptionStatus: 'idle',
              inscriptionResult: undefined,
              inscriptionError: undefined,
            },
          }));
        },

        isBlockValidForInscription: (): boolean => {
          const activeBlock = get().getCurrentBlock();
          if (!activeBlock) return false;

          const validation = get().validateActiveBlock();
          return (
            validation.isValid &&
            activeBlock.name.trim() !== '' &&
            activeBlock.description &&
            activeBlock.description.trim() !== '' &&
            get().getCurrentTemplate().trim() !== ''
          );
        },
      }),
      {
        name: 'block-tester-storage',
        version: 2, // Increment for migration
        migrate: (persistedState: unknown, version: number) => {
          if (version < 2) {
            return migrateStoreState(persistedState);
          }
          return persistedState;
        },
        partialize: (state) => ({
          blocks: state.blocks,
          activeBlockIndex: state.activeBlockIndex,
          nextBlockId: state.nextBlockId,
          blockStates: state.blockStates,
          previewMode: state.previewMode,
          exportFormat: state.exportFormat,
          closedBlocks: state.closedBlocks.slice(0, 5), // Only keep recent 5
          maxRecentBlocks: state.maxRecentBlocks,
          inscription: {
            networkType: state.inscription.networkType,
          },
          currentBlock: state.currentBlock,
          template: state.template,
          attributes: state.attributes,
          actions: state.actions,
          lastSaved: state.lastSaved,
        }),
      }
    )
  )
);

export const useCurrentBlock = () =>
  useBlockTesterStore((state) => state.getCurrentBlock());
export const useTemplate = () =>
  useBlockTesterStore((state) => state.getCurrentTemplate());
export const useAttributes = () =>
  useBlockTesterStore((state) => state.getCurrentAttributes());
export const useActions = () =>
  useBlockTesterStore((state) => state.getCurrentActions());
export const usePreviewMode = () =>
  useBlockTesterStore((state) => state.previewMode);
export const useErrors = () => useBlockTesterStore((state) => state.errors);
export const useIsLoading = () =>
  useBlockTesterStore((state) => state.isLoading);

export const useBlocks = () => useBlockTesterStore((state) => state.blocks);
export const useActiveBlockIndex = () =>
  useBlockTesterStore((state) => state.activeBlockIndex);
export const useBlockStates = () =>
  useBlockTesterStore((state) => state.blockStates);
export const useClosedBlocks = () =>
  useBlockTesterStore((state) => state.closedBlocks);

export const useBlockValidation = () => {
  return useBlockTesterStore((state) => state.validateActiveBlock);
};

export const useTemplateVariables = () => {
  return useBlockTesterStore((state) => state.getTemplateVariables);
};

export const useProcessTemplate = () => {
  return useBlockTesterStore((state) => state.processTemplate);
};

export const useAutoSaveControls = () => {
  return useBlockTesterStore((state) => ({
    enableAutoSave: state.enableAutoSave,
    disableAutoSave: state.disableAutoSave,
  }));
};

export const useInscriptionState = () => {
  return useBlockTesterStore((state) => state.inscription);
};

export const useInscribeBlock = () => {
  return useBlockTesterStore((state) => state.inscribeBlock);
};

export const useSetNetworkType = () => {
  return useBlockTesterStore((state) => state.setNetworkType);
};

export const useResetInscriptionState = () => {
  return useBlockTesterStore((state) => state.resetInscriptionState);
};
