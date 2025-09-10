export const HashinalsWalletConnectSDK = {
  getInstance() {
    return {
      async init() { /* no-op */ },
      async connect() { /* no-op */ },
      async disconnect() { return true; },
      async disconnectAll() { return true; },
      getAccountInfo() { return { accountId: '0.0.1234', network: { toString: () => 'testnet' } }; },
      async getAccountBalance() { return '1.00'; },
      async executeTransactionWithErrorHandling() {
        return { transactionId: '0.0.1234@1.2.3' } as any;
      },
      dAppConnector: { signers: [{ getAccountId: () => ({ toString: () => '0.0.1234' }) }] },
    } as any;
  },
};

