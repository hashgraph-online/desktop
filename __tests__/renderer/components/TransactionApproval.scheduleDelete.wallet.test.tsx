import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../../src/renderer/stores/walletStore', () => {
  const state = {
    isConnected: true,
    network: 'testnet',
    executeScheduleDelete: jest.fn().mockResolvedValue({ success: true, transactionId: '0.0.5005@1.2.3' }),
  };
  return { useWalletStore: (sel?: any) => (sel ? sel(state) : state) };
});

jest.mock('../../../src/renderer/stores/notificationStore', () => {
  return { useNotificationStore: (sel: any) => sel({ addNotification: jest.fn() }) };
});

describe('TransactionApprovalButton - schedule delete via wallet', () => {
  it('deletes schedule with wallet when connected', async () => {
    const { TransactionApprovalButton } = require('../../../src/renderer/components/chat/TransactionApproval/TransactionApprovalButton');
    render(
      <TransactionApprovalButton
        scheduleId={'0.0.5005'}
        messageId={'mid-sched-del'}
        description={'Schedule Delete'}
        network={'testnet'}
        scheduleOp={'delete'}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Approve in Wallet|Approve Transaction/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Transaction Approved|Transaction Executed Successfully|Transaction Completed Successfully/i)
      ).toBeTruthy();
    });
  });
});

