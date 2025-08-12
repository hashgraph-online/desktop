import { Logger } from '../utils/logger';

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    tokenizer: string;
    instruct_type?: string;
    modality?: string;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export class OpenRouterService {
  private static instance: OpenRouterService;
  private logger: Logger;
  private modelsCache: OpenRouterModel[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000;

  private constructor() {
    this.logger = new Logger({ module: 'OpenRouterService' });
  }

  static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  /**
   * Fetch all available models from OpenRouter
   */
  async getModels(forceRefresh = false): Promise<OpenRouterModel[]> {
    try {
      const now = Date.now();

      if (
        !forceRefresh &&
        this.modelsCache &&
        now - this.cacheTimestamp < this.CACHE_DURATION
      ) {
        this.logger.debug('Returning cached models');
        return this.modelsCache;
      }

      this.logger.info('Fetching models from OpenRouter API');

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }

      const data: OpenRouterModelsResponse = await response.json();

      this.modelsCache = data.data;
      this.cacheTimestamp = now;

      this.logger.info(`Fetched ${data.data.length} models from OpenRouter`);

      return data.data;
    } catch (error) {
      this.logger.error('Failed to fetch models from OpenRouter:', error);

      if (this.modelsCache) {
        this.logger.warn('Returning stale cache due to error');
        return this.modelsCache;
      }

      throw error;
    }
  }

  /**
   * Get models by provider
   */
  async getModelsByProvider(provider: string): Promise<OpenRouterModel[]> {
    const allModels = await this.getModels();
    const providerPrefix = this.getProviderPrefix(provider);

    return allModels.filter((model) =>
      model.id.toLowerCase().startsWith(providerPrefix.toLowerCase())
    );
  }

  /**
   * Get a specific model by ID
   */
  async getModel(modelId: string): Promise<OpenRouterModel | undefined> {
    const allModels = await this.getModels();
    return allModels.find((model) => model.id === modelId);
  }

  /**
   * Convert OpenRouter model to our internal format
   */
  convertToInternalFormat(
    model: OpenRouterModel,
    provider: 'openai' | 'anthropic'
  ): any {
    const name = this.extractModelName(model.id);
    const category = this.determineCategory(model.id, model.pricing);

    return {
      id: model.id,
      name: name,
      description: model.description || this.generateDescription(model.id),
      provider: provider,
      category: category,
      contextWindow: this.formatContextWindow(model.context_length),
      inputCost: this.formatCost(model.pricing.prompt),
      outputCost: this.formatCost(model.pricing.completion),
      strengths: this.determineStrengths(model),
      bestFor: this.determineBestFor(model, category),
      supportsVision: model.architecture?.modality === 'multimodal',
      supportsFunctionCalling: this.supportsFunctionCalling(model.id),
      isRecommended: this.isRecommended(model.id),
      isNew: this.isNew(model.id),
    };
  }

  private getProviderPrefix(provider: string): string {
    const prefixes: Record<string, string> = {
      openai: 'openai/',
      anthropic: 'anthropic/',
      google: 'google/',
      meta: 'meta-llama/',
    };
    return prefixes[provider] || provider;
  }

  private extractModelName(modelId: string): string {
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1];

    const nameMap: Record<string, string> = {
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

    return modelName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private determineCategory(modelId: string, pricing: any): string {
    const costPerMillion = parseFloat(pricing.prompt);

    if (
      modelId.includes('mini') ||
      modelId.includes('haiku') ||
      costPerMillion < 1
    ) {
      return 'efficient';
    }
    if (
      modelId.includes('opus') ||
      modelId.includes('gpt-4') ||
      costPerMillion > 10
    ) {
      return 'flagship';
    }
    if (modelId.includes('o1') || modelId.includes('reasoning')) {
      return 'specialized';
    }
    return 'flagship';
  }

  private formatContextWindow(contextLength: number): string {
    if (contextLength >= 1000000) {
      return `${contextLength / 1000000}M tokens`;
    }
    if (contextLength >= 1000) {
      return `${contextLength / 1000}K tokens`;
    }
    return `${contextLength} tokens`;
  }

  private formatCost(cost: string): string {
    const costNum = parseFloat(cost);
    return `$${costNum}/1M tokens`;
  }

  private determineStrengths(model: OpenRouterModel): string[] {
    const strengths: string[] = [];
    const modelId = model.id.toLowerCase();

    if (model.context_length >= 100000) {
      strengths.push('Long context');
    }
    if (modelId.includes('gpt-4') || modelId.includes('claude')) {
      strengths.push('Advanced reasoning');
    }
    if (modelId.includes('mini') || modelId.includes('haiku')) {
      strengths.push('Fast responses', 'Cost-effective');
    }
    if (model.architecture?.modality === 'multimodal') {
      strengths.push('Vision capabilities');
    }
    if (modelId.includes('sonnet') || modelId.includes('gpt-4')) {
      strengths.push('Superior coding');
    }

    return strengths;
  }

  private determineBestFor(model: OpenRouterModel, category: string): string[] {
    const bestFor: string[] = [];

    if (category === 'efficient') {
      bestFor.push(
        'High-volume applications',
        'Cost-sensitive projects',
        'Quick responses'
      );
    } else if (category === 'flagship') {
      bestFor.push(
        'Complex analysis',
        'Software development',
        'Creative writing'
      );
    }

    if (model.context_length >= 100000) {
      bestFor.push('Large documents', 'Extensive codebases');
    }

    return bestFor;
  }

  private generateDescription(modelId: string): string {
    if (modelId.includes('gpt-4o')) {
      return 'Multimodal model with vision capabilities and optimized performance';
    }
    if (modelId.includes('claude-3-5-sonnet')) {
      return 'Advanced model with exceptional coding and reasoning abilities';
    }
    if (modelId.includes('mini') || modelId.includes('haiku')) {
      return 'Fast and cost-effective model for everyday tasks';
    }
    return 'Advanced language model for various tasks';
  }

  private supportsFunctionCalling(modelId: string): boolean {
    const supportedPrefixes = ['openai/', 'anthropic/', 'google/'];
    return supportedPrefixes.some((prefix) => modelId.startsWith(prefix));
  }

  private isRecommended(modelId: string): boolean {
    const recommended = [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3-5-sonnet',
      'anthropic/claude-3-5-haiku',
    ];
    return recommended.includes(modelId);
  }

  private isNew(modelId: string): boolean {
    const newModels = [
      'gpt-4o-2024-11-20',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];
    return newModels.some((model) => modelId.includes(model));
  }
}
