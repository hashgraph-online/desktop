import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import Typography from '../../ui/Typography';
import { cn } from '../../../lib/utils';
import { FiInfo, FiAlertCircle } from 'react-icons/fi';
import type { EnhancedRenderConfig } from './types';

interface FormFieldProps {
  name: string;
  config: EnhancedRenderConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  touched?: boolean;
  onTouch?: () => void;
  className?: string;
}

/**
 * Renders individual form fields based on configuration
 */
export function FormField({
  name,
  config,
  value,
  onChange,
  error,
  disabled = false,
  touched = false,
  onTouch,
  className
}: FormFieldProps) {
  const {
    fieldType,
    ui = {},
    constraints = {},
    options = [],
    validation = {}
  } = config;

  const {
    label,
    placeholder,
    helpText,
    required,
    readonly,
    width = 'full',
    className: uiClassName
  } = ui;

  const handleChange = useCallback((newValue: unknown) => {
    onChange(newValue);
    onTouch?.();
  }, [onChange, onTouch]);

/**
 * Individual field input component
 */
const FieldInput: React.FC<{
  fieldType: string;
  value: unknown;
  onChange: (value: unknown) => void;
  constraints: any;
  config: EnhancedRenderConfig;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  onTouch?: () => void;
  uiClassName?: string;
  label?: string;
  options?: any[];
}> = ({ 
  fieldType, 
  value, 
  onChange, 
  constraints, 
  config, 
  error, 
  disabled, 
  readonly, 
  placeholder,
  onTouch,
  uiClassName,
  label,
  options = []
}) => {
  const baseProps = {
    disabled: disabled || readonly,
    className: cn(
      error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
      uiClassName
    )
  };

  switch (fieldType) {
    case 'text': {
      const inputType = constraints.type === 'email' ? 'email' : 
                        constraints.type === 'url' ? 'url' : 'text';
      
      return (
        <Input
          {...baseProps}
          type={inputType}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={constraints.minLength as number}
          maxLength={constraints.maxLength as number}
          pattern={constraints.pattern as string}
          onBlur={onTouch}
        />
      );
    }

    case 'number':
      return (
        <Input
          {...baseProps}
          type="number"
          value={(value as number) || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={placeholder}
          min={constraints.min as number}
          max={constraints.max as number}
          step={constraints.step as number}
          onBlur={onTouch}
        />
      );

    case 'textarea':
      return (
        <Textarea
          {...baseProps}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={(config.props?.rows as number) || 3}
          minLength={constraints.minLength as number}
          maxLength={constraints.maxLength as number}
          onBlur={onTouch}
        />
      );

    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled || readonly}
            onBlur={onTouch}
          />
          {label && (
            <Typography
              variant="body2"
              className={cn(
                'select-none cursor-pointer',
                disabled && 'opacity-50'
              )}
              onClick={() => !disabled && !readonly && onChange(!(value as boolean))}
            >
              {label}
            </Typography>
          )}
        </div>
      );

    case 'select':
      return (
        <Select
          value={(value as string) || ''}
          onValueChange={onChange}
          disabled={disabled || readonly}
          onOpenChange={(open) => !open && onTouch?.()}
        >
          <SelectTrigger className={baseProps.className}>
            <SelectValue placeholder={placeholder || 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={String(option.value)}
                value={String(option.value)}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'currency': {
      const symbol = (config.props?.symbol as string) || '$';
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
            {symbol}
          </span>
          <Input
            {...baseProps}
            type="number"
            value={(value as number) || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            className={cn('pl-8', baseProps.className)}
            placeholder={placeholder}
            min={constraints.min as number}
            max={constraints.max as number}
            step="0.01"
            onBlur={onTouch}
          />
        </div>
      );
    }

    case 'percentage':
      return (
        <div className="relative">
          <Input
            {...baseProps}
            type="number"
            value={(value as number) || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            min={constraints.min as number || 0}
            max={constraints.max as number || 100}
            step="0.1"
            onBlur={onTouch}
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
            %
          </span>
        </div>
      );

    case 'array':
      return (
        <ArrayField
          value={(value as unknown[]) || []}
          onChange={onChange}
          config={config}
          disabled={disabled || readonly}
          onTouch={onTouch}
        />
      );

    case 'object':
      return (
        <ObjectField
          value={(value as Record<string, unknown>) || {}}
          onChange={onChange}
          config={config}
          disabled={disabled || readonly}
          onTouch={onTouch}
        />
      );

    default:
      return (
        <Input
          {...baseProps}
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onBlur={onTouch}
        />
      );
  }
};

  const widthClass = {
    full: 'w-full',
    half: 'w-1/2',
    third: 'w-1/3',
    quarter: 'w-1/4'
  }[width];

  const priorityColor = {
    essential: 'text-red-600 dark:text-red-400',
    common: 'text-blue-600 dark:text-blue-400',
    advanced: 'text-orange-600 dark:text-orange-400',
    expert: 'text-purple-600 dark:text-purple-400'
  }[config.progressive?.priority || 'common'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(widthClass, className)}
    >
      <div className="space-y-1">
        {/* Field Label */}
        {fieldType !== 'checkbox' && label && (
          <div className="flex items-center gap-1">
            <Typography
              variant="body2"
              className="text-gray-700 dark:text-gray-300 font-medium"
            >
              {label}
            </Typography>
            {required && (
              <span className="text-red-500 text-sm">*</span>
            )}
            {config.progressive?.priority && config.progressive.priority !== 'common' && (
              <span
                className={cn('text-xs px-1.5 py-0.5 rounded-full', priorityColor)}
                title={`${config.progressive.priority} field`}
              >
                {config.progressive.priority}
              </span>
            )}
          </div>
        )}

        {/* Help Text */}
        {helpText && (
          <div className="flex items-start gap-1">
            <FiInfo className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
            <Typography variant="caption" color="muted" className="text-xs">
              {helpText}
            </Typography>
          </div>
        )}

        {/* Field Input */}
        <div className="relative">
          <FieldInput
            fieldType={fieldType}
            value={value}
            onChange={handleChange}
            constraints={constraints}
            config={config}
            error={error}
            disabled={disabled}
            readonly={readonly}
            placeholder={placeholder}
            onTouch={onTouch}
            uiClassName={uiClassName}
            label={label}
            options={options}
          />
        </div>

        {/* Error Message */}
        {error && touched && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-start gap-1"
          >
            <FiAlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
            <Typography variant="caption" className="text-red-500 text-xs">
              {error}
            </Typography>
          </motion.div>
        )}

        {/* Validation Status */}
        {!error && touched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-1 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden"
          >
            <div className="h-full bg-green-500 w-full" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Array field component for handling array inputs
 */
function ArrayField({
  value,
  onChange,
  config,
  disabled,
  onTouch
}: {
  value: unknown[];
  onChange: (value: unknown[]) => void;
  config: EnhancedRenderConfig;
  disabled?: boolean;
  onTouch?: () => void;
}) {
  const itemLabel = (config.props?.itemLabel as string) || 'Item';
  
  const addItem = useCallback(() => {
    onChange([...value, '']);
    onTouch?.();
  }, [value, onChange, onTouch]);

  const removeItem = useCallback((index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
    onTouch?.();
  }, [value, onChange, onTouch]);

  const updateItem = useCallback((index: number, itemValue: unknown) => {
    const newValue = [...value];
    newValue[index] = itemValue;
    onChange(newValue);
    onTouch?.();
  }, [value, onChange, onTouch]);

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={String(item)}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={`${itemLabel} ${index + 1}`}
            disabled={disabled}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="text-red-500 hover:text-red-700 p-1"
          >
            ×
          </button>
        </div>
      ))}
      
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className={cn(
          'w-full border-2 border-dashed border-gray-300 dark:border-gray-600',
          'rounded-md p-2 text-sm text-gray-500 dark:text-gray-400',
          'hover:border-gray-400 dark:hover:border-gray-500 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        + Add {itemLabel}
      </button>
    </div>
  );
}

/**
 * Object field component for handling nested objects
 */
function ObjectField({
  value,
  onChange,
  config,
  disabled,
  onTouch
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  config: EnhancedRenderConfig;
  disabled?: boolean;
  onTouch?: () => void;
}) {
  return (
    <div className="space-y-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
      <Typography variant="caption" color="muted">
        Object fields require nested schema parsing (not fully implemented in this MVP)
      </Typography>
      <Input
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
            onTouch?.();
          } catch {
          }
        }}
        placeholder="Enter JSON object"
        disabled={disabled}
      />
    </div>
  );
}