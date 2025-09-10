import { act } from '@testing-library/react';
let useWalletStore: any;
let walletService: jest.Mocked<typeof import('../../../src/renderer/services/walletService')['walletService']>;

jest.setTimeout(5000);

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: class { info(){} warn(){} error(){} debug(){} },
  NetworkType: 'testnet',
}));

jest.mock('@hashgraphonline/hashinal-wc', () => ({
  HashinalsWalletConnectSDK: {
    getInstance: () => ({
      init: async () => {},
      connect: async () => {},
      disconnect: async () => true,
      getAccountInfo: () => ({ accountId: '0.0.1234', network: { toString: () => 'testnet' } }),
      getAccountBalance: async () => '1.00',
      executeTransactionWithErrorHandling: async () => ({ result: undefined, transactionId: '0.0.1234@1.2.3' }),
    }),
  },
}));

jest.mock('../../../src/renderer/services/walletService', () => {
  const walletService = {
    init: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getAccountInfo: jest.fn().mockReturnValue({ accountId: '0.0.1234', network: { toString: () => 'testnet' } }),
    getBalance: jest.fn().mockResolvedValue('1.00'),
    executeFromBytes: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
    executeScheduleSign: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
    executeScheduleDelete: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
    getSigner: jest.fn().mockResolvedValue({ getAccountId: () => ({ toString: () => '0.0.1234' }) }),
  };
  return { walletService };
});

beforeEach(async () => {
  jest.resetModules();
  process.env.WALLETCONNECT_PROJECT_ID = 'test-project';
  (window as any).electron.getEnvironmentConfig = jest.fn().mockResolvedValue({ enableMainnet: false, walletConnect: { projectId: 'test-project' } });
  const storeMod = await import('../../../src/renderer/stores/walletStore');
  useWalletStore = storeMod.useWalletStore;
  walletService = (await import('../../../src/renderer/services/walletService')).walletService as any;
});

describe('walletStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes and restores session', async () => {
    await act(async () => {
      await useWalletStore.getState().init();
    });
    expect(walletService.init).toHaveBeenCalled();
    expect(walletService.getAccountInfo).toHaveBeenCalled();
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.accountId).toBe('0.0.1234');
    expect(state.network).toBe('testnet');
    expect(state.balance).toBe('1.00');
  });

  it('connects and updates state', async () => {
    await act(async () => {
      await useWalletStore.getState().connect();
    });
    const state = useWalletStore.getState();
    expect(walletService.connect).toHaveBeenCalled();
    expect(state.isConnected).toBe(true);
  });

  it('executes from bytes via wallet', async () => {
    const res = await useWalletStore.getState().executeFromBytes('Cg==');
    expect(res.success).toBe(true);
  });
});
