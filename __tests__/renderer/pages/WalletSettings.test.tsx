import React from 'react';
import { render, screen } from '@testing-library/react';
import { WalletSettings } from '../../../src/renderer/pages/settings/WalletSettings';

jest.mock('../../../src/renderer/stores/walletStore', () => {
  const state = {
    isConnected: false,
    isInitializing: false,
    error: null,
    accountId: null,
    network: 'testnet',
    balance: null,
    init: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    refreshBalance: jest.fn(),
  };
  return { useWalletStore: (sel?: any) => (sel ? sel(state) : state) };
});

describe('WalletSettings', () => {
  it('shows project ID missing warning when not set', async () => {
    (window as any).electron.getEnvironmentConfig = jest.fn().mockResolvedValue({ enableMainnet: false, walletConnect: {} });
    render(<WalletSettings />);
    expect(await screen.findByText(/WalletConnect project ID is not set/i)).toBeInTheDocument();
  });
});
