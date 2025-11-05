import { z } from 'zod';
import type { AgentCreationState } from '@hashgraphonline/standards-sdk';

const socialsSchema = z.object({
  twitter: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
});

const profileImageFileSchema = z.object({
  data: z.string(),
  name: z.string(),
  type: z.string(),
});

const feeConfigurationSchema = z
  .object({
    hbarFee: z.number().optional(),
    tokenFee: z
      .object({
        tokenId: z.string(),
        amount: z.number(),
      })
      .optional(),
  })
  .optional();

export const HCS10ProfileSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  profileType: z.enum(['person', 'aiAgent']),
  alias: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  creator: z.string().min(2, 'Creator must be at least 2 characters'),
  version: z.string().min(1, 'Version is required'),
  agentType: z.enum(['autonomous', 'manual']).optional(),
  capabilities: z.array(z.string()),
  socials: socialsSchema.optional(),
  profileImage: z.string().optional(),
  logo: z.string().optional(),
  profileImageFile: profileImageFileSchema.optional(),
  feeConfiguration: feeConfigurationSchema,
  customProperties: z.record(z.string(), z.unknown()).optional(),
});

export type HCS10ProfileFormData = z.infer<typeof HCS10ProfileSchema>;

export const HederaCredentialsSchema = z.object({
  accountId: z.string().min(1, 'Hedera account ID is required'),
  privateKey: z.string().min(1, 'Hedera private key is required'),
  network: z.string().optional(),
});

export type HederaCredentials = z.infer<typeof HederaCredentialsSchema>;

const agentCreationStateSchema = z.object({
  pfpTopicId: z.string().optional(),
  inboundTopicId: z.string().optional(),
  outboundTopicId: z.string().optional(),
  profileTopicId: z.string().optional(),
  currentStage: z.enum(['init', 'pfp', 'topics', 'profile', 'registration', 'complete']),
  completedPercentage: z.number(),
  error: z.string().optional(),
  createdResources: z.array(z.string()).optional(),
  agentMetadata: z.record(z.unknown()).optional(),
});

const registerOptionsSchema = z
  .object({
    isAutonomous: z.boolean().optional(),
    existingState: agentCreationStateSchema.optional(),
  })
  .optional();

const registerProfilePayloadSchema = z.object({
  profileData: HCS10ProfileSchema,
  hedera: HederaCredentialsSchema,
  options: registerOptionsSchema,
});

const retrieveProfilePayloadSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  hedera: HederaCredentialsSchema,
});

export type RegisterProfilePayload = z.infer<typeof registerProfilePayloadSchema>;
export type RetrieveProfilePayload = z.infer<typeof retrieveProfilePayloadSchema>;

function formatIssues(issues: readonly z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.join('.') || 'payload';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function assertRegisterProfilePayload(payload: unknown): RegisterProfilePayload {
  const result = registerProfilePayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid register profile payload: ${formatIssues(result.error.issues)}`);
  }
  return result.data;
}

export function assertRetrieveProfilePayload(payload: unknown): RetrieveProfilePayload {
  const result = retrieveProfilePayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid retrieve profile payload: ${formatIssues(result.error.issues)}`);
  }
  return result.data;
}
