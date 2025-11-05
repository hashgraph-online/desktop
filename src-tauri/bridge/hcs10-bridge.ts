

import { createInterface } from './stubs/readline-stub';

import {
  AgentBuilder,
  AIAgentCapability,
  HCS10Client,
  InboundTopicType,
  PersonBuilder,
  type CreateAgentResponse,
  type InscribeProfileResponse,
  type RegistrationProgressData,
} from '@hashgraphonline/standards-sdk';
import {
  HCS10ProfileSchema,
  type HCS10ProfileFormData,
  type HederaCredentials,
  assertRegisterProfilePayload,
  assertRetrieveProfilePayload,
} from './hcs10-schemas';

interface BridgeRequest {
  readonly id?: number;
  readonly action:
    | 'hcs10_register_profile'
    | 'hcs10_validate_profile'
    | 'hcs10_retrieve_profile'
    | 'hcs10_cancel_registration';
  readonly payload?: Record<string, unknown>;
}

interface BridgeResponse {
  readonly id: number | null;
  readonly type?: 'progress' | 'result';
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

type CancelledProgressData = {
  readonly stage: 'cancelled';
  readonly message: string;
  readonly progressPercent?: number;
  readonly details?: Record<string, unknown>;
};

type ProgressPayload = (RegistrationProgressData | CancelledProgressData) & {
  readonly timestamp: string;
  readonly profileName: string;
};

type ProgressEmitter = (progress: ProgressPayload) => void;

const tagToCapabilityMap: Record<string, AIAgentCapability> = {
  'text-generation': AIAgentCapability.TEXT_GENERATION,
  'data-integration': AIAgentCapability.DATA_INTEGRATION,
  analytics: AIAgentCapability.MARKET_INTELLIGENCE,
  automation: AIAgentCapability.WORKFLOW_AUTOMATION,
  'natural-language': AIAgentCapability.LANGUAGE_TRANSLATION,
  'image-generation': AIAgentCapability.IMAGE_GENERATION,
  'code-generation': AIAgentCapability.CODE_GENERATION,
  translation: AIAgentCapability.LANGUAGE_TRANSLATION,
  summarization: AIAgentCapability.SUMMARIZATION_EXTRACTION,
  'api-integration': AIAgentCapability.API_INTEGRATION,
};

let currentAbortController: AbortController | null = null;
let currentProfileName: string | null = null;

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let request: BridgeRequest;
  try {
    request = JSON.parse(trimmed) as BridgeRequest;
  } catch (error) {
    send({
      id: null,
      type: 'result',
      success: false,
      error: `Invalid JSON request: ${(error as Error).message}`,
    });
    return;
  }

  try {
    switch (request.action) {
      case 'hcs10_register_profile':
        await handleRegisterProfile(request);
        break;
      case 'hcs10_validate_profile':
        await handleValidateProfile(request);
        break;
      case 'hcs10_retrieve_profile':
        await handleRetrieveProfile(request);
        break;
      case 'hcs10_cancel_registration':
        await handleCancelRegistration(request);
        break;
      default:
        send({
          id: request.id ?? null,
          type: 'result',
          success: false,
          error: `Unknown action: ${request.action}`,
        });
    }
  } catch (error) {
    send({
      id: request.id ?? null,
      type: 'result',
      success: false,
      error: (error as Error).message ?? String(error),
    });
  }
});

function send(message: BridgeResponse): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function resolveNetwork(network?: string): 'mainnet' | 'testnet' {
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}

function slugifyName(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
}

function mapCapabilities(capabilities: readonly string[] = []): AIAgentCapability[] {
  return capabilities.map(
    (cap) => tagToCapabilityMap[cap] ?? AIAgentCapability.TEXT_GENERATION
  );
}

function isFailureResponse(value: unknown): value is { success: false; error?: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (value as { success?: unknown }).success === false;
}

function buildAgentBuilder(
  profileData: HCS10ProfileFormData,
  hedera: HederaCredentials,
  isAutonomous: boolean
): AgentBuilder {
  const builder = new AgentBuilder()
    .setName(profileData.name)
    .setAlias(profileData.alias || slugifyName(profileData.name))
    .setBio(profileData.description || '')
    .setCapabilities(mapCapabilities(profileData.capabilities))
    .setType(isAutonomous ? 'autonomous' : 'manual')
    .setModel('conversational-agent-2024')
    .setNetwork(resolveNetwork(hedera.network))
    .setInboundTopicType(
      profileData.feeConfiguration?.hbarFee
        ? InboundTopicType.FEE_BASED
        : InboundTopicType.PUBLIC
    )
    .setExistingAccount(hedera.accountId, hedera.privateKey);

  if (profileData.socials) {
    Object.entries(profileData.socials).forEach(([platform, handle]) => {
      if (handle) {
        builder.addSocial(platform as any, handle);
      }
    });
  }

  if (profileData.customProperties) {
    Object.entries(profileData.customProperties).forEach(([key, value]) => {
      if (value != null && value !== '') {
        builder.addProperty(key, String(value));
      }
    });
  }

  const imageBuffer = extractProfilePicture(profileData);
  if (imageBuffer) {
    builder.setProfilePicture(imageBuffer.buffer, imageBuffer.filename);
  }

  return builder;
}

function buildPersonBuilder(profileData: HCS10ProfileFormData): PersonBuilder {
  const builder = new PersonBuilder()
    .setName(profileData.name)
    .setAlias(profileData.alias || slugifyName(profileData.name))
    .setBio(profileData.description || '');

  if (profileData.socials) {
    Object.entries(profileData.socials).forEach(([platform, handle]) => {
      if (handle) {
        builder.addSocial(platform as any, handle);
      }
    });
  }

  if (profileData.customProperties) {
    Object.entries(profileData.customProperties).forEach(([key, value]) => {
      if (value != null && value !== '') {
        builder.addProperty(key, String(value));
      }
    });
  }

  const imageBuffer = extractProfilePicture(profileData);
  if (imageBuffer) {
    builder.setProfilePicture(imageBuffer.buffer, imageBuffer.filename);
  }

  return builder;
}

function extractProfilePicture(
  profileData: HCS10ProfileFormData
): { buffer: Buffer; filename: string } | null {
  if (profileData.profileImageFile?.data && profileData.profileImageFile.name) {
    const raw = profileData.profileImageFile.data;
    const base64Data = raw.includes(',') ? raw.split(',')[1] : raw;
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      return { buffer, filename: profileData.profileImageFile.name };
    } catch (error) {
      send({
        id: null,
        type: 'result',
        success: false,
        error: `Failed to decode profile image: ${(error as Error).message}`,
      });
    }
  }

  return null;
}

async function handleRegisterProfile(request: BridgeRequest): Promise<void> {
  const payload = assertRegisterProfilePayload(request.payload);

  if (currentAbortController) {
    throw new Error('Another registration is already in progress');
  }

  const profileData = payload.profileData;
  const hedera = payload.hedera;
  const options = payload.options ?? {};
  const isAutonomous = Boolean(options.isAutonomous);
  const existingState = options.existingState;

  const client = new HCS10Client({
    network: resolveNetwork(hedera.network),
    operatorId: hedera.accountId,
    operatorPrivateKey: hedera.privateKey,
    logLevel: 'info',
    prettyPrint: false,
  });

  const builder =
    profileData.profileType === 'person'
      ? buildPersonBuilder(profileData)
      : buildAgentBuilder(profileData, hedera, isAutonomous);

  const controller = new AbortController();
  currentAbortController = controller;
  currentProfileName = profileData.name;

  const emitProgress: ProgressEmitter = (progress) => {
    send({
      id: request.id ?? null,
      type: 'progress',
      success: true,
      data: progress,
    });
  };

  try {
    let abortHandler: (() => void) | null = null;
    const registrationPromise = client.create(builder, {
      existingState,
      progressCallback: (data: RegistrationProgressData) => {
        emitProgress({
          ...data,
          timestamp: new Date().toISOString(),
          profileName: profileData.name,
        });
      },
    });

    const abortPromise = new Promise<never>((_, reject) => {
      const handleAbort = () => {
        controller.signal.removeEventListener('abort', handleAbort);
        const abortError = new Error('Registration cancelled');
        abortError.name = 'AbortError';
        reject(abortError);
      };
      abortHandler = handleAbort;
      controller.signal.addEventListener('abort', handleAbort);
    });

    const result = await Promise.race([registrationPromise, abortPromise]);

    if (abortHandler) {
      controller.signal.removeEventListener('abort', abortHandler);
    }

    if (isFailureResponse(result)) {
      throw new Error(result.error || 'HCS10 profile registration failed');
    }

    const network = resolveNetwork(hedera.network);
    const accountId = hedera.accountId;
    let transactionId = 'N/A';
    let profileTopicId: string | undefined;
    let inboundTopicId: string | undefined;
    let outboundTopicId: string | undefined;
    const completionMessage =
      profileData.profileType === 'person'
        ? 'Person profile registered successfully!'
        : 'Agent profile registered successfully!';

    if (profileData.profileType === 'person') {
      const personResult = result as InscribeProfileResponse;
      transactionId = personResult.transactionId ?? 'N/A';
      profileTopicId = personResult.profileTopicId;
      inboundTopicId = personResult.inboundTopicId;
      outboundTopicId = personResult.outboundTopicId;
    } else {
      const agentResult = result as CreateAgentResponse;
      profileTopicId = agentResult.profileTopicId;
      inboundTopicId = agentResult.inboundTopicId;
      outboundTopicId = agentResult.outboundTopicId;
    }

    const profileUrl = profileTopicId
      ? `https://kiloscribe.com/api/inscription-cdn/${profileTopicId}?network=${network}`
      : undefined;

    emitProgress({
      stage: 'completed',
      message: completionMessage,
      progressPercent: 100,
      details: {
        accountId,
        profileTopicId,
        inboundTopicId,
        outboundTopicId,
      },
      timestamp: new Date().toISOString(),
      profileName: profileData.name,
    });

    send({
      id: request.id ?? null,
      type: 'result',
      success: true,
      data: {
        success: true,
        accountId,
        transactionId,
        timestamp: new Date().toISOString(),
        profileUrl,
        metadata: {
          name: profileData.name,
          description: profileData.description,
          capabilities: profileData.capabilities,
          socials: profileData.socials,
          profileImage: profileData.profileImage,
          feeConfiguration: profileData.feeConfiguration,
        },
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      send({
        id: request.id ?? null,
        type: 'result',
        success: false,
        error: 'Registration cancelled',
      });
    } else {
      throw error;
    }
  } finally {
    currentAbortController = null;
    currentProfileName = null;
  }
}

async function handleValidateProfile(request: BridgeRequest): Promise<void> {
  const profileData = (request.payload?.profileData ?? request.payload) as
    | HCS10ProfileFormData
    | undefined;

  if (!profileData) {
    throw new Error('profileData is required for validation');
  }

  const validation = HCS10ProfileSchema.safeParse(profileData);

  if (!validation.success) {
    send({
      id: request.id ?? null,
      type: 'result',
      success: true,
      data: {
        valid: false,
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  send({
    id: request.id ?? null,
    type: 'result',
    success: true,
    data: { valid: true },
  });
}

async function handleRetrieveProfile(request: BridgeRequest): Promise<void> {
  const payload = assertRetrieveProfilePayload(request.payload);

  const client = new HCS10Client({
    network: resolveNetwork(payload.hedera.network),
    operatorId: payload.hedera.accountId,
    operatorPrivateKey: payload.hedera.privateKey,
    logLevel: 'info',
    prettyPrint: false,
  });

  const profile = await client.retrieveProfile(payload.accountId);
  send({
    id: request.id ?? null,
    type: 'result',
    success: true,
    data: profile ?? null,
  });
}

async function handleCancelRegistration(request: BridgeRequest): Promise<void> {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  const progress: ProgressPayload = {
    stage: 'cancelled',
    message: 'Registration cancelled',
    progressPercent: 0,
    details: currentProfileName ? { profileName: currentProfileName } : undefined,
    timestamp: new Date().toISOString(),
    profileName: currentProfileName ?? 'unknown',
  };

  send({
    id: request.id ?? null,
    type: 'progress',
    success: true,
    data: progress,
  });

  currentProfileName = null;

  send({
    id: request.id ?? null,
    type: 'result',
    success: true,
    data: { cancelled: true },
  });
}

rl.on('close', () => {
  if (currentAbortController) {
    currentAbortController.abort();
  }
  process.exit(0);
});
