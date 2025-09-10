import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiHelpCircle,
  FiExternalLink,
} from 'react-icons/fi';
import { z } from 'zod';
import { useConfigStore } from '../../stores/configStore';
import { Input } from '../../components/ui';
import { Button } from '../../components/ui';
import Typography from '../../components/ui/Typography';
import { ModelSelectorWithOpenRouter } from '../../components/ui/ModelSelectorWithOpenRouter';
import { ApiKeyGuide } from '../../components/ui/ApiKeyGuide';
import { getModelInfo } from '../../lib/models';

type LLMSettingsProps = Record<string, never>;

const llmSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().optional(),
});

type LLMSettingsForm = z.infer<typeof llmSettingsSchema>;

export const LLMSettings: React.FC<LLMSettingsProps> = () => {
  const {
    config,
    setLLMProvider,
    setOpenAIApiKey,
    setOpenAIModel,
    setAnthropicApiKey,
    setAnthropicModel,
    testOpenAIConnection,
    testAnthropicConnection,
    isLLMConfigValid,
  } = useConfigStore();

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKeyGuide, setShowApiKeyGuide] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  const {
    register,
    handleSubmit: _handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<LLMSettingsForm>({
    resolver: zodResolver(llmSettingsSchema),
    defaultValues: {
      provider: config?.llmProvider || 'openai',
      openaiApiKey: config?.openai?.apiKey || '',
      openaiModel: config?.openai?.model || 'gpt-4o',
      anthropicApiKey: config?.anthropic?.apiKey || '',
      anthropicModel: config?.anthropic?.model || 'claude-3-7-sonnet-latest',
    },
  });

  React.useEffect(() => {
    if (config) {
      reset({
        provider: config.llmProvider || 'openai',
        openaiApiKey: config.openai?.apiKey || '',
        openaiModel: config.openai?.model || 'gpt-4o',
        anthropicApiKey: config.anthropic?.apiKey || '',
        anthropicModel: config.anthropic?.model || 'claude-3-7-sonnet-latest',
      });
    }
  }, [config, reset]);

  const watchProvider = watch('provider');
  const watchOpenAIApiKey = watch('openaiApiKey');
  const watchOpenAIModel = watch('openaiModel');
  const watchAnthropicApiKey = watch('anthropicApiKey');
  const watchAnthropicModel = watch('anthropicModel');

  useEffect(() => {
    const hasAnyApiKey = config?.openai?.apiKey || config?.anthropic?.apiKey;
    setIsFirstTime(!hasAnyApiKey);
  }, [config]);

  useEffect(() => {
    if (config?.llmProvider !== watchProvider) {
      setLLMProvider(watchProvider);
    }
  }, [watchProvider, setLLMProvider, config?.llmProvider]);

  useEffect(() => {
    if (watchOpenAIApiKey !== undefined && config?.openai?.apiKey !== watchOpenAIApiKey) {
      setOpenAIApiKey(watchOpenAIApiKey);
    }
  }, [watchOpenAIApiKey, setOpenAIApiKey, config?.openai?.apiKey]);

  useEffect(() => {
    if (watchOpenAIModel && config?.openai?.model !== watchOpenAIModel) {
      setOpenAIModel(watchOpenAIModel as string);
    }
  }, [watchOpenAIModel, setOpenAIModel, config?.openai?.model]);

  useEffect(() => {
    if (watchAnthropicApiKey !== undefined && config?.anthropic?.apiKey !== watchAnthropicApiKey) {
      setAnthropicApiKey(watchAnthropicApiKey);
    }
  }, [watchAnthropicApiKey, setAnthropicApiKey, config?.anthropic?.apiKey]);

  useEffect(() => {
    if (watchAnthropicModel && config?.anthropic?.model !== watchAnthropicModel) {
      setAnthropicModel(watchAnthropicModel as string);
    }
  }, [watchAnthropicModel, setAnthropicModel, config?.anthropic?.model]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result =
        watchProvider === 'openai'
          ? await testOpenAIConnection()
          : await testAnthropicConnection();

      setTestResult({
        success: result.success,
        message: result.success
          ? 'Connection successful! 🎉'
          : result.error || 'Connection failed',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const currentApiKey =
    watchProvider === 'openai' ? watchOpenAIApiKey : watchAnthropicApiKey;
  const currentModel =
    watchProvider === 'openai' ? watchOpenAIModel : watchAnthropicModel;
  const selectedModelInfo = getModelInfo(currentModel || '');

  if (showApiKeyGuide) {
    return (
      <ApiKeyGuide
        provider={watchProvider}
        onClose={() => setShowApiKeyGuide(false)}
      />
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <Typography variant='h4' noMargin>
          AI Language Model Configuration
        </Typography>
        <div className='mt-2'>
          <Typography variant='body1' color='muted' noMargin>
            Choose your AI provider and configure your API access. We support
            both OpenAI and Anthropic models.
          </Typography>
        </div>
      </div>

      {isFirstTime && (
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
          <div className='flex items-start space-x-4'>
            <div className='flex-shrink-0'>
              <div className='w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center'>
                <span className='text-white text-lg'>👋</span>
              </div>
            </div>
            <div className='flex-1'>
              <Typography
                variant='h6'
                className='text-blue-800 dark:text-blue-200 mb-1'
                noMargin
              >
                Welcome! Let's get you set up
              </Typography>
              <Typography
                variant='body1'
                className='text-blue-700 dark:text-blue-300 mb-3'
                noMargin
              >
                To use this conversational agent, you'll need an API key from
                either OpenAI or Anthropic. Don't worry - we'll guide you
                through the entire process!
              </Typography>
              <Button
                variant='default'
                onClick={() => setShowApiKeyGuide(true)}
                className='bg-blue-600 hover:bg-blue-700'
              >
                <FiHelpCircle className='w-4 h-4 mr-2' />
                Show Setup Guide
              </Button>
            </div>
          </div>
        </div>
      )}

      <form className='space-y-6'>
        <div>
          <Typography variant='h6' className='mb-4' noMargin>
            Choose Your AI Provider
          </Typography>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <div
              onClick={() => setValue('provider', 'openai')}
              className={`cursor-pointer border rounded-lg p-4 transition-colors ${
                watchProvider === 'openai'
                  ? 'border-brand-blue/60 bg-brand-blue/5 dark:bg-brand-blue/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className='flex items-center space-x-3 mb-3'>
                <div className='w-10 h-10 bg-gray-900 dark:bg-gray-800 rounded-lg flex items-center justify-center'>
                  <span className='text-white font-bold text-sm'>AI</span>
                </div>
                <div>
                  <Typography variant='h6' className='font-semibold' noMargin>
                    OpenAI
                  </Typography>
                  <Typography variant='caption' color='muted' noMargin>
                    GPT-4.1, GPT-4o, and more
                  </Typography>
                </div>
              </div>
              <Typography variant='caption' color='muted'>
                Popular models including the latest GPT-4.1 with 1M context
                window, efficient GPT-4o mini, and specialized reasoning models.
              </Typography>
            </div>

            <div
              onClick={() => setValue('provider', 'anthropic')}
              className={`cursor-pointer border rounded-lg p-4 transition-colors ${
                watchProvider === 'anthropic'
                  ? 'border-brand-blue/60 bg-brand-blue/5 dark:bg-brand-blue/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className='flex items-center space-x-3 mb-3'>
                <div className='w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center'>
                  <span className='text-white font-bold text-sm'>C</span>
                </div>
                <div>
                  <Typography variant='h6' className='font-semibold' noMargin>
                    Anthropic
                  </Typography>
                  <Typography variant='caption' color='muted' noMargin>
                    Claude 3.5 Sonnet, Haiku, and Opus
                  </Typography>
                </div>
              </div>
              <Typography variant='caption' color='muted'>
                Advanced models known for safety, helpful reasoning, and
                excellent performance on coding and creative tasks.
              </Typography>
            </div>
          </div>
        </div>

        <div>
          <div className='flex items-center justify-between mb-4'>
            <Typography variant='h6' noMargin>
              {watchProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API
              Configuration
            </Typography>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowApiKeyGuide(true)}
              className='text-sm'
            >
              <FiHelpCircle className='w-4 h-4 mr-1' />
              Need help?
            </Button>
          </div>

          <div className='space-y-3'>
            <div>
              <Typography variant='body1' className='font-medium mb-2' noMargin>
                API Key
              </Typography>
              <div className='space-y-2'>
                <Input
                  id={`${watchProvider}ApiKey`}
                  type='password'
                  placeholder={
                    watchProvider === 'openai' ? 'sk-...' : 'sk-ant-...'
                  }
                  {...register(
                    `${watchProvider}ApiKey` as keyof LLMSettingsForm
                  )}
                  className={
                    errors[`${watchProvider}ApiKey` as keyof LLMSettingsForm]
                      ? 'border-red-500'
                      : ''
                  }
                />
                {errors[`${watchProvider}ApiKey` as keyof LLMSettingsForm] && (
                  <Typography variant='caption' className='text-red-600'>
                    {
                      errors[`${watchProvider}ApiKey` as keyof LLMSettingsForm]
                        ?.message
                    }
                  </Typography>
                )}
                <div className='flex items-start space-x-2'>
                  <Typography
                    variant='caption'
                    color='muted'
                    className='flex-1'
                  >
                    Your API key is encrypted and stored securely using the
                    system keychain.
                    {watchProvider === 'openai'
                      ? ' OpenAI keys start with "sk-".'
                      : ' Anthropic keys start with "sk-ant-".'}
                  </Typography>
                  <a
                    href={
                      watchProvider === 'openai'
                        ? 'https://platform.openai.com/api-keys'
                        : 'https://console.anthropic.com/settings/keys'
                    }
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center space-x-1 text-brand-blue hover:text-brand-blue-dark text-sm whitespace-nowrap'
                  >
                    <span>Get API Key</span>
                    <FiExternalLink className='w-3 h-3' />
                  </a>
                </div>
              </div>
            </div>

            {currentApiKey && (
              <ModelSelectorWithOpenRouter
                provider={watchProvider}
                selectedModel={currentModel || ''}
                onModelChange={(model) =>
                  setValue(
                    `${watchProvider}Model` as keyof LLMSettingsForm,
                    model
                  )
                }
                useOpenRouter={true}
              />
            )}

            {currentApiKey && (
              <div className='pt-4'>
                <Button
                  type='button'
                  onClick={handleTestConnection}
                  disabled={!isLLMConfigValid() || isTesting}
                  variant={isLLMConfigValid() ? 'default' : 'secondary'}
                >
                  {isTesting ? 'Testing Connection...' : 'Test Connection'}
                </Button>
              </div>
            )}

            {testResult && (
              <div
                className={`p-4 rounded-lg flex items-center space-x-3 ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}
              >
                {testResult.success ? (
                  <FiCheckCircle className='w-5 h-5 flex-shrink-0' />
                ) : (
                  <FiAlertCircle className='w-5 h-5 flex-shrink-0' />
                )}
                <div className='flex-1'>
                  <Typography variant='body1' className='font-medium'>
                    {testResult.message}
                  </Typography>
                  {testResult.success && selectedModelInfo && (
                    <div className='mt-1'>
                      <Typography variant='caption' className='opacity-80'>
                        Connected to {selectedModelInfo.name} •{' '}
                        {selectedModelInfo.contextWindow} context
                      </Typography>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {isLLMConfigValid() && (
          <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6'>
            <div className='flex items-start space-x-3'>
              <FiCheckCircle className='w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5' />
              <div>
                <Typography
                  variant='h6'
                  className='text-green-800 dark:text-green-200 mb-2'
                  noMargin
                >
                  Configuration Complete! ✨
                </Typography>
                <Typography
                  variant='body1'
                  className='text-green-700 dark:text-green-300 mb-3'
                  noMargin
                >
                  You're all set to use the conversational agent with{' '}
                  {selectedModelInfo?.name || 'your selected model'}.
                </Typography>
                {selectedModelInfo && (
                  <div className='space-y-1'>
                    <Typography
                      variant='caption'
                      className='text-green-600 dark:text-green-400'
                    >
                      • Model: {selectedModelInfo.name}
                    </Typography>
                    <Typography
                      variant='caption'
                      className='text-green-600 dark:text-green-400'
                    >
                      • Context: {selectedModelInfo.contextWindow}
                    </Typography>
                    <Typography
                      variant='caption'
                      className='text-green-600 dark:text-green-400'
                    >
                      • Input Cost: {selectedModelInfo.inputCost}
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export const OpenAISettings = LLMSettings;
