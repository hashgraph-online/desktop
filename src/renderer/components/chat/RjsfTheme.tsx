import React, { useState, createContext, useContext } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiAlertTriangle,
} from 'react-icons/fi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import type {
  WidgetProps,
  TemplatesType,
  ArrayFieldTemplateProps,
  ObjectFieldTemplateProps,
  FieldTemplateProps,
} from '@rjsf/utils';

interface FieldInteractionContextType {
  interactedFields: Set<string>;
  attemptedSubmit: boolean;
  markFieldInteracted: (fieldId: string) => void;
  markSubmitAttempted: () => void;
}

const FieldInteractionContext =
  createContext<FieldInteractionContextType | null>(null);

export const FieldInteractionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [interactedFields, setInteractedFields] = useState<Set<string>>(
    new Set()
  );
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const markFieldInteracted = (fieldId: string) => {
    setInteractedFields((prev) => new Set(prev).add(fieldId));
  };

  const markSubmitAttempted = () => {
    setAttemptedSubmit(true);
  };

  return (
    <FieldInteractionContext.Provider
      value={{
        interactedFields,
        attemptedSubmit,
        markFieldInteracted,
        markSubmitAttempted,
      }}
    >
      {children}
    </FieldInteractionContext.Provider>
  );
};

const useFieldInteraction = () => {
  const context = useContext(FieldInteractionContext);
  if (!context) {
    throw new Error(
      'useFieldInteraction must be used within a FieldInteractionProvider'
    );
  }
  return context;
};

type CollapsibleContainerProps = {
  name: string;
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  disableGrow?: boolean;
};

/**
 * Collapsible container component for organizing form sections
 * with expand/collapse functionality for better UX.
 */
const CollapsibleContainer: React.FC<CollapsibleContainerProps> = ({
  name,
  isOpen: initialOpen,
  children,
  className = '',
  disableGrow = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div
      className={`${className} ${!disableGrow ? 'flex-1' : ''} bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden`}
    >
      <div
        className='cursor-pointer bg-white/5 border-b border-white/10 px-5 py-4 hover:bg-white/10 transition-all duration-200'
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className='flex items-center justify-between'>
          <h4 className='text-lg font-semibold text-white'>{name}</h4>
          {isOpen ? (
            <FiChevronUp className='h-5 w-5 text-white/70' />
          ) : (
            <FiChevronDown className='h-5 w-5 text-white/70' />
          )}
        </div>
      </div>
      {isOpen && <div className='p-5'>{children}</div>}
    </div>
  );
};

/**
 * Custom input widget for RJSF using ChatPage design patterns.
 * Handles text input with glass morphism styling and proper event handling.
 */
const CustomInputWidget = (props: WidgetProps) => {
  const { markFieldInteracted } = useFieldInteraction();

  const handleFocus = () => {
    props.onFocus && props.onFocus(props.id, props.value);
  };

  const handleBlur = () => {
    markFieldInteracted(props.id);
    props.onBlur && props.onBlur(props.id, props.value);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    markFieldInteracted(props.id);
    props.onChange(event.target.value);
  };

  return (
    <input
      type='text'
      value={props.value || ''}
      required={props.required}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      aria-label={props.schema?.title || props.placeholder || 'Text input'}
      aria-required={props.required}
      className='w-full px-4 py-3 bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:focus:ring-white/50 focus:border-blue-500 dark:focus:border-white/40 focus:bg-white dark:focus:bg-white/20 placeholder:text-gray-500 dark:placeholder:text-white/80 text-gray-900 dark:text-white transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed'
    />
  );
};

/**
 * Custom textarea widget for RJSF using ChatPage design patterns.
 * Handles multi-line text input with glass morphism styling.
 */
const CustomTextareaWidget = (props: WidgetProps) => {
  const { markFieldInteracted } = useFieldInteraction();

  const handleFocus = () => {
    props.onFocus && props.onFocus(props.id, props.value);
  };

  const handleBlur = () => {
    markFieldInteracted(props.id);
    props.onBlur && props.onBlur(props.id, props.value);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    markFieldInteracted(props.id);
    props.onChange(event.target.value);
  };

  return (
    <textarea
      value={props.value || ''}
      required={props.required}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      rows={4}
      aria-label={props.schema?.title || props.placeholder || 'Text area input'}
      aria-required={props.required}
      className='w-full px-4 py-3 bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:focus:ring-white/50 focus:border-blue-500 dark:focus:border-white/40 focus:bg-white dark:focus:bg-white/20 placeholder:text-gray-500 dark:placeholder:text-white/80 text-gray-900 dark:text-white transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed resize-none'
    />
  );
};

/**
 * Custom select widget for RJSF using our Select component.
 * Handles dropdown selection with proper options rendering.
 */
const CustomSelectWidget = (props: WidgetProps) => {
  const { markFieldInteracted } = useFieldInteraction();

  const handleValueChange = (value: string) => {
    markFieldInteracted(props.id);
    props.onChange(value);
  };

  return (
    <Select
      value={props.value}
      required={props.required}
      disabled={props.disabled}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className='bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white data-[placeholder]:text-gray-500 dark:data-[placeholder]:text-white/70'>
        <SelectValue
          placeholder={props.placeholder || 'Select an option'}
          className='text-gray-900 dark:text-white'
        />
      </SelectTrigger>
      <SelectContent className='bg-white border border-gray-200 text-gray-900 dark:bg-gray-900/95 dark:border-gray-700 dark:text-white'>
        {props.options.enumOptions?.map(({ value, label }) => (
          <SelectItem
            key={value}
            value={value}
            className='text-gray-900 dark:text-white data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-white/10 hover:bg-gray-100 focus:bg-gray-100 dark:hover:bg-white/10 dark:focus:bg-white/10'
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/**
 * Custom checkbox widget for RJSF using our Checkbox component.
 * Handles boolean input with proper labeling and styling.
 */
const CustomCheckboxWidget = (props: WidgetProps) => {
  const { markFieldInteracted } = useFieldInteraction();

  const handleCheckedChange = (checked: boolean) => {
    markFieldInteracted(props.id);
    props.onChange(checked);
  };

  return (
    <div className='flex items-center space-x-2'>
      <Checkbox
        id={props.id}
        checked={props.value}
        disabled={props.disabled}
        onCheckedChange={handleCheckedChange}
        className='border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-gray-900 data-[state=checked]:border-white'
      />
      <label
        htmlFor={props.id}
        className='text-sm font-medium text-white leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
      >
        {props.label}
      </label>
    </div>
  );
};

/**
 * Custom field template for RJSF that wraps form fields with labels and error handling.
 * Provides consistent styling and layout for all form fields.
 */
const CustomFieldTemplate = (props: FieldTemplateProps) => {
  const {
    id,
    classNames,
    label,
    help,
    required,
    description,
    errors,
    children,
    displayLabel,
  } = props;
  const { interactedFields, attemptedSubmit } = useFieldInteraction();

  if (!displayLabel) {
    return <div className={classNames}>{children}</div>;
  }

  /**
   * Extracts displayable error content from RJSF errors
   * Handles both string errors and React elements with empty content
   */
  const getErrorContent = (errors: any): string | null => {
    if (!errors) return null;

    if (typeof errors === 'string') {
      return errors.trim() || null;
    }

    if (React.isValidElement(errors)) {
      const children = (errors.props as any)?.children;
      const hasContent = React.Children.toArray(children || []).some(
        (child: any) => {
          if (typeof child === 'string') return child.trim();
          if (React.isValidElement(child)) {
            const childChildren = (child.props as any)?.children;
            return React.Children.count(childChildren) > 0;
          }
          return false;
        }
      );

      if (!hasContent) return null;

      const extractText = (element: React.ReactNode): string => {
        if (typeof element === 'string') return element;
        if (typeof element === 'number') return String(element);
        if (React.isValidElement(element)) {
          const elementChildren = (element.props as any)?.children;
          return React.Children.toArray(elementChildren || [])
            .map(extractText)
            .join('')
            .trim();
        }
        return '';
      };

      const extractedText = extractText(errors);
      return extractedText || null;
    }

    if (Array.isArray(errors)) {
      const validErrors = errors
        .map((error) => getErrorContent(error))
        .filter(Boolean);
      return validErrors.length > 0 ? validErrors.join(', ') : null;
    }

    return null;
  };

  const errorContent = getErrorContent(errors);
  const shouldShowErrors =
    errorContent && (interactedFields.has(id) || attemptedSubmit);

  return (
    <div className={`${classNames} mb-6 relative`}>
      {label && (
        <label
          htmlFor={id}
          className='block text-sm font-medium text-white mb-2'
        >
          {label}
          {required && <span className='text-red-100 ml-1'>*</span>}
        </label>
      )}
      {description && (
        <Typography variant='body2' as='span' className='mb-2 text-white/85'>
          {description}
        </Typography>
      )}
      {children}
      {shouldShowErrors && (
        <div className='mt-2 flex items-start space-x-2 text-sm text-red-100'>
          <FiAlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
          <div>{errorContent}</div>
        </div>
      )}
      {help && (
        <Typography variant='caption' className='mt-1 text-white/75'>
          {help}
        </Typography>
      )}
    </div>
  );
};

/**
 * Custom array field template for RJSF that handles dynamic lists like attributes.
 * Provides add/remove functionality with consistent styling.
 */
const CustomArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { items, canAdd, onAddClick, title, schema } = props;

  return (
    <div className='space-y-4'>
      {title && (
        <Typography variant='h4' className='mb-4 text-white'>
          {title}
        </Typography>
      )}

      <div className='space-y-4'>
        {items.map((item, index) => (
          <div key={item.key} className='relative'>
            <div className='flex items-start space-x-4'>
              <div className='flex-1'>{item.children}</div>
              {item.hasRemove && (
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={item.onDropIndexClick(index)}
                  className='mt-8 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white border-0 rounded-xl shadow-lg transition-all duration-300 ease-out font-medium'
                >
                  <FiTrash2 className='h-4 w-4' />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canAdd && (
        <Button
          variant='outline'
          onClick={onAddClick}
          className='mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl transition-all duration-300 ease-out font-medium text-white'
        >
          <FiPlus className='mr-2 h-4 w-4' />
          Add {title || 'Item'}
        </Button>
      )}
    </div>
  );
};

/**
 * Custom object field template for RJSF that handles nested objects with collapsible sections.
 * Provides organized layout for complex form structures.
 */
const CustomObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { properties, title, description, required } = props;

  const isAttributes = title?.includes('Attributes');
  const isFirst = title === 'Attributes-1';
  const shouldBeCollapsible = isAttributes;
  const defaultOpen = isFirst || !isAttributes;

  if (!title) {
    return (
      <div className='space-y-4'>{properties.map((prop) => prop.content)}</div>
    );
  }

  if (shouldBeCollapsible) {
    return (
      <CollapsibleContainer
        name={title}
        isOpen={defaultOpen}
        className='mt-6 mb-6'
        disableGrow
      >
        <div>
          {description && (
            <Typography
              variant='body2'
              as='span'
              className='mb-4 text-white/85'
            >
              {description}
            </Typography>
          )}
          <div className='space-y-4'>
            {properties.map((prop) => prop.content)}
          </div>
        </div>
      </CollapsibleContainer>
    );
  }

  return (
    <div className='mt-6 mb-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden'>
      <div className='bg-white/5 border-b border-white/10 px-5 py-4'>
        <h4 className='text-lg font-semibold text-white flex items-center'>
          {title}
          {required && <span className='text-red-100 ml-1'>*</span>}
        </h4>
        {description && (
          <Typography variant='body2' as='span' className='text-white/85 mt-1'>
            {description}
          </Typography>
        )}
      </div>
      <div className='p-5'>
        <div className='space-y-4'>
          {properties.map((prop) => prop.content)}
        </div>
      </div>
    </div>
  );
};

/**
 * Custom submit button template for RJSF using our Button component.
 * Provides consistent styling for form submission.
 */
const CustomSubmitButton = (props: any) => {
  const { markSubmitAttempted } = useFieldInteraction();

  const handleClick = (e: React.MouseEvent) => {
    markSubmitAttempted();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <Button
      type='submit'
      variant='default'
      size='default'
      {...props}
      onClick={handleClick}
    >
      {props?.uiSchema?.['ui:submitButtonOptions']?.submitText || 'Submit'}
    </Button>
  );
};

/**
 * RJSF theme configuration object that maps our custom components
 * to RJSF widget and template types for form rendering.
 */
export const rjsfTheme = {
  widgets: {
    TextWidget: CustomInputWidget,
    TextareaWidget: CustomTextareaWidget,
    SelectWidget: CustomSelectWidget,
    CheckboxWidget: CustomCheckboxWidget,
  },
  templates: {
    FieldTemplate: CustomFieldTemplate,
    ArrayFieldTemplate: CustomArrayFieldTemplate,
    ObjectFieldTemplate: CustomObjectFieldTemplate,
    ButtonTemplates: {
      AddButton: ({ onClick, ...props }: any) => (
        <Button
          variant='outline'
          onClick={onClick}
          {...props}
          className='px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl transition-all duration-300 ease-out font-medium text-white'
        >
          <FiPlus className='mr-2 h-4 w-4' />
          Add
        </Button>
      ),
      RemoveButton: ({ onClick, ...props }: any) => (
        <Button
          variant='destructive'
          size='sm'
          onClick={onClick}
          {...props}
          className='px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white border-0 rounded-xl shadow-lg transition-all duration-300 ease-out font-medium'
        >
          <FiTrash2 className='h-4 w-4' />
        </Button>
      ),
      SubmitButton: CustomSubmitButton,
    },
  },
} as const;
