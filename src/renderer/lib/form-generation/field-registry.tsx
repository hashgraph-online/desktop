import React, { ComponentType } from 'react';
import { ComponentRegistry, FieldComponentProps, FormFieldType } from './types';

export const TextFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  placeholder, 
  className, 
  ...props 
}) => {
  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return (
    <input
      type="text"
      value={stringValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
      aria-invalid={!!error}
      {...props}
    />
  );
};

export const NumberFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  placeholder, 
  min, 
  max, 
  step, 
  className, 
  ...props 
}) => {
  const getNumberValue = () => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || '';
    return '';
  };
  const numberValue = getNumberValue();
  return (
    <input
      type="number"
      value={numberValue}
      onChange={(e) => {
        const numValue = e.target.value === '' ? undefined : Number(e.target.value);
        onChange(numValue);
      }}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={className}
      aria-invalid={!!error}
      {...props}
    />
  );
};

export const SelectFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  options = [], 
  multiple = false,
  className, 
  ...props 
}) => {
  if (multiple) {
    return (
      <select
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(e) => {
          const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
          onChange(selectedValues as any);
        }}
        disabled={disabled}
        required={required}
        className={className}
        aria-invalid={!!error}
        {...props}
      >
        {options.map((option, index) => (
          <option key={index} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const selectValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return (
    <select
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={className}
      aria-invalid={!!error}
      {...props}
    >
      <option value="" disabled>Select an option...</option>
      {options.map((option, index) => (
        <option key={index} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export const CheckboxFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  className, 
  ...props 
}) => {
  return (
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      required={required}
      className={className}
      aria-invalid={!!error}
      {...props}
    />
  );
};

export const TextareaFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  placeholder, 
  rows, 
  className, 
  ...props 
}) => {
  const textValue = typeof value === 'string' ? value : '';
  return (
    <textarea
      value={textValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      rows={rows}
      className={className}
      aria-invalid={!!error}
      {...props}
    />
  );
};

export const FileFieldComponent: ComponentType<FieldComponentProps> = ({ 
  value, 
  onChange, 
  error, 
  disabled, 
  required, 
  accept, 
  multiple = false,
  className, 
  ...props 
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      onChange(undefined);
      return;
    }

    const processFile = (file: File) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            data: reader.result as string,
            type: file.type,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      });
    };

    if (multiple) {
      Promise.all(Array.from(files).map(processFile))
        .then((results) => onChange(results as any));
    } else {
      processFile(files[0])
        .then((result) => onChange(result as any));
    }
  };

  return (
    <input
      type="file"
      onChange={handleFileChange}
      disabled={disabled}
      required={required}
      accept={accept}
      multiple={multiple}
      className={className}
      aria-invalid={!!error}
      {...props}
    />
  );
};

/**
 * Default component registry mapping field types to components
 */
export const defaultComponentRegistry: ComponentRegistry = {
  text: TextFieldComponent,
  number: NumberFieldComponent,
  select: SelectFieldComponent,
  checkbox: CheckboxFieldComponent,
  textarea: TextareaFieldComponent,
  file: FileFieldComponent,
};

/**
 * Component registry class for managing field type to component mappings
 */
export class FieldRegistry {
  private registry: ComponentRegistry;

  constructor(initialRegistry?: Partial<ComponentRegistry>) {
    this.registry = {
      ...defaultComponentRegistry,
      ...initialRegistry,
    };
  }

  /**
   * Register a component for a field type
   */
  register(fieldType: FormFieldType, component: ComponentType<FieldComponentProps>): void {
    this.registry[fieldType] = component;
  }

  /**
   * Get component for a field type
   */
  get(fieldType: FormFieldType): ComponentType<FieldComponentProps> | undefined {
    return this.registry[fieldType];
  }

  /**
   * Check if a field type is registered
   */
  has(fieldType: FormFieldType): boolean {
    return fieldType in this.registry;
  }

  /**
   * Get all registered field types
   */
  getFieldTypes(): FormFieldType[] {
    return Object.keys(this.registry) as FormFieldType[];
  }

  /**
   * Create a copy of the registry
   */
  clone(): FieldRegistry {
    return new FieldRegistry(this.registry);
  }

  /**
   * Reset to default registry
   */
  reset(): void {
    this.registry = { ...defaultComponentRegistry };
  }

  /**
   * Get the entire registry
   */
  getAll(): ComponentRegistry {
    return { ...this.registry };
  }
}

/**
 * Default field registry instance
 */
export const defaultFieldRegistry = new FieldRegistry();