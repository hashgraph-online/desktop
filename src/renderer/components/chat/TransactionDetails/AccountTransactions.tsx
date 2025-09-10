import React from 'react';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  CryptoCreateAccountData,
  CryptoUpdateAccountData,
  CryptoDeleteData,
  CryptoApproveAllowanceData,
  CryptoDeleteAllowanceData,
} from './types';

export const CryptoCreateAccountSection: React.FC<{
  cryptoCreateAccount: CryptoCreateAccountData;
}> = ({ cryptoCreateAccount }) => (
  <TransactionSection title='Account Creation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Initial Balance'
        value={cryptoCreateAccount.initialBalance}
      />
      <FieldRow
        label='Key'
        value={cryptoCreateAccount.key ? 'Set' : undefined}
      />
      <FieldRow
        label='Receiver Sig Required'
        value={cryptoCreateAccount.receiverSigRequired ? 'Yes' : 'No'}
      />
      <FieldRow
        label='Auto Renew Period'
        value={cryptoCreateAccount.autoRenewPeriod}
      />
      <FieldRow label='Memo' value={cryptoCreateAccount.memo} />
      <FieldRow
        label='Max Token Associations'
        value={cryptoCreateAccount.maxAutomaticTokenAssociations}
      />
      <FieldRow
        label='Staked Account ID'
        value={cryptoCreateAccount.stakedAccountId}
        isMono
      />
      <FieldRow
        label='Staked Node ID'
        value={cryptoCreateAccount.stakedNodeId}
      />
      <FieldRow
        label='Decline Reward'
        value={cryptoCreateAccount.declineReward ? 'Yes' : 'No'}
      />
      <FieldRow label='Alias' value={cryptoCreateAccount.alias} isMono />
    </div>
  </TransactionSection>
);

export const CryptoUpdateAccountSection: React.FC<{
  cryptoUpdateAccount: CryptoUpdateAccountData;
}> = ({ cryptoUpdateAccount }) => (
  <TransactionSection title='Account Update Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Account ID'
        value={cryptoUpdateAccount.accountIdToUpdate}
        isMono
      />
      <FieldRow
        label='Key'
        value={cryptoUpdateAccount.key ? 'Updated' : undefined}
      />
      <FieldRow
        label='Expiration Time'
        value={cryptoUpdateAccount.expirationTime}
      />
      <FieldRow
        label='Receiver Sig Required'
        value={cryptoUpdateAccount.receiverSigRequired ? 'Yes' : 'No'}
      />
      <FieldRow
        label='Auto Renew Period'
        value={cryptoUpdateAccount.autoRenewPeriod}
      />
      <FieldRow label='Memo' value={cryptoUpdateAccount.memo} />
      <FieldRow
        label='Max Token Associations'
        value={cryptoUpdateAccount.maxAutomaticTokenAssociations}
      />
      <FieldRow
        label='Staked Account ID'
        value={cryptoUpdateAccount.stakedAccountId}
        isMono
      />
      <FieldRow
        label='Staked Node ID'
        value={cryptoUpdateAccount.stakedNodeId}
      />
      <FieldRow
        label='Decline Reward'
        value={cryptoUpdateAccount.declineReward ? 'Yes' : 'No'}
      />
    </div>
  </TransactionSection>
);

export const CryptoDeleteSection: React.FC<{
  cryptoDelete: CryptoDeleteData;
}> = ({ cryptoDelete }) => (
  <TransactionSection title='Account Deletion Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Delete Account ID'
        value={cryptoDelete.deleteAccountId}
        isMono
      />
      <FieldRow
        label='Transfer Account ID'
        value={cryptoDelete.transferAccountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const CryptoApproveAllowanceSection: React.FC<{
  cryptoApproveAllowance: CryptoApproveAllowanceData;
}> = ({ cryptoApproveAllowance }) => (
  <TransactionSection title='Approve Allowance Details'>
    <div className='p-4 space-y-3'>
      {cryptoApproveAllowance.hbarAllowances &&
        cryptoApproveAllowance.hbarAllowances.length > 0 && (
          <div>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              HBAR Allowances ({cryptoApproveAllowance.hbarAllowances.length})
            </div>
            <div className='space-y-1'>
              {cryptoApproveAllowance.hbarAllowances.map((allowance, idx) => (
                <div
                  key={idx}
                  className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                >
                  Owner: {allowance.ownerAccountId} → Spender:{' '}
                  {allowance.spenderAccountId} | Amount: {allowance.amount} ℏ
                </div>
              ))}
            </div>
          </div>
        )}
      {cryptoApproveAllowance.tokenAllowances &&
        cryptoApproveAllowance.tokenAllowances.length > 0 && (
          <div>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              Token Allowances ({cryptoApproveAllowance.tokenAllowances.length})
            </div>
            <div className='space-y-1'>
              {cryptoApproveAllowance.tokenAllowances.map((allowance, idx) => (
                <div
                  key={idx}
                  className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                >
                  Token: {allowance.tokenId} | Owner: {allowance.ownerAccountId}{' '}
                  → Spender: {allowance.spenderAccountId} | Amount:{' '}
                  {allowance.amount}
                </div>
              ))}
            </div>
          </div>
        )}
      {cryptoApproveAllowance.nftAllowances &&
        cryptoApproveAllowance.nftAllowances.length > 0 && (
          <div>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              NFT Allowances ({cryptoApproveAllowance.nftAllowances.length})
            </div>
            <div className='space-y-1'>
              {cryptoApproveAllowance.nftAllowances.map((allowance, idx) => (
                <div
                  key={idx}
                  className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                >
                  Token: {allowance.tokenId} | Owner: {allowance.ownerAccountId}{' '}
                  → Spender: {allowance.spenderAccountId}
                  {allowance.approvedForAll && (
                    <span className='ml-2 text-xs bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 px-1 rounded'>
                      ALL
                    </span>
                  )}
                  {allowance.serialNumbers &&
                    allowance.serialNumbers.length > 0 && (
                      <span className='ml-2 text-xs'>
                        Serials: {allowance.serialNumbers.join(', ')}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  </TransactionSection>
);

export const CryptoDeleteAllowanceSection: React.FC<{
  cryptoDeleteAllowance: CryptoDeleteAllowanceData;
}> = ({ cryptoDeleteAllowance }) => (
  <TransactionSection title='Delete Allowance Details'>
    <div className='p-4'>
      {cryptoDeleteAllowance.nftAllowancesToRemove &&
        cryptoDeleteAllowance.nftAllowancesToRemove.length > 0 && (
          <div>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              NFT Allowances to Remove (
              {cryptoDeleteAllowance.nftAllowancesToRemove.length})
            </div>
            <div className='space-y-1'>
              {cryptoDeleteAllowance.nftAllowancesToRemove.map(
                (allowance, idx) => (
                  <div
                    key={idx}
                    className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                  >
                    Token: {allowance.tokenId} | Owner:{' '}
                    {allowance.ownerAccountId}
                    {allowance.serialNumbers &&
                      allowance.serialNumbers.length > 0 && (
                        <span className='ml-2 text-xs'>
                          Serials: {allowance.serialNumbers.join(', ')}
                        </span>
                      )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </div>
  </TransactionSection>
);
