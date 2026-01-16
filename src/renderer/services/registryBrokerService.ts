/**
 * Registry Broker Service
 *
 * Provides agent discovery and resolution via the HOL Registry Broker API.
 * Uses native fetch for HTTP requests to avoid SDK version dependencies.
 */

const DEFAULT_BASE_URL = 'https://hol.org/registry/api/v1';
const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface AgentSearchOptions {
  q?: string;
  limit?: number;
  page?: number;
  capabilities?: number[];
  registries?: string[];
  hasProfileImage?: boolean;
}

interface AgentSearchHit {
  uaid: string;
  name: string;
  description?: string;
  registry: string;
  profileImage?: string;
  capabilities?: number[];
  protocols?: string[];
  rating?: number;
  ratingCount?: number;
  network?: string;
  createdAt?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
  trustScore?: number;
}

interface AgentSearchResult {
  hits: AgentSearchHit[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DiscoverAgentsResult {
  success: boolean;
  data?: {
    agents: AgentSearchHit[];
    pagination: {
      currentPage: number;
      totalPages: number;
      limit: number;
      total: number;
    };
  };
  error?: string;
}

interface ResolvedAgent {
  uaid?: string;
  name?: string;
  description?: string;
  accountId?: string;
  inboundTopicId?: string;
  profileImage?: string;
  capabilities?: number[];
  metadata?: Record<string, unknown>;
}

interface SearchApiResponse {
  hits?: Array<{
    uaid?: string;
    name?: string;
    description?: string;
    bio?: string;
    registry?: string;
    profileImage?: string;
    image?: string;
    capabilities?: number[];
    protocols?: string[];
    rating?: number;
    ratingCount?: number;
    network?: string;
    createdAt?: string;
    accountId?: string;
    alias?: string;
    creator?: string;
    model?: string;
    socials?: unknown;
    inboundTopicId?: string;
  }>;
  total?: number;
  page?: number;
  limit?: number;
}

interface ResolveApiResponse {
  agent?: ResolvedAgent;
}

interface StatsApiResponse {
  [key: string]: unknown;
}

interface ValidateApiResponse {
  valid?: boolean;
  formats?: string[];
}

const searchCache = new Map<string, CacheEntry<AgentSearchResult>>();
const resolveCache = new Map<string, CacheEntry<ResolvedAgent>>();

class RegistryBrokerServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RegistryBrokerServiceError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new RegistryBrokerServiceError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

function buildCacheKey(options: AgentSearchOptions): string {
  return JSON.stringify({
    q: options.q ?? '',
    limit: options.limit ?? 50,
    page: options.page ?? 1,
    capabilities: options.capabilities ?? [],
    registries: options.registries ?? [],
    hasProfileImage: options.hasProfileImage ?? null,
  });
}

function extractAccountIdFromUaid(uaid?: string): string | undefined {
  if (!uaid) return undefined;
  const match = uaid.match(/aid:(\d+\.\d+\.\d+)/);
  return match ? match[1] : undefined;
}

export async function discoverAgents(
  options: AgentSearchOptions,
  baseUrl?: string
): Promise<DiscoverAgentsResult> {
  const cacheKey = buildCacheKey(options);
  const now = Date.now();
  const cached = searchCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return {
      success: true,
      data: {
        agents: cached.value.hits,
        pagination: {
          currentPage: cached.value.page,
          totalPages: cached.value.totalPages,
          limit: cached.value.limit,
          total: cached.value.total,
        },
      },
    };
  }

  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const params = new URLSearchParams();
    params.set('q', options.q ?? '');
    params.set('limit', String(options.limit ?? 50));
    params.set('page', String(options.page ?? 1));
    if (options.registries?.length) {
      params.set('registries', options.registries.join(','));
    }

    const searchResult = await fetchJson<SearchApiResponse>(
      `${url}/search?${params.toString()}`
    );

    let hits: AgentSearchHit[] = (searchResult.hits ?? []).map((hit) => ({
      uaid: hit.uaid ?? '',
      name: hit.name ?? 'Unknown Agent',
      description: hit.description ?? hit.bio,
      registry: hit.registry ?? 'unknown',
      profileImage: hit.profileImage ?? hit.image,
      capabilities: hit.capabilities ?? [],
      protocols: hit.protocols ?? [],
      rating: hit.rating ?? 0,
      ratingCount: hit.ratingCount ?? 0,
      network: hit.network,
      createdAt: hit.createdAt,
      accountId: hit.accountId ?? extractAccountIdFromUaid(hit.uaid),
      metadata: {
        display_name: hit.name,
        alias: hit.alias,
        bio: hit.description ?? hit.bio,
        profileImage: hit.profileImage ?? hit.image,
        logo: hit.image,
        aiAgent: {
          capabilities: hit.capabilities ?? [],
          creator: hit.creator,
          model: hit.model,
        },
        socials: hit.socials,
        inboundTopicId: hit.inboundTopicId,
      },
    }));

    if (options.capabilities && options.capabilities.length > 0) {
      hits = hits.filter((hit) => {
        const agentCapabilities = hit.capabilities ?? [];
        return options.capabilities!.every((cap) =>
          agentCapabilities.includes(cap)
        );
      });
    }

    if (options.hasProfileImage === true) {
      hits = hits.filter((hit) => Boolean(hit.profileImage));
    }

    const result: AgentSearchResult = {
      hits,
      total: searchResult.total ?? hits.length,
      page: options.page ?? 1,
      limit: options.limit ?? 50,
      totalPages: Math.ceil(
        (searchResult.total ?? hits.length) / (options.limit ?? 50)
      ),
    };

    searchCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value: result });

    return {
      success: true,
      data: {
        agents: result.hits,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
          total: result.total,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof RegistryBrokerServiceError
        ? `Registry broker error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      success: false,
      error: message,
    };
  }
}

export async function resolveAgent(
  uaid: string,
  baseUrl?: string
): Promise<{ success: boolean; agent?: ResolvedAgent; error?: string }> {
  const now = Date.now();
  const cached = resolveCache.get(uaid);

  if (cached && cached.expiresAt > now) {
    return { success: true, agent: cached.value };
  }

  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const resolved = await fetchJson<ResolveApiResponse>(
      `${url}/resolve/${encodeURIComponent(uaid)}`
    );

    if (resolved.agent) {
      resolveCache.set(uaid, { expiresAt: now + CACHE_TTL_MS, value: resolved.agent });
    }

    return { success: true, agent: resolved.agent };
  } catch (error) {
    const message =
      error instanceof RegistryBrokerServiceError
        ? `Registry broker error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

export async function getRegistryStats(
  baseUrl?: string
): Promise<{ success: boolean; stats?: Record<string, unknown>; error?: string }> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const stats = await fetchJson<StatsApiResponse>(`${url}/stats`);
    return { success: true, stats };
  } catch (error) {
    const message =
      error instanceof RegistryBrokerServiceError
        ? `Registry broker error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

export async function validateUaid(
  uaid: string,
  baseUrl?: string
): Promise<{ success: boolean; valid?: boolean; formats?: string[]; error?: string }> {
  try {
    const url = baseUrl ?? DEFAULT_BASE_URL;
    const validation = await fetchJson<ValidateApiResponse>(
      `${url}/validate/${encodeURIComponent(uaid)}`
    );
    return {
      success: true,
      valid: validation.valid,
      formats: validation.formats,
    };
  } catch (error) {
    const message =
      error instanceof RegistryBrokerServiceError
        ? `Registry broker error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    return { success: false, error: message };
  }
}

export function clearSearchCache(): void {
  searchCache.clear();
}

export function clearResolveCache(): void {
  resolveCache.clear();
}

export function clearAllCaches(): void {
  searchCache.clear();
  resolveCache.clear();
}

export { RegistryBrokerServiceError };
