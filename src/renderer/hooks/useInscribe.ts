import { useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { walletService } from '../services/walletService';
import {
  inscribeWithSigner,
  type InscriptionOptions,
  type RetrievedInscriptionResult,
  type StartInscriptionRequest,
} from '@hashgraphonline/standards-sdk';
import type { DAppSigner } from '@hashgraph/hedera-wallet-connect/dist/lib/dapp/DAppSigner';
import { InscriptionSDK, type RegistrationProgressData } from '@kiloscribe/inscription-sdk';
import { Buffer } from 'buffer';

export type BufferInput = {
  type: 'buffer';
  buffer: Buffer | ArrayBuffer;
  fileName: string;
  mimeType?: string;
};

export type UrlInput = {
  type: 'url';
  url: string;
};

export type InscribeInput = BufferInput | UrlInput;

export type ProgressData = {
  stage: string;
  progressPercent?: number;
  message?: string;
  details?: Record<string, unknown>;
};

export function useInscribe() {
  const network = useWalletStore((s) => s.network) as
    | 'mainnet'
    | 'testnet'
    | null;
  const sdkRef = useRef<InscriptionSDK | null>(null);

  const inscribe = useCallback(
    async (
      input: InscribeInput,
      options?: Omit<InscriptionOptions, 'waitForConfirmation' | 'network'>,
      onProgress?: (data: ProgressData) => void
    ): Promise<RetrievedInscriptionResult> => {
      const info = walletService.getAccountInfo();
      const signer: DAppSigner | null = await walletService.getSigner();
      if (!info?.accountId || !signer || !network) {
        throw new Error('No signer or network available');
      }

      if (!sdkRef.current) {
        sdkRef.current = await InscriptionSDK.createWithAuth({
          type: 'client',
          accountId: info.accountId,
          signer,
          network,
          connectionMode: 'websocket',
        });
      }

      const progressCb = onProgress
        ? (d: RegistrationProgressData) =>
            onProgress({
              stage: d.stage,
              progressPercent: d.progressPercent,
              message: d.message,
              details: d.details as Record<string, unknown> | undefined,
            })
        : undefined;

      const response = await inscribeWithSigner(
        input,
        signer,
        {
          ...(options || {}),
          mode: options?.mode || 'file',
          waitForConfirmation: true,
          network,
          progressCallback: progressCb,
        },
        sdkRef.current,
      );

      if (!response.confirmed || !response.inscription) {
        throw new Error('Inscription did not complete');
      }

      return response.inscription;
    },
    [network]
  );

  return { inscribe };
}
