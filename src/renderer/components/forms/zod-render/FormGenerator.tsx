import React, { useState, useCallback, useMemo } from 'react';
import { ZodType, ZodError, ZodIssue } from 'zod';
import { Logger } from '@hashgraphonline/standards-sdk';
import { motion, AnimatePresence } from 'framer-motion';
import { SchemaParser } from './SchemaParser';
import { FormField } from './FormField';
import { Button } from '../../ui/Button';
import Typography from '../../ui/Typography';
import { Alert, AlertDescription } from '../../ui/alert';
import { FiSend, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import type { 
  FormState, 
  FormActions, 
  UseFormReturn, 
  ValidationError,
  FormGenerationOptions,
  FormGroup
} from './types';

interface FormGeneratorProps<TSchema = Record<string, unknown>> {
  schema: ZodType<TSchema>;
  onSubmit?: (values: TSchema) => void | Promise<void>;
  onValueChange?: (path: string[], value: unknown) => void;
  options?: FormGenerationOptions;
  initialValues?: Partial<TSchema>;
  className?: string;
  title?: string;
  description?: string;
}

/**
 * Main form generation engine that transforms Zod schemas into React forms
 * with progressive disclosure support
 */
export function FormGenerator<TSchema = Record<string, unknown>>({
  schema,
  onSubmit,
  onValueChange,
  options = {},
  initialValues = {},
  className,
  title,
  description
}: FormGeneratorProps<TSchema>) {
  const logger = useMemo(() => new Logger({ module: 'FormGenerator' }), []);
  const schemaParser = useMemo(() => new SchemaParser(schema), [schema]);
  const parsedSchema = useMemo(() => schemaParser.parse(), [schemaParser]);

  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...schemaParser.getDefaultValues(),
    ...initialValues
  }));
  
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [_isValidating, _setIsValidating] = useState(false);
  const [isSubmitting, _setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const defaultExpanded = new Set<string>();
    if (options.progressiveDisclosure?.defaultExpanded) {
      options.progressiveDisclosure.defaultExpanded.forEach((group: string) => 
        defaultExpanded.add(group)
      );
    }
    if (options.progressiveDisclosure?.groups) {
      options.progressiveDisclosure.groups
        .filter((group: FormGroup) => group.priority === 'essential' || group.defaultExpanded)
        .forEach((group: FormGroup) => defaultExpanded.add(group.name));
    }
    return defaultExpanded;
  });

  const isDirty = useMemo(() => {
    const defaultValues = schemaParser.getDefaultValues();
    return JSON.stringify(values) !== JSON.stringify({ ...defaultValues, ...initialValues });
  }, [values, schemaParser, initialValues]);

  const setValue = useCallback((path: string[], value: unknown) => {
    const pathKey = path.join('.');
    setValues(prev => {
      const newValues = { ...prev };
      let current = newValues;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!(path[i] in current)) {
          current[path[i]] = {};
        }
        current = current[path[i]] as Record<string, unknown>;
      }
      
      current[path[path.length - 1]] = value;
      return newValues;
    });
    
    setErrors(prev => prev.filter(error => error.path.join('.') !== pathKey));
    
    setTouchedFields(prev => new Set([...prev, pathKey]));
    
    onValueChange?.(path, value);
  }, [onValueChange]);

  const _setFieldValues = useCallback((newValues: Partial<TSchema>) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  const _setError = useCallback((path: string[], message: string) => {
    const pathKey = path.join('.');
    setErrors(prev => [
      ...prev.filter(error => error.path.join('.') !== pathKey),
      { path, message, code: 'custom' }
    ]);
  }, []);

  const _clearError = useCallback((path: string[]) => {
    const pathKey = path.join('.');
    setErrors(prev => prev.filter(error => error.path.join('.') !== pathKey));
  }, []);

  const _clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const reset = useCallback(() => {
    const defaultValues = schemaParser.getDefaultValues();
    setValues({ ...defaultValues, ...initialValues });
    setErrors([]);
    setTouchedFields(new Set());
  }, [schemaParser, initialValues]);

  const validate = useCallback(async (): Promise<boolean> => {
    _setIsValidating(true);
    try {
      schema.parse(values);
      setErrors([]);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.issues.map((err: ZodIssue) => ({
          path: err.path.map(String),
          message: err.message,
          code: err.code
        }));
        setErrors(validationErrors);
      }
      return false;
    } finally {
      _setIsValidating(false);
    }
  }, [schema, values]);

  const submit = useCallback(async () => {
    if (!onSubmit) return;
    
    _setIsSubmitting(true);
    try {
      const isValid = await validate();
      if (isValid) {
        await onSubmit(values as TSchema);
      }
    } catch (error) {
      logger.error('Form submission error:', error);
    } finally {
      _setIsSubmitting(false);
    }
  }, [onSubmit, validate, values, logger]);

  const touchField = useCallback((path: string[]) => {
    const pathKey = path.join('.');
    setTouchedFields(prev => new Set([...prev, pathKey]));
  }, []);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  }, []);

  const getFieldsByGroup = useCallback(() => {
    const groups: Record<string, typeof parsedSchema.fields> = {};
    const ungrouped: typeof parsedSchema.fields = {};

    Object.entries(parsedSchema.fields).forEach(([fieldName, fieldConfig]) => {
      const groupName = fieldConfig.progressive?.group || 'ungrouped';
      
      if (groupName === 'ungrouped') {
        ungrouped[fieldName] = fieldConfig;
      } else {
        if (!groups[groupName]) {
          groups[groupName] = {};
        }
        groups[groupName][fieldName] = fieldConfig;
      }
    });

    return { groups, ungrouped };
  }, [parsedSchema]);

  // Note: formState and formActions are available for external access if needed
  // const _formState: FormState<TSchema> = {
  //   values: values as TSchema,
  //   errors,
  //   _isValidating,
  //   isSubmitting,
  //   isDirty,
  //   touchedFields
  // };

  // const _formActions: FormActions<TSchema> = {
  //   setValue,
  //   setValues: setFieldValues,
  //   setError,
  //   clearError,
  //   clearErrors,
  //   reset,
  //   submit,
  //   validate,
  //   touchField
  // };

  const { groups, ungrouped } = getFieldsByGroup();
  const progressiveConfig = options.progressiveDisclosure;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        'rounded-lg shadow-sm p-6 space-y-6',
        className
      )}
    >
      {/* Form Header */}
      {(title || description) && (
        <div className="space-y-2">
          {title && (
            <Typography variant="h5" className="font-semibold">
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" color="muted">
              {description}
            </Typography>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <FiAlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>
                  <strong>{error.path.join('.')}</strong>: {error.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Ungrouped Fields (Essential/Common priority) */}
        {Object.keys(ungrouped).length > 0 && (
          <div className="space-y-4">
            {Object.entries(ungrouped).map(([fieldName, fieldConfig]) => (
              <FormField
                key={fieldName}
                name={fieldName}
                config={fieldConfig}
                value={values[fieldName]}
                onChange={(value) => setValue([fieldName], value)}
                error={errors.find(err => err.path[0] === fieldName)?.message}
                disabled={isSubmitting}
                touched={touchedFields.has(fieldName)}
                onTouch={() => touchField([fieldName])}
              />
            ))}
          </div>
        )}

        {/* Progressive Disclosure Groups */}
        {progressiveConfig?.enabled !== false && Object.entries(groups).map(([groupName, groupFields]) => {
          const groupConfig = progressiveConfig?.groups?.find((g: FormGroup) => g.name === groupName);
          const isExpanded = expandedGroups.has(groupName);
          const fieldCount = Object.keys(groupFields).length;
          const priority = groupConfig?.priority || 'common';
          
          if (priority === 'essential') {
            return (
              <div key={groupName} className="space-y-4">
                {groupConfig?.description && (
                  <Typography variant="body2" color="muted">
                    {groupConfig.description}
                  </Typography>
                )}
                {Object.entries(groupFields).map(([fieldName, fieldConfig]) => (
                  <FormField
                    key={fieldName}
                    name={fieldName}
                    config={fieldConfig}
                    value={values[fieldName]}
                    onChange={(value) => setValue([fieldName], value)}
                    error={errors.find(err => err.path[0] === fieldName)?.message}
                    disabled={isSubmitting}
                    touched={touchedFields.has(fieldName)}
                    onTouch={() => touchField([fieldName])}
                  />
                ))}
              </div>
            );
          }

          return (
            <div key={groupName} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              {/* Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className={cn(
                  'w-full flex items-center justify-between p-4',
                  'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  isExpanded && 'border-b border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex items-center gap-3">
                  <Typography variant="h6" className="font-medium">
                    {groupName}
                  </Typography>
                  {!isExpanded && progressiveConfig?.showFieldCount && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FiRefreshCw className="h-4 w-4 text-gray-400" />
                </motion.div>
              </button>

              {/* Group Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-4">
                      {groupConfig?.description && (
                        <Typography variant="body2" color="muted">
                          {groupConfig.description}
                        </Typography>
                      )}
                      {Object.entries(groupFields).map(([fieldName, fieldConfig]) => (
                        <FormField
                          key={fieldName}
                          name={fieldName}
                          config={fieldConfig}
                          value={values[fieldName]}
                          onChange={(value) => setValue([fieldName], value)}
                          error={errors.find(err => err.path[0] === fieldName)?.message}
                          disabled={isSubmitting}
                          touched={touchedFields.has(fieldName)}
                          onTouch={() => touchField([fieldName])}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Form Actions */}
      {(options.showSubmitButton !== false || options.showResetButton) && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {options.showResetButton && (
            <Button
              type="button"
              variant="ghost"
              onClick={reset}
              disabled={isSubmitting || !isDirty}
            >
              {options.resetButtonText || 'Reset'}
            </Button>
          )}
          
          {options.showSubmitButton !== false && onSubmit && (
            <Button
              type="button"
              onClick={submit}
              disabled={isSubmitting || errors.length > 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FiSend className="w-4 h-4" />
                  {options.submitButtonText || 'Submit'}
                </div>
              )}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Hook for using form state and actions separately
 */
export function useFormGenerator<TSchema = Record<string, unknown>>(
  schema: ZodType<TSchema>,
  initialValues: Partial<TSchema> = {}
): UseFormReturn<TSchema> {
  const schemaParser = useMemo(() => new SchemaParser(schema), [schema]);
  
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...schemaParser.getDefaultValues(),
    ...initialValues
  }));
  
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [_isValidating, _setIsValidating] = useState(false);
  const [isSubmitting, _setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const isDirty = useMemo(() => {
    const defaultValues = schemaParser.getDefaultValues();
    return JSON.stringify(values) !== JSON.stringify({ ...defaultValues, ...initialValues });
  }, [values, schemaParser, initialValues]);

  const setValue = useCallback((path: string[], value: unknown) => {
    const pathKey = path.join('.');
    setValues(prev => {
      const newValues = { ...prev };
      let current = newValues;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!(path[i] in current)) {
          current[path[i]] = {};
        }
        current = current[path[i]] as Record<string, unknown>;
      }
      
      current[path[path.length - 1]] = value;
      return newValues;
    });
    
    setErrors(prev => prev.filter(error => error.path.join('.') !== pathKey));
    setTouchedFields(prev => new Set([...prev, pathKey]));
  }, []);


  const formState: FormState<TSchema> = {
    values: values as TSchema,
    errors,
    isValidating: _isValidating,
    isSubmitting,
    isDirty,
    touchedFields
  };

  const formActions: FormActions<TSchema> = {
    setValue,
    setValues: (newValues) => setValues(prev => ({ ...prev, ...newValues })),
    setError: (path, message) => setErrors(prev => [...prev, { path, message, code: 'custom' }]),
    clearError: (path) => setErrors(prev => prev.filter(e => e.path.join('.') !== path.join('.'))),
    clearErrors: () => setErrors([]),
    reset: () => {
      const defaultValues = schemaParser.getDefaultValues();
      setValues({ ...defaultValues, ...initialValues });
      setErrors([]);
      setTouchedFields(new Set());
    },
    submit: async () => {
      try {
        schema.parse(values);
        setErrors([]);
      } catch (error) {
        if (error instanceof ZodError) {
          setErrors(error.issues.map((err: ZodIssue) => ({
            path: err.path.map(String),
            message: err.message,
            code: err.code
          })));
        }
      }
    },
    validate: async () => {
      try {
        schema.parse(values);
        setErrors([]);
        return true;
      } catch {
        return false;
      }
    },
    touchField: (path) => setTouchedFields(prev => new Set([...prev, path.join('.')]))
  };

  return { state: formState, actions: formActions };
}