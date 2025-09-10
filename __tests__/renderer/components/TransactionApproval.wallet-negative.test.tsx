import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionApprovalButton } from '../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton';

jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: { parseScheduleResponse: jest.fn(() => ({})) },
  HederaMirrorNode: jest.fn().mockImplementation(() => ({ getTransaction: jest.fn().mockResolvedValue(null) })),
  Logger: function Logger() { return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setLogLevel: jest.fn() }; },
}));

describe('TransactionApprovalButton - wallet negative paths', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('shows rejection error when wallet rejects', async () => {
    jest.doMock('../../../src/renderer/stores/walletStore', () => {
      const state = {
        isConnected: true,
        network: 'testnet',
        executeFromBytes: jest.fn().mockResolvedValue({ success: false, error: 'You rejected the transaction' }),
      };
      return { useWalletStore: (sel?: any) => (sel ? sel(state) : state) };
    });
    jest.doMock('../../../src/renderer/stores/notificationStore', () => ({
      useNotificationStore: (sel: any) => sel({ addNotification: jest.fn() }),
    }));
    const { TransactionApprovalButton: Component } = require('../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton');

    render(<Component transactionBytes={'Cg=='} messageId={'mid-r'} description={'Test'} network={'testnet'} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve in Wallet/i }));
    await waitFor(() => {
      expect(screen.getByText(/You rejected the transaction/i)).toBeInTheDocument();
    });
  });

  it('shows timeout error when wallet times out', async () => {
    jest.doMock('../../../src/renderer/stores/walletStore', () => {
      const state = {
        isConnected: true,
        network: 'testnet',
        executeFromBytes: jest.fn().mockResolvedValue({ success: false, error: 'timeout' }),
      };
      return { useWalletStore: (sel?: any) => (sel ? sel(state) : state) };
    });
    jest.doMock('../../../src/renderer/stores/notificationStore', () => ({
      useNotificationStore: (sel: any) => sel({ addNotification: jest.fn() }),
    }));
    const { TransactionApprovalButton: Component } = require('../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton');

    render(<Component transactionBytes={'Cg=='} messageId={'mid-t'} description={'Test'} network={'testnet'} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve in Wallet/i }));
    await waitFor(() => {
      expect(screen.getByText(/timeout/i)).toBeInTheDocument();
    });
  });
});
