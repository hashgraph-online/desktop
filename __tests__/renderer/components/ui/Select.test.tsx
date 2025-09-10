import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('lucide-react', () => ({
  CheckIcon: () => <div data-testid='check-icon' />,
  ChevronDownIcon: () => <div data-testid='chevron-down-icon' />,
  ChevronUpIcon: () => <div data-testid='chevron-up-icon' />,
}));

jest.mock('@radix-ui/react-select', () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid='radix-select-root' {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, className, ...props }: any) => (
    <button data-testid='radix-select-trigger' className={className} {...props}>
      {children}
    </button>
  ),
  Content: ({ children, ...props }: any) => (
    <div data-testid='radix-select-content' {...props}>
      {children}
    </div>
  ),
  Viewport: ({ children, ...props }: any) => (
    <div data-testid='radix-select-viewport' {...props}>
      {children}
    </div>
  ),
  Item: ({ children, ...props }: any) => (
    <div data-testid='radix-select-item' {...props}>
      {children}
    </div>
  ),
  ItemText: ({ children, ...props }: any) => (
    <span data-testid='radix-select-item-text' {...props}>
      {children}
    </span>
  ),
  ItemIndicator: ({ children, ...props }: any) => (
    <span data-testid='radix-select-item-indicator' {...props}>
      {children}
    </span>
  ),
  Group: ({ children, ...props }: any) => (
    <div data-testid='radix-select-group' {...props}>
      {children}
    </div>
  ),
  Label: ({ children, ...props }: any) => (
    <div data-testid='radix-select-label' {...props}>
      {children}
    </div>
  ),
  Separator: ({ ...props }: any) => (
    <hr data-testid='radix-select-separator' {...props} />
  ),
  ScrollUpButton: ({ children, ...props }: any) => (
    <button data-testid='radix-select-scroll-up' {...props}>
      {children}
    </button>
  ),
  ScrollDownButton: ({ children, ...props }: any) => (
    <button data-testid='radix-select-scroll-down' {...props}>
      {children}
    </button>
  ),
  Icon: ({ children, ...props }: any) => (
    <span data-testid='radix-select-icon' {...props}>
      {children}
    </span>
  ),
  Value: ({ placeholder, children, ...props }: any) => (
    <span
      data-testid='radix-select-value'
      data-placeholder={placeholder ? '' : undefined}
      {...props}
    >
      {children || placeholder}
    </span>
  ),
  Portal: ({ children, ...props }: any) => (
    <div data-testid='radix-select-portal' {...props}>
      {children}
    </div>
  ),
  __esModule: true,
}));

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../../../../src/renderer/components/ui/select';

describe('Select Components', () => {
  const mockOnValueChange = jest.fn();
  const mockOnOpenChange = jest.fn();

  describe('Select Root', () => {
    test('should render with default props', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select an option' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
            <SelectItem value='option2'>Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-root')).toBeInTheDocument();
      expect(screen.getByTestId('radix-select-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('radix-select-content')).toBeInTheDocument();
    });

    test('should handle value changes', async () => {
      const user = userEvent.setup();

      render(
        <Select value='option1' onValueChange={mockOnValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
            <SelectItem value='option2'>Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      await user.click(trigger);

      const item = screen.getByTestId('radix-select-item');
      await user.click(item);

      expect(screen.getByTestId('radix-select-root')).toHaveAttribute(
        'value',
        'option1'
      );
    });

    test('should handle open state changes', () => {
      render(
        <Select open={true} onOpenChange={mockOnOpenChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-root')).toHaveAttribute(
        'open',
        'true'
      );
    });
  });

  describe('SelectTrigger', () => {
    test('should render with default size', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('data-size', 'default');
      expect(trigger).toHaveClass('data-[size=default]:h-9');
    });

    test('should render with small size', () => {
      render(
        <Select>
          <SelectTrigger size='sm'>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('data-size', 'sm');
      expect(trigger).toHaveClass('data-[size=sm]:h-8');
    });

    test('should apply custom className', () => {
      render(
        <Select>
          <SelectTrigger className='custom-class'>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveClass('custom-class');
    });

    test('should render chevron icon', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });

    test('should forward additional props', () => {
      render(
        <Select>
          <SelectTrigger disabled data-testid='custom-trigger'>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('custom-trigger');
      expect(trigger).toBeDisabled();
    });
  });

  describe('SelectValue', () => {
    test('should render placeholder when no value is selected', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Choose an option' />
          </SelectTrigger>
        </Select>
      );

      expect(screen.getByTestId('radix-select-value')).toBeInTheDocument();
    });

    test('should render children when provided', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue>
              <span>Custom content</span>
            </SelectValue>
          </SelectTrigger>
        </Select>
      );

      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });

    test('should handle placeholder attribute', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select something' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('data-placeholder', 'true');
    });
  });

  describe('SelectContent', () => {
    test('should render content when open', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-content')).toBeInTheDocument();
    });

    test('should not render content when closed', () => {
      render(
        <Select open={false}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(
        screen.queryByTestId('radix-select-content')
      ).not.toBeInTheDocument();
    });

    test('should forward props to content', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='custom-content' position='popper'>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const content = screen.getByTestId('radix-select-content');
      expect(content).toHaveClass('custom-content');
      expect(content).toHaveAttribute('position', 'popper');
    });
  });

  describe('SelectItem', () => {
    test('should render item with value and text', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-item')).toHaveAttribute(
        'value',
        'option1'
      );
      expect(screen.getByTestId('radix-select-item-text')).toHaveTextContent(
        'Option 1'
      );
    });

    test('should render check icon for selected item', () => {
      render(
        <Select open={true} value='option1'>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    test('should handle disabled state', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1' disabled>
              Option 1
            </SelectItem>
          </SelectContent>
        </Select>
      );

      const item = screen.getByTestId('radix-select-item');
      expect(item).toHaveAttribute('disabled', '');
    });
  });

  describe('SelectGroup', () => {
    test('should render group with items', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Group 1</SelectLabel>
              <SelectItem value='option1'>Option 1</SelectItem>
              <SelectItem value='option2'>Option 2</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-group')).toBeInTheDocument();
      expect(screen.getByTestId('radix-select-label')).toHaveTextContent(
        'Group 1'
      );
      expect(screen.getAllByTestId('radix-select-item')).toHaveLength(2);
    });
  });

  describe('SelectLabel', () => {
    test('should render label', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectLabel>Choose an option</SelectLabel>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-label')).toHaveTextContent(
        'Choose an option'
      );
    });
  });

  describe('SelectSeparator', () => {
    test('should render separator', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
            <SelectSeparator />
            <SelectItem value='option2'>Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-separator')).toBeInTheDocument();
    });
  });

  describe('SelectScrollButtons', () => {
    test('should render scroll buttons', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectScrollUpButton />
            <SelectItem value='option1'>Option 1</SelectItem>
            <SelectItem value='option2'>Option 2</SelectItem>
            <SelectScrollDownButton />
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-scroll-up')).toBeInTheDocument();
      expect(
        screen.getByTestId('radix-select-scroll-down')
      ).toBeInTheDocument();
    });

    test('should render chevron icons in scroll buttons', () => {
      render(
        <Select open={true}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectScrollUpButton>
              <div>Up</div>
            </SelectScrollUpButton>
            <SelectScrollDownButton>
              <div>Down</div>
            </SelectScrollDownButton>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('chevron-up-icon')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete select workflow', async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder='Select a fruit' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value='apple'>Apple</SelectItem>
              <SelectItem value='banana'>Banana</SelectItem>
              <SelectItem value='orange'>Orange</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value='carrot'>Carrot</SelectItem>
              <SelectItem value='broccoli'>Broccoli</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('radix-select-trigger')).toBeInTheDocument();
      expect(
        screen.queryByTestId('radix-select-content')
      ).not.toBeInTheDocument();

      expect(screen.getByTestId('radix-select-root')).toBeInTheDocument();
    });

    test('should handle complex select with multiple groups and separators', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select an option' />
          </SelectTrigger>
          <SelectContent>
            <SelectScrollUpButton />
            <SelectGroup>
              <SelectLabel>Primary Options</SelectLabel>
              <SelectItem value='primary1'>Primary 1</SelectItem>
              <SelectItem value='primary2'>Primary 2</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Secondary Options</SelectLabel>
              <SelectItem value='secondary1'>Secondary 1</SelectItem>
              <SelectItem value='secondary2'>Secondary 2</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Tertiary Options</SelectLabel>
              <SelectItem value='tertiary1'>Tertiary 1</SelectItem>
              <SelectItem value='tertiary2'>Tertiary 2</SelectItem>
            </SelectGroup>
            <SelectScrollDownButton />
          </SelectContent>
        </Select>
      );

      expect(screen.getAllByTestId('radix-select-group')).toHaveLength(3);
      expect(screen.getAllByTestId('radix-select-separator')).toHaveLength(2);
      expect(screen.getAllByTestId('radix-select-label')).toHaveLength(3);
      expect(screen.getAllByTestId('radix-select-item')).toHaveLength(6);
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(
        <Select>
          <SelectTrigger aria-label='Select option'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Select option');
    });

    test('should support disabled state', () => {
      render(
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder='Disabled select' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toBeDisabled();
    });

    test('should handle required state', () => {
      render(
        <Select required>
          <SelectTrigger>
            <SelectValue placeholder='Required select' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='option1'>Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Styling and Classes', () => {
    test('should apply default styling classes', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('border-input'),
        expect.stringContaining('focus-visible:border-ring'),
        expect.stringContaining('data-[size=default]:h-9'),
        expect.anything()
      );
    });

    test('should apply size-specific classes', () => {
      render(
        <Select>
          <SelectTrigger size='sm'>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('data-[size=sm]:h-8'),
        expect.anything()
      );
    });

    test('should merge custom classes with default classes', () => {
      mockCn.mockClear();

      render(
        <Select>
          <SelectTrigger className='custom-class'>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      expect(mockCn).toHaveBeenCalled();
      const callArgs = mockCn.mock.calls[0];
      expect(callArgs).toContain('custom-class');
      expect(callArgs.some((arg) => arg && arg.includes('border-input'))).toBe(
        true
      );
    });
  });

  describe('Error States', () => {
    test('should handle invalid aria state', () => {
      render(
        <Select>
          <SelectTrigger aria-invalid>
            <SelectValue placeholder='Invalid select' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    test('should apply error styling for invalid state', () => {
      mockCn.mockClear();

      render(
        <Select>
          <SelectTrigger aria-invalid>
            <SelectValue placeholder='Invalid select' />
          </SelectTrigger>
        </Select>
      );

      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('aria-invalid:ring-destructive/20'),
        expect.stringContaining('dark:aria-invalid:ring-destructive/40'),
        expect.stringContaining('aria-invalid:border-destructive'),
        expect.anything()
      );
    });
  });

  describe('Data Attributes', () => {
    test('should apply proper data attributes', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('data-slot', 'select-trigger');
      expect(trigger).toHaveAttribute('data-size', 'default');
    });

    test('should handle placeholder data attribute', () => {
      render(
        <Select>
          <SelectTrigger data-placeholder>
            <SelectValue placeholder='Select...' />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId('radix-select-trigger');
      expect(trigger).toHaveAttribute('data-placeholder', '');
    });
  });
});
