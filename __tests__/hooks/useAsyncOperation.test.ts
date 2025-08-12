import { act, renderHook } from '@testing-library/react'
import { useAsyncOperation } from '../../src/renderer/hooks/useAsyncOperation'
import { delay } from '../utils/testHelpers'

describe('useAsyncOperation', () => {
  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useAsyncOperation())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.execute).toBe('function')
      expect(typeof result.current.reset).toBe('function')
      expect(typeof result.current.setError).toBe('function')
    })
  })

  describe('execute', () => {
    it('should execute operation successfully', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockResolvedValue('success')

      let operationResult: string | undefined
      await act(async () => {
        operationResult = await result.current.execute(mockOperation)
      })

      expect(mockOperation).toHaveBeenCalledTimes(1)
      expect(operationResult).toBe('success')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set loading state during operation', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockImplementation(() => delay(100).then(() => 'success'))

      const executePromise = act(async () => {
        return result.current.execute(mockOperation)
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isSubmitting).toBe(false)

      await executePromise
      expect(result.current.isLoading).toBe(false)
    })

    it('should use submitting state when useSubmittingState is true', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockImplementation(() => delay(100).then(() => 'success'))

      const executePromise = act(async () => {
        return result.current.execute(mockOperation, { useSubmittingState: true })
      })

      expect(result.current.isSubmitting).toBe(true)
      expect(result.current.isLoading).toBe(false)

      await executePromise
      expect(result.current.isSubmitting).toBe(false)
    })

    it('should handle operation errors', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockError = new Error('Operation failed')
      const mockOperation = jest.fn().mockRejectedValue(mockError)

      let operationResult: string | undefined
      await act(async () => {
        operationResult = await result.current.execute(mockOperation)
      })

      expect(operationResult).toBeUndefined()
      expect(result.current.error).toBe('Operation failed')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle non-Error exceptions', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockRejectedValue('String error')

      await act(async () => {
        await result.current.execute(mockOperation)
      })

      expect(result.current.error).toBe('An error occurred')
    })

    it('should call custom error handler', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockError = new Error('Custom error')
      const mockOperation = jest.fn().mockRejectedValue(mockError)
      const mockErrorHandler = jest.fn()

      await act(async () => {
        await result.current.execute(mockOperation, { onError: mockErrorHandler })
      })

      expect(mockErrorHandler).toHaveBeenCalledWith(mockError)
      expect(result.current.error).toBe('Custom error')
    })

    it('should clear previous error before execution', async () => {
      const { result } = renderHook(() => useAsyncOperation())

      act(() => {
        result.current.setError('Previous error')
      })

      expect(result.current.error).toBe('Previous error')

      const mockOperation = jest.fn().mockResolvedValue('success')
      await act(async () => {
        await result.current.execute(mockOperation)
      })

      expect(result.current.error).toBeNull()
    })

    it('should reset loading state even if operation throws', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'))

      await act(async () => {
        await result.current.execute(mockOperation)
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSubmitting).toBe(false)
    })

    it('should reset submitting state even if operation throws', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'))

      await act(async () => {
        await result.current.execute(mockOperation, { useSubmittingState: true })
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all states to initial values', () => {
      const { result } = renderHook(() => useAsyncOperation())

      act(() => {
        result.current.setError('Test error')
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error state', () => {
      const { result } = renderHook(() => useAsyncOperation())

      act(() => {
        result.current.setError('Custom error message')
      })

      expect(result.current.error).toBe('Custom error message')
    })

    it('should clear error when set to null', () => {
      const { result } = renderHook(() => useAsyncOperation())

      act(() => {
        result.current.setError('Error message')
      })

      act(() => {
        result.current.setError(null)
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent executions', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation1 = jest.fn().mockImplementation(() => delay(100).then(() => 'result1'))
      const mockOperation2 = jest.fn().mockImplementation(() => delay(50).then(() => 'result2'))

      const promises = await act(async () => {
        return Promise.all([
          result.current.execute(mockOperation1),
          result.current.execute(mockOperation2),
        ])
      })

      expect(promises[0]).toBe('result1')
      expect(promises[1]).toBe('result2')
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('type safety', () => {
    it('should maintain type safety for operation results', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const mockOperation = jest.fn().mockResolvedValue({ data: 'test', count: 42 })

      let operationResult: { data: string; count: number } | undefined
      await act(async () => {
        operationResult = await result.current.execute(mockOperation)
      })

      expect(operationResult).toEqual({ data: 'test', count: 42 })
    })
  })
})