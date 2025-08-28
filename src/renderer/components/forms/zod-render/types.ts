import { ReactNode, ComponentType } from 'react';
import { ZodType, ZodSchema } from 'zod';

/**
 * Field types supported by the form renderer
 */
export type FormFieldType = 
  | 'text'
  | 'number'
  | 'boolean'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'array'
  | 'object'
  | 'currency'
  | 'percentage'
  | 'email'
  | 'url'
  | 'password'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'file';

/**
 * Validation error type
 */
export type ValidationError = {
  path: string[];
  message: string;
  code: string;
};

/**
 * Select option type
 */
export type SelectOption = {
  value: unknown;
  label: string;
  disabled?: boolean;
};

/**
 * File upload result
 */
export type FileUploadResult = {
  name: string;
  size: number;
  type: string;
  data: string | ArrayBuffer;
};

/**
 * Progressive disclosure configuration
 */
export type ProgressiveDisclosureConfig = {
  enabled?: boolean;
  priority?: 'essential' | 'common' | 'advanced' | 'expert';
  collapsible?: boolean;
  expanded?: boolean;
  showWhen?: (values: Record<string, unknown>) => boolean;
  groups?: FormGroup[];
  defaultExpanded?: string[];
  showFieldCount?: boolean;
  group?: string;
};

/**
 * Form group configuration
 */
export type FormGroup = {
  name: string;
  label?: string;
  description?: string;
  collapsible?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  order?: number;
  priority?: 'essential' | 'common' | 'advanced' | 'expert';
};

/**
 * Field metadata
 */
export type FieldMetadata = {
  label?: string;
  placeholder?: string;
  helpText?: string;
  group?: string;
  order?: number;
  hidden?: boolean;
  readonly?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  className?: string;
  priority?: 'essential' | 'common' | 'advanced' | 'expert';
  collapsible?: boolean;
  expanded?: boolean;
  icon?: string;
  description?: string;
  required?: boolean;
  type?: FormFieldType;
  optional?: boolean;
  default?: unknown;
  options?: SelectOption[];
  constraints?: FieldConstraints;
  validation?: Record<string, unknown>;
};

/**
 * Field constraints
 */
export type FieldConstraints = {
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  accept?: string;
  multiple?: boolean;
  type?: string;
};

/**
 * Enhanced render configuration
 */
export type EnhancedRenderConfig = {
  fieldType: FormFieldType;
  ui: FieldMetadata;
  constraints: FieldConstraints;
  options: SelectOption[];
  validation: Record<string, unknown>;
  props?: Record<string, unknown>;
  progressive?: ProgressiveDisclosureConfig;
};

/**
 * Render configuration schema
 */
export type RenderConfigSchema = {
  fields: Record<string, EnhancedRenderConfig>;
  groups?: FormGroup[];
  progressive?: ProgressiveDisclosureConfig;
};

/**
 * Zod schema with render configuration
 */
export type ZodSchemaWithRender = ZodSchema & {
  _def: {
    render?: EnhancedRenderConfig;
  };
};

/**
 * Extracted render configuration
 */
export type ExtractedRenderConfig = {
  fields: Record<string, EnhancedRenderConfig>;
  groups: Record<string, string[]>;
  order: string[];
  metadata: Record<string, FieldMetadata>;
  progressiveDisclosure?: ProgressiveDisclosureConfig;
};

/**
 * Form state management for desktop implementation
 */
export type FormState<TValues = Record<string, unknown>> = {
  values: TValues;
  errors: ValidationError[];
  isValidating: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  touchedFields: Set<string>;
};

/**
 * Form action handlers for desktop implementation
 */
export type FormActions<TValues = Record<string, unknown>> = {
  setValue: (path: string[], value: unknown) => void;
  setValues: (values: Partial<TValues>) => void;
  setError: (path: string[], error: string) => void;
  clearError: (path: string[]) => void;
  clearErrors: () => void;
  reset: () => void;
  submit: () => Promise<void>;
  validate: () => Promise<boolean>;
  touchField: (path: string[]) => void;
};

/**
 * Complete form hook return type
 */
export type UseFormReturn<TValues = Record<string, unknown>> = {
  state: FormState<TValues>;
  actions: FormActions<TValues>;
};

/**
 * Options for generating forms from schemas
 */
export type FormGenerationOptions = {
  fieldOrder?: string[];
  fieldConfigs?: Record<string, EnhancedRenderConfig>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  onValueChange?: (path: string[], value: unknown) => void;
  className?: string;
  disabled?: boolean;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  resetButtonText?: string;
  showResetButton?: boolean;
  groupBy?: 'none' | 'group' | 'section';
  layout?: 'vertical' | 'horizontal' | 'grid';
  progressiveDisclosure?: ProgressiveDisclosureConfig;
};

/**
 * Props passed to field components
 */
export type FieldComponentProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: unknown; label: string; disabled?: boolean }>;
  multiple?: boolean;
  accept?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

/**
 * Registry mapping field types to React components
 */
export type ComponentRegistry = Record<FormFieldType, ComponentType<FieldComponentProps>>;

/**
 * Context for rendering fields
 */
export type RenderContext = {
  path: string[];
  value: unknown;
  setValue: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Function that renders a field component for a Zod schema
 */
export type RenderFunction<TSchema = unknown> = (
  schema: ZodType<TSchema>,
  context: RenderContext
) => ReactNode;

