import { Buffer } from 'buffer';
import { Logger } from '@hashgraphonline/standards-sdk';
import {
  InscriptionSDK,
  type StartInscriptionRequest,
} from '@kiloscribe/inscription-sdk';
import type { DesktopIPCData } from '@/types/desktop-bridge';
import { triggerHashpackDeepLink, walletService } from './walletService';

type WalletStartRequestPayload = {
  requestId?: string;
  request?: unknown;
  network?: 'mainnet' | 'testnet';
};

const logger = new Logger({ module: 'WalletBridgeRenderer' });

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

        const sdk = await InscriptionSDK.createWithAuth({
          type: 'client',
          accountId: signer.getAccountId().toString(),
          signer,
          network,
          connectionMode: 'websocket',
        });

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

        window.desktop.send(`wallet_inscribe_start_reply_${requestId}`, {
          success: true,
          data: {
            transactionBytes,
            tx_id:
              (inscriptionResponse as { tx_id?: string; id?: string }).tx_id ??
              (inscriptionResponse as { id?: string }).id,
            status: (inscriptionResponse as { status?: string }).status,
            completed: (inscriptionResponse as { completed?: boolean })
              .completed,
          },
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
