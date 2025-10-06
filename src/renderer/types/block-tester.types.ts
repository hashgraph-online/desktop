/**
 * Block Tester Type Definitions
 *
 * Type definitions for the HCS-12 Block Tester development tool
 */


/**
 * Component prop types following CLAUDE.md rule #11
 */
export interface BlockEditorProps {
  block: WorkingBlock;
  onChange: (block: WorkingBlock) => void;
  onValidation?: (result: ValidationResult) => void;
}

export interface TemplateEditorProps {
  template: string;
  onChange: (template: string) => void;
  errors: ErrorLog[];
  suggestions: string[];
  config?: EditorConfig;
}

export interface AttributeEditorProps {
  attributes: Record<string, unknown>;
  schema: Record<string, AttributeSchema>;
  onChange: (attributes: Record<string, unknown>) => void;
  onSchemaChange?: (schema: Record<string, AttributeSchema>) => void;
}

export interface BlockPreviewProps {
  block: WorkingBlock;
  template: string;
  attributes: Record<string, unknown>;
  actions: Record<string, ActionBinding>;
  config: PreviewConfig;
}

export interface DevToolsProps {
  block: WorkingBlock | null;
  errors: ErrorLog[];
  onExport: () => void;
  onImport: () => void;
}

export interface MonacoEditorConfig {
  language: string;
  theme: 'vs-light' | 'vs-dark';
  minimap: boolean;
  wordWrap: 'on' | 'off';
  fontSize: number;
  lineNumbers: 'on' | 'off' | 'relative';
}

export interface LayoutProps {
  children?: React.ReactNode;
  className?: string;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export interface BlockDefinition {
  apiVersion: number;
  name: string;
  title: string;
  category: string;
  template_t_id: string;
  icon?: string;
  description?: string;
  keywords?: string[];
  textdomain?: string;
  attributes: Record<string, unknown>;
  provides?: Record<string, unknown>;
  usesContext?: string[];
  supports: Record<string, unknown>;
  parent?: string | string[];
}

export interface AttributeDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  enum?: string[];
  source?: string;
}

export interface ActionDefinition {
  name: string;
  description: string;
  inputs: unknown[];
  outputs: unknown[];
  required_capabilities: unknown[];
}

export interface ValidationRule {
  type?: string;
  required?: string[];
  properties?: Record<string, ValidationRule>;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  transactionId?: string;
  executionTime?: number;
}

export interface HCS12ValidationError {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Block Tester Application State - Multi-block support
 */
export interface BlockTesterState {
  blocks: WorkingBlock[];
  activeBlockIndex: number;
  nextBlockId: number;

  blockStates: Record<
    string,
    {
      template: string;
      templateSource?: TemplateSource;
      attributes: Record<string, unknown>;
      actions: Record<string, ActionBinding>;
      lastSaved: Date | null;
      isDirty: boolean;
      validation: ValidationResult;
    }
  >;

  previewMode: ViewportSize;
  errors: ErrorLog[];
  exportFormat: ExportFormat;
  isLoading: boolean;
  inscription: InscriptionState;

  closedBlocks: Array<{ block: WorkingBlock; closedAt: number }>;
  maxRecentBlocks: number;

  currentBlock?: WorkingBlock | null;
  template?: string;
  attributes?: Record<string, unknown>;
  actions?: Record<string, ActionBinding>;
  lastSaved?: Date | null;
}

/**
 * Working block definition with additional metadata for editing
 */
export interface WorkingBlock {
  id: string;
  name: string;
  title: string;
  description?: string;
  category: BlockCategory;
  template: string;
  templateSource: TemplateSource;
  attributes: Record<string, AttributeSchema>;
  actions: Record<string, ActionBinding>;
  keywords?: string[];
  icon?: string;
  created: Date;
  modified: Date;
}

/**
 * Enhanced attribute schema for the editor
 */
export interface AttributeSchema {
  type: AttributeType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  validation?: ValidationRule;
  placeholder?: string;
  helpText?: string;
}

/**
 * Action binding configuration
 */
export interface ActionBinding {
  actionId: string;
  actionName: string;
  topicId?: string;
  mockResponse?: MockActionResponse;
  parameters?: Record<string, unknown>;
}

/**
 * Mock action response for development
 */
export interface MockActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  delay?: number; // Simulate network delay
}

/**
 * Template source configuration
 */
export interface TemplateSource {
  type: 'inline' | 'blockchain' | 'hcs' | 'file';
  value?: string; // Template content or file path
  topicId?: string; // HCS topic ID for 'hcs' type
  lastFetched?: Date;
}

/**
 * Error logging
 */
export interface ErrorLog {
  id: string;
  type: ErrorType;
  message: string;
  source: ErrorSource;
  line?: number;
  column?: number;
  timestamp: Date;
  dismissed?: boolean;
}

/**
 * Block validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Preview configuration
 */
export interface PreviewConfig {
  viewport: ViewportSize;
  theme: 'light' | 'dark';
  showGrid: boolean;
  showBoundingBoxes: boolean;
  scale: number;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  includeMetadata: boolean;
  minify: boolean;
  target: 'hcs-1' | 'json' | 'html';
}

/**
 * Template example for library
 */
export interface TemplateExample {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  attributes: Record<string, unknown>;
  actions: Record<string, ActionBinding>;
  keywords: string[];
  featured: boolean;
  preview?: string; // Base64 encoded preview image
}

/**
 * Editor tab configuration
 */
export interface EditorTab {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType<Record<string, unknown>>;
  badge?: string | number;
}

/**
 * Monaco editor configuration
 */
export interface EditorConfig {
  language: 'html' | 'json' | 'javascript';
  theme: 'vs-light' | 'vs-dark';
  minimap: boolean;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  fontSize: number;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
}

/**
 * Component props interfaces - updated to avoid duplicates
 */
export interface ActionEditorProps {
  actions: Record<string, ActionBinding>;
  onChange: (actions: Record<string, ActionBinding>) => void;
  availableActions: ActionDefinition[];
}

/**
 * Enums and Constants
 */
export type AttributeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'color'
  | 'url'
  | 'email'
  | 'textarea'
  | 'select'
  | 'multiselect';

export type BlockCategory =
  | 'form'
  | 'display'
  | 'action'
  | 'layout'
  | 'media'
  | 'interactive'
  | 'ui'
  | 'custom';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export type ExportFormat = 'json' | 'hcs-1' | 'html' | 'template';

export type ErrorType =
  | 'syntax'
  | 'validation'
  | 'runtime'
  | 'network'
  | 'template'
  | 'action'
  | 'import'
  | 'preview'
  | 'editor'
  | 'export'
  | 'inscription';

export type ErrorSource =
  | 'template'
  | 'attributes'
  | 'actions'
  | 'preview'
  | 'export'
  | 'import'
  | 'validation'
  | 'processTemplate'
  | 'save'
  | 'iframe'
  | 'monaco'
  | 'inscribeBlock';

export type TemplateLanguage = 'handlebars' | 'html' | 'mustache';

/**
 * Inscription state types
 */
export interface InscriptionState {
  isInscribing: boolean;
  inscriptionStatus: 'idle' | 'validating' | 'submitting' | 'success' | 'error';
  inscriptionResult?: {
    topicId: string;
    hashLink: string;
    transactionId: string;
  };
  inscriptionError?: string;
  networkType: string; // NetworkType from standards-sdk
}

/**
 * Zustand store actions for state management (desktop app pattern)
 */
export interface BlockTesterActions {
  createBlock: (template?: Partial<WorkingBlock>) => void;
  duplicateBlock: (index: number) => void;
  closeBlock: (index: number) => void;
  switchToBlock: (index: number) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  restoreClosedBlock: () => void;

  updateBlockTemplate: (blockId: string, template: string) => void;
  updateBlockAttributes: (
    blockId: string,
    attributes: Record<string, AttributeSchema>
  ) => void;
  updateBlockActions: (
    blockId: string,
    actions: Record<string, ActionBinding>
  ) => void;
  updateBlock: (blockId: string, updates: Partial<WorkingBlock>) => void;
  markBlockDirty: (blockId: string) => void;
  validateActiveBlock: () => ValidationResult;

  getCurrentBlock: () => WorkingBlock | null;
  getCurrentTemplate: () => string;
  getCurrentAttributes: () => Record<string, AttributeSchema>;
  getCurrentActions: () => Record<string, ActionBinding>;
  getActiveBlockState: () => {
    template: string;
    attributes: Record<string, AttributeSchema>;
    actions: Record<string, ActionBinding>;
    isDirty: boolean;
    lastSaved: Date | null;
  } | null;

  setBlock: (block: WorkingBlock) => void;
  updateTemplate: (template: string) => void;
  updateAttributes: (attributes: Record<string, AttributeSchema>) => void;
  updateActions: (actions: Record<string, ActionBinding>) => void;
  saveBlock: () => void;
  resetBlock: () => void;
  validateBlock: () => ValidationResult;
  exportBlock: (format: ExportFormat) => string;
  importBlock: (data: string | object) => void;

  setPreviewMode: (mode: ViewportSize) => void;
  addError: (error: Omit<ErrorLog, 'id' | 'timestamp'>) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;
  setLoading: (loading: boolean) => void;
  setExportFormat: (format: ExportFormat) => void;

  processTemplate: (template: string, context: Record<string, unknown>) => string;
  clearTemplateCache: () => void;
  getTemplateVariables: (template?: string) => string[];
  enableAutoSave: (intervalMs?: number) => void;
  disableAutoSave: () => void;

  inscribeBlock: (block: WorkingBlock) => Promise<void>;
  setNetworkType: (networkType: string) => void;
  resetInscriptionState: () => void;
  isBlockValidForInscription: () => boolean;
}

/**
 * Combined Zustand store interface
 */
export interface BlockTesterStore
  extends BlockTesterState,
    BlockTesterActions {}

/**
 * Hook return types
 */
export interface UseBlockValidationReturn {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validate: () => ValidationResult;
}

export interface UseTemplateRendererReturn {
  renderedContent: string;
  isLoading: boolean;
  error: string | null;
  render: (template: string, attributes: Record<string, unknown>) => Promise<void>;
}

/**
 * Utility types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
