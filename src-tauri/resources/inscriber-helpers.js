"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveInscriptionContext = exports.getStringField = exports.toRecord = void 0;
const toRecord = (value) => {
    if (value && typeof value === 'object') {
        return value;
    }
    return null;
};
exports.toRecord = toRecord;
const normalizeKeys = (field) => {
    if (field.includes('_')) {
        const camel = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        return [field, camel];
    }
    const snake = field.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
    return snake === field ? [field] : [field, snake];
};
const getStringField = (source, field) => {
    if (!source) {
        return undefined;
    }
    for (const key of normalizeKeys(field)) {
        const value = source[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return undefined;
};
exports.getStringField = getStringField;
const deriveInscriptionContext = (record) => {
    const inscriptionRecord = (0, exports.toRecord)(record.inscription);
    const resultRecord = (0, exports.toRecord)(record.result);
    const metadataTopicId = (() => {
        const direct = (0, exports.getStringField)(record, 'jsonTopicId') ||
            (0, exports.getStringField)(record, 'json_topic_id');
        if (direct) {
            return direct;
        }
        const inscriptionJson = (0, exports.getStringField)(inscriptionRecord, 'jsonTopicId');
        if (inscriptionJson) {
            return inscriptionJson;
        }
        const inscriptionMetadataField = (0, exports.getStringField)(inscriptionRecord, 'metadataTopicId') ||
            (0, exports.getStringField)(inscriptionRecord, 'metadata_topic_id');
        if (inscriptionMetadataField) {
            return inscriptionMetadataField;
        }
        const resultJson = (0, exports.getStringField)(resultRecord, 'jsonTopicId');
        if (resultJson) {
            return resultJson;
        }
        const filesRecord = (0, exports.toRecord)(inscriptionRecord?.files);
        const metadataUploads = Array.isArray(filesRecord?.metadataUploads)
            ? filesRecord?.metadataUploads
            : undefined;
        if (metadataUploads) {
            for (const entry of metadataUploads) {
                const entryRecord = (0, exports.toRecord)(entry);
                const candidate = (0, exports.getStringField)(entryRecord, 'topicId') ||
                    (0, exports.getStringField)(entryRecord, 'topic_id');
                if (candidate) {
                    return candidate;
                }
            }
        }
        return undefined;
    })();
    let normalizedInscription = inscriptionRecord;
    if (metadataTopicId) {
        const existingJson = (0, exports.getStringField)(inscriptionRecord, 'jsonTopicId');
        if (metadataTopicId !== existingJson && inscriptionRecord) {
            normalizedInscription = {
                ...inscriptionRecord,
                jsonTopicId: metadataTopicId,
            };
        }
    }
    let normalizedResult = resultRecord;
    if (metadataTopicId) {
        const existingJson = (0, exports.getStringField)(resultRecord, 'jsonTopicId');
        if (metadataTopicId !== existingJson && resultRecord) {
            normalizedResult = {
                ...resultRecord,
                jsonTopicId: metadataTopicId,
            };
        }
    }
    return {
        metadataTopicId,
        inscriptionRecord: normalizedInscription,
        resultRecord: normalizedResult,
    };
};
exports.deriveInscriptionContext = deriveInscriptionContext;
