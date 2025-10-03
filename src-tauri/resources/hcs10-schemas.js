"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HederaCredentialsSchema = exports.HCS10ProfileSchema = void 0;
exports.assertRegisterProfilePayload = assertRegisterProfilePayload;
exports.assertRetrieveProfilePayload = assertRetrieveProfilePayload;
const zod_1 = require("zod");
const socialsSchema = zod_1.z.object({
    twitter: zod_1.z.string().optional(),
    github: zod_1.z.string().optional(),
    website: zod_1.z.string().optional(),
});
const profileImageFileSchema = zod_1.z.object({
    data: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
});
const feeConfigurationSchema = zod_1.z
    .object({
    hbarFee: zod_1.z.number().optional(),
    tokenFee: zod_1.z
        .object({
        tokenId: zod_1.z.string(),
        amount: zod_1.z.number(),
    })
        .optional(),
})
    .optional();
exports.HCS10ProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Name must be at least 3 characters'),
    description: zod_1.z.string().min(10, 'Description must be at least 10 characters'),
    profileType: zod_1.z.enum(['person', 'aiAgent']),
    alias: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    creator: zod_1.z.string().min(2, 'Creator must be at least 2 characters'),
    version: zod_1.z.string().min(1, 'Version is required'),
    agentType: zod_1.z.enum(['autonomous', 'manual']).optional(),
    capabilities: zod_1.z.array(zod_1.z.string()),
    socials: socialsSchema.optional(),
    profileImage: zod_1.z.string().optional(),
    logo: zod_1.z.string().optional(),
    profileImageFile: profileImageFileSchema.optional(),
    feeConfiguration: feeConfigurationSchema,
    customProperties: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.HederaCredentialsSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, 'Hedera account ID is required'),
    privateKey: zod_1.z.string().min(1, 'Hedera private key is required'),
    network: zod_1.z.string().optional(),
});
const agentCreationStateSchema = zod_1.z.object({
    pfpTopicId: zod_1.z.string().optional(),
    inboundTopicId: zod_1.z.string().optional(),
    outboundTopicId: zod_1.z.string().optional(),
    profileTopicId: zod_1.z.string().optional(),
    currentStage: zod_1.z.enum(['init', 'pfp', 'topics', 'profile', 'registration', 'complete']),
    completedPercentage: zod_1.z.number(),
    error: zod_1.z.string().optional(),
    createdResources: zod_1.z.array(zod_1.z.string()).optional(),
    agentMetadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const registerOptionsSchema = zod_1.z
    .object({
    isAutonomous: zod_1.z.boolean().optional(),
    existingState: agentCreationStateSchema.optional(),
})
    .optional();
const registerProfilePayloadSchema = zod_1.z.object({
    profileData: exports.HCS10ProfileSchema,
    hedera: exports.HederaCredentialsSchema,
    options: registerOptionsSchema,
});
const retrieveProfilePayloadSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1, 'Account ID is required'),
    hedera: exports.HederaCredentialsSchema,
});
function formatIssues(issues) {
    return issues
        .map((issue) => {
        const path = issue.path.join('.') || 'payload';
        return `${path}: ${issue.message}`;
    })
        .join('; ');
}
function assertRegisterProfilePayload(payload) {
    const result = registerProfilePayloadSchema.safeParse(payload);
    if (!result.success) {
        throw new Error(`Invalid register profile payload: ${formatIssues(result.error.issues)}`);
    }
    return result.data;
}
function assertRetrieveProfilePayload(payload) {
    const result = retrieveProfilePayloadSchema.safeParse(payload);
    if (!result.success) {
        throw new Error(`Invalid retrieve profile payload: ${formatIssues(result.error.issues)}`);
    }
    return result.data;
}
