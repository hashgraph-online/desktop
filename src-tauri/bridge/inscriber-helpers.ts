export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return null;
};

const normalizeKeys = (field: string): string[] => {
  if (field.includes('_')) {
    const camel = field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return [field, camel];
  }
  const snake = field.replace(/([A-Z])/g, (match: string) => `_${match.toLowerCase()}`);
  return snake === field ? [field] : [field, snake];
};

export const getStringField = (
  source: Record<string, unknown> | null | undefined,
  field: string,
): string | undefined => {
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

export const deriveInscriptionContext = (
  record: Record<string, unknown>,
): {
  metadataTopicId?: string;
  inscriptionRecord: Record<string, unknown> | null;
  resultRecord: Record<string, unknown> | null;
} => {
  const inscriptionRecord = toRecord(record.inscription);
  const resultRecord = toRecord(record.result);

  const metadataTopicId = (() => {
    const direct =
      getStringField(record as Record<string, unknown>, 'jsonTopicId') ||
      getStringField(record as Record<string, unknown>, 'json_topic_id');
    if (direct) {
      return direct;
    }

    const inscriptionJson = getStringField(inscriptionRecord, 'jsonTopicId');
    if (inscriptionJson) {
      return inscriptionJson;
    }

    const inscriptionMetadataField =
      getStringField(inscriptionRecord, 'metadataTopicId') ||
      getStringField(inscriptionRecord, 'metadata_topic_id');
    if (inscriptionMetadataField) {
      return inscriptionMetadataField;
    }

    const resultJson = getStringField(resultRecord, 'jsonTopicId');
    if (resultJson) {
      return resultJson;
    }

    const filesRecord = toRecord(inscriptionRecord?.files);
    const metadataUploads = Array.isArray(filesRecord?.metadataUploads)
      ? (filesRecord?.metadataUploads as Array<unknown>)
      : undefined;
    if (metadataUploads) {
      for (const entry of metadataUploads) {
        const entryRecord = toRecord(entry);
        const candidate =
          getStringField(entryRecord, 'topicId') ||
          getStringField(entryRecord, 'topic_id');
        if (candidate) {
          return candidate;
        }
      }
    }

    return undefined;
  })();

  let normalizedInscription = inscriptionRecord;
  if (metadataTopicId) {
    const existingJson = getStringField(inscriptionRecord, 'jsonTopicId');
    if (metadataTopicId !== existingJson && inscriptionRecord) {
      normalizedInscription = {
        ...inscriptionRecord,
        jsonTopicId: metadataTopicId,
      };
    }
  }

  let normalizedResult = resultRecord;
  if (metadataTopicId) {
    const existingJson = getStringField(resultRecord, 'jsonTopicId');
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
