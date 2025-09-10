import { useAgentStore } from '../stores/agentStore';

export function isLikelyPayerOnly(txType: string): boolean {
  const t = (txType || '').toUpperCase();
  return (
    (t.includes('CRYPTO') && t.includes('TRANSFER')) ||
    t.includes('TOKENASSOCIATE') ||
    t.includes('TOKENDISSOCIATE') ||
    t.includes('CONTRACTCALL') ||
    t.includes('SCHEDULESIGN') ||
    t.includes('CONSENSUSCREATETOPIC') ||
    t.includes('TOPICCREATE') ||
    (t.includes('CONSENSUS') && t.includes('CREATE') && t.includes('TOPIC'))
  );
}

export async function waitForMirrorConfirmation(
  txId: string,
  net: string,
  timeoutMs: number = 45000
): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    const toHyphenId = (id: string): string => {
      const s = String(id || '');
      const atIdx = s.indexOf('@');
      if (atIdx !== -1) {
        const prefix = s.slice(0, atIdx);
        const rest = s.slice(atIdx + 1);
        return rest.includes('.')
          ? `${prefix}-${rest.replace('.', '-')}`
          : `${prefix}-${rest}`;
      }
      return s;
    };

    const formattedId = toHyphenId(txId);
    const ledger: 'mainnet' | 'testnet' = (net || 'testnet') === 'mainnet' ? 'mainnet' : 'testnet';
    const deadline = Date.now() + Math.max(1000, timeoutMs);

    let lastStatus: string | undefined;
    while (Date.now() < deadline) {
      try {
        const resp = await (window as any).electron?.mirrorNode?.getTransaction?.(formattedId, ledger);
        if (resp && typeof resp === 'object' && resp.success && resp.data) {
          const tx = resp.data as any;
          const status = String(tx?.result || tx?.status || '').toUpperCase();
          if (status === 'SUCCESS') return { ok: true, status };
          if (status) return { ok: false, status };
        }
      } catch {
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { ok: false, status: lastStatus, error: 'Mirror confirmation timed out' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function persistExecuted(
  messageId: string | undefined,
  transactionId: string | undefined
): Promise<void> {
  try {
    if (!messageId) return;
    const sessId = useAgentStore.getState().currentSession?.id || undefined;
    await useAgentStore.getState().markTransactionExecuted(messageId, transactionId, sessId);
  } catch {
  }
}

