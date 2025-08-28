import { z } from 'zod';
import { SchemaParser } from '../src/renderer/components/forms/zod-render/SchemaParser';

describe('SchemaParser Type Safety', () => {
  describe('Zod schema introspection with type safety', () => {
    it('should safely extract render config from schema', () => {
      const schema = z.string();
      const parser = new SchemaParser(schema);
      
      const result = parser.parse();
      expect(result.fields.value.fieldType).toBe('text');
    });

    it('should safely infer field types from Zod schemas', () => {
      const stringSchema = z.string();
      const numberSchema = z.number();
      const booleanSchema = z.boolean();
      const enumSchema = z.enum(['option1', 'option2']);
      
      const stringParser = new SchemaParser(stringSchema);
      const numberParser = new SchemaParser(numberSchema);
      const booleanParser = new SchemaParser(booleanSchema);
      const enumParser = new SchemaParser(enumSchema);
      
      expect(stringParser.parse().fields.value.fieldType).toBe('text');
      expect(numberParser.parse().fields.value.fieldType).toBe('number');
      expect(booleanParser.parse().fields.value.fieldType).toBe('checkbox');
      expect(enumParser.parse().fields.value.fieldType).toBe('select');
    });

    it('should safely extract options from enum schemas', () => {
      const enumSchema = z.enum(['red', 'green', 'blue']);
      const parser = new SchemaParser(enumSchema);
      
      const result = parser.parse();
      expect(result.fields.value.options).toHaveLength(3);
      expect(result.fields.value.options?.[0]).toEqual({
        value: 'red',
        label: 'Red'
      });
    });

    it('should safely detect optional schemas', () => {
      const requiredSchema = z.object({ name: z.string() });
      const optionalSchema = z.object({ name: z.string().optional() });
      
      const requiredParser = new SchemaParser(requiredSchema);
      const optionalParser = new SchemaParser(optionalSchema);
      
      const requiredResult = requiredParser.parse();
      const optionalResult = optionalParser.parse();
      
      expect(requiredResult.metadata.name.required).toBe(true);
      expect(optionalResult.metadata.name.required).toBe(false);
    });

    it('should safely extract constraints from string schemas', () => {
      const constrainedSchema = z.string().min(5).max(20).email();
      const parser = new SchemaParser(constrainedSchema);
      
      const result = parser.parse();
      expect(result.metadata.value.constraints.minLength).toBe(5);
      expect(result.metadata.value.constraints.maxLength).toBe(20);
      expect(result.metadata.value.constraints.type).toBe('email');
    });

    it('should safely extract constraints from number schemas', () => {
      const constrainedSchema = z.number().min(0).max(100).int();
      const parser = new SchemaParser(constrainedSchema);
      
      const result = parser.parse();
      expect(result.metadata.value.constraints.min).toBe(0);
      expect(result.metadata.value.constraints.max).toBe(100);
      expect(result.metadata.value.constraints.step).toBe(1);
    });

    it('should safely get default values from schemas', () => {
      const schemaWithDefault = z.object({
        name: z.string().default('John'),
        age: z.number().default(25),
        active: z.boolean().default(true)
      });
      const parser = new SchemaParser(schemaWithDefault);
      
      const defaults = parser.getDefaultValues();
      expect(defaults).toEqual({
        name: 'John',
        age: 25,
        active: true
      });
    });

    it('should safely validate values against schema', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18)
      });
      const parser = new SchemaParser(schema);
      
      const validValues = { email: 'test@example.com', age: 25 };
      const invalidValues = { email: 'invalid-email', age: 15 };
      
      expect(parser.validate(validValues)).toHaveLength(0);
      expect(parser.validate(invalidValues).length).toBeGreaterThan(0);
    });

    it('should safely handle union schemas', () => {
      const unionSchema = z.union([
        z.literal('option1'),
        z.literal('option2'),
        z.literal('option3')
      ]);
      const parser = new SchemaParser(unionSchema);
      
      const result = parser.parse();
      expect(result.fields.value.fieldType).toBe('select');
      expect(result.fields.value.options).toHaveLength(3);
    });

    it('should safely handle nested object schemas', () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean()
        })
      });
      const parser = new SchemaParser(nestedSchema);
      
      const result = parser.parse();
      expect(Object.keys(result.fields)).toContain('user');
      expect(Object.keys(result.fields)).toContain('settings');
    });
  });

  describe('Error handling with type safety', () => {
    it('should safely handle unknown schema types', () => {
      const unknownSchema = z.custom<string>(() => true);
      const parser = new SchemaParser(unknownSchema);
      
      const result = parser.parse();
      expect(result.fields.value.fieldType).toBe('text');
    });

    it('should safely handle validation errors', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional()
      });
      const parser = new SchemaParser(schema);
      
      const errors = parser.validate({ optional: 'value' }); // missing required field
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['required'],
            message: expect.any(String),
            code: expect.any(String)
          })
        ])
      );
    });
  });
});