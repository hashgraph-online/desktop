import { SchemaParser } from '../src/renderer/components/forms/zod-render/SchemaParser';
import { z } from 'zod';

describe('SchemaParser Type Safety', () => {
  describe('Zod Schema Introspection Type Safety', () => {
    it('should access schema._def properties with proper typing instead of any cast', () => {
      const stringSchema = z.string();
      const numberSchema = z.number();
      const objectSchema = z.object({ test: z.string() });

      const stringDef = stringSchema._def;
      const numberDef = numberSchema._def;
      const objectDef = objectSchema._def;

      expect(stringDef.typeName).toBe('ZodString');
      expect(numberDef.typeName).toBe('ZodNumber');
      expect(objectDef.typeName).toBe('ZodObject');
    });

    it('should handle ZodObject shape access with proper typing instead of any cast', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
        isActive: z.boolean(),
        tags: z.array(z.string())
      });

      const shape = testSchema.shape;
      expect(typeof shape).toBe('object');
      expect('name' in shape).toBe(true);
      expect('age' in shape).toBe(true);
      expect('email' in shape).toBe(true);
      expect('isActive' in shape).toBe(true);
      expect('tags' in shape).toBe(true);

      const fieldCount = Object.keys(shape).length;
      expect(fieldCount).toBe(5);
    });

    it('should handle ZodEnum values access with proper typing instead of any cast', () => {
      const enumSchema = z.enum(['red', 'green', 'blue']);
      
      const enumDef = enumSchema._def;
      expect(enumDef.typeName).toBe('ZodEnum');
      expect(Array.isArray(enumDef.values)).toBe(true);
      expect(enumDef.values).toEqual(['red', 'green', 'blue']);
    });

    it('should handle ZodUnion options access with proper typing instead of any cast', () => {
      const unionSchema = z.union([
        z.literal('small'),
        z.literal('medium'),
        z.literal('large')
      ]);

      const unionDef = unionSchema._def;
      expect(unionDef.typeName).toBe('ZodUnion');
      expect(Array.isArray(unionDef.options)).toBe(true);
      expect(unionDef.options).toHaveLength(3);
    });

    it('should handle ZodOptional and ZodDefault inner type access with proper typing', () => {
      const optionalSchema = z.string().optional();
      const defaultSchema = z.number().default(42);

      const optionalDef = optionalSchema._def;
      const defaultDef = defaultSchema._def;

      expect(optionalDef.typeName).toBe('ZodOptional');
      expect(defaultDef.typeName).toBe('ZodDefault');
      
      expect(optionalDef.innerType).toBeDefined();
      expect(optionalDef.innerType._def.typeName).toBe('ZodString');
      
      expect(defaultDef.innerType).toBeDefined();
      expect(defaultDef.innerType._def.typeName).toBe('ZodNumber');
    });
  });

  describe('Type Guards for Schema Validation', () => {
    it('should use proper type guards instead of any casting for schema validation', () => {
      function isZodObject(schema: z.ZodType): schema is z.ZodObject<z.ZodRawShape> {
        return schema._def.typeName === 'ZodObject';
      }

      function isZodString(schema: z.ZodType): schema is z.ZodString {
        return schema._def.typeName === 'ZodString';
      }

      function isZodEnum(schema: z.ZodType): schema is z.ZodEnum<[string, ...string[]]> {
        return schema._def.typeName === 'ZodEnum';
      }

      function isZodUnion(schema: z.ZodType): schema is z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]> {
        return schema._def.typeName === 'ZodUnion';
      }

      const stringSchema = z.string();
      const objectSchema = z.object({ test: z.string() });
      const enumSchema = z.enum(['a', 'b', 'c']);
      const unionSchema = z.union([z.literal('x'), z.literal('y')]);

      expect(isZodString(stringSchema)).toBe(true);
      expect(isZodString(objectSchema)).toBe(false);

      expect(isZodObject(objectSchema)).toBe(true);
      expect(isZodObject(stringSchema)).toBe(false);

      expect(isZodEnum(enumSchema)).toBe(true);
      expect(isZodEnum(stringSchema)).toBe(false);

      expect(isZodUnion(unionSchema)).toBe(true);
      expect(isZodUnion(stringSchema)).toBe(false);

      if (isZodObject(objectSchema)) {
        const shape = objectSchema.shape;
        expect('test' in shape).toBe(true);
      }
    });

    it('should handle ZodString validation checks with proper typing', () => {
      const emailSchema = z.string().email();
      const minLengthSchema = z.string().min(5);
      const maxLengthSchema = z.string().max(100);
      const regexSchema = z.string().regex(/^[A-Z]+$/);

      const emailDef = emailSchema._def;
      expect(Array.isArray(emailDef.checks)).toBe(true);
      
      const minDef = minLengthSchema._def;
      expect(Array.isArray(minDef.checks)).toBe(true);
      
      const maxDef = maxLengthSchema._def;
      expect(Array.isArray(maxDef.checks)).toBe(true);
      
      const regexDef = regexSchema._def;
      expect(Array.isArray(regexDef.checks)).toBe(true);

      const emailCheck = emailDef.checks.find(c => c.kind === 'email');
      expect(emailCheck).toBeDefined();
      
      const minCheck = minDef.checks.find(c => c.kind === 'min');
      expect(minCheck).toBeDefined();
      expect((minCheck as { value: number }).value).toBe(5);
    });

    it('should handle ZodNumber validation checks with proper typing', () => {
      const minSchema = z.number().min(0);
      const maxSchema = z.number().max(100);
      const intSchema = z.number().int();
      const multipleSchema = z.number().multipleOf(5);

      const minDef = minSchema._def;
      const maxDef = maxSchema._def;
      const intDef = intSchema._def;
      const multipleDef = multipleSchema._def;

      expect(Array.isArray(minDef.checks)).toBe(true);
      expect(Array.isArray(maxDef.checks)).toBe(true);
      expect(Array.isArray(intDef.checks)).toBe(true);
      expect(Array.isArray(multipleDef.checks)).toBe(true);

      const minCheck = minDef.checks.find(c => c.kind === 'min');
      expect(minCheck).toBeDefined();
      expect((minCheck as { value: number }).value).toBe(0);

      const maxCheck = maxDef.checks.find(c => c.kind === 'max');
      expect(maxCheck).toBeDefined();
      expect((maxCheck as { value: number }).value).toBe(100);
    });
  });

  describe('SchemaParser Type Safety Integration', () => {
    it('should parse complex schemas without any type casting', () => {
      const complexSchema = z.object({
        personalInfo: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().min(18).max(100)
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
          tags: z.array(z.string())
        }),
        metadata: z.record(z.unknown()).optional()
      });

      const parser = new SchemaParser(complexSchema);
      const parsed = parser.parse();

      expect(typeof parsed).toBe('object');
      expect('fields' in parsed).toBe(true);
      expect('groups' in parsed).toBe(true);
      expect('order' in parsed).toBe(true);
      expect('metadata' in parsed).toBe(true);

      const fields = parsed.fields;
      expect(typeof fields).toBe('object');
      
      expect('personalInfo' in fields).toBe(true);
      expect('preferences' in fields).toBe(true);
      expect('metadata' in fields).toBe(true);
    });

    it('should generate default values without type casting', () => {
      const schemaWithDefaults = z.object({
        name: z.string().default('John Doe'),
        age: z.number().default(25),
        isActive: z.boolean().default(true),
        tags: z.array(z.string()).default(['user']),
        config: z.record(z.unknown()).default({})
      });

      const parser = new SchemaParser(schemaWithDefaults);
      const defaultValues = parser.getDefaultValues();

      expect(defaultValues.name).toBe('John Doe');
      expect(defaultValues.age).toBe(25);
      expect(defaultValues.isActive).toBe(true);
      expect(Array.isArray(defaultValues.tags)).toBe(true);
      expect((defaultValues.tags as string[]).includes('user')).toBe(true);
      expect(typeof defaultValues.config).toBe('object');
    });

    it('should validate input without type casting', () => {
      const validationSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string()
      }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword']
      });

      const parser = new SchemaParser(validationSchema);

      const validData = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      const validResult = parser.validate(validData);
      expect(Array.isArray(validResult)).toBe(true);
      expect(validResult).toHaveLength(0);

      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        confirmPassword: '456' // Doesn't match
      };

      const invalidResult = parser.validate(invalidData);
      expect(Array.isArray(invalidResult)).toBe(true);
      expect(invalidResult.length).toBeGreaterThan(0);

      for (const error of invalidResult) {
        expect('path' in error).toBe(true);
        expect('message' in error).toBe(true);
        expect('code' in error).toBe(true);
        expect(Array.isArray(error.path)).toBe(true);
        expect(typeof error.message).toBe('string');
        expect(typeof error.code).toBe('string');
      }
    });
  });

  describe('Schema Definition Access Type Safety', () => {
    it('should access render config without type casting', () => {
      const schemaWithRenderConfig = z.string();
      (schemaWithRenderConfig as { _renderConfig: { fieldType: string; ui: { label: string } } })._renderConfig = {
        fieldType: 'textarea',
        ui: { label: 'Custom Label' }
      };

      const hasRenderConfig = '_renderConfig' in schemaWithRenderConfig;
      expect(hasRenderConfig).toBe(true);

      if (hasRenderConfig) {
        const renderConfig = (schemaWithRenderConfig as { _renderConfig: { fieldType: string; ui: { label: string } } })._renderConfig;
        expect(renderConfig.fieldType).toBe('textarea');
        expect(renderConfig.ui.label).toBe('Custom Label');
      }
    });

    it('should access schema description without type casting', () => {
      const schemaWithDescription = z.string().describe('This is a test field');
      
      expect('description' in schemaWithDescription).toBe(true);
      expect(schemaWithDescription.description).toBe('This is a test field');
    });
  });
});