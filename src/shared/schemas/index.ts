import { z } from 'zod';

export const CredentialSchema = z.object({
  service: z.string().min(1),
  account: z.string().min(1),
  password: z.string().min(1),
});

export const CredentialRequestSchema = z.object({
  service: z.string().min(1),
  account: z.string().min(1),
});

export const ConfigurationSchema = z.object({
  apiEndpoint: z.string().url().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  autoStart: z.boolean().optional(),
  minimizeToTray: z.boolean().optional(),
  autonomousMode: z.boolean().default(false).optional(),
  legalAcceptance: z.object({
    termsAccepted: z.boolean().default(false),
    privacyAccepted: z.boolean().default(false),
    acceptedAt: z.string().datetime().optional(),
  }).default({ termsAccepted: false, privacyAccepted: false }).optional(),
});

export const IPCMessageSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('credential:store'),
    data: CredentialSchema,
  }),
  z.object({
    channel: z.literal('credential:get'),
    data: CredentialRequestSchema,
  }),
  z.object({
    channel: z.literal('credential:delete'),
    data: CredentialRequestSchema,
  }),
  z.object({
    channel: z.literal('credential:clear'),
    data: z.object({}),
  }),
  z.object({
    channel: z.literal('config:get'),
    data: z.object({
      key: z.string().optional(),
    }),
  }),
  z.object({
    channel: z.literal('config:set'),
    data: ConfigurationSchema,
  }),
]);

export const IPCResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type Credential = z.infer<typeof CredentialSchema>;
export type CredentialRequest = z.infer<typeof CredentialRequestSchema>;
export type Configuration = z.infer<typeof ConfigurationSchema>;
export type IPCMessage = z.infer<typeof IPCMessageSchema>;
export type IPCResponse = z.infer<typeof IPCResponseSchema>;

export * from './hcs10';