import {
  InscriptionSDK,
  type StartInscriptionRequest,
} from '@kiloscribe/inscription-sdk';
import { walletService } from './walletService';

function registerWalletBridgeRenderer(): void {
  window.electron.on(
    'wallet:inscribe-start:request',
    async (payload: {
      requestId: string;
      request: StartInscriptionRequest;
      network: 'mainnet' | 'testnet';
    }) => {
      const { requestId, request, network } = payload;
      try {
        const signer = await walletService.getSigner();
        if (!signer) throw new Error('No wallet signer available');
        const sdk = await InscriptionSDK.createWithAuth({
          type: 'client',
          accountId: signer.getAccountId().toString(),
          signer,
          network,
          connectionMode: 'websocket',
        });
        const res = await sdk.startInscription(request);
        const anyRes = res;
        window.electron.send(`wallet:inscribe-start:reply:${requestId}`, {
          success: true,
          data: {
            transactionBytes: anyRes?.transactionBytes,
            tx_id: anyRes?.tx_id || anyRes?.id
            topic_id:
              anyRes?.topic_id || anyRes?.jsonTopicId || anyRes?.topicId,
            jsonTopicId:
              anyRes?.jsonTopicId,
            status: anyRes?.status,
            completed: anyRes?.completed,
          },
        });
      } catch (error) {
        window.electron.send(`wallet:inscribe-start:reply:${requestId}`, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

registerWalletBridgeRenderer();
