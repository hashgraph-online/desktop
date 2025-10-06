import { InscriptionSDK } from '@kiloscribe/inscription-sdk';

type SupportedNetwork = 'mainnet' | 'testnet';

let cachedKey: string | null = null;
let cachedPromise: Promise<InscriptionSDK> | null = null;

export const getInscriptionSDK = async (
  signer: { getAccountId(): { toString(): string } },
  network: SupportedNetwork
): Promise<InscriptionSDK> => {
  const accountId = signer.getAccountId().toString();
  const key = `${accountId}|${network}`;

  if (!cachedPromise || cachedKey !== key) {
    cachedKey = key;
    cachedPromise = InscriptionSDK.createWithAuth({
      type: 'client',
      accountId,
      signer,
      network,
      connectionMode: 'websocket',
    }).catch((error) => {
      if (cachedKey === key) {
        cachedKey = null;
        cachedPromise = null;
      }
      throw error;
    });
  }

  return cachedPromise;
};
