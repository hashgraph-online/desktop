import { useEffect, useCallback } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';

export function useFormPersistence<T extends Record<string, unknown>>(
  key: string,
  watch: UseFormWatch<T>,
  setValue: UseFormSetValue<T>,
  dependencies: (keyof T & string)[] = []
) {
  const storageKey = `form_persistence_${key}`;

  useEffect(() => {
    const loadTimeout = setTimeout(() => {
      try {
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
          const parsedData = JSON.parse(savedData) as Partial<T>;
          
          (Object.entries(parsedData) as Array<[keyof T & string, T[keyof T]]>).forEach(([fieldName, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              setValue(fieldName as any, value as any, { 
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false
              });
            }
          });
        }
      } catch (error) {
      }
    }, 100);
    
    return () => clearTimeout(loadTimeout);
  }, [storageKey, setValue]);

  const saveToStorage = useCallback(() => {
    try {
      const currentData = dependencies.length > 0 
        ? dependencies.reduce((acc, key) => {
            (acc as any)[key] = watch(key as any);
            return acc;
          }, {} as Partial<T>)
        : (watch() as unknown as Partial<T>);

      const filteredData = (Object.entries(currentData) as Array<[string, unknown]>).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            (acc as any)[key] = value as any;
          } else if (typeof value === 'object' && value !== null) {
            const hasValues = Object.values(value).some(v => v !== undefined && v !== null && v !== '');
            if (hasValues) {
              (acc as any)[key] = value as any;
            }
          } else if (typeof value !== 'object') {
            (acc as any)[key] = value as any;
          }
        }
        return acc;
      }, {} as Record<string, unknown>);

      localStorage.setItem(storageKey, JSON.stringify(filteredData));
    } catch (error) {
    }
  }, [storageKey, watch, dependencies]);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
    }
  }, [storageKey]);

  return {
    saveToStorage,
    clearPersistedData
  };
}