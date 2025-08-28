import React, { useState, useCallback, useMemo } from "react";
import Form from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import { rjsfTheme, FieldInteractionProvider } from "./RjsfTheme";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { Button } from "../ui/Button";
import type { FormMessage } from "../../stores/agentStore";
import { useAgentStore } from "../../stores/agentStore";
import SubmitButtonContent from "./SubmitButtonContent";
import { FiCheckCircle, FiXCircle, FiLoader } from "react-icons/fi";

const typingSelector = (state: any) => state.isTyping;

interface FormMessageBubbleProps {
  formMessage: FormMessage;
  className?: string;
}

interface RJSFFormProps {
  message: FormMessage;
  onSubmit: (formData: JsonRecord) => Promise<void>;
  onCancel: () => void;
  jsonSchema: RJSFSchema;
  uiSchema: UiSchema;
}

type JsonRecord = Record<string, unknown>;
type RJSFEvent = { formData?: JsonRecord };

/**
 * Converts FormMessage field configuration to JSON Schema format
 */
const convertToJsonSchema = (formMessage: FormMessage): RJSFSchema => {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  formMessage.formConfig.fields.forEach((field) => {
    if (field.required) {
      required.push(field.name);
    }

    const fieldSchema: any = {
      title: field.label,
      description: field.helpText || field.placeholder,
    };

    switch (field.type) {
      case "text":
        fieldSchema.type = "string";
        break;
      case "number":
      case "currency":
      case "percentage":
        fieldSchema.type = "number";
        if (field.validation?.min !== undefined)
          fieldSchema.minimum = field.validation.min;
        if (field.validation?.max !== undefined)
          fieldSchema.maximum = field.validation.max;
        break;
      case "textarea":
        fieldSchema.type = "string";
        break;
      case "checkbox":
        fieldSchema.type = "boolean";
        break;
      case "select":
        fieldSchema.type = "string";
        if (field.options) {
          fieldSchema.enum = field.options.map((opt) => opt.value);
          fieldSchema.enumNames = field.options.map((opt) => opt.label);
        }
        break;
      default:
        fieldSchema.type = "string";
    }

    if (field.validation?.minLength)
      fieldSchema.minLength = field.validation.minLength;
    if (field.validation?.maxLength)
      fieldSchema.maxLength = field.validation.maxLength;
    if (field.validation?.pattern)
      fieldSchema.pattern = field.validation.pattern;
    if (field.defaultValue !== undefined)
      fieldSchema.default = field.defaultValue;

    const errorMessage: Record<string, string> = {};

    if (field.required) {
      errorMessage.required = `${field.label} is required`;
    }

    if (field.validation?.minLength) {
      errorMessage.minLength = `${field.label} must be at least ${field.validation.minLength} characters`;
    }

    if (field.validation?.maxLength) {
      errorMessage.maxLength = `${field.label} must be no more than ${field.validation.maxLength} characters`;
    }

    if (field.validation?.pattern) {
      errorMessage.pattern = `${field.label} has invalid format`;
    }

    if (field.validation?.min !== undefined) {
      if (field.validation?.max !== undefined) {
        errorMessage.minimum = `${field.label} must be between ${field.validation.min} and ${field.validation.max}`;
      } else {
        errorMessage.minimum = `${field.label} must be at least ${field.validation.min}`;
      }
    }

    if (
      field.validation?.max !== undefined &&
      field.validation?.min === undefined
    ) {
      errorMessage.maximum = `${field.label} must be no more than ${field.validation.max}`;
    }

    if (Object.keys(errorMessage).length > 0) {
      fieldSchema.errorMessage = errorMessage;
    }

    properties[field.name] = fieldSchema;
  });

  const schema = {
    type: "object" as const,
    title: formMessage.formConfig.title,
    description: formMessage.formConfig.description,
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: true,
  };

  return schema;
};

/**
 * Converts FormMessage field configuration to UI Schema format
 */
const convertToUiSchema = (formMessage: FormMessage): UiSchema => {
  const uiSchema: UiSchema = {};

  formMessage.formConfig.fields.forEach((field) => {
    switch (field.type) {
      case "textarea":
        uiSchema[field.name] = { "ui:widget": "TextareaWidget" };
        break;
      case "checkbox":
        uiSchema[field.name] = { "ui:widget": "CheckboxWidget" };
        break;
      case "select":
        uiSchema[field.name] = { "ui:widget": "SelectWidget" };
        break;
      default:
        uiSchema[field.name] = { "ui:widget": "TextWidget" };
    }

    if (field.placeholder) {
      uiSchema[field.name] = {
        ...uiSchema[field.name],
        "ui:placeholder": field.placeholder,
      };
    }
  });

  return uiSchema;
};

/**
 * RJSF form component using our custom theme
 */
function RJSFForm({
  message,
  onSubmit,
  onCancel,
  jsonSchema,
  uiSchema,
}: RJSFFormProps) {
  const [formData, setFormData] = useState<JsonRecord>(
    (message.partialInput as JsonRecord) || {},
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isTyping = useAgentStore(typingSelector);

  const completionState = message.completionState || "active";
  const isCompleted = completionState === "completed";
  const isFailed = completionState === "failed";
  const isFormSubmitting = completionState === "submitting";

  const isProcessing = isSubmitting || isTyping || isFormSubmitting;

  const validator = useMemo(
    () =>
      customizeValidator({
        ajvOptionsOverrides: {
          removeAdditional: "all",
          strict: false,
          allErrors: true,
        },
      }),
    [],
  );

  const handleSubmit = useCallback(
    (data: RJSFEvent, event: React.FormEvent): void => {
      event.preventDefault();
      setIsSubmitting(true);
      Promise.resolve(onSubmit((data.formData || {}) as JsonRecord)).finally(
        () => {
          setIsSubmitting(false);
        },
      );
    },
    [onSubmit],
  );

  const handleChange = useCallback(
    (data: RJSFEvent): void => {
      if (!isCompleted && !isFailed) {
        setFormData((data.formData || {}) as JsonRecord);
      }
    },
    [isCompleted, isFailed],
  );

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  if (isCompleted) {
    return (
      <FieldInteractionProvider>
        <div className='w-full'>
          <div className='mb-4'>
            <h3 className='text-lg font-semibold text-white'>
              {message.formConfig?.title || 'Complete Form'}
            </h3>
            {message.formConfig?.description && (
              <p className='text-sm text-white/70 mt-1'>
                {message.formConfig.description}
              </p>
            )}
          </div>
          
          <div className='bg-blue-950/40 border border-blue-800/30 rounded-xl p-4 mb-4'>
            <div className='flex items-center gap-3 mb-3'>
              <FiCheckCircle className='text-blue-300 w-5 h-5 flex-shrink-0' />
              <div>
                <span className='text-white font-medium text-base'>Form Submitted Successfully</span>
                {message.completedAt && (
                  <p className='text-white/60 text-sm mt-0.5'>
                    {formatTimestamp(message.completedAt)}
                  </p>
                )}
              </div>
            </div>
            {message.completionResult?.message && (
              <p className='text-white/70 text-sm leading-relaxed ml-8'>
                {message.completionResult.message}
              </p>
            )}
          </div>

          <div className='opacity-50 pointer-events-none'>
            <Form
              schema={jsonSchema}
              uiSchema={uiSchema}
              formData={message.partialInput as JsonRecord || {}}
              validator={validator}
              widgets={rjsfTheme.widgets}
              templates={rjsfTheme.templates}
              liveValidate={false}
              showErrorList={false}
              noHtml5Validate={true}
              omitExtraData={true}
              liveOmit={true}
              disabled={true}
              readonly={true}
            >
              <div></div>
            </Form>
          </div>
        </div>
      </FieldInteractionProvider>
    );
  }

  if (isFailed) {
    return (
      <FieldInteractionProvider>
        <div className="w-full">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">
              {message.formConfig?.title || "Complete Form"}
            </h3>
            {message.formConfig?.description && (
              <p className="text-sm text-white/90 mt-1">
                {message.formConfig.description}
              </p>
            )}
          </div>

          <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-rose-500/10 to-orange-500/10 border border-red-500/20 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-rose-500/5"></div>
            <div className="relative p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FiXCircle className="text-white w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-red-300 font-bold text-lg mb-1">
                    Form Submission Failed
                  </h4>
                  <p className="text-red-200/80 text-sm leading-relaxed">
                    There was an issue processing your form submission. Please
                    review the details below and try again.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-red-500/20">
                {message.completionResult?.message && (
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                    <p className="text-red-100 text-sm leading-relaxed font-medium">
                      {message.completionResult.message}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-red-200/70 text-sm">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                  <span>
                    You can modify your responses and try submitting again
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-white/10 rounded-xl opacity-50"></div>
            <div className="relative bg-black/20 rounded-xl p-4 border border-white/10">
              <div className="mb-4">
                <span className="text-xs text-white/50 font-medium tracking-wide uppercase">
                  Retry Form Submission
                </span>
              </div>
              <Form
                schema={jsonSchema}
                uiSchema={uiSchema}
                formData={formData}
                onChange={handleChange}
                onSubmit={handleSubmit}
                validator={validator}
                widgets={rjsfTheme.widgets}
                templates={rjsfTheme.templates}
                liveValidate={false}
                showErrorList={false}
                noHtml5Validate={true}
                omitExtraData={true}
                liveOmit={true}
                disabled={isProcessing}
              >
                <div className="flex gap-3 mt-8">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-transparent hover:bg-white/10 border border-white/30 hover:border-white/50 rounded-xl transition-all duration-300 ease-out font-medium text-white/80 hover:text-white"
                  >
                    {message.formConfig?.cancelLabel || "Cancel"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-out font-semibold text-base"
                  >
                    <SubmitButtonContent
                      submitting={isProcessing}
                      label="Retry Submission"
                    />
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </FieldInteractionProvider>
    );
  }

  return (
    <FieldInteractionProvider>
      <div className="w-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">
            {message.formConfig?.title || "Complete Form"}
          </h3>
          {message.formConfig?.description && (
            <p className="text-sm text-white/90 mt-1">
              {message.formConfig.description}
            </p>
          )}
          {isFormSubmitting && (
            <div className="flex items-center gap-2 mt-2 text-blue-300">
              <FiLoader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Submitting form...</span>
            </div>
          )}
        </div>
        <div>
          <Form
            schema={jsonSchema}
            uiSchema={uiSchema}
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            validator={validator}
            widgets={rjsfTheme.widgets}
            templates={rjsfTheme.templates}
            liveValidate={false}
            showErrorList={false}
            noHtml5Validate={true}
            omitExtraData={true}
            liveOmit={true}
            disabled={isProcessing}
          >
            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isProcessing}
                className="px-6 py-3 bg-transparent hover:bg-white/10 border border-white/30 hover:border-white/50 rounded-xl transition-all duration-300 ease-out font-medium text-white/80 hover:text-white"
              >
                {message.formConfig?.cancelLabel || "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-3 bg-white hover:bg-white/90 text-blue-600 border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-out font-semibold text-base"
              >
                <SubmitButtonContent
                  submitting={isProcessing}
                  label={message.formConfig?.submitLabel || "Continue"}
                />
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </FieldInteractionProvider>
  );
}

/**
 * Wrapper component that maintains backwards compatibility with existing usage
 */
export function FormMessageBubble({
  formMessage,
  className,
}: FormMessageBubbleProps) {
  const { processFormSubmission } = useAgentStore();

  const handleSubmit = useCallback(
    async (formData: any) => {
      try {
        await processFormSubmission(formMessage.id, formData);
      } catch (error) {}
    },
    [processFormSubmission, formMessage.id],
  );

  const handleCancel = useCallback(() => {}, []);

  const jsonSchema = useMemo(
    () => formMessage.jsonSchema || convertToJsonSchema(formMessage),
    [formMessage],
  );

  const uiSchema = useMemo(
    () => formMessage.uiSchema || convertToUiSchema(formMessage),
    [formMessage],
  );

  return (
    <div className={className}>
      <RJSFForm
        message={formMessage}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        jsonSchema={jsonSchema}
        uiSchema={uiSchema}
      />
    </div>
  );
}
