import { describe, expect, it } from 'vitest';

import {
  deriveInscriptionContext,
} from '../../src-tauri/bridge/inscriber-helpers';

const makeRecord = (overrides: Record<string, unknown>) => ({
  transactionBytes: 'dummy',
  ...overrides,
});

describe('deriveInscriptionContext', () => {
  it('prefers top-level jsonTopicId when present', () => {
    const record = makeRecord({
      jsonTopicId: '0.0.111',
      inscription: {
        topic_id: '0.0.222',
      },
      result: {
        topicId: '0.0.333',
      },
    });

    const { metadataTopicId, inscriptionRecord, resultRecord } = deriveInscriptionContext(
      record as Record<string, unknown>,
    );

    expect(metadataTopicId).toBe('0.0.111');
    expect(inscriptionRecord?.jsonTopicId).toBe('0.0.111');
    expect(resultRecord?.jsonTopicId).toBe('0.0.111');
  });

  it('prefers top-level json_topic_id when camelCase field absent', () => {
    const record = makeRecord({
      json_topic_id: '0.0.777',
      inscription: {
        topic_id: '0.0.222',
      },
      result: {
        topicId: '0.0.333',
      },
    });

    const { metadataTopicId, inscriptionRecord, resultRecord } = deriveInscriptionContext(
      record as Record<string, unknown>,
    );

    expect(metadataTopicId).toBe('0.0.777');
    expect(inscriptionRecord?.jsonTopicId).toBe('0.0.777');
    expect(resultRecord?.jsonTopicId).toBe('0.0.777');
  });

  it('extracts metadata topic from nested metadata uploads when jsonTopicId missing', () => {
    const record = makeRecord({
      inscription: {
        topic_id: '0.0.222',
        files: {
          metadataUploads: [
            {
              topicId: '0.0.444',
            },
          ],
        },
      },
      result: {
        topicId: '0.0.333',
      },
    });

    const { metadataTopicId, inscriptionRecord, resultRecord } = deriveInscriptionContext(
      record as Record<string, unknown>,
    );

    expect(metadataTopicId).toBe('0.0.444');
    expect(inscriptionRecord?.jsonTopicId).toBe('0.0.444');
    expect(resultRecord?.jsonTopicId).toBe('0.0.444');
  });
});
