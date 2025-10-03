import React, { useState, useEffect } from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  ModelInfo,
  getModelsByProvider,
  getModelDisplayInfo,
} from '../../lib/models';
import { useOpenRouterModels } from '../../hooks/useOpenRouterModels';
import Typography from './Typography';
import { Badge } from './badge';
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
import { Button } from './Button';

interface ModelSelectorProps {
  provider: 'openai' | 'anthropic';
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
  useOpenRouter?: boolean;
}

interface ModelCardProps {
  model: ModelInfo;
  isSelected: boolean;
  onSelect: (modelId: string) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isSelected,
  onSelect,
}) => {
  const displayInfo = getModelDisplayInfo(model.id);

  return (
    <div
      onClick={() => onSelect(model.id)}
      className={`cursor-pointer border rounded-lg p-4 transition-all hover:shadow-md ${
        isSelected
          ? 'border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className='flex items-start justify-between mb-2'>
        <div className='flex items-center space-x-2'>
          <Typography variant='h6' className='font-semibold'>
            {model.name}
          </Typography>
          <div className='flex items-center space-x-1'>
            {displayInfo?.badges.map((badge) => (
              <Badge
                key={badge}
                variant={(() => {
                  if (badge === 'Recommended') return 'default';
                  if (badge === 'New') return 'secondary';
                  return 'outline';
                })()}
                className='text-xs'
              >
                {badge}
              </Badge>
            ))}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <FiInfo className='w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help' />
          </TooltipTrigger>
          <TooltipContent>View detailed information</TooltipContent>
        </Tooltip>
      </div>

      <Typography
        variant='caption'
        color='muted'
        className='mb-3 leading-relaxed'
      >
        {model.description}
      </Typography>

      <div className='grid grid-cols-2 gap-4 mb-3'>
        <div>
          <Typography
            variant='caption'
            className='font-medium text-gray-700 dark:text-gray-300'
          >
            Context Window
          </Typography>
          <Typography variant='caption' color='muted'>
            {model.contextWindow}
          </Typography>
        </div>
        <div>
          <Typography
            variant='caption'
            className='font-medium text-gray-700 dark:text-gray-300'
          >
            Input Cost
          </Typography>
          <Typography variant='caption' color='muted'>
            {model.inputCost}
          </Typography>
        </div>
      </div>

      {model.bestFor && model.bestFor.length > 0 && (
        <div className='mb-3'>
          <Typography
            variant='caption'
            className='font-medium text-gray-700 dark:text-gray-300 mb-1'
          >
            Best For:
          </Typography>
          <div className='flex flex-wrap gap-1'>
            {model.bestFor.slice(0, 3).map((use) => (
              <span
                key={use}
                className='inline-block bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs'
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400'>
          {model.supportsVision && (
            <span className='flex items-center'>👁️ Vision</span>
          )}
          {model.supportsFunctionCalling && (
            <span className='flex items-center'>🔧 Functions</span>
          )}
        </div>
        <Typography variant='caption' color='muted'>
          Output: {model.outputCost}
        </Typography>
      </div>
    </div>
  );
};

export const ModelSelectorWithOpenRouter: React.FC<ModelSelectorProps> = ({
  provider,
  selectedModel,
  onModelChange,
  className = '',
  useOpenRouter = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLiveData, setShowLiveData] = useState(useOpenRouter);

  const {
    models: openRouterModels,
    isLoading,
    error,
    refetch,
  } = useOpenRouterModels({
    provider,
    autoLoad: showLiveData,
  });

  const staticModels = getModelsByProvider(provider);
  const models =
    showLiveData && openRouterModels.length > 0
      ? openRouterModels
      : staticModels;
  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  const recommendedModels = models.filter((m) => m.isRecommended);
  const otherModels = models.filter((m) => !m.isRecommended);

  if (!isExpanded) {
    return (
      <div className={className}>
        <div className='mb-2'>
          <Typography variant='body1' className='font-medium mb-1'>
            AI Model
          </Typography>
          <Typography variant='caption' color='muted'>
            Choose the AI model that best fits your needs and budget
          </Typography>
        </div>

        <div
          onClick={() => setIsExpanded(true)}
          className='cursor-pointer border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-colors'
        >
          <div className='flex items-center justify-between'>
            <div>
              <Typography variant='body1' className='font-medium'>
                {selectedModelInfo?.name || 'Select a model'}
              </Typography>
              {selectedModelInfo && (
                <Typography
                  variant='caption'
                  color='muted'
                  className='line-clamp-1'
                >
                  {selectedModelInfo.description}
                </Typography>
              )}
            </div>
            <FiChevronDown className='w-5 h-5 text-gray-500' />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <Typography variant='body1' className='font-medium mb-1'>
            Select AI Model
          </Typography>
          <Typography variant='caption' color='muted'>
            {showLiveData
              ? 'Live pricing from OpenRouter'
              : 'Choose the model that best fits your use case'}
          </Typography>
        </div>
        <div className='flex items-center space-x-2'>
          {useOpenRouter && (
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setShowLiveData(!showLiveData);
                  if (!showLiveData && openRouterModels.length === 0) {
                    refetch();
                  }
                }}
                disabled={isLoading}
              >
                {showLiveData ? 'Use Static' : 'Use Live Data'}
              </Button>
              {showLiveData && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => refetch(true)}
                  disabled={isLoading}
                >
                  <FiRefreshCw
                    className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                  />
                </Button>
              )}
            </div>
          )}
          <button
            onClick={() => setIsExpanded(false)}
            className='flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          >
            <span className='text-sm'>Collapse</span>
            <FiChevronUp className='w-4 h-4' />
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
          <Typography
            variant='caption'
            className='text-red-600 dark:text-red-400'
          >
            Failed to load live model data: {error}
          </Typography>
        </div>
      )}

      {isLoading ? (
        <div className='flex items-center justify-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue'></div>
        </div>
      ) : (
        <>
          {recommendedModels.length > 0 && (
            <div className='mb-6'>
              <Typography
                variant='h6'
                className='mb-3 text-green-700 dark:text-green-300'
              >
                ⭐ Recommended Models
              </Typography>
              <div className='space-y-3'>
                {recommendedModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    onSelect={onModelChange}
                  />
                ))}
              </div>
            </div>
          )}

          {otherModels.length > 0 && (
            <div>
              <Typography
                variant='h6'
                className='mb-3 text-gray-700 dark:text-gray-300'
              >
                Other Models
              </Typography>
              <div className='space-y-3'>
                {otherModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    onSelect={onModelChange}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
