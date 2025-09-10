import { z } from 'zod';

export const MessageMetadataPatchSchema = z
  .object({
    pendingApproval: z.boolean().optional(),
    approved: z.boolean().optional(),
    transactionId: z.string().min(10).max(120).optional(),
    executedAt: z.string().min(10).max(64).optional(),
    approvalError: z.string().max(500).optional(),
  })
  .strict();

export type MessageMetadataPatch = z.infer<typeof MessageMetadataPatchSchema>;

/**
 * Narrow type guard for plain object records.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Applies a validated metadata patch onto the current metadata while enforcing idempotent rules.
 */
export function applyMetadataPatch(
  current: unknown,
  patch: MessageMetadataPatch
): { merged: Record<string, unknown> } {
  const base: Record<string, unknown> = isRecord(current) ? { ...current } : {};

  const prevApproved = Boolean((base as { approved?: boolean }).approved);
  const nextApproved = Boolean(patch.approved);

  if (prevApproved && patch.approved === false) {
    return { merged: base };
  }

  const prevTx = (base as { transactionId?: unknown }).transactionId;
  if (prevApproved && patch.transactionId && prevTx && patch.transactionId !== String(prevTx)) {
    return { merged: base };
  }

  const merged: Record<string, unknown> = {
    ...base,
    ...(patch.pendingApproval !== undefined
      ? { pendingApproval: patch.pendingApproval }
      : {}),
    ...(patch.approved !== undefined
      ? { approved: patch.approved || prevApproved }
      : prevApproved
      ? { approved: true }
      : {}),
    ...(patch.transactionId ? { transactionId: patch.transactionId } : {}),
    ...(patch.executedAt ? { executedAt: patch.executedAt } : {}),
    ...(patch.approvalError !== undefined
      ? { approvalError: patch.approvalError }
      : {}),
  };

  if (merged.pendingApproval === undefined) {
    merged.pendingApproval = false;
  }

  return { merged };
}

