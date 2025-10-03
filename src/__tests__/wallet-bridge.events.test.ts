import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { DesktopIPCData } from '@/types/desktop-bridge';

vi.mock('@kiloscribe/inscription-sdk', () => ({
  InscriptionSDK: { createWithAuth: vi.fn() },
}));

vi.mock('../renderer/services/walletService', () => ({
  walletService: {
    getSigner: vi.fn(async () => ({
      getAccountId: () => ({ toString: () => '0.0.1001' }),
    })),
    executeFromBytes: vi.fn(async () => ({
      success: true,
      transactionId: '0.0.5005-123-456',
    })),
  },
}));

describe('wallet bridge event wiring', () => {
  const originalDesktop = (window as typeof window & { desktop?: unknown }).desktop;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    (window as typeof window & { desktop?: unknown }).desktop = originalDesktop;
  });

  it('registers inscription handler using snake_case events', async () => {
    const on = vi.fn().mockReturnValue(() => {});
    const send = vi.fn();
    (window as typeof window & { desktop?: unknown }).desktop = {
      on,
      send,
    } as unknown as NonNullable<(typeof window)['desktop']>;

    await import('../renderer/services/wallet-bridge-renderer');

    expect(on).toHaveBeenCalledWith('wallet_inscribe_start_request', expect.any(Function));
  });

  it('normalizes inscription transaction bytes to base64 strings', async () => {
    const handlers = new Map<string, (payload: DesktopIPCData) => void>();
    const on = vi.fn((event: string, handler: (payload: DesktopIPCData) => void) => {
      handlers.set(event, handler);
      return () => {};
    });
    const send = vi.fn();
    (window as typeof window & { desktop?: unknown }).desktop = {
      on,
      send,
    } as unknown as NonNullable<(typeof window)['desktop']>;

    const { InscriptionSDK } = await import('@kiloscribe/inscription-sdk');
    const transactionSource = Buffer.from('inscription-payload');
    const transactionBuffer = {
      type: 'Buffer',
      data: Array.from(transactionSource.values()),
    } satisfies {
      type: 'Buffer';
      data: number[];
    };
    const startInscription = vi.fn(async () => ({
      transactionBytes: transactionBuffer,
      tx_id: '0.0.1001-123-456',
    }));
    vi.mocked(InscriptionSDK.createWithAuth).mockResolvedValue({
      startInscription,
    } as never);

    await import('../renderer/services/wallet-bridge-renderer');

    const handler = handlers.get('wallet_inscribe_start_request');
    expect(handler).toBeDefined();

    if (!handler) {
      throw new Error('wallet_inscribe_start_request handler was not registered');
    }

    await handler({
      requestId: 'abc',
      request: {},
      network: 'testnet',
    } as unknown as DesktopIPCData);

    expect(send).toHaveBeenCalledWith('wallet_inscribe_start_reply_abc', {
      success: true,
      data: expect.objectContaining({
        transactionBytes: transactionSource.toString('base64'),
      }),
    });
  });

  it('registers executor handler using snake_case events', async () => {
    const on = vi.fn().mockReturnValue(() => {});
    const send = vi.fn();
    (window as typeof window & { desktop?: unknown }).desktop = {
      on,
      send,
    } as unknown as NonNullable<(typeof window)['desktop']>;

    await import('../renderer/services/wallet-executor-bridge');

    expect(on).toHaveBeenCalledWith('wallet_execute_tx_request', expect.any(Function));
  });
});
