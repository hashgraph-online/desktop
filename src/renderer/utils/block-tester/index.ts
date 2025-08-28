/**
 * Block Tester Utility Functions
 */

import { cn } from '../../lib/utils';
import { 
  WorkingBlock, 
  ValidationResult, 
  ValidationError,
  ValidationWarning,
  AttributeSchema,
  BlockCategory
} from '../../types/block-tester.types';

export { cn };

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Create a new working block with default values
 */
export function createDefaultBlock(): WorkingBlock {
  return {
    id: generateId(),
    name: 'untitled-block',
    title: 'Untitled Block',
    description: '',
    category: 'display' as BlockCategory,
    template: DEFAULT_TEMPLATE,
    templateSource: {
      type: 'inline',
      value: DEFAULT_TEMPLATE,
    },
    attributes: {
      title: {
        type: 'string',
        label: 'Title',
        description: 'Block title',
        required: true,
        default: 'Untitled Block',
        placeholder: 'Enter block title...'
      },
      description: {
        type: 'string',
        label: 'Description',
        description: 'Block description',
        required: false,
        default: '',
        placeholder: 'Enter block description...'
      }
    },
    actions: {},
    keywords: [],
    icon: 'block',
    created: new Date(),
    modified: new Date(),
  };
}

/**
 * Default template for new blocks
 */
export const DEFAULT_TEMPLATE = `<div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm w-full">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-6 h-6 bg-blue-500 rounded flex-shrink-0"></div>
    <div class="min-w-0 flex-1">
      <h3 class="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">{{attributes.title}}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{attributes.description}}</p>
    </div>
  </div>
  <div class="pt-2 border-t border-slate-200 dark:border-slate-700">
    <p class="text-xs text-slate-600 dark:text-slate-400">Created with Block Tester</p>
  </div>
</div>`;

/**
 * Validate a working block
 */
export function validateBlock(block: WorkingBlock): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!block.name || block.name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Block name is required',
      severity: 'error'
    });
  } else if (!/^[a-z0-9-]+$/.test(block.name)) {
    errors.push({
      field: 'name',
      message: 'Block name must contain only lowercase letters, numbers, and hyphens',
      severity: 'error'
    });
  }

  if (!block.title || block.title.trim() === '') {
    errors.push({
      field: 'title',
      message: 'Block title is required',
      severity: 'error'
    });
  }

  if (!block.template || block.template.trim() === '') {
    errors.push({
      field: 'template',
      message: 'Block template is required',
      severity: 'error'
    });
  } else {
    const templateIssues = validateTemplate(block.template, block.attributes);
    errors.push(...templateIssues.errors);
    warnings.push(...templateIssues.warnings);
  }

  Object.entries(block.attributes).forEach(([key, schema]) => {
    if (!schema.label) {
      warnings.push({
        field: `attributes.${key}.label`,
        message: `Attribute "${key}" should have a label for better UX`,
        suggestion: 'Add a descriptive label for this attribute'
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate template syntax and structure
 */
export function validateTemplate(
  template: string, 
  attributes: Record<string, AttributeSchema>
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const openTags = template.match(/<[^/][^>]*>/g) || [];
  const closeTags = template.match(/<\/[^>]*>/g) || [];
  
  if (openTags.length !== closeTags.length) {
    warnings.push({
      field: 'template',
      message: 'Template may have unbalanced HTML tags',
      suggestion: 'Check that all opening tags have corresponding closing tags'
    });
  }

  const handlebarsMatches = template.match(/\{\{[^}]+\}\}/g) || [];
  
  handlebarsMatches.forEach((match: string) => {
    const expression = match.slice(2, -2).trim();
    
    if (expression.startsWith('attributes.')) {
      const attributeName = expression.split('.')[1];
      if (!attributes[attributeName]) {
        warnings.push({
          field: 'template',
          message: `Template references undefined attribute "${attributeName}"`,
          suggestion: `Add "${attributeName}" to block attributes or remove the reference`
        });
      }
    }
    
    if (expression.startsWith('actions.')) {
      warnings.push({
        field: 'template',
        message: 'Action references in templates are not yet supported in preview mode',
        suggestion: 'Action bindings will work when deployed but not in preview'
      });
    }
  });

  if (template.includes('<script')) {
    warnings.push({
      field: 'template',
      message: 'Template contains script tags',
      suggestion: 'Consider using HCS-3 for external scripts or inline event handlers'
    });
  }

  return { errors, warnings };
}

/**
 * Process template with enhanced placeholder substitution
 * Following the blockchain template rendering specification from memory
 * Handles attributes, actions, and common HCS-12 template variables
 */
export function processTemplate(
  template: string, 
  attributes: Record<string, unknown>,
  actions: Record<string, unknown> = {},
  context: Record<string, unknown> = {}
): string {
  let processed = template;

  Object.entries(attributes).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{attributes\\.${key}\\}\\}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  });

  Object.entries(attributes).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  });

  const defaultContext = {
    topicId: context.topicId || attributes.topicId || '0.0.123456',
    name: context.name || attributes.name || attributes.title || 'Test Block',
    creator: context.creator || attributes.creator || 'Block Tester',
    hrl: context.hrl || `hcs://12/${context.topicId || attributes.topicId || '0.0.123456'}`,
    network: context.network || 'testnet',
    ...context // Allow override of defaults
  };

  Object.entries(defaultContext).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  });

  Object.entries(actions).forEach(([key, _action]) => {
    const regex = new RegExp(`\\{\\{actions\\.${key}\\}\\}`, 'g');
    processed = processed.replace(regex, `javascript:void(0); /* Mock action: ${key} */`);
  });

  processed = processed.replace(/\{\{[^}]+\}\}/g, '');

  return processed;
}

/**
 * Export block to different formats
 */
export function exportBlock(block: WorkingBlock, format: 'json' | 'hcs-1' | 'html' | 'template'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(block, null, 2);
      
    case 'hcs-1':
      return JSON.stringify({
        p: 'hcs-12',
        op: 'register',
        name: block.name,
        title: block.title,
        description: block.description,
        category: block.category,
        template: block.template,
        attributes: Object.fromEntries(
          Object.entries(block.attributes).map(([key, schema]) => [
            key,
            {
              type: schema.type,
              default: schema.default,
              required: schema.required
            }
          ])
        ),
        keywords: block.keywords,
        icon: block.icon
      }, null, 2);
      
    case 'html': {
      const processedTemplate = processTemplate(
        block.template, 
        Object.fromEntries(
          Object.entries(block.attributes).map(([key, schema]) => [key, schema.default])
        )
      );
      
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${block.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
  <div class="max-w-2xl mx-auto">
    ${processedTemplate}
  </div>
</body>
</html>`;
    }
      
    case 'template':
      return block.template;
      
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Import block from various formats
 */
export function importBlock(data: string | object): WorkingBlock {
  let blockData: Record<string, unknown>;
  
  if (typeof data === 'string') {
    try {
      blockData = JSON.parse(data);
    } catch (_error) {
      return {
        id: generateId(),
        name: 'imported-template',
        title: 'Imported Template',
        description: 'Template imported from raw HTML',
        category: 'display',
        template: data as string,
        templateSource: {
          type: 'inline',
          value: data as string,
        },
        attributes: {
          title: {
            type: 'string',
            label: 'Title',
            description: 'Block title',
            required: true,
            default: 'Imported Block',
            placeholder: 'Enter block title...'
          },
          description: {
            type: 'string',
            label: 'Description',
            description: 'Block description',
            required: false,
            default: 'This block was imported from a template',
            placeholder: 'Enter block description...'
          }
        },
        actions: {},
        keywords: [],
        icon: 'block',
        created: new Date(),
        modified: new Date(),
      };
    }
  } else {
    blockData = data as Record<string, unknown>;
  }

  if (blockData.p === 'hcs-12' && blockData.op === 'register') {
    const hcsData = blockData as {
      p: string;
      op: string;
      name?: string;
      title?: string;
      description?: string;
      category?: BlockCategory;
      template?: string;
      attributes?: Record<string, { type?: string; required?: boolean; default?: unknown }>;
      keywords?: string[];
      icon?: string;
    };
    
    return {
      id: generateId(),
      name: hcsData.name || 'imported-block',
      title: hcsData.title || 'Imported Block',
      description: hcsData.description || '',
      category: hcsData.category || 'display',
      template: hcsData.template || DEFAULT_TEMPLATE,
      templateSource: {
        type: 'inline',
        value: hcsData.template || DEFAULT_TEMPLATE,
      },
      attributes: Object.fromEntries(
        Object.entries(hcsData.attributes || {}).map(([key, attr]) => [
          key,
          {
            type: (attr.type as AttributeSchema['type']) || 'string',
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            description: '',
            required: attr.required || false,
            default: attr.default || '',
          } as AttributeSchema
        ])
      ),
      actions: {},
      keywords: hcsData.keywords || [],
      icon: hcsData.icon || 'block',
      created: new Date(),
      modified: new Date(),
    };
  } else if (blockData.id && blockData.template) {
    const workingBlockData = blockData as Partial<WorkingBlock> & {
      id: string;
      template: string;
      created?: string | Date;
      modified?: string | Date;
    };
    
    return {
      id: workingBlockData.id,
      name: workingBlockData.name || 'Imported Block',
      title: workingBlockData.title || 'Imported Block',
      description: workingBlockData.description || '',
      category: workingBlockData.category || 'display',
      template: workingBlockData.template,
      templateSource: workingBlockData.templateSource || {
        type: 'inline',
        value: workingBlockData.template,
      },
      attributes: workingBlockData.attributes || {},
      actions: workingBlockData.actions || {},
      keywords: workingBlockData.keywords || [],
      icon: workingBlockData.icon,
      created: workingBlockData.created ? new Date(workingBlockData.created) : new Date(),
      modified: workingBlockData.modified ? new Date(workingBlockData.modified) : new Date(),
    };
  }

  throw new Error('Unsupported import format');
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get viewport dimensions for preview modes
 */
export function getViewportDimensions(mode: 'desktop' | 'tablet' | 'mobile') {
  switch (mode) {
    case 'desktop':
      return { width: 1200, height: 800 };
    case 'tablet':
      return { width: 768, height: 1024 };
    case 'mobile':
      return { width: 375, height: 667 };
    default:
      return { width: 1200, height: 800 };
  }
}