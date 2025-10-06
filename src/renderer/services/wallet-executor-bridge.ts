import type { DesktopIPCData } from '@/types/desktop-bridge';
import { Logger } from '@hashgraphonline/standards-sdk';
import { walletService } from './walletService';

type Ledger = 'mainnet' | 'testnet';

const logger = new Logger({ module: 'WalletExecutorBridge' });

function registerWalletExecutorBridge(): void {
  if (!window.desktop || typeof window?.desktop?.on !== 'function') {
    return;
  }
  const off = window?.desktop?.on(
    'wallet_execute_tx_request',
    async (...args: DesktopIPCData[]) => {
      const [raw] = args;
      if (!raw || typeof raw !== 'object') {
        return;
      }
      const { requestId, base64, network } = raw as {
        requestId?: string;
        base64?: string;
        network?: Ledger;
      };
      if (!requestId || !base64 || !network) {
        return;
      }
      try {
        logger.info('WalletExecutorBridge executing transaction', {
          requestId,
          network,
        });
        const out = await walletService.executeFromBytes(base64);
        if (!out.success || !out.transactionId) {
          throw new Error(out.error || 'Unknown wallet execution error');
        }
        window?.desktop?.send(`wallet_execute_tx_reply_${requestId}`, {
          success: true,
          data: {
            transactionId: String(out.transactionId),
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        window?.desktop?.send(`wallet_execute_tx_reply_${requestId}`, {
          success: false,
          error: msg,
        });
        logger.warn('WalletExecutorBridge execution failed', {
          requestId,
          error: msg,
        });
      }
    }
  );

  void off;
}

registerWalletExecutorBridge();
