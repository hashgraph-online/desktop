import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

export async function startInscriptionViaWallet(
  request: Record<string, unknown>,
  network: 'mainnet' | 'testnet',
  timeoutMs = 60000
): Promise<{
  transactionBytes: string;
  tx_id?: string;
  topic_id?: string;
  status?: string;
  completed?: boolean;
}> {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) throw new Error('No renderer window available');
  const win = windows[0];
  const requestId = randomUUID();

  return new Promise((resolve, reject) => {
    const replyChannel = `wallet:inscribe-start:reply:${requestId}`;
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(replyChannel);
      reject(new Error('wallet inscription start timeout'));
    }, timeoutMs);

    ipcMain.once(
      replyChannel,
      (_event, payload: { success: boolean; data?: any; error?: string }) => {
        clearTimeout(timer);
        if (payload?.success && payload.data?.transactionBytes) {
          resolve(payload.data);
        } else {
          reject(new Error(payload?.error || 'wallet inscription start failed'));
        }
      }
    );

    win.webContents.send('wallet:inscribe-start:request', {
      requestId,
      request,
      network,
    });
  });
}

