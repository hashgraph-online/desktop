import { useCallback, useMemo, useRef, useState } from 'react';
import { Logger } from '@hashgraphonline/standards-sdk';
import { useWalletStore } from '../stores/walletStore';
import { useConfigStore } from '../stores/configStore';

interface RawJobFileEntry {
  topicId?: string | null;
}

interface RawJobFiles {
  imageUploads?: RawJobFileEntry[];
  metadataUploads?: RawJobFileEntry[];
}

interface RawInscriptionJob {
  tx_id: string;
  topic_id?: string | null;
  mimeType?: string | null;
  createdAt?: string | null;
  type?: string | null;
  name?: string | null;
  files?: RawJobFiles | null;
}

export interface InscriptionJob {
  id: string;
  topic: string;
  imageTopic: string;
  mimeType: string | null;
  type: string | null;
  name: string | null;
  createdAt: Date | null;
}

interface UseInscriptionJobsResult {
  jobs: InscriptionJob[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  network: 'mainnet' | 'testnet';
  loadJobs: () => Promise<void>;
}

const logger = new Logger({ module: 'useInscriptionJobs' });

/**
 * Determines whether the provided value is a non-null record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for inscription job entries returned by the Kiloscribe jobs endpoint
 */
function isRawInscriptionJob(value: unknown): value is RawInscriptionJob {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.tx_id === 'string';
}

/**
 * Removes known URL prefixes from HCS topic identifiers
 */
function normalizeTopic(topic: string): string {
  return topic
    .replace(/^hcs:\/\/(1\/)?/i, '')
    .replace(/^1\//, '')
    .trim();
}

/**
 * Maps a raw job payload into a structured inscription job
 */
function mapJob(raw: RawInscriptionJob): InscriptionJob {
  const primaryTopic = typeof raw.topic_id === 'string' ? raw.topic_id : '';
  const imageTopicCandidate = raw.files?.imageUploads?.find(
    (entry) => typeof entry?.topicId === 'string' && entry.topicId.trim().length > 0,
  )?.topicId;
  const metadataTopicCandidate = raw.files?.metadataUploads?.find(
    (entry) => typeof entry?.topicId === 'string' && entry.topicId.trim().length > 0,
  )?.topicId;

  const normalizedTopic = normalizeTopic(imageTopicCandidate || primaryTopic || '');
  const normalizedMetadataTopic = normalizeTopic(metadataTopicCandidate || primaryTopic || '');

  const createdAt = raw.createdAt ? new Date(raw.createdAt) : null;
  const validCreatedAt = createdAt && !Number.isNaN(createdAt.valueOf()) ? createdAt : null;

  return {
    id: raw.tx_id,
    topic: normalizeTopic(primaryTopic || normalizedMetadataTopic),
    imageTopic: normalizedTopic || normalizeTopic(primaryTopic),
    mimeType: raw.mimeType ?? null,
    type: raw.type ?? null,
    name: raw.name ?? null,
    createdAt: validCreatedAt,
  };
}

/**
 * Hook that retrieves a user's previous inscriptions from Kiloscribe jobs endpoint
 */
export function useInscriptionJobs(): UseInscriptionJobsResult {
  const walletAccountId = useWalletStore((state) => state.accountId);
  const walletNetwork = useWalletStore((state) => state.network);
  const configAccountId = useConfigStore(
    (state) => state.config?.hedera.accountId ?? ''
  );
  const configNetwork = useConfigStore(
    (state) => state.config?.hedera.network ?? 'testnet'
  );

  const [jobs, setJobs] = useState<InscriptionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const busy = useRef(false);

  const effectiveAccountId = useMemo(() => {
    return walletAccountId || configAccountId || '';
  }, [walletAccountId, configAccountId]);

  const effectiveNetwork = useMemo<'mainnet' | 'testnet'>(() => {
    if (walletNetwork === 'mainnet' || walletNetwork === 'testnet') {
      return walletNetwork;
    }
    return configNetwork === 'mainnet' ? 'mainnet' : 'testnet';
  }, [walletNetwork, configNetwork]);

  const loadJobs = useCallback(async () => {
    if (busy.current) {
      return;
    }

    if (!effectiveAccountId) {
      setJobs([]);
      setError('No Hedera account configured for inscriptions');
      setHasLoaded(true);
      return;
    }

    busy.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://kiloscribe.com/api/jobs', {
        method: 'GET',
        headers: {
          'x-account-id': effectiveAccountId,
          'x-type': 'file',
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload = await response.json();
      const rawJobs = Array.isArray(payload)
        ? payload.filter(isRawInscriptionJob)
        : [];
      const mapped = rawJobs.map(mapJob);
      const sorted = mapped.sort((a, b) => {
        const aTime = a.createdAt?.valueOf() ?? 0;
        const bTime = b.createdAt?.valueOf() ?? 0;
        return bTime - aTime;
      });
      setJobs(sorted);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const message = errorObj.message || 'Failed to load inscriptions';
      setJobs([]);
      setError(message);
      logger.error('Failed to load inscription jobs', errorObj);
    } finally {
      setLoading(false);
      setHasLoaded(true);
      busy.current = false;
    }
  }, [effectiveAccountId]);

  return {
    jobs,
    loading,
    error,
    hasLoaded,
    network: effectiveNetwork,
    loadJobs,
  };
}
