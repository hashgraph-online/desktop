import { cn } from '../../src/renderer/lib/utils'

describe('utils', () => {
  describe('cn (className merge utility)', () => {
    it('should merge simple class names', () => {
      const result = cn('text-red-500', 'bg-blue-500')
      expect(result).toContain('text-red-500')
      expect(result).toContain('bg-blue-500')
    })

    it('should handle conditional classes with objects', () => {
      const result = cn('base-class', {
        'active-class': true,
        'inactive-class': false,
      })
      
      expect(result).toContain('base-class')
      expect(result).toContain('active-class')
      expect(result).not.toContain('inactive-class')
    })

    it('should handle array of classes', () => {
      const result = cn(['text-sm', 'font-bold'], 'text-red-500')
      
      expect(result).toContain('text-sm')
      expect(result).toContain('font-bold')
      expect(result).toContain('text-red-500')
    })

    it('should merge conflicting Tailwind classes correctly', () => {
      const result = cn('text-red-500', 'text-blue-500')
      
      expect(result).not.toContain('text-red-500')
      expect(result).toContain('text-blue-500')
    })

    it('should handle undefined and null values', () => {
      const result = cn('base-class', undefined, null, 'other-class')
      
      expect(result).toContain('base-class')
      expect(result).toContain('other-class')
      expect(result).not.toContain('undefined')
      expect(result).not.toContain('null')
    })

    it('should handle empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle complex conditional logic', () => {
      const isActive = true
      const isDisabled = false
      const variant = 'primary'
      
      const result = cn(
        'base-button',
        {
          'active': isActive,
          'disabled': isDisabled,
          'primary': variant === 'primary',
          'secondary': variant === 'secondary',
        },
        isActive && 'hover:bg-blue-600',
        !isDisabled && 'cursor-pointer'
      )
      
      expect(result).toContain('base-button')
      expect(result).toContain('active')
      expect(result).toContain('primary')
      expect(result).toContain('hover:bg-blue-600')
      expect(result).toContain('cursor-pointer')
      expect(result).not.toContain('disabled')
      expect(result).not.toContain('secondary')
    })

    it('should merge size classes correctly', () => {
      const result = cn('w-4', 'w-6', 'h-4', 'h-8')
      
      expect(result).not.toContain('w-4')
      expect(result).toContain('w-6')
      expect(result).not.toContain('h-4')
      expect(result).toContain('h-8')
    })

    it('should merge padding classes correctly', () => {
      const result = cn('p-2', 'px-4', 'py-6')
      
      expect(result).not.toContain('p-2')
      expect(result).toContain('px-4')
      expect(result).toContain('py-6')
    })

    it('should handle responsive classes', () => {
      const result = cn(
        'w-full',
        'md:w-1/2',
        'lg:w-1/3',
        'text-sm',
        'md:text-base',
        'lg:text-lg'
      )
      
      expect(result).toContain('w-full')
      expect(result).toContain('md:w-1/2')
      expect(result).toContain('lg:w-1/3')
      expect(result).toContain('text-sm')
      expect(result).toContain('md:text-base')
      expect(result).toContain('lg:text-lg')
    })

    it('should handle variant-based styling patterns', () => {
      const variant = 'destructive'
      const size = 'lg'
      
      const result = cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
          'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        }
      )
      
      expect(result).toContain('inline-flex')
      expect(result).toContain('bg-red-600')
      expect(result).toContain('hover:bg-red-700')
      expect(result).toContain('h-12')
      expect(result).toContain('px-6')
      expect(result).toContain('text-lg')
      expect(result).not.toContain('bg-blue-600')
      expect(result).not.toContain('bg-gray-200')
    })

    it('should handle state-based classes', () => {
      const isLoading = true
      const hasError = false
      const isSuccess = false
      
      const result = cn(
        'button',
        isLoading && 'opacity-50 cursor-not-allowed',
        hasError && 'border-red-500 text-red-500',
        isSuccess && 'border-green-500 text-green-500',
        !isLoading && !hasError && !isSuccess && 'hover:bg-gray-50'
      )
      
      expect(result).toContain('button')
      expect(result).toContain('opacity-50')
      expect(result).toContain('cursor-not-allowed')
      expect(result).not.toContain('border-red-500')
      expect(result).not.toContain('border-green-500')
      expect(result).not.toContain('hover:bg-gray-50')
    })

    it('should handle nested arrays and objects', () => {
      const result = cn(
        'base',
        ['array-class-1', 'array-class-2'],
        {
          'object-class-1': true,
          'object-class-2': false,
        },
        [
          'nested-array-class',
          {
            'nested-object-class': true,
          }
        ]
      )
      
      expect(result).toContain('base')
      expect(result).toContain('array-class-1')
      expect(result).toContain('array-class-2')
      expect(result).toContain('object-class-1')
      expect(result).toContain('nested-array-class')
      expect(result).toContain('nested-object-class')
      expect(result).not.toContain('object-class-2')
    })
  })
})