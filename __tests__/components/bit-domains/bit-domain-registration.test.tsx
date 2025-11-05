import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BitDomainRegistration } from '@/renderer/components/bit-domains/BitDomainRegistration';

const mockGetName = jest.fn();
const mockSetSigner = jest.fn();
const mockGetRegisterPriceUsd = jest.fn();
const mockGetRegisterPriceHbar = jest.fn();
const mockRegisterName = jest.fn();

jest.mock('@kabuto-sh/ns', () => {
  const constructor = jest.fn(function MockKNS(this: Record<string, unknown>) {
    this.getName = mockGetName;
    this.setSigner = mockSetSigner;
    this.getRegisterPriceUsd = mockGetRegisterPriceUsd;
    this.getRegisterPriceHbar = mockGetRegisterPriceHbar;
    this.registerName = mockRegisterName;
  });
  return {
    __esModule: true,
    KNS: constructor,
  };
});

const { KNS: MockKNS } = jest.requireMock('@kabuto-sh/ns') as {
  KNS: jest.Mock;
};

type WalletStateMock = {
  isConnected: boolean;
  network: 'mainnet' | 'testnet';
  accountId: string | null;
  connect: jest.Mock<Promise<void>, []>;
  service: {
    getSigner: jest.Mock<Promise<unknown>, []>;
  };
};

let walletState: WalletStateMock;
let user: ReturnType<typeof userEvent.setup>;

const mockUseWalletStore = jest.fn(<T,>(selector?: (state: WalletStateMock) => T) => {
  if (typeof selector === 'function') {
    return selector(walletState);
  }
  return walletState as unknown as T;
});

mockUseWalletStore.getState = () => walletState;

jest.mock('@/renderer/stores/walletStore', () => ({
  useWalletStore: (selector?: (state: WalletStateMock) => unknown) => mockUseWalletStore(selector),
}));

describe('BitDomainRegistration', () => {
  beforeEach(() => {
    walletState = {
      isConnected: true,
      network: 'testnet',
      accountId: '0.0.1001',
      connect: jest.fn().mockResolvedValue(undefined),
      service: {
        getSigner: jest.fn().mockResolvedValue({}),
      },
    };
    jest.useFakeTimers();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockUseWalletStore.mockClear();
    MockKNS.mockClear();
    mockGetName.mockReset();
    mockSetSigner.mockReset();
    mockGetRegisterPriceUsd.mockReset();
    mockGetRegisterPriceHbar.mockReset();
    mockRegisterName.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows pricing once an available domain is detected', async () => {
    walletState.isConnected = false;
    const nameNotFoundError = new Error('missing');
    nameNotFoundError.name = 'NameNotFoundError';
    mockGetName.mockRejectedValueOnce(nameNotFoundError);
    mockGetRegisterPriceUsd.mockResolvedValueOnce(12.34);
    mockGetRegisterPriceHbar.mockResolvedValueOnce({
      toString: () => '1.2345 ℏ',
    });

    render(<BitDomainRegistration />);

    expect(mockUseWalletStore).toHaveBeenCalled();
    expect(MockKNS).toHaveBeenCalledTimes(1);
    const knsInstance = MockKNS.mock.instances[0];
    expect(knsInstance).toBeDefined();
    if (knsInstance) {
      (knsInstance as Record<string, unknown>).getName = mockGetName;
      (knsInstance as Record<string, unknown>).getRegisterPriceUsd = mockGetRegisterPriceUsd;
      (knsInstance as Record<string, unknown>).getRegisterPriceHbar = mockGetRegisterPriceHbar;
      (knsInstance as Record<string, unknown>).registerName = mockRegisterName;
    }
    expect(knsInstance?.getName).toBe(mockGetName);
    const input = screen.getByPlaceholderText(/search \.bit domains/i);
    await user.type(input, 'hol');
    expect((input as HTMLInputElement).value).toBe('hol');

    await act(async () => {
      jest.advanceTimersByTime(600);
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockGetName).toHaveBeenCalledWith('hol.bit');
    });

    await waitFor(() => {
      expect(screen.getByText(/available/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/12\.34/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.2345/i)).toBeInTheDocument();
  });

  it('requests wallet connection before registering when disconnected', async () => {
    walletState.isConnected = false;
    walletState.connect = jest
      .fn()
      .mockImplementation(async () => {
        walletState.isConnected = true;
      });

    const nameNotFoundError = new Error('missing');
    nameNotFoundError.name = 'NameNotFoundError';
    mockGetName.mockRejectedValueOnce(nameNotFoundError);
    mockGetRegisterPriceUsd.mockResolvedValueOnce(10.5);
    mockGetRegisterPriceHbar.mockResolvedValueOnce({
      toString: () => '0.6543 ℏ',
    });

    render(<BitDomainRegistration />);

    expect(mockUseWalletStore).toHaveBeenCalled();
    expect(MockKNS).toHaveBeenCalledTimes(1);
    const knsInstance = MockKNS.mock.instances[0];
    expect(knsInstance).toBeDefined();
    if (knsInstance) {
      (knsInstance as Record<string, unknown>).getName = mockGetName;
      (knsInstance as Record<string, unknown>).getRegisterPriceUsd = mockGetRegisterPriceUsd;
      (knsInstance as Record<string, unknown>).getRegisterPriceHbar = mockGetRegisterPriceHbar;
      (knsInstance as Record<string, unknown>).registerName = mockRegisterName;
    }
    expect(knsInstance?.getName).toBe(mockGetName);
    const input = screen.getByPlaceholderText(/search \.bit domains/i);
    await user.type(input, 'connectme');
    expect((input as HTMLInputElement).value).toBe('connectme');

    await act(async () => {
      jest.advanceTimersByTime(600);
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(mockGetName).toHaveBeenCalledWith('connectme.bit');
    });

    await waitFor(() => {
      expect(screen.getByText(/available/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /connect wallet/i })
    ).toBeInTheDocument();
    expect(mockRegisterName).not.toHaveBeenCalled();
  });
});
