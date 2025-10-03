import React from 'react';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { CAPABILITY_OPTIONS } from '../../../shared/schemas/hcs10';

interface CapabilitiesSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Multi-select component for agent capabilities
 */
export function CapabilitiesSelector({ value, onChange, disabled = false, error }: CapabilitiesSelectorProps) {
  const handleToggle = (capability: string) => {
    if (value.includes(capability)) {
      onChange(value.filter(c => c !== capability));
    } else {
      onChange([...value, capability]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CAPABILITY_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={`capability-${option.value}`}
              checked={value.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
              disabled={disabled}
            />
            <Label 
              htmlFor={`capability-${option.value}`} 
              className="text-sm font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
      
      {error && (
        <Typography variant="body1" className="text-sm text-destructive">
          {error}
        </Typography>
      )}
      
      <Typography variant="body1" className="text-xs text-muted-foreground">
        Select the capabilities that your agent provides
      </Typography>
    </div>
  );
}