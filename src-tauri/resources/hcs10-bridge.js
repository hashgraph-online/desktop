"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const readline_stub_1 = require("./stubs/readline-stub");
const standards_sdk_1 = require("@hashgraphonline/standards-sdk");
const hcs10_schemas_1 = require("./hcs10-schemas");
const tagToCapabilityMap = {
    'text-generation': standards_sdk_1.AIAgentCapability.TEXT_GENERATION,
    'data-integration': standards_sdk_1.AIAgentCapability.DATA_INTEGRATION,
    analytics: standards_sdk_1.AIAgentCapability.MARKET_INTELLIGENCE,
    automation: standards_sdk_1.AIAgentCapability.WORKFLOW_AUTOMATION,
    'natural-language': standards_sdk_1.AIAgentCapability.LANGUAGE_TRANSLATION,
    'image-generation': standards_sdk_1.AIAgentCapability.IMAGE_GENERATION,
    'code-generation': standards_sdk_1.AIAgentCapability.CODE_GENERATION,
    translation: standards_sdk_1.AIAgentCapability.LANGUAGE_TRANSLATION,
    summarization: standards_sdk_1.AIAgentCapability.SUMMARIZATION_EXTRACTION,
    'api-integration': standards_sdk_1.AIAgentCapability.API_INTEGRATION,
};
let currentAbortController = null;
let currentProfileName = null;
const rl = (0, readline_stub_1.createInterface)({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
        return;
    }
    let request;
    try {
        request = JSON.parse(trimmed);
    }
    catch (error) {
        send({
            id: null,
            type: 'result',
            success: false,
            error: `Invalid JSON request: ${error.message}`,
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
    }
    catch (error) {
        send({
            id: request.id ?? null,
            type: 'result',
            success: false,
            error: error.message ?? String(error),
        });
    }
});
function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}
function resolveNetwork(network) {
    return network === 'mainnet' ? 'mainnet' : 'testnet';
}
function slugifyName(name) {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
}
function mapCapabilities(capabilities = []) {
    return capabilities.map((cap) => tagToCapabilityMap[cap] ?? standards_sdk_1.AIAgentCapability.TEXT_GENERATION);
}
function isFailureResponse(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return value.success === false;
}
function buildAgentBuilder(profileData, hedera, isAutonomous) {
    const builder = new standards_sdk_1.AgentBuilder()
        .setName(profileData.name)
        .setAlias(profileData.alias || slugifyName(profileData.name))
        .setBio(profileData.description || '')
        .setCapabilities(mapCapabilities(profileData.capabilities))
        .setType(isAutonomous ? 'autonomous' : 'manual')
        .setModel('conversational-agent-2024')
        .setNetwork(resolveNetwork(hedera.network))
        .setInboundTopicType(profileData.feeConfiguration?.hbarFee
        ? standards_sdk_1.InboundTopicType.FEE_BASED
        : standards_sdk_1.InboundTopicType.PUBLIC)
        .setExistingAccount(hedera.accountId, hedera.privateKey);
    if (profileData.socials) {
        Object.entries(profileData.socials).forEach(([platform, handle]) => {
            if (handle) {
                builder.addSocial(platform, handle);
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
function buildPersonBuilder(profileData) {
    const builder = new standards_sdk_1.PersonBuilder()
        .setName(profileData.name)
        .setAlias(profileData.alias || slugifyName(profileData.name))
        .setBio(profileData.description || '');
    if (profileData.socials) {
        Object.entries(profileData.socials).forEach(([platform, handle]) => {
            if (handle) {
                builder.addSocial(platform, handle);
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
function extractProfilePicture(profileData) {
    if (profileData.profileImageFile?.data && profileData.profileImageFile.name) {
        const raw = profileData.profileImageFile.data;
        const base64Data = raw.includes(',') ? raw.split(',')[1] : raw;
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            return { buffer, filename: profileData.profileImageFile.name };
        }
        catch (error) {
            send({
                id: null,
                type: 'result',
                success: false,
                error: `Failed to decode profile image: ${error.message}`,
            });
        }
    }
    return null;
}
async function handleRegisterProfile(request) {
    const payload = (0, hcs10_schemas_1.assertRegisterProfilePayload)(request.payload);
    if (currentAbortController) {
        throw new Error('Another registration is already in progress');
    }
    const profileData = payload.profileData;
    const hedera = payload.hedera;
    const options = payload.options ?? {};
    const isAutonomous = Boolean(options.isAutonomous);
    const existingState = options.existingState;
    const client = new standards_sdk_1.HCS10Client({
        network: resolveNetwork(hedera.network),
        operatorId: hedera.accountId,
        operatorPrivateKey: hedera.privateKey,
        logLevel: 'info',
        prettyPrint: false,
    });
    const builder = profileData.profileType === 'person'
        ? buildPersonBuilder(profileData)
        : buildAgentBuilder(profileData, hedera, isAutonomous);
    const controller = new AbortController();
    currentAbortController = controller;
    currentProfileName = profileData.name;
    const emitProgress = (progress) => {
        send({
            id: request.id ?? null,
            type: 'progress',
            success: true,
            data: progress,
        });
    };
    try {
        let abortHandler = null;
        const registrationPromise = client.create(builder, {
            existingState,
            progressCallback: (data) => {
                emitProgress({
                    ...data,
                    timestamp: new Date().toISOString(),
                    profileName: profileData.name,
                });
            },
        });
        const abortPromise = new Promise((_, reject) => {
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
        let profileTopicId;
        let inboundTopicId;
        let outboundTopicId;
        const completionMessage = profileData.profileType === 'person'
            ? 'Person profile registered successfully!'
            : 'Agent profile registered successfully!';
        if (profileData.profileType === 'person') {
            const personResult = result;
            transactionId = personResult.transactionId ?? 'N/A';
            profileTopicId = personResult.profileTopicId;
            inboundTopicId = personResult.inboundTopicId;
            outboundTopicId = personResult.outboundTopicId;
        }
        else {
            const agentResult = result;
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
    }
    catch (error) {
        if (error.name === 'AbortError') {
            send({
                id: request.id ?? null,
                type: 'result',
                success: false,
                error: 'Registration cancelled',
            });
        }
        else {
            throw error;
        }
    }
    finally {
        currentAbortController = null;
        currentProfileName = null;
    }
}
async function handleValidateProfile(request) {
    const profileData = (request.payload?.profileData ?? request.payload);
    if (!profileData) {
        throw new Error('profileData is required for validation');
    }
    const validation = hcs10_schemas_1.HCS10ProfileSchema.safeParse(profileData);
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
async function handleRetrieveProfile(request) {
    const payload = (0, hcs10_schemas_1.assertRetrieveProfilePayload)(request.payload);
    const client = new standards_sdk_1.HCS10Client({
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
async function handleCancelRegistration(request) {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    const progress = {
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
