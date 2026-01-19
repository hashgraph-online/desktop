/**
 * Stub for @reown/walletkit - provides no-op implementation
 * The actual WalletKit functionality is not used in the desktop app
 */

export class WalletKit {
  static init(): Promise<WalletKit> {
    console.warn('@reown/walletkit is stubbed in desktop environment');
    return Promise.resolve(new WalletKit());
  }

  on(): void {}
  off(): void {}
  approveSession(): Promise<void> {
    return Promise.resolve();
  }
  rejectSession(): Promise<void> {
    return Promise.resolve();
  }
  updateSession(): Promise<void> {
    return Promise.resolve();
  }
  disconnectSession(): Promise<void> {
    return Promise.resolve();
  }
  respondSessionRequest(): Promise<void> {
    return Promise.resolve();
  }
  getActiveSessions(): Record<string, unknown> {
    return {};
  }
}

export default WalletKit;
