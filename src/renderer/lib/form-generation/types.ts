import { ReactNode, ComponentType } from 'react';
import { ZodType, ZodSchema } from 'zod';

export type FormFieldType = 
  | 'text' 
  | 'number' 
  | 'select' 
  | 'checkbox' 
  | 'textarea' 
  | 'file';

export type RenderContext = {
  path: string[];
  value: unknown;
  setValue: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
};

export type RenderFunction<T = unknown> = (
  schema: ZodType<T>,
  context: RenderContext
) => ReactNode;

export type FormFieldConfig = {
  fieldType: FormFieldType;
  component?: ComponentType<FieldComponentProps>;
  props?: Record<string, unknown>;
  wrapper?: ComponentType<{ children: ReactNode }>;
  validation?: {
    customMessages?: Record<string, string>;
  };
};

export type FormGenerationOptions = {
  fieldOrder?: string[];
  fieldConfigs?: Record<string, FormFieldConfig>;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  onValueChange?: (path: string[], value: unknown) => void;
  className?: string;
  disabled?: boolean;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  resetButtonText?: string;
  showResetButton?: boolean;
};

export interface ZodSchemaWithRender<T = unknown> extends ZodSchema<T> {
  _renderConfig?: FormFieldConfig;
  withRender: (config: FormFieldConfig) => ZodSchemaWithRender<T>;
}

export type ValidationError = {
  path: string[];
  message: string;
  code: string;
};

export type FormState<T = Record<string, unknown>> = {
  values: T;
  errors: ValidationError[];
  isValidating: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  touchedFields: Set<string>;
};

export type FormActions<T = Record<string, unknown>> = {
  setValue: (path: string[], value: unknown) => void;
  setValues: (values: Partial<T>) => void;
  setError: (path: string[], error: string) => void;
  clearError: (path: string[]) => void;
  clearErrors: () => void;
  reset: () => void;
  submit: () => Promise<void>;
  validate: () => Promise<boolean>;
  touchField: (path: string[]) => void;
};

export type UseFormReturn<T = Record<string, unknown>> = {
  state: FormState<T>;
  actions: FormActions<T>;
};

export type ComponentRegistry = Record<FormFieldType, ComponentType<FieldComponentProps>>;

export type FormFieldValue = string | number | boolean | File | FileList | null | undefined;

export type FieldComponentProps = {
  value: FormFieldValue;
  onChange: (value: FormFieldValue) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: FormFieldValue; label: string; disabled?: boolean }>;
  multiple?: boolean;
  accept?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export type SelectOption = {
  value: FormFieldValue;
  label: string;
  disabled?: boolean;
};

export type FileUploadResult = {
  name: string;
  data: string;
  type: string;
  size: number;
};