import { useState, useCallback, ChangeEvent } from 'react';

/**
 * Custom hook for managing form state with validation.
 * Provides centralized form state management to reduce code duplication.
 * 
 * @param initialValues - Initial form field values
 * @param validators - Optional validation functions for each field
 * @returns Object containing form state, handlers, and validation methods
 */
export function useFormState<T extends Record<string, any>>(
  initialValues: T,
  validators?: Partial<Record<keyof T, (value: any) => string | null>>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  /**
   * Updates a single form field value.
   * 
   * @param field - The field name to update
   * @param value - The new value for the field
   */
  const setValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    if (validators && validators[field]) {
      const error = validators[field]!(value);
      setErrors(prev => ({
        ...prev,
        [field]: error || undefined
      }));
    }
  }, [validators]);

  /**
   * Handles input change events for form fields.
   * 
   * @param field - The field name to update
   * @returns Event handler function for the input
   */
  const handleChange = useCallback((field: keyof T) => {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : e.target.value;
      setValue(field, value as T[keyof T]);
    };
  }, [setValue]);

  /**
   * Marks a field as touched (for validation display).
   * 
   * @param field - The field name to mark as touched
   */
  const handleBlur = useCallback((field: keyof T) => {
    return () => {
      setTouched(prev => ({ ...prev, [field]: true }));
      
      if (validators && validators[field]) {
        const error = validators[field]!(values[field]);
        setErrors(prev => ({
          ...prev,
          [field]: error || undefined
        }));
      }
    };
  }, [validators, values]);

  /**
   * Validates all form fields.
   * 
   * @returns True if all fields are valid, false otherwise
   */
  const validate = useCallback((): boolean => {
    if (!validators) return true;
    
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;
    
    Object.keys(validators).forEach((field) => {
      const validator = validators[field as keyof T];
      if (validator) {
        const error = validator(values[field as keyof T]);
        if (error) {
          newErrors[field as keyof T] = error;
          isValid = false;
        }
      }
    });
    
    setErrors(newErrors);
    setTouched(Object.keys(values).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as Partial<Record<keyof T, boolean>>));
    
    return isValid;
  }, [validators, values]);

  /**
   * Resets the form to initial values and clears errors.
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  /**
   * Gets the error message for a field if it has been touched.
   * 
   * @param field - The field name to get the error for
   * @returns The error message or undefined
   */
  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return touched[field] ? errors[field] : undefined;
  }, [errors, touched]);

  return {
    values,
    errors,
    touched,
    setValue,
    handleChange,
    handleBlur,
    validate,
    reset,
    getFieldError,
    setValues,
  };
}

/**
 * Type definition for the return value of useFormState hook.
 */
export type UseFormStateReturn<T extends Record<string, any>> = ReturnType<typeof useFormState<T>>;