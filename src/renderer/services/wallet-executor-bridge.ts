import { walletService } from './walletService';

type Ledger = 'mainnet' | 'testnet';

function registerWalletExecutorBridge(): void {
  if (!window.electron || typeof window.electron.on !== 'function') {
    return;
  }
  const off = window.electron.on(
    'wallet:execute-tx:request',
    async (payload: { requestId: string; base64: string; network: Ledger }) => {
      const { requestId, base64 } = payload;
      try {
        const out = await walletService.executeFromBytes(base64);
        if (!out.success || !out.transactionId) {
          throw new Error(out.error || 'Unknown wallet execution error');
        }
        window.electron.send(`wallet:execute-tx:reply:${requestId}`, {
          success: true,
          transactionId: String(out.transactionId),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        window.electron.send(`wallet:execute-tx:reply:${requestId}`, {
          success: false,
          error: msg,
        });
      }
    }
  );

  void off;
}

registerWalletExecutorBridge();
