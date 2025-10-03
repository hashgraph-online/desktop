import { ZodType, ZodSchema } from 'zod';
import { FormFieldConfig, ZodSchemaWithRender } from './types';

/**
 * Internal Zod schema definition types
 */
interface ZodDef {
  typeName?: string;
  value?: unknown;
  innerType?: ZodType<unknown>;
  defaultValue?: unknown | (() => unknown);
  checks?: Array<{ kind: string; value?: unknown; regex?: RegExp }>;
}

/**
 * Extends a Zod schema with render configuration for form generation
 */
export function extendZodSchema<T>(schema: ZodType<T>): ZodSchemaWithRender<T> {
  const extendedSchema = schema as ZodSchemaWithRender<T>;
  
  extendedSchema.withRender = function(config: FormFieldConfig): ZodSchemaWithRender<T> {
    const newSchema = this._def ? this._def.clone() : this;
    (newSchema as ZodSchemaWithRender<T>)._renderConfig = config;
    (newSchema as ZodSchemaWithRender<T>).withRender = extendedSchema.withRender;
    return newSchema as ZodSchemaWithRender<T>;
  };

  return extendedSchema;
}

/**
 * Checks if a schema has render configuration
 */
export function hasRenderConfig(schema: unknown): schema is ZodSchemaWithRender {
  return schema && typeof (schema as ZodSchemaWithRender<unknown>).withRender === 'function';
}

/**
 * Extracts render configuration from a schema
 */
export function getRenderConfig(schema: ZodType<unknown>): FormFieldConfig | undefined {
  if (hasRenderConfig(schema)) {
    return schema._renderConfig;
  }
  return undefined;
}

/**
 * Infers form field type from Zod schema type
 */
export function inferFieldTypeFromSchema(schema: ZodType<unknown>): string {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  
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
      return 'select';
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return 'select';
    case 'ZodDate':
      return 'text';
    case 'ZodObject':
      return 'object';
    default:
      return 'text';
  }
}

/**
 * Extracts options from enum or union schemas
 */
export function extractOptionsFromSchema(schema: ZodType<unknown>): Array<{ value: unknown; label: string }> | undefined {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  
  if (typeName === 'ZodEnum') {
    const values = (schema._def as Record<string, unknown>)?.values;
    if (Array.isArray(values)) {
      return values.map((value: string) => ({
        value,
        label: value,
      }));
    }
  }
  
  if (typeName === 'ZodNativeEnum') {
    const enumObject = (schema._def as Record<string, unknown>)?.values;
    if (enumObject) {
      return Object.entries(enumObject).map(([key, value]) => ({
        value,
        label: key,
      }));
    }
  }
  
  if (typeName === 'ZodUnion') {
    const options: Array<{ value: unknown; label: string }> = [];
    const unionOptions = (schema._def as Record<string, unknown>)?.options;
    
    if (Array.isArray(unionOptions)) {
      for (const option of unionOptions) {
        if ((option._def as Record<string, unknown>)?.typeName === 'ZodLiteral') {
          const value = (option._def as ZodDef)?.value;
          if (value !== undefined) {
            options.push({
              value,
              label: String(value),
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
 * Checks if a schema is optional
 */
export function isOptionalSchema(schema: ZodType<any>): boolean {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}

/**
 * Gets the inner schema from optional/default wrappers
 */
export function getInnerSchema(schema: ZodType<any>): ZodType<any> {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    const innerType = (schema._def as ZodDef)?.innerType;
    return innerType || schema;
  }
  return schema;
}

/**
 * Extracts validation constraints from a schema
 */
export function extractValidationConstraints(schema: ZodType<any>) {
  const innerSchema = getInnerSchema(schema);
  const typeName = (innerSchema._def as ZodDef)?.typeName;
  const constraints: Record<string, any> = {};
  
  if (typeName === 'ZodString') {
    const def = innerSchema._def as ZodDef;
    if (def.checks && Array.isArray(def.checks)) {
      for (const check of def.checks) {
        switch (check.kind) {
          case 'min':
            constraints.minLength = check.value;
            break;
          case 'max':
            constraints.maxLength = check.value;
            break;
          case 'email':
            constraints.type = 'email';
            break;
          case 'url':
            constraints.type = 'url';
            break;
          case 'regex':
            constraints.pattern = check.regex;
            break;
        }
      }
    }
  }
  
  if (typeName === 'ZodNumber') {
    const def = innerSchema._def as ZodDef;
    if (def.checks && Array.isArray(def.checks)) {
      for (const check of def.checks) {
        switch (check.kind) {
          case 'min':
            constraints.min = check.value;
            break;
          case 'max':
            constraints.max = check.value;
            break;
          case 'int':
            constraints.step = 1;
            break;
        }
      }
    }
  }
  
  return constraints;
}

/**
 * Gets default value from schema
 */
export function getDefaultValue(schema: ZodType<any>): any {
  const typeName = (schema._def as Record<string, unknown>)?.typeName;
  if (typeName === 'ZodDefault') {
    const defaultValue = (schema._def as ZodDef)?.defaultValue;
    if (typeof defaultValue === 'function') {
      return defaultValue();
    }
    return defaultValue;
  }
  
  const innerSchema = getInnerSchema(schema);
  const innerTypeName = (innerSchema._def as ZodDef)?.typeName;
  
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
    default:
      return undefined;
  }
}