export type {
  FormFieldType,
  RenderContext,
  RenderFunction,
  FormFieldConfig,
  FormGenerationOptions,
  ZodSchemaWithRender,
  ValidationError,
  FormState,
  FormActions,
  UseFormReturn,
  ComponentRegistry,
  FieldComponentProps,
  SelectOption,
  FileUploadResult,
} from './types';

export {
  extendZodSchema,
  hasRenderConfig,
  getRenderConfig,
  inferFieldTypeFromSchema,
  extractOptionsFromSchema,
  isOptionalSchema,
  getInnerSchema,
  extractValidationConstraints,
  getDefaultValue,
} from './schema-extension';

export {
  TextFieldComponent,
  NumberFieldComponent,
  SelectFieldComponent,
  CheckboxFieldComponent,
  TextareaFieldComponent,
  FileFieldComponent,
  defaultComponentRegistry,
  FieldRegistry,
  defaultFieldRegistry,
} from './field-registry';