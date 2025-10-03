import { useState, useCallback } from 'react';

/**
 * Custom hook for managing async operation states.
 * Provides loading, error, and submission states with helper methods.
 * Implements DRY principle by centralizing common async state patterns.
 * 
 * @returns Object containing state values and helper methods for async operations
 */
export function useAsyncOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Executes an async operation with automatic state management.
   * Handles loading states and error catching.
   * 
   * @param operation - The async function to execute
   * @param options - Configuration options for the operation
   * @returns Promise resolving to the operation result or undefined on error
   */
  const execute = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: {
      /** Use submitting state instead of loading state */
      useSubmittingState?: boolean;
      /** Custom error handler function */
      onError?: (error: Error) => void;
    }
  ): Promise<T | undefined> => {
    const { useSubmittingState = false, onError } = options || {};
    
    setError(null);
    
    if (useSubmittingState) {
      setIsSubmitting(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      if (onError && err instanceof Error) {
        onError(err);
      }
      
      return undefined;
    } finally {
      if (useSubmittingState) {
        setIsSubmitting(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Resets all states to their initial values.
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSubmitting(false);
    setError(null);
  }, []);

  return {
    isLoading,
    isSubmitting,
    error,
    execute,
    reset,
    setError,
  };
}

/**
 * Type definition for the return value of useAsyncOperation hook.
 */
export type UseAsyncOperationReturn = ReturnType<typeof useAsyncOperation>;