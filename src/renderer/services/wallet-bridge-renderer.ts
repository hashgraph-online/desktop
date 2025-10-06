import { Buffer } from 'buffer';
import { Logger } from '@hashgraphonline/standards-sdk';
import type { StartInscriptionRequest } from '@kiloscribe/inscription-sdk';
import type { DesktopIPCData } from '@/types/desktop-bridge';
import { triggerHashpackDeepLink, walletService } from './walletService';
import { getInscriptionSDK } from './inscriptionSdkProvider';

type WalletStartRequestPayload = {
  requestId?: string;
  request?: unknown;
  network?: 'mainnet' | 'testnet';
};

const logger = new Logger({ module: 'WalletBridgeRenderer' });

const toKeyVariants = (field: string): string[] => {
  if (field.includes('_')) {
    const camel = field.replace(/_([a-z])/g, (_match, letter: string) =>
      letter.toUpperCase()
    );
    return camel === field ? [field] : [field, camel];
  }
  const snake = field.replace(
    /([A-Z])/g,
    (match: string) => `_${match.toLowerCase()}`
  );
  return snake === field ? [field] : [field, snake];
};

const readStringField = (
  source: unknown,
  ...keys: string[]
): string | undefined => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    for (const variant of toKeyVariants(key)) {
      const value = record[variant];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return undefined;
};

function registerWalletBridgeRenderer(): void {
  if (!window?.desktop?.on) {
    return;
  }

  window.desktop.on(
    'wallet_inscribe_start_request',
    async (...args: DesktopIPCData[]) => {
      const [raw] = args;
      if (!raw || typeof raw !== 'object') {
        return;
      }

      const { requestId, request, network } = raw as WalletStartRequestPayload;
      if (!requestId || !request || !network) {
        return;
      }

      try {
        const signer = await walletService.getSigner();
        if (!signer) {
          throw new Error('No wallet signer available');
        }

        const typedRequest = request as StartInscriptionRequest;
        triggerHashpackDeepLink();
        logger.info('Requesting inscription start from wallet', {
          ...typedRequest,
        });

        const sdk = await getInscriptionSDK(signer, network);

        const inscriptionResponse = await sdk.startInscription(typedRequest);
        const rawBytes = (
          inscriptionResponse as { transactionBytes?: string | Uint8Array }
        ).transactionBytes;
        const transactionBytes =
          typeof rawBytes === 'string'
            ? rawBytes.trim()
            : rawBytes
            ? Buffer.from(rawBytes).toString('base64')
            : undefined;

        const txId = readStringField(
          inscriptionResponse,
          'tx_id',
          'id',
          'transactionId'
        );

        const data: Record<string, unknown> = {
          transactionBytes,
        };

        if (txId) {
          data.tx_id = txId;
        }

        window.desktop.send(`wallet_inscribe_start_reply_${requestId}`, {
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Wallet inscription bridge failed', error);
        window.desktop.send(`wallet_inscribe_start_reply_${requestId}`, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  window.desktop.on(
    'wallet_inscribe_fetch_request',
    async (...args: DesktopIPCData[]) => {
      const [raw] = args;
      if (!raw || typeof raw !== 'object') {
        return;
      }

      const { requestId, transactionId, network } = raw as {
        requestId?: string;
        transactionId?: string;
        network?: 'mainnet' | 'testnet';
      };

      if (!requestId || !transactionId || !network) {
        return;
      }

      try {
        const signer = await walletService.getSigner();
        if (!signer) {
          throw new Error('No wallet signer available');
        }

        const sdk = await getInscriptionSDK(signer, network);

        console.log('got SDK', sdk);

        const inscription = await sdk.waitForInscription(transactionId);

        console.log('got inscription', inscription);

        window.desktop.send(`wallet_inscribe_fetch_reply_${requestId}`, {
          success: true,
          data: inscription,
        });
      } catch (error) {
        logger.error('Wallet inscription fetch failed', error);
        window.desktop.send(`wallet_inscribe_fetch_reply_${requestId}`, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

function initializeWalletBridge(): void {
  if (typeof window?.desktop?.on === 'function') {
    registerWalletBridgeRenderer();
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeWalletBridge, 100);
    });
    return;
  }

  setTimeout(initializeWalletBridge, 100);
}

initializeWalletBridge();
