/**
 * HCS-10 types and constants for the conversational agent app
 * We use the types and schemas directly from @hashgraphonline/standards-sdk
 */
import { 
  AIAgentCapability,
  AIAgentType,
  ProfileType,
  BaseProfileSchema,
  PersonalProfileSchema,
  AIAgentProfileSchema,
  HCS11ProfileSchema,
  type HCS11Profile,
  type AIAgentProfile,
  type PersonalProfile,
} from '@hashgraphonline/standards-sdk';
import { z } from 'zod';

/**
 * Map our UI capability values to AIAgentCapability enum values
 */
export const tagToCapabilityMap: Record<string, AIAgentCapability> = {
  'text-generation': AIAgentCapability.TEXT_GENERATION,
  'data-integration': AIAgentCapability.DATA_INTEGRATION,
  'analytics': AIAgentCapability.MARKET_INTELLIGENCE,
  'automation': AIAgentCapability.WORKFLOW_AUTOMATION,
  'natural-language': AIAgentCapability.LANGUAGE_TRANSLATION,
  'image-generation': AIAgentCapability.IMAGE_GENERATION,
  'code-generation': AIAgentCapability.CODE_GENERATION,
  'translation': AIAgentCapability.LANGUAGE_TRANSLATION,
  'summarization': AIAgentCapability.SUMMARIZATION_EXTRACTION,
  'api-integration': AIAgentCapability.API_INTEGRATION,
};

/**
 * UI-specific form schema that extends the base profile schema
 * This is only for UI-specific fields that don't exist in HCS-11
 */
export const HCS10ProfileFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  profileType: z.enum(['person', 'aiAgent']),
  alias: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  creator: z.string().min(2, 'Creator must be at least 2 characters'),
  version: z.string().min(1, 'Version is required'),
  
  agentType: z.enum(['autonomous', 'manual']).optional(),
  capabilities: z.array(z.string()),
  
  socials: z.object({
    twitter: z.string().optional(),
    github: z.string().optional(),
    website: z.string().optional(),
  }).optional(),
  
  profileImage: z.string().optional(),
  logo: z.string().optional(),
  profileImageFile: z.object({
    data: z.string(),
    name: z.string(),
    type: z.string(),
  }).optional(),
  
  feeConfiguration: z.object({
    hbarFee: z.number().optional(),
    tokenFee: z.object({
      tokenId: z.string(),
      amount: z.number(),
    }).optional(),
  }).optional(),
  customProperties: z.record(z.string(), z.unknown()).optional(),
});

export const HCS10ProfileSchema = HCS10ProfileFormSchema;

/**
 * Form data type
 */
export type HCS10ProfileFormData = z.infer<typeof HCS10ProfileFormSchema>;

/**
 * Transform function to convert form data to HCS-11 profile format
 */
export function formDataToHCS11Profile(formData: HCS10ProfileFormData): HCS11Profile {
  const baseProfile = {
    version: formData.version || '1.0',
    display_name: formData.name,
    alias: formData.alias,
    bio: formData.description,
    profileImage: formData.profileImage || formData.logo,
    properties: formData.customProperties,
    socials: formData.socials ? 
      Object.entries(formData.socials)
        .filter(([_, value]) => value)
        .map(([platform, handle]) => ({
          platform: platform as 'twitter' | 'github' | 'website',
          handle: handle!
        }))
      : undefined,
  };

  if (formData.profileType === 'person') {
    return {
      ...baseProfile,
      type: ProfileType.PERSONAL,
    } as PersonalProfile;
  } else {
    const capabilities = formData.capabilities.map(cap => 
      tagToCapabilityMap[cap] || AIAgentCapability.TEXT_GENERATION
    );

    return {
      ...baseProfile,
      type: ProfileType.AI_AGENT,
      aiAgent: {
        type: formData.agentType === 'autonomous' ? AIAgentType.AUTONOMOUS : AIAgentType.MANUAL,
        capabilities,
        model: formData.creator,
        creator: formData.creator,
      }
    } as AIAgentProfile;
  }
}

/**
 * Response from HCS-10 registration
 */
export interface HCS10ProfileResponse {
  success: boolean;
  accountId: string;
  transactionId: string;
  timestamp: string;
  profileUrl?: string;
  metadata?: {
    name: string;
    description: string;
    capabilities: string[];
    socials?: {
      twitter?: string;
      github?: string;
      website?: string;
    };
    profileImage?: string;
    feeConfiguration?: HCS10ProfileFormData['feeConfiguration'];
  };
}

/**
 * Stored profile data
 */
export interface StoredHCS10Profile {
  id: string;
  accountId: string;
  name: string;
  description: string;
  capabilities: string[];
  socials?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
  profileImage?: string;
  feeConfiguration?: HCS10ProfileFormData['feeConfiguration'];
  registeredAt: Date;
  lastUpdated: Date;
  status: 'active' | 'inactive' | 'pending';
}

/**
 * Predefined capability options for HCS-10 agents
 */
export const CAPABILITY_OPTIONS = [
  { value: 'text-generation', label: 'Text Generation' },
  { value: 'data-integration', label: 'Data Integration' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'automation', label: 'Automation' },
  { value: 'natural-language', label: 'Natural Language Processing' },
  { value: 'image-generation', label: 'Image Generation' },
  { value: 'code-generation', label: 'Code Generation' },
  { value: 'translation', label: 'Translation' },
  { value: 'summarization', label: 'Summarization' },
  { value: 'api-integration', label: 'API Integration' }
] as const;

/**
 * Social platform configuration for UI
 */
export const SOCIAL_PLATFORMS = [
  { value: 'twitter', label: 'Twitter', placeholder: '@username' },
  { value: 'github', label: 'GitHub', placeholder: 'username' },
  { value: 'website', label: 'Website', placeholder: 'https://example.com' }
] as const;