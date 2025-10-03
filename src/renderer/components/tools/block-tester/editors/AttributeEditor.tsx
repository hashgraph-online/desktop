import React, { useState } from 'react';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { ScrollArea } from '../../../ui/scroll-area';
import { cn } from '../../../../lib/utils';
import { AttributeSchema, AttributeType } from '../../../../types/block-tester.types';

type AttributeValue = string | number | boolean | string[];

interface AttributeData {
  schema: AttributeSchema;
  value: AttributeValue;
}

interface AttributeEditorProps {
  attributes: Record<string, AttributeData>;
  onChange: (attributes: Record<string, AttributeData>) => void;
  className?: string;
}

interface AttributeInputProps {
  name: string;
  attributeData: AttributeData;
  onUpdate: (name: string, updates: Partial<{ schema: AttributeSchema; value: AttributeValue }>) => void;
}

const AttributeInput: React.FC<AttributeInputProps> = ({ name, attributeData, onUpdate }) => {
  const { schema, value } = attributeData;

  const updateValue = (newValue: AttributeValue) => onUpdate(name, { value: newValue });
  const inputClassName = "w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground";
  const inputPlaceholder = schema.placeholder || `Enter ${schema.label || name}`;

  switch (schema.type) {
    case 'string':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
          placeholder={inputPlaceholder}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
          placeholder={inputPlaceholder}
          rows={3}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : 0}
          min={schema.validation?.minimum}
          max={schema.validation?.maximum}
          onChange={(e) => updateValue(parseFloat(e.target.value) || 0)}
          className={inputClassName}
          placeholder={inputPlaceholder}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : false}
            onChange={(e) => updateValue(e.target.checked)}
            className="rounded border-input"
          />
          <span>Enable {schema.label || name}</span>
        </label>
      );

    case 'color': {
      const colorValue = typeof value === 'string' ? value : '#000000';
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorValue}
            onChange={(e) => updateValue(e.target.value)}
            className="w-12 h-10 rounded border border-input cursor-pointer"
          />
          <input
            type="text"
            value={colorValue}
            onChange={(e) => updateValue(e.target.value)}
            className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            placeholder="#000000"
          />
        </div>
      );
    }

    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
        >
          <option value="">Select an option</option>
          {(schema.enum || []).map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'url':
      return (
        <input
          type="url"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
          placeholder={inputPlaceholder}
        />
      );

    case 'email':
      return (
        <input
          type="email"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
          placeholder={inputPlaceholder}
        />
      );

    default:
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => updateValue(e.target.value)}
          className={inputClassName}
          placeholder={inputPlaceholder}
        />
      );
  }
};

interface SchemaEditorProps {
  name: string;
  schema: AttributeSchema;
  onUpdate: (name: string, updates: Partial<{ schema: AttributeSchema; value: AttributeValue }>) => void;
  onClose: () => void;
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({ name, schema, onUpdate, onClose }) => (
  <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
    <div className="flex items-center justify-between">
      <Typography variant="h4" className="font-medium" noMargin>
        Configure "{name}" Attribute
      </Typography>
      <Button
        variant="outline"
        size="sm"
        onClick={onClose}
      >
        Done
      </Button>
    </div>

    <div className="grid gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Display Label</label>
        <input
          type="text"
          value={schema.label || ''}
          onChange={(e) => onUpdate(name, {
            schema: { ...schema, label: e.target.value }
          })}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          placeholder="Human-readable label"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={schema.type}
          onChange={(e) => onUpdate(name, {
            schema: { ...schema, type: e.target.value as AttributeType }
          })}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
        >
          <option value="string">Text</option>
          <option value="textarea">Long Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="color">Color</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
          <option value="select">Select</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder</label>
        <input
          type="text"
          value={schema.placeholder || ''}
          onChange={(e) => onUpdate(name, {
            schema: { ...schema, placeholder: e.target.value }
          })}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          placeholder="Placeholder text"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={schema.description || ''}
          onChange={(e) => onUpdate(name, {
            schema: { ...schema, description: e.target.value }
          })}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          placeholder="Help text for this attribute"
          rows={2}
        />
      </div>

      {schema.type === 'select' && (
        <div>
          <label className="block text-sm font-medium mb-1">Options (one per line)</label>
          <textarea
            value={schema.enum?.join('\n') || ''}
            onChange={(e) => onUpdate(name, {
              schema: { ...schema, enum: e.target.value.split('\n').filter(option => option.trim()) }
            })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            placeholder="Option 1\nOption 2\nOption 3"
            rows={4}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`required-${name}`}
          checked={schema.required || false}
          onChange={(e) => onUpdate(name, {
            schema: { ...schema, required: e.target.checked }
          })}
          className="rounded border-input"
        />
        <label htmlFor={`required-${name}`} className="text-sm font-medium cursor-pointer">
          Required field
        </label>
      </div>
    </div>
  </div>
);

/**
 * Attribute editor component for managing block attribute schema and values
 * Provides dynamic form generation based on attribute types
 */
const AttributeEditor: React.FC<AttributeEditorProps> = ({
  attributes,
  onChange,
  className
}) => {
  const [editingAttribute, setEditingAttribute] = useState<string | null>(null);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [showValues, setShowValues] = useState(true);

  const createDefaultSchema = (type: AttributeType): AttributeSchema => ({
    type,
    label: '',
    default: type === 'boolean' ? false : type === 'number' ? 0 : '',
    placeholder: '',
    description: '',
    required: false,
  });

  const handleAddAttribute = () => {
    if (!newAttributeName.trim()) return;
    
    const schema = createDefaultSchema('string');
    const updatedAttributes = {
      ...attributes,
      [newAttributeName]: {
        schema: { ...schema, label: newAttributeName },
        value: (schema.default as AttributeValue) || ''
      }
    };
    
    onChange(updatedAttributes);
    setNewAttributeName('');
    setEditingAttribute(newAttributeName);
  };

  const handleRemoveAttribute = (name: string) => {
    const { [name]: _, ...remaining } = attributes;
    onChange(remaining);
    if (editingAttribute === name) {
      setEditingAttribute(null);
    }
  };

  const handleUpdateAttribute = (name: string, updates: Partial<{ schema: AttributeSchema; value: AttributeValue }>) => {
    const defaultSchema = createDefaultSchema('string');
    const current = attributes[name] || { schema: { ...defaultSchema, label: name }, value: (defaultSchema.default as AttributeValue) || '' };
    const updatedAttributes = {
      ...attributes,
      [name]: {
        ...current,
        ...updates
      }
    };
    onChange(updatedAttributes);
  };



  return (
    <div className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <Typography variant="h4" className="font-medium" noMargin>
          {Object.keys(attributes).length} Attributes
        </Typography>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowValues(!showValues)}
        >
          {showValues ? 'Hide Values' : 'Show Values'}
        </Button>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newAttributeName}
          onChange={(e) => setNewAttributeName(e.target.value)}
          placeholder="Attribute name (e.g., title, description)"
          className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
          onKeyPress={(e) => e.key === 'Enter' && handleAddAttribute()}
        />
        <Button 
          onClick={handleAddAttribute} 
          disabled={!newAttributeName.trim()}
          size="sm"
        >
          Add
        </Button>
      </div>

      {Object.keys(attributes).length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg">
            <Typography variant="h3" className="text-lg font-medium mb-2" noMargin>
              No Attributes Defined
            </Typography>
            <Typography variant="body1" className="text-muted-foreground mb-4" noMargin>
              Add attributes to make your block template dynamic and customizable
            </Typography>
            <Typography variant="body1" className="text-sm text-muted-foreground" noMargin>
              Common attributes: title, description, buttonText, imageUrl
            </Typography>
          </div>
        ) : (
          <div className="space-y-3">
              {Object.entries(attributes).map(([name, attributeData]) => {
                const { schema } = attributeData;
                const isEditing = editingAttribute === name;

                return (
                  <div key={name} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              {schema.label || name}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">
                              {schema.type}
                            </span>
                            {schema.required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                                required
                              </span>
                            )}
                          </div>
                          {schema.description && (
                            <Typography variant="body1" className="text-sm text-muted-foreground mt-1" noMargin>
                              {schema.description}
                            </Typography>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingAttribute(isEditing ? null : name)}
                        >
                          {isEditing ? 'Done' : 'Configure'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAttribute(name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {isEditing && (
                      <SchemaEditor
                        name={name}
                        schema={schema}
                        onUpdate={handleUpdateAttribute}
                        onClose={() => setEditingAttribute(null)}
                      />
                    )}

                    {showValues && (
                      <div className="mt-3">
                        <Typography variant="body1" className="text-sm font-medium mb-2" noMargin>
                          Current Value
                        </Typography>
                        <AttributeInput
                          name={name}
                          attributeData={attributeData}
                          onUpdate={handleUpdateAttribute}
                        />
                      </div>
                    )}

                    <div className="mt-3 px-3 py-2 bg-muted/30 rounded border text-xs">
                      <Typography variant="body1" className="font-mono text-muted-foreground" noMargin>
                        Template: <code className="px-1 py-0.5 bg-background rounded">{'{{' + name + '}}'}</code>
                      </Typography>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
    </div>
  );
};

export default AttributeEditor;