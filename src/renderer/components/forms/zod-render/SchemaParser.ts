import { ZodType, ZodObject, ZodArray, ZodUnion, ZodDiscriminatedUnion, ZodOptional, ZodDefault, ZodEnum } from 'zod';
import {
  FormFieldType,
  EnhancedRenderConfig,
  FieldMetadata,
  SelectOption,
  ValidationError,
  ExtractedRenderConfig
} from './types';

interface ZodDefinition {
  typeName: string;
  innerType?: ZodType<unknown>;
  values?: readonly string[] | Record<string, unknown>;
  checks?: ZodCheck[];
  shape?: Record<string, ZodType<unknown>>;
  options?: ZodType<unknown>[];
  defaultValue?: unknown | (() => unknown);
  minLength?: { value: number };
  maxLength?: { value: number };
  value?: unknown;
}

interface ZodCheck {
  kind: string;
  value?: number | string;
  regex?: RegExp;
}

interface ZodTypeWithDef {
  _def: ZodDefinition;
}

interface ZodSchemaWithRenderConfig {
  _renderConfig?: EnhancedRenderConfig;
}

interface ZodError {
  errors?: Array<{
    path: (string | number)[];
    message: string;
    code: string;
  }>;
}

function hasZodDef(schema: ZodType<unknown>): boolean {
  return schema && typeof schema === 'object' && '_def' in schema && 
    typeof (schema as { _def: unknown })._def === 'object';
}

function hasRenderConfigProperty(schema: ZodType<unknown>): boolean {
  return schema && typeof schema === 'object' && '_renderConfig' in schema;
}

function isZodError(error: unknown): error is ZodError {
  return typeof error === 'object' && error !== null && 'errors' in error;
}

function getZodDef(schema: ZodType<unknown>): ZodDefinition | null {
  if (!hasZodDef(schema)) {
    return null;
  }
  return (schema as unknown as ZodTypeWithDef)._def;
}

function getZodTypeName(schema: ZodType<unknown>): string | null {
  const def = getZodDef(schema);
  return def?.typeName || null;
}

function getZodInnerType(schema: ZodType<unknown>): ZodType<unknown> | null {
  const def = getZodDef(schema);
  return def?.innerType || null;
}

function getZodValues(schema: ZodType<unknown>): readonly string[] | Record<string, unknown> | null {
  const def = getZodDef(schema);
  return def?.values || null;
}

function getZodChecks(schema: ZodType<unknown>): ZodCheck[] {
  const def = getZodDef(schema);
  return def?.checks || [];
}

function getZodShape(schema: ZodType<unknown>): Record<string, ZodType<unknown>> | null {
  const def = getZodDef(schema);
  if (def?.shape) {
    if (typeof def.shape === 'function') {
      try {
        const shapeResult = (def.shape as () => Record<string, ZodType<unknown>>)();
        return shapeResult;
      } catch {
        return null;
      }
    }
    if (typeof def.shape === 'object' && def.shape !== null) {
      return def.shape as Record<string, ZodType<unknown>>;
    }
  }
  
  if (schema && typeof schema === 'object' && 'shape' in schema) {
    const shapeValue = (schema as { shape: unknown }).shape;
    if (typeof shapeValue === 'object' && shapeValue !== null) {
      return shapeValue as Record<string, ZodType<unknown>>;
    }
  }
  
  return null;
}

function getZodOptions(schema: ZodType<unknown>): ZodType<unknown>[] | null {
  const def = getZodDef(schema);
  return def?.options || null;
}

function getZodDefaultValue(schema: ZodType<unknown>): unknown | (() => unknown) | null {
  const def = getZodDef(schema);
  return def?.defaultValue ?? null;
}

function getZodMinLength(schema: ZodType<unknown>): number | null {
  const def = getZodDef(schema);
  return def?.minLength?.value ?? null;
}

function getZodMaxLength(schema: ZodType<unknown>): number | null {
  const def = getZodDef(schema);
  return def?.maxLength?.value ?? null;
}

function getZodLiteralValue(schema: ZodType<unknown>): unknown {
  const def = getZodDef(schema);
  return def?.value;
}

function getZodDescription(schema: ZodType<unknown>): string | undefined {
  if (typeof schema === 'object' && schema !== null && 'description' in schema) {
    return (schema as { description: unknown }).description as string;
  }
  return undefined;
}

/**
 * Extracts render configuration from Zod schema
 */
function getRenderConfig(schema: ZodType<unknown>): EnhancedRenderConfig | undefined {
  if (!hasRenderConfigProperty(schema)) {
    return undefined;
  }
  return (schema as unknown as ZodSchemaWithRenderConfig)._renderConfig;
}

/**
 * Checks if schema has render configuration
 */
function hasRenderConfig(schema: ZodType<unknown>): boolean {
  return hasRenderConfigProperty(schema) && !!(schema as unknown as ZodSchemaWithRenderConfig)._renderConfig;
}

/**
 * Infers field type from Zod schema
 */
function inferFieldType(schema: ZodType<unknown>): FormFieldType {
  const typeName = getZodTypeName(schema);
  
  switch (typeName) {
    case 'ZodString':
      return 'text';
    case 'ZodNumber':
    case 'ZodBigInt':
      return 'number';
    case 'ZodBoolean':
      return 'checkbox';
    case 'ZodEnum':
    case 'ZodNativeEnum':
      return 'select';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return 'select';
    case 'ZodDate':
      return 'text';
    case 'ZodOptional':
    case 'ZodDefault': {
      const innerSchema = getZodInnerType(schema);
      return innerSchema ? inferFieldType(innerSchema) : 'text';
    }
    default:
      return 'text';
  }
}

/**
 * Extracts options from enum or union schemas
 */
function extractOptions(schema: ZodType<unknown>): SelectOption[] | undefined {
  const typeName = getZodTypeName(schema);
  
  if (typeName === 'ZodEnum') {
    const values = getZodValues(schema);
    if (Array.isArray(values)) {
      return values.map((value: string) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' ')
      }));
    }
  }
  
  if (typeName === 'ZodNativeEnum') {
    const enumObject = getZodValues(schema);
    if (enumObject && typeof enumObject === 'object' && !Array.isArray(enumObject)) {
      return Object.entries(enumObject).map(([key, value]) => ({
        value,
        label: key.replace(/[_-]/g, ' ')
      }));
    }
  }
  
  if (typeName === 'ZodUnion') {
    const options: SelectOption[] = [];
    const unionOptions = getZodOptions(schema);
    
    if (Array.isArray(unionOptions)) {
      for (const option of unionOptions) {
        if (getZodTypeName(option) === 'ZodLiteral') {
          const value = getZodLiteralValue(option);
          if (value !== undefined) {
            options.push({
              value,
              label: typeof value === 'string' 
                ? value.charAt(0).toUpperCase() + value.slice(1)
                : String(value)
            });
          }
        }
      }
    }
    
    return options.length > 0 ? options : undefined;
  }
  
  return undefined;
}

/**
 * Checks if schema is optional
 */
function isOptional(schema: ZodType<unknown>): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}

/**
 * Gets inner schema from optional/default wrappers
 */
function getInnerSchema(schema: ZodType<unknown>): ZodType<unknown> {
  const typeName = getZodTypeName(schema);
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    return getZodInnerType(schema) || schema;
  }
  return schema;
}

/**
 * Extracts validation constraints from schema
 */
function extractConstraints(schema: ZodType<unknown>): Record<string, unknown> {
  const innerSchema = getInnerSchema(schema);
  const typeName = getZodTypeName(innerSchema);
  const constraints: Record<string, unknown> = {};
  
  if (typeName === 'ZodString') {
    const checks = getZodChecks(innerSchema);
    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          if (typeof check.value === 'number') {
            constraints.minLength = check.value;
          }
          break;
        case 'max':
          if (typeof check.value === 'number') {
            constraints.maxLength = check.value;
          }
          break;
        case 'email':
          constraints.type = 'email';
          break;
        case 'url':
          constraints.type = 'url';
          break;
        case 'regex':
          if (check.regex) {
            constraints.pattern = check.regex.source;
          }
          break;
      }
    }
  }
  
  if (typeName === 'ZodNumber') {
    const checks = getZodChecks(innerSchema);
    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          if (typeof check.value === 'number') {
            constraints.min = check.value;
          }
          break;
        case 'max':
          if (typeof check.value === 'number') {
            constraints.max = check.value;
          }
          break;
        case 'int':
          constraints.step = 1;
          break;
        case 'multipleOf':
          if (typeof check.value === 'number') {
            constraints.step = check.value;
          }
          break;
      }
    }
  }
  
  if (typeName === 'ZodArray') {
    const minLength = getZodMinLength(innerSchema);
    const maxLength = getZodMaxLength(innerSchema);
    if (minLength !== null) constraints.minItems = minLength;
    if (maxLength !== null) constraints.maxItems = maxLength;
  }
  
  return constraints;
}

/**
 * Gets default value from schema
 */
function getDefaultValue(schema: ZodType<unknown>): unknown {
  const typeName = getZodTypeName(schema);
  
  if (typeName === 'ZodDefault') {
    const defaultValue = getZodDefaultValue(schema);
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }
  
  const innerSchema = getInnerSchema(schema);
  const innerTypeName = getZodTypeName(innerSchema);
  
  switch (innerTypeName) {
    case 'ZodString':
      return '';
    case 'ZodNumber':
    case 'ZodBigInt':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodArray':
      return [];
    case 'ZodObject':
      return {};
    case 'ZodDate':
      return new Date();
    case 'ZodEnum': {
      const values = getZodValues(innerSchema);
      return Array.isArray(values) && values.length > 0 ? values[0] : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Parses Zod schemas and extracts form field configurations
 */
export class SchemaParser {
  private schema: ZodType<unknown>;
  
  constructor(schema: ZodType<unknown>) {
    this.schema = schema;
  }

  /**
   * Parses the schema and returns form configuration
   */
  parse(): ExtractedRenderConfig {
    const typeName = getZodTypeName(this.schema);
    
    if (typeName === 'ZodObject') {
      return this.parseObjectSchema(this.schema as ZodObject<Record<string, ZodType<unknown>>>);
    }
    
    const fieldConfig = this.parseFieldSchema('value', this.schema);
    return {
      fields: { value: fieldConfig },
      groups: {},
      order: ['value'],
      metadata: { value: this.extractFieldMetadata(this.schema) }
    };
  }

  /**
   * Parses ZodObject schema
   */
  private parseObjectSchema(schema: ZodObject<Record<string, ZodType<unknown>>>): ExtractedRenderConfig {
    const shape = getZodShape(schema);
    const fields: Record<string, EnhancedRenderConfig> = {};
    const groups: Record<string, string[]> = {};
    const order: string[] = [];
    const metadata: Record<string, FieldMetadata> = {};

    if (shape) {
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const fieldConfig = this.parseFieldSchema(fieldName, fieldSchema);
        fields[fieldName] = fieldConfig;
        order.push(fieldName);
        metadata[fieldName] = this.extractFieldMetadata(fieldSchema);

        const groupName = fieldConfig.progressive?.group || 'default';
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(fieldName);
      }
    }

    const schemaRenderConfig = getRenderConfig(schema);
    const progressiveDisclosure = schemaRenderConfig?.progressive ? {
      enabled: true,
      groups: this.extractFormGroups(fields),
      defaultExpanded: ['default'],
      showFieldCount: true,
      adaptiveLayout: true
    } : undefined;

    return {
      fields,
      groups,
      order,
      metadata,
      progressiveDisclosure
    };
  }

  /**
   * Parses individual field schema
   */
  private parseFieldSchema(fieldName: string, schema: ZodType<unknown>): EnhancedRenderConfig {
    const renderConfig = getRenderConfig(schema);
    const fieldType = renderConfig?.fieldType || inferFieldType(schema);
    const constraints = extractConstraints(schema);
    const options = extractOptions(getInnerSchema(schema));
    const required = !isOptional(schema);

    const config: EnhancedRenderConfig = {
      fieldType,
      ui: {
        label: this.generateLabel(fieldName),
        placeholder: this.generatePlaceholder(fieldName, fieldType),
        priority: 'common',
        ...renderConfig?.ui
      },
      progressive: {
        priority: 'common',
        ...renderConfig?.progressive
      },
      constraints: {
        ...constraints,
        ...renderConfig?.constraints
      },
      validation: {
        customMessages: {},
        ...renderConfig?.validation
      },
      ...renderConfig
    };

    if (options && (fieldType === 'select' || config.fieldType === 'select')) {
      config.options = options;
    }

    if (required) {
      config.ui = { ...config.ui, required: true };
    }

    return config;
  }

  /**
   * Extracts field metadata
   */
  private extractFieldMetadata(schema: ZodType<unknown>): FieldMetadata {
    const innerSchema = getInnerSchema(schema);
    const fieldType = inferFieldType(schema);
    const required = !isOptional(schema);
    const defaultValue = getDefaultValue(schema);
    const options = extractOptions(innerSchema);
    const constraints = extractConstraints(schema);
    const description = getZodDescription(schema);

    return {
      type: fieldType,
      required,
      optional: !required,
      default: defaultValue,
      options,
      constraints,
      description,
      validation: {
        minLength: constraints.minLength as number,
        maxLength: constraints.maxLength as number,
        min: constraints.min as number,
        max: constraints.max as number,
        pattern: constraints.pattern ? new RegExp(constraints.pattern as string) : undefined
      }
    };
  }

  /**
   * Generates form groups from field configurations
   */
  private extractFormGroups(fields: Record<string, EnhancedRenderConfig>) {
    const groupMap = new Map<string, { priority: string; fieldCount: number }>();

    Object.values(fields).forEach(field => {
      const groupName = field.progressive?.group || 'default';
      const priority = field.progressive?.priority || 'common';
      
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { priority, fieldCount: 0 });
      }
      groupMap.get(groupName)!.fieldCount++;
    });

    return Array.from(groupMap.entries()).map(([name, info]) => ({
      name,
      priority: info.priority as 'essential' | 'common' | 'advanced' | 'expert',
      collapsible: info.priority !== 'essential',
      defaultExpanded: info.priority === 'essential'
    }));
  }

  /**
   * Generates default values for all fields
   */
  getDefaultValues(): Record<string, unknown> {
    const parsed = this.parse();
    const values: Record<string, unknown> = {};

    Object.entries(parsed.metadata).forEach(([fieldName, metadata]) => {
      if (metadata.default !== undefined) {
        values[fieldName] = metadata.default;
      }
    });

    return values;
  }

  /**
   * Validates values against schema
   */
  validate(values: Record<string, unknown>): ValidationError[] {
    try {
      this.schema.parse(values);
      return [];
    } catch (error: unknown) {
      if (isZodError(error) && error.errors) {
        return error.errors.map((err) => ({
          path: err.path.map(String),
          message: err.message,
          code: err.code
        }));
      }
      return [{ path: [], message: 'Validation failed', code: 'custom' }];
    }
  }

  /**
   * Generates a human-readable label from field name
   */
  private generateLabel(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/[_-]/g, ' ')
      .trim();
  }

  /**
   * Generates a placeholder based on field name and type
   */
  private generatePlaceholder(fieldName: string, fieldType: FormFieldType): string {
    switch (fieldType) {
      case 'text':
        if (fieldName.toLowerCase().includes('email')) return 'Enter your email';
        if (fieldName.toLowerCase().includes('name')) return 'Enter name';
        if (fieldName.toLowerCase().includes('url')) return 'https://example.com';
        return `Enter ${this.generateLabel(fieldName).toLowerCase()}`;
      case 'number':
        return '0';
      case 'textarea':
        return `Enter ${this.generateLabel(fieldName).toLowerCase()}...`;
      case 'select':
        return 'Select an option';
      case 'checkbox':
        return '';
      default:
        return '';
    }
  }
}