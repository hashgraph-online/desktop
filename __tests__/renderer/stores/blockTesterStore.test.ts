import { act, renderHook } from '@testing-library/react';
import { useBlockTesterStore } from '../../../src/renderer/stores/blockTesterStore';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  HCS12Client: jest.fn().mockImplementation(() => ({
    inscribeBlock: jest.fn(),
    getBlockInfo: jest.fn(),
    validateBlock: jest.fn()
  })),
  BlockBuilder: {
    createDisplayBlock: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setIcon: jest.fn().mockReturnThis(),
    setKeywords: jest.fn().mockReturnThis(),
    setTemplate: jest.fn().mockReturnThis(),
    addAttribute: jest.fn().mockReturnThis(),
    build: jest.fn()
  }
}));

jest.mock('handlebars', () => ({
  compile: jest.fn().mockImplementation((template: string) => {
    return jest.fn().mockImplementation((data: any) => {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || '');
    });
  })
}));

Object.defineProperty(window, 'electron', {
  value: {
    invoke: jest.fn()
  },
  writable: true
});

describe('BlockTesterStore', () => {

  const mockBlock = {
    id: 'block-1',
    name: 'Test Block',
    title: 'Test Block Title',
    description: 'A test block',
    category: 'custom' as const,
    template: '<div>{{content}}</div>',
    templateSource: {
      type: 'inline' as const,
      value: '<div>{{content}}</div>'
    },
    attributes: {
      content: {
        type: 'string' as const,
        default: 'Hello World'
      }
    },
    actions: {},
    keywords: ['test'],
    created: new Date('2024-01-01T00:00:00Z'),
    modified: new Date('2024-01-01T01:00:00Z')
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useBlockTesterStore.setState({
      blocks: [],
      activeBlockIndex: -1,
      nextBlockId: 1,
      blockStates: {},
      previewMode: 'desktop',
      errors: [],
      exportFormat: 'json',
      isLoading: false,
      inscription: {
        isInscribing: false,
        inscriptionStatus: 'idle',
        inscriptionResult: undefined,
        inscriptionError: undefined,
        networkType: 'testnet'
      },
      closedBlocks: [],
      maxRecentBlocks: 10,
      currentBlock: null,
      template: '',
      attributes: {},
      actions: {},
      lastSaved: null
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      expect(result.current.blocks).toEqual([]);
      expect(result.current.activeBlockIndex).toBe(-1);
      expect(result.current.nextBlockId).toBe(1);
      expect(result.current.previewMode).toBe('desktop');
      expect(result.current.errors).toEqual([]);
      expect(result.current.exportFormat).toBe('json');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentBlock).toBe(null);
      expect(result.current.template).toBe('');
      expect(result.current.attributes).toEqual({});
      expect(result.current.actions).toEqual({});
      expect(result.current.lastSaved).toBe(null);
    });
  });

  describe('Block Management', () => {
    test('should create a new block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
      });

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.activeBlockIndex).toBe(0);
      expect(result.current.currentBlock?.name).toBe('Block 1');
      expect(result.current.currentBlock?.template).toBe('<div>{{content}}</div>');
    });

    test('should create block with custom template', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const customTemplate = {
        name: 'Custom Block',
        title: 'My Custom Block',
        description: 'A custom block description',
        template: '<div class="custom">{{title}}</div>',
        category: 'custom' as const,
        attributes: {
          title: {
            type: 'string' as const,
            default: 'Custom Title'
          }
        },
        actions: {},
        keywords: ['custom']
      };

      act(() => {
        result.current.createBlock(customTemplate);
      });

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.currentBlock?.name).toBe('Custom Block');
      expect(result.current.currentBlock?.title).toBe('My Custom Block');
      expect(result.current.currentBlock?.template).toBe('<div class="custom">{{title}}</div>');
      expect(result.current.currentBlock?.attributes).toEqual({
        title: {
          type: 'string',
          default: 'Custom Title'
        }
      });
    });

    test('should duplicate a block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          name: 'Original Block',
          template: '<div>{{content}}</div>'
        });
      });

      act(() => {
        result.current.duplicateBlock(0);
      });

      expect(result.current.blocks).toHaveLength(2);
      expect(result.current.currentBlock?.name).toBe('Original Block Copy');
      expect(result.current.activeBlockIndex).toBe(1);
    });

    test('should not duplicate invalid block index', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
      });

      act(() => {
        result.current.duplicateBlock(5); // Index out of bounds
      });

      expect(result.current.blocks).toHaveLength(1); // Should remain unchanged
    });

    test('should close a block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Block 1' });
        result.current.createBlock({ name: 'Block 2' });
        result.current.createBlock({ name: 'Block 3' });
      });

      expect(result.current.blocks).toHaveLength(3);

      act(() => {
        result.current.closeBlock(1);
      });

      expect(result.current.blocks).toHaveLength(2);
      expect(result.current.blocks[0].name).toBe('Block 1');
      expect(result.current.blocks[1].name).toBe('Block 3');
      expect(result.current.closedBlocks).toHaveLength(1);
    });

    test('should not close last block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Only Block' });
      });

      expect(result.current.blocks).toHaveLength(1);

      act(() => {
        result.current.closeBlock(0);
      });

      expect(result.current.blocks).toHaveLength(1); // Should remain unchanged
    });

    test('should set active block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Block 1' });
        result.current.createBlock({ name: 'Block 2' });
        result.current.createBlock({ name: 'Block 3' });
      });

      act(() => {
        result.current.setActiveBlock(1);
      });

      expect(result.current.activeBlockIndex).toBe(1);
      expect(result.current.currentBlock?.name).toBe('Block 2');
    });

    test('should not set invalid active block index', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Block 1' });
      });

      act(() => {
        result.current.setActiveBlock(5);
      });

      expect(result.current.activeBlockIndex).toBe(0); // Should remain unchanged
    });
  });

  describe('Template Management', () => {
    test('should update template', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
        result.current.updateTemplate('<div class="updated">{{newContent}}</div>');
      });

      expect(result.current.template).toBe('<div class="updated">{{newContent}}</div>');
      expect(result.current.currentBlock?.template).toBe('<div class="updated">{{newContent}}</div>');
    });

    test('should validate template', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const validResult = result.current.validateTemplate('<div>{{content}}</div>');
      expect(validResult.isValid).toBe(true);

      const invalidResult = result.current.validateTemplate('<div>{{content');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    test('should extract template variables', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const template = '<div>{{name}} {{age}} {{name}}</div>';
      const variables = result.current.extractTemplateVariables(template);

      expect(variables).toEqual(['name', 'age']);
    });

    test('should render template', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const template = '<div>Hello {{name}}!</div>';
      const data = { name: 'World' };
      const rendered = result.current.renderTemplate(template, data);

      expect(rendered).toBe('<div>Hello World!</div>');
    });
  });

  describe('Attribute Management', () => {
    test('should update attributes', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const newAttributes = {
        title: {
          type: 'string' as const,
          default: 'New Title'
        },
        count: {
          type: 'number' as const,
          default: 5
        }
      };

      act(() => {
        result.current.createBlock();
        result.current.updateAttributes(newAttributes);
      });

      expect(result.current.attributes).toEqual(newAttributes);
      expect(result.current.currentBlock?.attributes).toEqual(newAttributes);
    });

    test('should add attribute', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
        result.current.addAttribute('newAttr', {
          type: 'string',
          default: 'default value'
        });
      });

      expect(result.current.attributes.newAttr).toEqual({
        type: 'string',
        default: 'default value'
      });
    });

    test('should remove attribute', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          attributes: {
            attr1: { type: 'string', default: 'value1' },
            attr2: { type: 'string', default: 'value2' }
          }
        });
        result.current.removeAttribute('attr1');
      });

      expect(result.current.attributes.attr1).toBeUndefined();
      expect(result.current.attributes.attr2).toEqual({ type: 'string', default: 'value2' });
    });
  });

  describe('Action Management', () => {
    test('should update actions', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const newActions = {
        click: {
          type: 'click' as const,
          handler: 'handleClick'
        }
      };

      act(() => {
        result.current.createBlock();
        result.current.updateActions(newActions);
      });

      expect(result.current.actions).toEqual(newActions);
      expect(result.current.currentBlock?.actions).toEqual(newActions);
    });

    test('should add action', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
        result.current.addAction('hover', {
          type: 'hover',
          handler: 'handleHover'
        });
      });

      expect(result.current.actions.hover).toEqual({
        type: 'hover',
        handler: 'handleHover'
      });
    });

    test('should remove action', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          actions: {
            action1: { type: 'click', handler: 'handler1' },
            action2: { type: 'hover', handler: 'handler2' }
          }
        });
        result.current.removeAction('action1');
      });

      expect(result.current.actions.action1).toBeUndefined();
      expect(result.current.actions.action2).toEqual({ type: 'hover', handler: 'handler2' });
    });
  });

  describe('Preview and Export', () => {
    test('should set preview mode', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.setPreviewMode('mobile');
      });

      expect(result.current.previewMode).toBe('mobile');
    });

    test('should set export format', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.setExportFormat('yaml');
      });

      expect(result.current.exportFormat).toBe('yaml');
    });

    test('should export block', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          name: 'Export Test',
          template: '<div>{{content}}</div>'
        });
      });

      const exported = result.current.exportBlock();
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });

    test('should export all blocks', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Block 1' });
        result.current.createBlock({ name: 'Block 2' });
      });

      const exported = result.current.exportAllBlocks();
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });
  });

  describe('Error Management', () => {
    test('should add error', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const error = {
        id: 'error-1',
        message: 'Template validation failed',
        type: 'validation',
        timestamp: Date.now(),
        blockId: 'block-1'
      };

      act(() => {
        result.current.addError(error);
      });

      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0]).toEqual(error);
    });

    test('should remove error', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const error = {
        id: 'error-1',
        message: 'Template validation failed',
        type: 'validation',
        timestamp: Date.now(),
        blockId: 'block-1'
      };

      act(() => {
        result.current.addError(error);
        result.current.removeError('error-1');
      });

      expect(result.current.errors).toEqual([]);
    });

    test('should clear all errors', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.addError({
          id: 'error-1',
          message: 'Error 1',
          type: 'validation',
          timestamp: Date.now()
        });
        result.current.addError({
          id: 'error-2',
          message: 'Error 2',
          type: 'validation',
          timestamp: Date.now()
        });
        result.current.clearErrors();
      });

      expect(result.current.errors).toEqual([]);
    });
  });

  describe('Inscription Management', () => {
    test('should set inscription status', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.setInscriptionStatus('inscribing');
      });

      expect(result.current.inscription.inscriptionStatus).toBe('inscribing');
    });

    test('should set inscription error', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const error = new Error('Inscription failed');

      act(() => {
        result.current.setInscriptionError(error);
      });

      expect(result.current.inscription.inscriptionError).toBe(error);
      expect(result.current.inscription.inscriptionStatus).toBe('error');
    });

    test('should set inscription result', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      const inscriptionResult = {
        blockId: 'block-1',
        transactionId: '0.0.123@1234567890.000000000',
        timestamp: Date.now(),
        network: 'testnet'
      };

      act(() => {
        result.current.setInscriptionResult(inscriptionResult);
      });

      expect(result.current.inscription.inscriptionResult).toEqual(inscriptionResult);
      expect(result.current.inscription.inscriptionStatus).toBe('completed');
    });

    test('should reset inscription state', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.setInscriptionStatus('inscribing');
        result.current.setInscriptionError(new Error('Test error'));
        result.current.resetInscription();
      });

      expect(result.current.inscription.inscriptionStatus).toBe('idle');
      expect(result.current.inscription.inscriptionError).toBeUndefined();
      expect(result.current.inscription.inscriptionResult).toBeUndefined();
    });
  });

  describe('Auto-save Functionality', () => {
    test('should set auto-save enabled', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.setAutoSaveEnabled(true);
      });

      expect(result.current.autoSaveEnabled).toBe(true);
    });

    test('should trigger manual save', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
        result.current.manualSave();
      });

      expect(result.current.lastSaved).toBeInstanceOf(Date);
      expect(result.current.currentBlock?.modified).toBeInstanceOf(Date);
    });
  });

  describe('Block State Management', () => {
    test('should mark block as dirty', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock();
        result.current.setBlockDirty(true);
      });

      const blockState = result.current.blockStates[result.current.currentBlock!.id];
      expect(blockState.isDirty).toBe(true);
    });

    test('should validate block state', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          template: '<div>{{content}}</div>',
          attributes: {
            content: { type: 'string', default: 'test' }
          }
        });
      });

      const validation = result.current.validateBlockState();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete block workflow', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({
          name: 'Workflow Block',
          template: '<div class="card">{{title}}</div>',
          attributes: {
            title: { type: 'string', default: 'Default Title' }
          }
        });
      });

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.currentBlock?.name).toBe('Workflow Block');

      act(() => {
        result.current.updateTemplate('<div class="updated">{{title}} {{subtitle}}</div>');
        result.current.addAttribute('subtitle', { type: 'string', default: 'Default Subtitle' });
      });

      expect(result.current.template).toContain('updated');
      expect(result.current.attributes.subtitle).toBeDefined();

      const rendered = result.current.renderTemplate(
        result.current.template,
        { title: 'Test Title', subtitle: 'Test Subtitle' }
      );

      expect(rendered).toBe('<div class="updated">Test Title Test Subtitle</div>');

      const exported = result.current.exportBlock();
      expect(exported).toContain('Workflow Block');
    });

    test('should handle multiple block operations', () => {
      const { result } = renderHook(() => useBlockTesterStore());

      act(() => {
        result.current.createBlock({ name: 'Block A' });
        result.current.createBlock({ name: 'Block B' });
        result.current.createBlock({ name: 'Block C' });
      });

      expect(result.current.blocks).toHaveLength(3);

      act(() => {
        result.current.setActiveBlock(1); // Block B
      });

      expect(result.current.currentBlock?.name).toBe('Block B');

      act(() => {
        result.current.duplicateBlock(1);
      });

      expect(result.current.blocks).toHaveLength(4);
      expect(result.current.currentBlock?.name).toBe('Block B Copy');

      act(() => {
        result.current.closeBlock(0); // Close Block A
      });

      expect(result.current.blocks).toHaveLength(3);
      expect(result.current.blocks[0].name).toBe('Block B'); // Should shift indices
    });
  });
});
