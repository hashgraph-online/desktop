import { HCS10Client } from '@hashgraphonline/standards-sdk';
import { ConfigService } from './config-service';

let singleton: HCS10Client | null = null;

export async function getHCS10Client(): Promise<HCS10Client> {
  if (singleton) return singleton;
  const configService = ConfigService.getInstance();
  const cfg = await configService.load();
  if (!cfg.hedera?.accountId || !cfg.hedera?.privateKey) {
    throw new Error('Hedera credentials not configured');
  }
  singleton = new HCS10Client({
    network: cfg.hedera.network || 'testnet',
    operatorId: cfg.hedera.accountId,
    operatorPrivateKey: cfg.hedera.privateKey,
    logLevel: 'info',
    prettyPrint: false,
  });
  return singleton;
}

export function resetHCS10Client(): void {
  singleton = null;
}

