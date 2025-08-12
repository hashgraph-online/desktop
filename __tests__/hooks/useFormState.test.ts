import { act, renderHook } from '@testing-library/react'
import { ChangeEvent } from 'react'
import { useFormState } from '../../src/renderer/hooks/useFormState'

interface TestFormData {
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
  age: number
}

describe('useFormState', () => {
  const initialValues: TestFormData = {
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    age: 0,
  }

  const validators = {
    email: (value: string) => {
      if (!value) return 'Email is required'
      if (!value.includes('@')) return 'Invalid email format'
      return null
    },
    password: (value: string) => {
      if (!value) return 'Password is required'
      if (value.length < 8) return 'Password must be at least 8 characters'
      return null
    },
    confirmPassword: (value: string) => {
      if (!value) return 'Confirm password is required'
      return null
    },
    acceptTerms: (value: boolean) => {
      if (!value) return 'You must accept the terms'
      return null
    },
    age: (value: number) => {
      if (value < 18) return 'You must be at least 18 years old'
      return null
    },
  }

  describe('initialization', () => {
    it('should initialize with provided initial values', () => {
      const { result } = renderHook(() => useFormState(initialValues))

      expect(result.current.values).toEqual(initialValues)
      expect(result.current.errors).toEqual({})
      expect(result.current.touched).toEqual({})
    })

    it('should initialize without validators', () => {
      const { result } = renderHook(() => useFormState(initialValues))

      expect(typeof result.current.setValue).toBe('function')
      expect(typeof result.current.handleChange).toBe('function')
      expect(typeof result.current.validate).toBe('function')
    })
  })

  describe('setValue', () => {
    it('should update field value', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'test@example.com')
      })

      expect(result.current.values.email).toBe('test@example.com')
    })

    it('should validate field on value change', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'invalid-email')
      })

      expect(result.current.errors.email).toBe('Invalid email format')

      act(() => {
        result.current.setValue('email', 'valid@example.com')
      })

      expect(result.current.errors.email).toBeUndefined()
    })

    it('should work without validators', () => {
      const { result } = renderHook(() => useFormState(initialValues))

      act(() => {
        result.current.setValue('email', 'test@example.com')
      })

      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.errors.email).toBeUndefined()
    })
  })

  describe('handleChange', () => {
    it('should handle text input changes', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      const mockEvent = {
        target: { type: 'text', value: 'test@example.com' },
      } as ChangeEvent<HTMLInputElement>

      act(() => {
        result.current.handleChange('email')(mockEvent)
      })

      expect(result.current.values.email).toBe('test@example.com')
    })

    it('should handle checkbox changes', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      const mockEvent = {
        target: { type: 'checkbox', checked: true },
      } as ChangeEvent<HTMLInputElement>

      act(() => {
        result.current.handleChange('acceptTerms')(mockEvent)
      })

      expect(result.current.values.acceptTerms).toBe(true)
    })

    it('should handle textarea changes', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      const mockEvent = {
        target: { type: 'textarea', value: 'long password value' },
      } as ChangeEvent<HTMLTextAreaElement>

      act(() => {
        result.current.handleChange('password')(mockEvent)
      })

      expect(result.current.values.password).toBe('long password value')
    })

    it('should handle select changes', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      const mockEvent = {
        target: { type: 'select-one', value: '25' },
      } as ChangeEvent<HTMLSelectElement>

      act(() => {
        result.current.handleChange('age')(mockEvent)
      })

      expect(result.current.values.age).toBe('25')
    })
  })

  describe('handleBlur', () => {
    it('should mark field as touched', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.handleBlur('email')()
      })

      expect(result.current.touched.email).toBe(true)
    })

    it('should validate field on blur', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'invalid-email')
        result.current.handleBlur('email')()
      })

      expect(result.current.touched.email).toBe(true)
      expect(result.current.errors.email).toBe('Invalid email format')
    })

    it('should clear error if field becomes valid', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'valid@example.com')
        result.current.handleBlur('email')()
      })

      expect(result.current.errors.email).toBeUndefined()
    })
  })

  describe('validate', () => {
    it('should validate all fields and return true if valid', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'valid@example.com')
        result.current.setValue('password', 'validpassword123')
        result.current.setValue('confirmPassword', 'validpassword123')
        result.current.setValue('acceptTerms', true)
        result.current.setValue('age', 25)
      })

      let isValid: boolean
      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid!).toBe(true)
      expect(Object.keys(result.current.errors)).toHaveLength(0)
    })

    it('should validate all fields and return false if invalid', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      let isValid: boolean
      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid!).toBe(false)
      expect(result.current.errors.email).toBe('Email is required')
      expect(result.current.errors.password).toBe('Password is required')
      expect(result.current.errors.confirmPassword).toBe('Confirm password is required')
      expect(result.current.errors.acceptTerms).toBe('You must accept the terms')
      expect(result.current.errors.age).toBe('You must be at least 18 years old')
    })

    it('should mark all fields as touched', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.validate()
      })

      expect(result.current.touched.email).toBe(true)
      expect(result.current.touched.password).toBe(true)
      expect(result.current.touched.confirmPassword).toBe(true)
      expect(result.current.touched.acceptTerms).toBe(true)
      expect(result.current.touched.age).toBe(true)
    })

    it('should return true when no validators provided', () => {
      const { result } = renderHook(() => useFormState(initialValues))

      let isValid: boolean
      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid!).toBe(true)
    })
  })

  describe('reset', () => {
    it('should reset form to initial values', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'test@example.com')
        result.current.setValue('password', 'password123')
        result.current.handleBlur('email')()
        result.current.validate()
      })

      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.touched.email).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.values).toEqual(initialValues)
      expect(result.current.errors).toEqual({})
      expect(result.current.touched).toEqual({})
    })
  })

  describe('getFieldError', () => {
    it('should return error only if field is touched', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'invalid-email')
      })

      expect(result.current.getFieldError('email')).toBeUndefined()

      act(() => {
        result.current.handleBlur('email')()
      })

      expect(result.current.getFieldError('email')).toBe('Invalid email format')
    })

    it('should return undefined for valid fields', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      act(() => {
        result.current.setValue('email', 'valid@example.com')
        result.current.handleBlur('email')()
      })

      expect(result.current.getFieldError('email')).toBeUndefined()
    })
  })

  describe('setValues', () => {
    it('should update multiple values at once', () => {
      const { result } = renderHook(() => useFormState(initialValues, validators))

      const newValues = {
        ...initialValues,
        email: 'test@example.com',
        password: 'newpassword123',
      }

      act(() => {
        result.current.setValues(newValues)
      })

      expect(result.current.values).toEqual(newValues)
    })
  })

  describe('complex validation scenarios', () => {
    it('should handle interdependent field validation', () => {
      const validatorsWithConfirm = {
        ...validators,
        confirmPassword: (value: string, formValues?: TestFormData) => {
          if (!value) return 'Confirm password is required'
          return null
        },
      }

      const { result } = renderHook(() => useFormState(initialValues, validatorsWithConfirm))

      act(() => {
        result.current.setValue('password', 'password123')
        result.current.setValue('confirmPassword', 'different')
        result.current.validate()
      })

      expect(result.current.errors.password).toBeUndefined()
      expect(result.current.errors.confirmPassword).toBeUndefined()
    })

    it('should handle dynamic validation rules', () => {
      const dynamicValidators = {
        age: (value: number) => {
          const numValue = Number(value)
          if (isNaN(numValue)) return 'Age must be a number'
          if (numValue < 0) return 'Age cannot be negative'
          if (numValue > 150) return 'Age seems unrealistic'
          if (numValue < 18) return 'You must be at least 18 years old'
          return null
        },
      }

      const { result } = renderHook(() => useFormState(initialValues, dynamicValidators))

      act(() => {
        result.current.setValue('age', -5)
      })
      expect(result.current.errors.age).toBe('Age cannot be negative')

      act(() => {
        result.current.setValue('age', 200)
      })
      expect(result.current.errors.age).toBe('Age seems unrealistic')

      act(() => {
        result.current.setValue('age', 25)
      })
      expect(result.current.errors.age).toBeUndefined()
    })
  })
})