import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { FormGenerator, useFormGenerator } from '../FormGenerator';
import { SchemaParser } from '../SchemaParser';
import '@testing-library/jest-dom';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('FormGenerator', () => {
  describe('Basic form generation', () => {
    it('should render a simple text field', () => {
      const schema = z.object({
        name: z.string()
      });

      render(<FormGenerator schema={schema} title="Test Form" />);

      expect(screen.getByText('Test Form')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    it('should render multiple field types', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean(),
        role: z.enum(['admin', 'user', 'guest'])
      });

      render(<FormGenerator schema={schema} />);

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Age')).toBeInTheDocument();
      expect(screen.getByLabelText('Is Active')).toBeInTheDocument();
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
        age: z.number().default(25)
      });

      render(<FormGenerator schema={schema} />);

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
      expect(screen.getByLabelText('Age')).toBeInTheDocument();
      
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Progressive disclosure', () => {
    it('should support progressive disclosure with groups', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        advancedOption: z.string().optional(),
        expertSetting: z.number().optional()
      });

      const options = {
        progressiveDisclosure: {
          enabled: true,
          groups: [
            { name: 'Basic Info', priority: 'essential' as const, defaultExpanded: true },
            { name: 'Advanced', priority: 'advanced' as const, collapsible: true },
            { name: 'Expert', priority: 'expert' as const, collapsible: true }
          ],
          defaultExpanded: ['Basic Info'],
          showFieldCount: true
        }
      };

      render(<FormGenerator schema={schema} options={options} />);

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('should expand and collapse groups', async () => {
      const schema = z.object({
        name: z.string(),
        advancedOption: z.string().optional()
      });

      const options = {
        progressiveDisclosure: {
          enabled: true,
          groups: [
            { name: 'Advanced', priority: 'advanced' as const, collapsible: true }
          ],
          showFieldCount: true
        }
      };

      render(<FormGenerator schema={schema} options={options} />);

      const advancedToggle = screen.getByText('Advanced');
      fireEvent.click(advancedToggle);

      expect(screen.getByText(/field/)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should validate required fields', async () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email')
      });

      const onSubmit = jest.fn();
      render(<FormGenerator schema={schema} onSubmit={onSubmit} />);

      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit with valid data', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const onSubmit = jest.fn();
      render(<FormGenerator schema={schema} onSubmit={onSubmit} />);

      const nameInput = screen.getByLabelText('Name');
      const ageInput = screen.getByLabelText('Age');
      
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(ageInput, { target: { value: '30' } });

      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          age: 30
        });
      });
    });
  });

  describe('Value changes', () => {
    it('should call onValueChange when field values change', () => {
      const schema = z.object({
        name: z.string()
      });

      const onValueChange = jest.fn();
      render(<FormGenerator schema={schema} onValueChange={onValueChange} />);

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'John' } });

      expect(onValueChange).toHaveBeenCalledWith(['name'], 'John');
    });

    it('should update form state when values change', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      render(<FormGenerator schema={schema} />);

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'John' } });

      expect(nameInput).toHaveValue('John');
    });
  });

  describe('Initial values', () => {
    it('should use provided initial values', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const initialValues = { name: 'Initial Name', age: 25 };
      render(<FormGenerator schema={schema} initialValues={initialValues} />);

      expect(screen.getByDisplayValue('Initial Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    });

    it('should use schema defaults when no initial values provided', () => {
      const schema = z.object({
        name: z.string().default('Default Name'),
        age: z.number().default(30)
      });

      render(<FormGenerator schema={schema} />);

      expect(screen.getByDisplayValue('Default Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });
  });

  describe('Form actions', () => {
    it('should reset form to initial values', () => {
      const schema = z.object({
        name: z.string().default('Default')
      });

      render(<FormGenerator schema={schema} options={{ showResetButton: true }} />);

      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'Changed' } });
      
      expect(nameInput).toHaveValue('Changed');

      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      expect(nameInput).toHaveValue('Default');
    });
  });
});

describe('SchemaParser', () => {
  it('should parse simple object schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean()
    });

    const parser = new SchemaParser(schema);
    const parsed = parser.parse();

    expect(parsed.fields).toHaveProperty('name');
    expect(parsed.fields).toHaveProperty('age');
    expect(parsed.fields).toHaveProperty('isActive');
    
    expect(parsed.fields.name.fieldType).toBe('text');
    expect(parsed.fields.age.fieldType).toBe('number');
    expect(parsed.fields.isActive.fieldType).toBe('checkbox');
  });

  it('should extract field metadata correctly', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18).max(120),
      role: z.enum(['admin', 'user'])
    });

    const parser = new SchemaParser(schema);
    const parsed = parser.parse();

    expect(parsed.metadata.email.constraints).toHaveProperty('type', 'email');
    expect(parsed.metadata.age.constraints).toHaveProperty('min', 18);
    expect(parsed.metadata.age.constraints).toHaveProperty('max', 120);
    expect(parsed.metadata.role.options).toHaveLength(2);
  });

  it('should generate default values', () => {
    const schema = z.object({
      name: z.string().default('John'),
      age: z.number().default(25),
      isActive: z.boolean().default(true)
    });

    const parser = new SchemaParser(schema);
    const defaults = parser.getDefaultValues();

    expect(defaults).toEqual({
      name: 'John',
      age: 25,
      isActive: true
    });
  });

  it('should validate values against schema', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(18)
    });

    const parser = new SchemaParser(schema);
    
    const validValues = { name: 'John', age: 25 };
    const validErrors = parser.validate(validValues);
    expect(validErrors).toHaveLength(0);

    const invalidValues = { name: '', age: 15 };
    const invalidErrors = parser.validate(invalidValues);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});

describe('useFormGenerator hook', () => {
  it('should provide form state and actions', () => {
    const TestComponent = () => {
      const schema = z.object({ name: z.string() });
      const { state, actions } = useFormGenerator(schema);

      return (
        <div>
          <span data-testid="isDirty">{state.isDirty.toString()}</span>
          <button onClick={() => actions.setValue(['name'], 'test')}>
            Set Name
          </button>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('isDirty')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('Set Name'));
    expect(screen.getByTestId('isDirty')).toHaveTextContent('true');
  });
});