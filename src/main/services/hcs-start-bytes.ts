import { Client, AccountId, TransactionId, TopicCreateTransaction, PublicKey } from '@hashgraph/sdk';
import { HederaMirrorNode } from '@hashgraphonline/standards-sdk';
import { getCurrentWallet } from './wallet-context';

export type Network = 'mainnet' | 'testnet';

export async function startHCSOperationViaLocalBuilder(
  op: string,
  request: Record<string, unknown>,
  network: Network
): Promise<{ transactionBytes: string }> {
  switch (op) {
    case 'hcs2.createRegistry': {
      return await buildHCS2CreateRegistryBytes(request, network);
    }
    case 'hcs2.migrateRegistry': {
      return await buildHCS2CreateRegistryBytes(request, network);
    }
    default: {
      throw new Error(`startHCSOperation unsupported op: ${op}`);
    }
  }
}

async function resolveWalletPublicKey(network: Network, accountId: string): Promise<string | null> {
  try {
    const mirror = new HederaMirrorNode(network);
    const info = await mirror.requestAccount(accountId);
    const key = (info as any)?.key?.key || (info as any)?.key || null;
    return typeof key === 'string' && key ? key : null;
  } catch {
    return null;
  }
}

async function buildHCS2CreateRegistryBytes(
  request: Record<string, unknown>,
  network: Network
): Promise<{ transactionBytes: string }> {
  const wallet = getCurrentWallet();
  if (!wallet || !wallet.accountId || wallet.network !== network) {
    throw new Error('wallet_unavailable: no connected wallet or network mismatch');
  }

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const payer = AccountId.fromString(wallet.accountId);

  const options = (request as any)?.options || {};
  const registryType: number = typeof options.registryType === 'number' ? options.registryType : 0;
  const ttl: number = typeof options.ttl === 'number' ? options.ttl : 86400;
  const adminKeyOpt = options.adminKey as string | boolean | undefined;
  const submitKeyOpt = options.submitKey as string | boolean | undefined;

  const memo = `hcs-2:${registryType}:${ttl}`;

  const tx = new TopicCreateTransaction()
    .setTransactionId(TransactionId.generate(payer))
    .setTopicMemo(memo)
    .setAutoRenewAccountId(payer)
    .setAutoRenewPeriod(7776000);

  if (adminKeyOpt) {
    try {
      if (typeof adminKeyOpt === 'string') {
        tx.setAdminKey(PublicKey.fromString(adminKeyOpt));
      } else {
        const pub = await resolveWalletPublicKey(network, wallet.accountId);
        if (pub) tx.setAdminKey(PublicKey.fromString(pub));
      }
    } catch {}
  }

  if (submitKeyOpt) {
    try {
      if (typeof submitKeyOpt === 'string') {
        tx.setSubmitKey(PublicKey.fromString(submitKeyOpt));
      } else {
        const pub = await resolveWalletPublicKey(network, wallet.accountId);
        if (pub) tx.setSubmitKey(PublicKey.fromString(pub));
      }
    } catch {}
  }

  const frozen = await tx.freezeWith(client);
  const bytes = Buffer.from(frozen.toBytes());
  return { transactionBytes: bytes.toString('base64') };
}
