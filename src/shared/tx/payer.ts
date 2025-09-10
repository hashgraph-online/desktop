import { Transaction } from '@hashgraph/sdk';

export function getPayerFromTransactionBytes(base64: string): string | null {
  try {
    const tx = Transaction.fromBytes(Buffer.from(base64, 'base64')) as any;
    const payer = tx?.transactionId?.accountId?.toString?.();
    return typeof payer === 'string' && payer ? payer : null;
  } catch {
    return null;
  }
}

export function comparePayer(
  base64: string,
  expected: string | undefined | null
): { matches: boolean; payer: string | null } {
  const payer = getPayerFromTransactionBytes(base64);
  if (!expected || !payer) return { matches: false, payer };
  return { matches: payer === expected, payer };
}
