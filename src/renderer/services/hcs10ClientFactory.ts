import { BrowserHCSClient, HCS10Client } from '@hashgraphonline/standards-sdk';
import type { NetworkType } from '@hashgraphonline/standards-sdk';
import { walletService } from './walletService';

type ResolvedNetwork = 'mainnet' | 'testnet';

export function getHCS10Client(
  network: NetworkType,
  options: { walletConnected: boolean; accountId?: string; privateKey?: string }
) {
  const resolvedNetwork: ResolvedNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet');
  if (options.walletConnected) {
    const hwc = walletService.getSDK();
    return new BrowserHCSClient({ network: resolvedNetwork, hwc });
  }
  if (!options.accountId || !options.privateKey) {
    throw new Error('Missing operator credentials for HCS10Client');
  }
  return new HCS10Client({
    network: resolvedNetwork,
    operatorId: options.accountId,
    operatorPrivateKey: options.privateKey,
    logLevel: 'info',
  });
}

const PROFILE_CACHE = new Map<string, { expiresAt: number; value: { success: boolean; profile?: any; error?: string } }>();
const PROFILE_TTL_MS = 30_000; // 30s to avoid chatty re-fetching during UI updates

export async function fetchUserProfile(
  accountId: string,
  network: NetworkType,
  options: { walletConnected: boolean; operatorId?: string; privateKey?: string }
) {
  const cacheKey = `${accountId}-${network}-${options.walletConnected ? 'wallet' : 'key'}`;
  const now = Date.now();
  const cached = PROFILE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value as { success: boolean; profile?: any; error?: string };
  }
  const client = getHCS10Client(network, {
    walletConnected: options.walletConnected,
    accountId: options.operatorId,
    privateKey: options.privateKey,
  });
  try {
    const resp = await client.retrieveProfile(accountId, false);
    if (resp.success && resp.profile) {
      const p: any = resp.profile;
      const result = {
        success: true,
        profile: {
          ...p,
          display_name: p.display_name || (options.walletConnected ? 'Wallet Account' : undefined),
          profileImage: p.profileImage || p.logo,
        },
      } as const;
      PROFILE_CACHE.set(cacheKey, { expiresAt: now + PROFILE_TTL_MS, value: result });
      return result;
    }
    const miss = { success: false, error: resp.error || 'Profile not found' } as const;
    PROFILE_CACHE.set(cacheKey, { expiresAt: now + 5_000, value: miss }); // brief negative cache
    return miss;
  } catch (e) {
    const err = { success: false, error: e instanceof Error ? e.message : String(e) } as const;
    PROFILE_CACHE.set(cacheKey, { expiresAt: now + 5_000, value: err });
    return err;
  }
}
