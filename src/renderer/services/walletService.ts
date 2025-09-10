import {
  HashinalsWalletConnectSDK,
  HashgraphSDK,
} from '@hashgraphonline/hashinal-wc';
import type { DAppSigner } from '@hashgraph/hedera-wallet-connect';
import type { LedgerId } from '@hashgraph/sdk';
import { SessionTypes, type SignClientTypes } from '@walletconnect/types';

type ExecResult = { success: boolean; transactionId?: string; error?: string };

export const walletService = {
  async connect(
    network: LedgerId,
    projectId: string,
    metadata: SignClientTypes.Metadata
  ): Promise<{
    accountId: string;
    balance: string;
    session: SessionTypes.Struct;
  }> {
    const sdk = HashinalsWalletConnectSDK.getInstance(undefined, network);
    const pid = projectId.trim();
    if (!pid) throw new Error('WalletConnect projectId missing');

    return sdk.connectWallet(pid, metadata, network);
  },

  async disconnect(): Promise<void> {
    await HashinalsWalletConnectSDK.getInstance().disconnectWallet(true);
  },

  getSDK(): HashinalsWalletConnectSDK {
    return HashinalsWalletConnectSDK.getInstance();
  },

  getAccountInfo(): { accountId: string; network: LedgerId } | null {
    const info = HashinalsWalletConnectSDK.getInstance().getAccountInfo();
    return info || null;
  },

  async getBalance(): Promise<string> {
    return await HashinalsWalletConnectSDK.getInstance().getAccountBalance();
  },

  async executeFromBytes(base64: string): Promise<ExecResult> {
    try {
      const bytes = Buffer.from(base64, 'base64');
      const tx = HashgraphSDK.Transaction.fromBytes(bytes);
      const txFrozenChecker = tx as unknown as { isFrozen?: () => boolean };
      const isFrozen = typeof txFrozenChecker.isFrozen === 'function' ? txFrozenChecker.isFrozen() : false;
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          isFrozen
        );
      if (out?.error) return { success: false, error: out.error };
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async executeScheduleSign(scheduleId: string): Promise<ExecResult> {
    try {
      const tx = new HashgraphSDK.ScheduleSignTransaction().setScheduleId(
        HashgraphSDK.ScheduleId.fromString(scheduleId)
      );
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          false
        );
      if (out?.error) return { success: false, error: out.error };
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async executeScheduleDelete(scheduleId: string): Promise<ExecResult> {
    try {
      const tx = new HashgraphSDK.ScheduleDeleteTransaction().setScheduleId(
        HashgraphSDK.ScheduleId.fromString(scheduleId)
      );
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          false
        );
      if (out?.error) {
        return { success: false, error: out.error };
      }
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async getSigner(): Promise<DAppSigner | null> {
    const sdk = HashinalsWalletConnectSDK.getInstance();
    const info = sdk.getAccountInfo();
    if (!info?.accountId) {
      return null;
    }
    const signer = sdk.dAppConnector.signers.find(
      (s) => s.getAccountId().toString() === info.accountId
    );
    return (signer as DAppSigner | undefined) || null;
  },
};

export type { ExecResult };
