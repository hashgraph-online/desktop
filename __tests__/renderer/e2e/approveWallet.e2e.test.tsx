import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionApprovalButton } from '../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton';

jest.mock('../../../src/renderer/stores/walletStore', () => {
  const state = {
    isConnected: true,
    network: 'testnet',
    executeFromBytes: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.1234@1.2.3' }),
  };
  return {
    useWalletStore: (sel: any) => sel(state),
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
}));

describe('E2E (mocked): wallet approval to success display', () => {
  it('renders success state after wallet approval', async () => {
    render(
      <TransactionApprovalButton
        transactionBytes={'Cg=='}
        messageId={'mid-e2e'}
        description={'Test Tx'}
        network={'testnet'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Approve in Wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/Transaction Executed Successfully/i)).toBeInTheDocument();
    });
  });
});

