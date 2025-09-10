import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../../src/renderer/stores/walletStore', () => {
  const state = {
    isConnected: true,
    network: 'testnet',
    executeFromBytes: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
  };
  return {
    useWalletStore: (sel?: any) => (sel ? sel(state) : state),
  };
});

jest.mock('../../../src/renderer/stores/notificationStore', () => {
  return {
    useNotificationStore: (sel: any) => sel({ addNotification: jest.fn() }),
  };
});

jest.mock('@hashgraphonline/standards-sdk', () => ({
  TransactionParser: { parseScheduleResponse: jest.fn(() => ({})) },
  HederaMirrorNode: jest.fn().mockImplementation(() => ({ getTransaction: jest.fn().mockResolvedValue(null) })),
  Logger: function Logger() { return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setLogLevel: jest.fn() }; },
}));

describe('TransactionApprovalButton - wallet path', () => {
  it('approves via wallet when connected and networks match', async () => {
    const { TransactionApprovalButton } = require('../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton');
    render(
      <TransactionApprovalButton transactionBytes={'Cg=='} messageId={'mid-1'} description={'Test Tx'} network={'testnet'} />
    );

    const btn = screen.getByRole('button', { name: /Approve Transaction/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Processing|Signing|Submitting|Confirming/i)).toBeTruthy();
    });
  });

  it('blocks on network mismatch and does not call wallet execution', async () => {
    jest.resetModules();
    jest.doMock('../../../src/renderer/stores/walletStore', () => {
      const state = {
        isConnected: true,
        network: 'mainnet',
        executeFromBytes: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
      };
      return { useWalletStore: (sel: any) => sel(state) };
    });
    const { TransactionApprovalButton: Component } = require('../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton');

    render(<Component transactionBytes={'Cg=='} messageId={'mid-2'} description={'Test'} network={'testnet'} />);

    const btn = screen.getByRole('button', { name: /Approve Transaction/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Network Mismatch/i)).toBeInTheDocument();
    });
  });
});
