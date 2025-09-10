jest.mock('../../../src/main/utils/logger');

import fetch from 'node-fetch';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const mockResponse = {
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient model',
        context_length: 200000,
        pricing: {
          prompt: '0.25',
          completion: '1.25'
        },
        top_provider: {
          context_length: 200000,
          max_completion_tokens: 4096,
          is_moderated: false
        },
        architecture: {
          tokenizer: 'Anthropic',
          instruct_type: 'claude'
        },
        per_request_limits: null
      }
    ]
  })
};

import { OpenRouterService, OpenRouterModel } from '../../../src/main/services/open-router-service';

describe('OpenRouterService', () => {
  let openRouterService: OpenRouterService;

  const mockModelsResponse: OpenRouterModel[] = [
    {
      id: 'anthropic/claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fast and efficient model',
      context_length: 200000,
      pricing: {
        prompt: '0.25',
        completion: '1.25'
      },
      top_provider: {
        context_length: 200000,
        max_completion_tokens: 4096,
        is_moderated: false
      },
      architecture: {
        tokenizer: 'Anthropic',
        instruct_type: 'claude',
        modality: 'text'
      },
      per_request_limits: {
        prompt_tokens: '200000',
        completion_tokens: '4096'
      }
    },
    {
      id: 'openai/gpt-4',
      name: 'GPT-4',
      description: 'Advanced reasoning model',
      context_length: 8192,
      pricing: {
        prompt: '0.03',
        completion: '0.06'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    OpenRouterService['instance'] = null;

    mockFetch.mockResolvedValue(mockResponse);

    openRouterService = OpenRouterService.getInstance();

    (openRouterService as any).modelsCache = null;
    (openRouterService as any).lastFetchTime = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = OpenRouterService.getInstance();
      const instance2 = OpenRouterService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should create new instance after reset', () => {
      const instance1 = OpenRouterService.getInstance();
      OpenRouterService['instance'] = null;
      const instance2 = OpenRouterService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getModels', () => {
    test('should fetch models from API on first call', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(models).toEqual(mockModelsResponse);
    });

    test('should return cached models on subsequent calls', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await openRouterService.getModels();
      const models = await openRouterService.getModels();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(models).toEqual(mockModelsResponse);
    });

    test('should force refresh when requested', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await openRouterService.getModels();
      await openRouterService.getModels(true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(openRouterService.getModels()).rejects.toThrow('OpenRouter API error: 500 Internal Server Error');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(openRouterService.getModels()).rejects.toThrow('Network error');
    });

    test('should handle malformed response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(openRouterService.getModels()).rejects.toThrow('Invalid response format from OpenRouter API');
    });
  });

  describe('getModelsByProvider', () => {
    test('should filter models by provider', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const anthropicModels = await openRouterService.getModelsByProvider('anthropic');

      expect(anthropicModels).toHaveLength(1);
      expect(anthropicModels[0].id).toBe('anthropic/claude-3-haiku');
    });

    test('should return empty array for unknown provider', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const unknownModels = await openRouterService.getModelsByProvider('unknown');

      expect(unknownModels).toEqual([]);
    });

    test('should handle case insensitive provider matching', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const anthropicModels = await openRouterService.getModelsByProvider('ANTHROPIC');

      expect(anthropicModels).toHaveLength(1);
      expect(anthropicModels[0].id).toBe('anthropic/claude-3-haiku');
    });

    test('should return all models if no models are cached', async () => {
      const emptyResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [] })
      };
      mockFetch.mockResolvedValueOnce(emptyResponse);

      const allModels = await openRouterService.getModelsByProvider('anthropic');

      expect(allModels).toEqual([]);
    });
  });

  describe('getModel', () => {
    test('should return specific model by ID', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const model = await openRouterService.getModel('anthropic/claude-3-haiku');

      expect(model).toEqual(mockModelsResponse[0]);
    });

    test('should return undefined for unknown model ID', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const model = await openRouterService.getModel('unknown/model');

      expect(model).toBeUndefined();
    });

    test('should return undefined if no models are cached', async () => {
      const emptyResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [] })
      };
      mockFetch.mockResolvedValueOnce(emptyResponse);

      const model = await openRouterService.getModel('anthropic/claude-3-haiku');

      expect(model).toBeUndefined();
    });

    test('should handle exact ID matching', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const model = await openRouterService.getModel('openai/gpt-4');

      expect(model).toEqual(mockModelsResponse[1]);
    });
  });

  describe('convertToInternalFormat', () => {
    let convertToInternalFormat: (model: OpenRouterModel) => any;

    beforeEach(() => {
      convertToInternalFormat = (openRouterService as any).convertToInternalFormat.bind(openRouterService);
    });

    test('should convert basic model information', () => {
      const converted = convertToInternalFormat(mockModelsResponse[0], 'anthropic');

      expect(converted).toEqual({
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient model',
        provider: 'anthropic',
        category: 'efficient',
        contextWindow: '200K tokens',
        inputCost: '$0.25/1M tokens',
        outputCost: '$1.25/1M tokens',
        strengths: ['Long context', 'Advanced reasoning', 'Fast responses', 'Cost-effective'],
        bestFor: ['High-volume applications', 'Cost-sensitive projects', 'Quick responses', 'Large documents', 'Extensive codebases'],
        supportsVision: false,
        supportsFunctionCalling: true,
        isRecommended: false,
        isNew: false
      });
    });

    test('should handle models without description', () => {
      const modelWithoutDesc = { ...mockModelsResponse[0] };
      delete modelWithoutDesc.description;

      const converted = convertToInternalFormat(modelWithoutDesc, 'anthropic');

      expect(converted.description).toBe('Fast and cost-effective model for everyday tasks');
    });

    test('should handle models without pricing', () => {
      const modelWithoutPricing = { ...mockModelsResponse[0] };
      delete modelWithoutPricing.pricing;

      const converted = convertToInternalFormat(modelWithoutPricing, 'anthropic');

      expect(converted.inputCost).toBe('$0.00/1M tokens');
      expect(converted.outputCost).toBe('$0.00/1M tokens');
    });

    test('should categorize GPT models correctly', () => {
      const gptModel = { ...mockModelsResponse[1] };

      const converted = convertToInternalFormat(gptModel, 'openai');

      expect(converted.provider).toBe('openai');
      expect(converted.category).toBe('efficient');
      expect(converted.strengths).toContain('Advanced reasoning');
    });

    test('should handle O1 models', () => {
      const o1Model = {
        ...mockModelsResponse[0],
        id: 'openai/o1-preview',
        name: 'O1 Preview'
      };

      const converted = convertToInternalFormat(o1Model, 'openai');

      expect(converted.category).toBe('efficient');
      expect(converted.strengths).toContain('Long context');
    });

    test('should handle vision models', () => {
      const visionModel = {
        ...mockModelsResponse[0],
        id: 'anthropic/claude-3-sonnet-vision',
        architecture: {
          ...mockModelsResponse[0].architecture,
          modality: 'multimodal'
        }
      };

      const converted = convertToInternalFormat(visionModel, 'anthropic');

      expect(converted.supportsVision).toBe(true);
    });

    test('should handle large context models', () => {
      const largeContextModel = {
        ...mockModelsResponse[0],
        context_length: 2000000
      };

      const converted = convertToInternalFormat(largeContextModel, 'anthropic');

      expect(converted.contextWindow).toBe('2M tokens');
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch timeout', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(openRouterService.getModels()).rejects.toThrow('Timeout');
    });

    test('should handle malformed JSON response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(openRouterService.getModels()).rejects.toThrow('Invalid JSON');
    });

    test('should handle rate limiting', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(openRouterService.getModels()).rejects.toThrow('OpenRouter API error: 429 Too Many Requests');
    });

    test('should handle unauthorized access', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(openRouterService.getModels()).rejects.toThrow('OpenRouter API error: 401 Unauthorized');
    });
  });

  describe('Caching Behavior', () => {
    test('should cache models for subsequent calls', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models1 = await openRouterService.getModels();
      const models2 = await openRouterService.getModels();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(models1).toBe(models2);
    });

    test('should invalidate cache on force refresh', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await openRouterService.getModels();
      await openRouterService.getModels(true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should handle cache with empty results', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [] })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(models).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete model discovery workflow', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const allModels = await openRouterService.getModels();
      expect(allModels).toHaveLength(2);

      const anthropicModels = await openRouterService.getModelsByProvider('anthropic');
      expect(anthropicModels).toHaveLength(1);

      const specificModel = await openRouterService.getModel('anthropic/claude-3-haiku');
      expect(specificModel).toBeDefined();
      expect(specificModel?.id).toBe('anthropic/claude-3-haiku');
    });

    test('should handle provider switching', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const anthropicModels = await openRouterService.getModelsByProvider('anthropic');
      const openaiModels = await openRouterService.getModelsByProvider('openai');

      expect(anthropicModels).toHaveLength(1);
      expect(openaiModels).toHaveLength(1);
      expect(anthropicModels[0].id).toContain('anthropic');
      expect(openaiModels[0].id).toContain('openai');
    });

    test('should handle model comparison', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      const claudeModel = models.find(m => m.id === 'anthropic/claude-3-haiku');
      const gptModel = models.find(m => m.id === 'openai/gpt-4');

      expect(claudeModel?.context_length).toBeGreaterThan(gptModel?.context_length || 0);
      expect(claudeModel?.pricing.prompt).toBe('0.25');
      expect(gptModel?.pricing.prompt).toBe('0.03');
    });
  });

  describe('Real-world Model Data', () => {
    test('should handle real OpenRouter model response format', async () => {
      const realResponse = {
        data: [
          {
            id: 'anthropic/claude-3-opus',
            name: 'Claude 3 Opus',
            description: 'Most intelligent model',
            context_length: 200000,
            pricing: {
              prompt: '15.00',
              completion: '75.00'
            },
            top_provider: {
              context_length: 200000,
              max_completion_tokens: 4096,
              is_moderated: false
            },
            architecture: {
              tokenizer: 'Anthropic',
              instruct_type: 'claude'
            }
          }
        ]
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(realResponse)
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('anthropic/claude-3-opus');
      expect(models[0].context_length).toBe(200000);
    });

    test('should handle models with missing optional fields', async () => {
      const minimalModel = {
        id: 'test/model',
        name: 'Test Model',
        context_length: 4096,
        pricing: {
          prompt: '0.01',
          completion: '0.02'
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [minimalModel] })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('test/model');
      expect(models[0].description).toBeUndefined();
      expect(models[0].top_provider).toBeUndefined();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle very large model lists', async () => {
      const largeModelList = Array.from({ length: 100 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        context_length: 4096,
        pricing: {
          prompt: '0.01',
          completion: '0.02'
        }
      }));

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: largeModelList })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(models).toHaveLength(100);
      expect(models[0].id).toBe('model-0');
      expect(models[99].id).toBe('model-99');
    });

    test('should handle models with special characters in names', async () => {
      const specialModel = {
        id: 'test/model-with-dashes',
        name: 'Model with (Parentheses) & Special [Chars]',
        context_length: 4096,
        pricing: {
          prompt: '0.01',
          completion: '0.02'
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [specialModel] })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const models = await openRouterService.getModels();

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Model with (Parentheses) & Special [Chars]');
    });

    test('should handle concurrent requests', async () => {
      (openRouterService as any).modelsCache = null;
      (openRouterService as any).lastFetchTime = 0;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: mockModelsResponse })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const promises = [
        openRouterService.getModels(),
        openRouterService.getModels(),
        openRouterService.getModels()
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(mockModelsResponse);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});


