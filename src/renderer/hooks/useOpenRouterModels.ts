import { useState, useEffect, useCallback } from 'react';
import {
  ModelInfo,
  ALL_MODELS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
} from '../lib/models';

interface OpenRouterAPIModel {
  id: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality?: string;
  };
}

interface UseOpenRouterModelsOptions {
  provider?: 'openai' | 'anthropic';
  autoLoad?: boolean;
}

interface UseOpenRouterModelsReturn {
  models: ModelInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
}

export function useOpenRouterModels(options: UseOpenRouterModelsOptions = {}): UseOpenRouterModelsReturn {
  const { provider, autoLoad = true } = options;
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const desktopApi = typeof window === 'undefined' ? undefined : window.desktop;
      const hasProviderBridge = typeof desktopApi?.getOpenRouterModelsByProvider === 'function';
      const hasModelsBridge = typeof desktopApi?.getOpenRouterModels === 'function';

      if (provider && !hasProviderBridge) {
        const fallbackModels = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;
        setModels([...fallbackModels]);
        setIsLoading(false);
        return;
      }

      if (!provider && !hasModelsBridge) {
        setModels([...ALL_MODELS]);
        setIsLoading(false);
        return;
      }

      if (provider) {
        const response = await desktopApi?.getOpenRouterModelsByProvider?.(provider);
        if (response.success && response.data) {
          const data = response.data;
          if (isModelInfoArray(data)) {
            setModels(data);
          } else if (Array.isArray(data)) {
            const converted = convertRawModels(data as OpenRouterAPIModel[]).filter(
              (model) => model.provider === provider
            );
            setModels(converted);
          } else {
            throw new Error('Unexpected response format');
          }
        } else {
          throw new Error(response.error || 'Failed to fetch models');
        }
      } else {
        const response = await desktopApi?.getOpenRouterModels?.(forceRefresh);
        if (response.success && response.data) {
          const data = response.data;
          if (isModelInfoArray(data)) {
            setModels(data);
          } else if (Array.isArray(data)) {
            setModels(convertRawModels(data as OpenRouterAPIModel[]));
          } else {
            throw new Error('Unexpected response format');
          }
        } else {
          throw new Error(response.error || 'Failed to fetch models');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (autoLoad) {
      fetchModels();
    }
  }, [autoLoad, fetchModels]);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels
  };
}

function extractModelName(modelId: string): string {
  const parts = modelId.split('/');
  const modelName = parts[parts.length - 1];
  
  const nameMap: Record<string, string> = {
    'gpt-5': 'GPT-5',
    'gpt-4o': 'GPT-4o (Omni)',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku': 'Claude 3.5 Haiku',
    'claude-3-opus': 'Claude 3 Opus',
    'claude-3-sonnet': 'Claude 3 Sonnet',
    'claude-3-haiku': 'Claude 3 Haiku',
  };
  
  for (const [key, value] of Object.entries(nameMap)) {
    if (modelName.includes(key)) {
      return value;
    }
  }
  
  return modelName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function convertRawModels(models: OpenRouterAPIModel[]): ModelInfo[] {
  return models.map((model) => ({
    id: model.id,
    name: extractModelName(model.id),
    description: model.description || '',
    provider: determineProvider(model.id),
    category: determineCategory(model.id, model.pricing),
    contextWindow: formatContextWindow(model.context_length),
    inputCost: formatCost(model.pricing.prompt),
    outputCost: formatCost(model.pricing.completion),
    strengths: [],
    bestFor: [],
    supportsVision: model.architecture?.modality === 'multimodal',
    supportsFunctionCalling: true,
    isRecommended: false,
    isNew: false,
  }));
}

function isModelInfoArray(payload: unknown): payload is ModelInfo[] {
  return (
    Array.isArray(payload) &&
    payload.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'name' in item &&
        'provider' in item &&
        'contextWindow' in item
    )
  );
}

function determineProvider(modelId: string): 'openai' | 'anthropic' {
  if (modelId.includes('gpt') || modelId.includes('openai')) {
    return 'openai';
  }
  return 'anthropic';
}

function determineCategory(modelId: string, pricing: OpenRouterAPIModel['pricing']): 'flagship' | 'efficient' | 'legacy' | 'specialized' {
  const costPerMillion = parseFloat(pricing.prompt);
  
  if (modelId.includes('mini') || modelId.includes('haiku') || costPerMillion < 1) {
    return 'efficient';
  }
  if (modelId.includes('opus') || modelId.includes('gpt-4') || costPerMillion > 10) {
    return 'flagship';
  }
  if (modelId.includes('o1') || modelId.includes('reasoning')) {
    return 'specialized';
  }
  return 'flagship';
}

function formatContextWindow(contextLength: number): string {
  if (contextLength >= 1000000) {
    return `${contextLength / 1000000}M tokens`;
  }
  if (contextLength >= 1000) {
    return `${contextLength / 1000}K tokens`;
  }
  return `${contextLength} tokens`;
}

function formatCost(cost: string): string {
  const costNum = parseFloat(cost);
  return `$${costNum}/1M tokens`;
}
