import { z } from 'zod';
import { SchemaParser } from '../../../src/renderer/components/forms/zod-render/SchemaParser';
import type {
  FormFieldType,
  FieldMetadata,
  ValidationError,
  SelectOption,
  EnhancedRenderConfig,
  ExtractedRenderConfig
} from '../../../src/renderer/components/forms/zod-render';

describe('SchemaParser', () => {
  describe('Basic Schema Parsing', () => {
    test('should parse string schema', () => {
      const schema = z.string();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('value');
      expect(result.fields.value.type).toBe('text');
      expect(result.fields.value.required).toBe(true);
    });

    test('should parse string with min/max length', () => {
      const schema = z.string().min(3).max(100);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.validation.minLength).toBe(3);
      expect(result.fields.value.validation.maxLength).toBe(100);
    });

    test('should parse number schema', () => {
      const schema = z.number();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('number');
      expect(result.fields.value.required).toBe(true);
    });

    test('should parse number with min/max', () => {
      const schema = z.number().min(0).max(100);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.validation.minimum).toBe(0);
      expect(result.fields.value.validation.maximum).toBe(100);
    });

    test('should parse boolean schema', () => {
      const schema = z.boolean();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('boolean');
      expect(result.fields.value.required).toBe(true);
    });

    test('should parse date schema', () => {
      const schema = z.date();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('datetime');
      expect(result.fields.value.required).toBe(true);
    });

    test('should parse optional schema', () => {
      const schema = z.string().optional();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.required).toBe(false);
      expect(result.fields.value.optional).toBe(true);
    });

    test('should parse nullable schema', () => {
      const schema = z.string().nullable();
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.required).toBe(false);
    });

    test('should parse default value schema', () => {
      const schema = z.string().default('default value');
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.default).toBe('default value');
      expect(result.fields.value.required).toBe(false);
    });
  });

  describe('Object Schema Parsing', () => {
    test('should parse simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean()
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('name');
      expect(result.fields).toHaveProperty('age');
      expect(result.fields).toHaveProperty('isActive');

      expect(result.fields.name.type).toBe('text');
      expect(result.fields.name.required).toBe(true);
      expect(result.fields.age.type).toBe('number');
      expect(result.fields.age.required).toBe(true);
      expect(result.fields.isActive.type).toBe('boolean');
      expect(result.fields.isActive.required).toBe(true);

      expect(result.order).toEqual(['name', 'age', 'isActive']);
    });

    test('should parse object with optional fields', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional()
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.name.required).toBe(true);
      expect(result.fields.description.required).toBe(false);
      expect(result.fields.tags.required).toBe(false);
    });

    test('should parse nested object schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean()
        })
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('user');
      expect(result.fields).toHaveProperty('settings');
      expect(result.fields.user.type).toBe('object');
      expect(result.fields.settings.type).toBe('object');
    });
  });

  describe('Enum and Union Parsing', () => {
    test('should parse enum schema', () => {
      const schema = z.enum(['option1', 'option2', 'option3']);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('select');
      expect(result.fields.value.options).toEqual([
        { value: 'option1', label: 'option1' },
        { value: 'option2', label: 'option2' },
        { value: 'option3', label: 'option3' }
      ]);
    });

    test('should parse literal union schema', () => {
      const schema = z.union([z.literal('option1'), z.literal('option2')]);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('select');
      expect(result.fields.value.options).toEqual([
        { value: 'option1', label: 'option1' },
        { value: 'option2', label: 'option2' }
      ]);
    });

    test('should parse discriminated union schema', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), content: z.string() }),
        z.object({ type: z.literal('number'), value: z.number() })
      ]);

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('value');
      expect(result.fields.value.type).toBeDefined();
    });
  });

  describe('Array Schema Parsing', () => {
    test('should parse array schema', () => {
      const schema = z.array(z.string());
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('array');
      expect(result.fields.value.required).toBe(true);
    });

    test('should parse array with min/max length', () => {
      const schema = z.array(z.string()).min(1).max(10);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('array');
      expect(result.fields.value.validation.minItems).toBe(1);
      expect(result.fields.value.validation.maxItems).toBe(10);
    });

    test('should parse tuple schema', () => {
      const schema = z.tuple([z.string(), z.number()]);
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.value.type).toBe('array');
    });
  });

  describe('Validation', () => {
    test('should validate data successfully', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      const parser = new SchemaParser(schema);
      const data = { name: 'John', age: 25 };
      const errors = parser.validate(data);

      expect(errors).toEqual([]);
    });

    test('should return validation errors', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      const parser = new SchemaParser(schema);
      const data = { name: '', age: -5 };
      const errors = parser.validate(data);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        message: expect.stringContaining('too_small'),
        path: expect.arrayContaining(['name'])
      });
    });
  });

  describe('Default Values', () => {
    test('should get default values from schema', () => {
      const schema = z.object({
        name: z.string().default('Anonymous'),
        age: z.number().default(18),
        isActive: z.boolean()
      });

      const parser = new SchemaParser(schema);
      const defaults = parser.getDefaultValues();

      expect(defaults).toEqual({
        name: 'Anonymous',
        age: 18
      });
    });

    test('should handle schemas without defaults', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const parser = new SchemaParser(schema);
      const defaults = parser.getDefaultValues();

      expect(defaults).toEqual({});
    });
  });

  describe('Complex Object Schemas', () => {
    test('should handle deeply nested objects', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            settings: z.object({
              theme: z.enum(['light', 'dark']),
              notifications: z.boolean()
            })
          })
        })
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('user');
      expect(result.fields.user.type).toBe('object');
    });

    test('should handle arrays with complex objects', () => {
      const schema = z.object({
        users: z.array(z.object({
          name: z.string(),
          email: z.string().email(),
          roles: z.array(z.string())
        }))
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('users');
      expect(result.fields.users.type).toBe('array');
    });

    test('should handle discriminated unions', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), content: z.string() }),
        z.object({ type: z.literal('number'), value: z.number() }),
        z.object({ type: z.literal('boolean'), flag: z.boolean() })
      ]);

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('value');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty object schema', () => {
      const schema = z.object({});
      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toEqual({});
      expect(result.order).toEqual([]);
    });

    test('should handle schema with all optional fields', () => {
      const schema = z.object({
        name: z.string().optional(),
        age: z.number().optional(),
        email: z.string().email().optional()
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.name.required).toBe(false);
      expect(result.fields.age.required).toBe(false);
      expect(result.fields.email.required).toBe(false);
    });

    test('should handle schema with mixed required and optional fields', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email(),
        age: z.number().optional()
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.id.required).toBe(true);
      expect(result.fields.name.required).toBe(false);
      expect(result.fields.email.required).toBe(true);
      expect(result.fields.age.required).toBe(false);
    });

    test('should handle schema with regex patterns', () => {
      const schema = z.object({
        username: z.string().regex(/^[a-zA-Z0-9_]+$/),
        email: z.string().email(),
        phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/)
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields.username.validation.pattern).toEqual(/^[a-zA-Z0-9_]+$/);
      expect(result.fields.email.validation.pattern).toBeDefined();
      expect(result.fields.phone.validation.pattern).toEqual(/^\+?[\d\s\-\(\)]+$/);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete form schema workflow', () => {
      const schema = z.object({
        personalInfo: z.object({
          firstName: z.string().min(1, 'First name is required'),
          lastName: z.string().min(1, 'Last name is required'),
          email: z.string().email('Invalid email format'),
          phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional()
        }),
        preferences: z.object({
          newsletter: z.boolean().default(false),
          theme: z.enum(['light', 'dark', 'auto']).default('light'),
          language: z.string().default('en')
        }),
        account: z.object({
          username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
          password: z.string().min(8, 'Password must be at least 8 characters'),
          confirmPassword: z.string()
        }).refine(data => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword']
        })
      });

      const parser = new SchemaParser(schema);
      const result = parser.parse();

      expect(result.fields).toHaveProperty('personalInfo');
      expect(result.fields).toHaveProperty('preferences');
      expect(result.fields).toHaveProperty('account');

      expect(result.fields.personalInfo.type).toBe('object');
      expect(result.fields.preferences.type).toBe('object');
      expect(result.fields.account.type).toBe('object');

      expect(result.order).toEqual(['personalInfo', 'preferences', 'account']);
    });

    test('should validate complete form data', () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(18).max(120),
        terms: z.boolean().refine(val => val === true, 'You must accept the terms')
      });

      const parser = new SchemaParser(schema);

      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        terms: true
      };

      expect(parser.validate(validData)).toEqual([]);

      const invalidData = {
        name: '',
        email: 'invalid-email',
        age: 15,
        terms: false
      };

      const errors = parser.validate(invalidData);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should extract default values for complex schemas', () => {
      const schema = z.object({
        profile: z.object({
          name: z.string().default('Anonymous'),
          age: z.number().default(18),
          settings: z.object({
            theme: z.enum(['light', 'dark']).default('light'),
            notifications: z.boolean().default(true)
          })
        }),
        preferences: z.object({
          language: z.string().default('en'),
          timezone: z.string()
        })
      });

      const parser = new SchemaParser(schema);
      const defaults = parser.getDefaultValues();

      expect(defaults).toEqual({
        'profile.name': 'Anonymous',
        'profile.age': 18,
        'profile.settings.theme': 'light',
        'profile.settings.notifications': true,
        'preferences.language': 'en'
      });
    });
  });
});
