import { z } from 'zod'

export const hederaConfigSchema = z.object({
  accountId: z
    .string()
    .min(1, 'Account ID is required')
    .regex(/^\d+\.\d+\.\d+$/, 'Invalid account ID format (e.g., 0.0.12345)'),
  privateKey: z
    .string()
    .min(1, 'Private key is required')
    .min(64, 'Invalid private key format'),
  network: z.enum(['mainnet', 'testnet'])
})

export const swarmConfigSchema = z.object({
  beeApiUrl: z
    .string()
    .min(1, 'Bee node or Gateway api URL is required'),
  beeFeedPK: z
    .string()
    .min(1, 'Private key is required')
    .min(64, 'Invalid private key format'),
  autoAssignStamp: z.boolean().default(true),
  deferredUploadSizeThresholdMB: z.number().default(5),
})

export const openAIConfigSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .startsWith('sk-', "API key must start with 'sk-'"),
  model: z.enum(['gpt-5', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'o4-mini'])
})

export const anthropicConfigSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .startsWith('sk-ant-', "API key must start with 'sk-ant-'"),
  model: z.enum(['claude-3-7-sonnet-latest', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'])
})

export const advancedConfigSchema = z.object({
  theme: z.enum(['light', 'dark']),
  autoStart: z.boolean(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  webBrowserPluginEnabled: z.boolean().optional().default(true)
})

export const appConfigSchema = z.object({
  hedera: hederaConfigSchema,
  openai: openAIConfigSchema,
  anthropic: anthropicConfigSchema,
  advanced: advancedConfigSchema,
  llmProvider: z.enum(['openai', 'anthropic'])
})

export type HederaConfigForm = z.infer<typeof hederaConfigSchema>
export type AdvancedConfigForm = z.infer<typeof advancedConfigSchema>
export type AppConfigForm = z.infer<typeof appConfigSchema>
