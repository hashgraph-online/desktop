import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

type Ledger = 'mainnet' | 'testnet';

export async function executeWithWallet(
  base64: string,
  network: Ledger,
  timeoutMs: number = 60000
): Promise<{ transactionId: string }> {
  const wins = BrowserWindow.getAllWindows();
  if (!wins.length) {
    throw new Error('No renderer window available');
  }
  const win = wins[0];
  const requestId = randomUUID();

  return new Promise((resolve, reject) => {
    const replyChannel = `wallet:execute-tx:reply:${requestId}`;
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(replyChannel);
      reject(new Error('wallet executor timeout'));
    }, timeoutMs);

    ipcMain.once(replyChannel, (_event, payload: { success: boolean; transactionId?: string; error?: string }) => {
      clearTimeout(timer);
      if (payload?.success && payload.transactionId) {
        resolve({ transactionId: payload.transactionId });
      } else {
        reject(new Error(payload?.error || 'wallet executor error'));
      }
    });

    win.webContents.send('wallet:execute-tx:request', { requestId, base64, network });
  });
}

