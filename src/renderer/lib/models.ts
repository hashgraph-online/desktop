/**
 * Comprehensive model information for AI providers
 */

export interface ModelInfo {
  id: string
  name: string
  description: string
  provider: 'openai' | 'anthropic'
  category: 'flagship' | 'efficient' | 'legacy' | 'specialized'
  contextWindow: string
  inputCost: string
  outputCost: string
  strengths: string[]
  bestFor: string[]
  knowledgeCutoff?: string
  supportsVision?: boolean
  supportsFunctionCalling?: boolean
  isRecommended?: boolean
  isNew?: boolean
}

export const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Latest flagship model with major improvements in coding, instruction following, and long-context understanding. Supports up to 1M context tokens.',
    provider: 'openai',
    category: 'flagship',
    contextWindow: '1M tokens',
    inputCost: '$10/1M tokens',
    outputCost: '$30/1M tokens',
    strengths: ['Long context', 'Advanced reasoning', 'Superior coding', 'Complex instructions'],
    bestFor: ['Large codebases', 'Complex reasoning', 'Long documents', 'Advanced coding tasks'],
    knowledgeCutoff: 'June 2024',
    supportsVision: true,
    supportsFunctionCalling: true,
    isRecommended: true,
    isNew: true
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Efficient version of GPT-4.1 with excellent performance at a lower cost.',
    provider: 'openai',
    category: 'efficient',
    contextWindow: '128K tokens',
    inputCost: '$1.50/1M tokens',
    outputCost: '$6/1M tokens',
    strengths: ['Cost-effective', 'Fast responses', 'Good reasoning', 'Function calling'],
    bestFor: ['Production apps', 'Frequent API calls', 'Chatbots', 'Content generation'],
    knowledgeCutoff: 'June 2024',
    supportsVision: true,
    supportsFunctionCalling: true,
    isNew: true
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    description: 'Compact version optimized for speed and efficiency.',
    provider: 'openai',
    category: 'efficient',
    contextWindow: '32K tokens',
    inputCost: '$0.25/1M tokens',
    outputCost: '$1/1M tokens',
    strengths: ['Ultra-fast', 'Very low cost', 'Lightweight', 'Quick responses'],
    bestFor: ['Simple tasks', 'Quick responses', 'High-volume applications', 'Basic chat'],
    knowledgeCutoff: 'June 2024',
    supportsFunctionCalling: true,
    isNew: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    description: 'Multimodal flagship model that is faster and more affordable than GPT-4 Turbo, with strong vision capabilities.',
    provider: 'openai',
    category: 'flagship',
    contextWindow: '128K tokens',
    inputCost: '$5/1M tokens',
    outputCost: '$15/1M tokens',
    strengths: ['Multimodal', 'Vision analysis', 'Fast responses', 'Balanced performance'],
    bestFor: ['Vision tasks', 'Image analysis', 'General purpose', 'Creative work'],
    knowledgeCutoff: 'October 2023',
    supportsVision: true,
    supportsFunctionCalling: true,
    isRecommended: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Most cost-efficient model with strong performance, 60% cheaper than GPT-3.5 Turbo.',
    provider: 'openai',
    category: 'efficient',
    contextWindow: '128K tokens',
    inputCost: '$0.15/1M tokens',
    outputCost: '$0.60/1M tokens',
    strengths: ['Extremely cost-effective', 'Good reasoning', 'Multimodal', 'Function calling'],
    bestFor: ['High-volume apps', 'Cost-sensitive projects', 'Prototyping', 'Basic tasks'],
    knowledgeCutoff: 'October 2023',
    supportsVision: true,
    supportsFunctionCalling: true,
    isRecommended: true
  },
  {
    id: 'o4-mini',
    name: 'O4-mini',
    description: 'Specialized reasoning model optimized for math, coding, and visual problem-solving tasks.',
    provider: 'openai',
    category: 'specialized',
    contextWindow: '200K tokens',
    inputCost: '$3/1M tokens',
    outputCost: '$12/1M tokens',
    strengths: ['Advanced reasoning', 'Math expertise', 'Coding problems', 'Visual analysis'],
    bestFor: ['Mathematical problems', 'Code debugging', 'Complex reasoning', 'Educational tasks'],
    knowledgeCutoff: 'June 2024',
    supportsVision: true,
    supportsFunctionCalling: true
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Previous generation flagship model with excellent capabilities for complex tasks.',
    provider: 'openai',
    category: 'legacy',
    contextWindow: '8K tokens',
    inputCost: '$30/1M tokens',
    outputCost: '$60/1M tokens',
    strengths: ['High quality', 'Complex reasoning', 'Creative tasks', 'Reliable'],
    bestFor: ['High-quality outputs', 'Complex analysis', 'Creative writing', 'Professional tasks'],
    knowledgeCutoff: 'April 2023',
    supportsFunctionCalling: true
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Cost-effective model suitable for simpler tasks and high-volume applications.',
    provider: 'openai',
    category: 'legacy',
    contextWindow: '16K tokens',
    inputCost: '$0.50/1M tokens',
    outputCost: '$1.50/1M tokens',
    strengths: ['Very affordable', 'Fast responses', 'Simple tasks', 'JSON mode'],
    bestFor: ['Simple chatbots', 'Basic content', 'Prototyping', 'High-volume tasks'],
    knowledgeCutoff: 'September 2021',
    supportsFunctionCalling: true
  }
]

export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Latest flagship model with exceptional coding abilities and reasoning. Sets new industry benchmarks across multiple domains.',
    provider: 'anthropic',
    category: 'flagship',
    contextWindow: '200K tokens',
    inputCost: '$3/1M tokens',
    outputCost: '$15/1M tokens',
    strengths: ['Superior coding', 'Advanced reasoning', 'Fast responses', 'Complex instructions'],
    bestFor: ['Software development', 'Complex analysis', 'Creative writing', 'Professional tasks'],
    knowledgeCutoff: 'April 2024',
    supportsVision: true,
    supportsFunctionCalling: true,
    isRecommended: true
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and cost-effective model that matches Claude 3 Opus performance at similar speed to previous Haiku.',
    provider: 'anthropic',
    category: 'efficient',
    contextWindow: '200K tokens',
    inputCost: '$0.80/1M tokens',
    outputCost: '$4/1M tokens',
    strengths: ['Fast responses', 'Cost-effective', 'Good reasoning', 'Coding skills'],
    bestFor: ['Real-time applications', 'Cost-sensitive projects', 'Quick responses', 'Coding tasks'],
    knowledgeCutoff: 'July 2024',
    supportsVision: true,
    supportsFunctionCalling: true,
    isRecommended: true
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most capable model from the previous generation, excellent for highly complex tasks requiring deep analysis.',
    provider: 'anthropic',
    category: 'legacy',
    contextWindow: '200K tokens',
    inputCost: '$15/1M tokens',
    outputCost: '$75/1M tokens',
    strengths: ['Highest intelligence', 'Complex reasoning', 'Creative tasks', 'Analysis'],
    bestFor: ['Research', 'Complex analysis', 'Creative projects', 'Strategic planning'],
    knowledgeCutoff: 'August 2023',
    supportsVision: true,
    supportsFunctionCalling: true
  }
]

export const ALL_MODELS = [...OPENAI_MODELS, ...ANTHROPIC_MODELS]

/**
 * Get model information by ID
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return ALL_MODELS.find(model => model.id === modelId)
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: 'openai' | 'anthropic'): ModelInfo[] {
  return ALL_MODELS.filter(model => model.provider === provider)
}

/**
 * Get recommended models
 */
export function getRecommendedModels(): ModelInfo[] {
  return ALL_MODELS.filter(model => model.isRecommended)
}

/**
 * Get new models
 */
export function getNewModels(): ModelInfo[] {
  return ALL_MODELS.filter(model => model.isNew)
}

/**
 * Format cost string for display
 */
export function formatCost(cost: string): string {
  return cost
}

/**
 * Get model display name with badges
 */
export function getModelDisplayInfo(modelId: string) {
  const model = getModelInfo(modelId)
  if (!model) return null
  
  return {
    ...model,
    badges: [
      ...(model.isNew ? ['New'] : []),
      ...(model.isRecommended ? ['Recommended'] : []),
      model.category === 'flagship' ? 'Flagship' : 
      model.category === 'efficient' ? 'Efficient' : 
      model.category === 'specialized' ? 'Specialized' : null
    ].filter(Boolean)
  }
}