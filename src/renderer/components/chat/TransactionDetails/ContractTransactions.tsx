import React from 'react';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  ContractCallInfo,
  ContractCreateData,
  ContractUpdateData,
  ContractDeleteData,
} from './types';

export const ContractCallSection: React.FC<{
  contractCall: ContractCallInfo;
}> = ({ contractCall }) => (
  <TransactionSection title='Contract Call Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Contract ID' value={contractCall.contractId} isMono />
      <FieldRow label='Gas' value={contractCall.gas} />
      <FieldRow label='Amount' value={contractCall.amount} />
      <FieldRow label='Function Name' value={contractCall.functionName} />
      {contractCall.functionParameters && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Function Parameters
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
            {contractCall.functionParameters}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const ContractCreateSection: React.FC<{
  contractCreate: ContractCreateData;
}> = ({ contractCreate }) => (
  <TransactionSection title='Contract Creation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Initial Balance' value={contractCreate.initialBalance} />
      <FieldRow label='Gas' value={contractCreate.gas} />
      <FieldRow
        label='Admin Key'
        value={contractCreate.adminKey ? 'Set' : undefined}
      />
      <FieldRow label='Memo' value={contractCreate.memo} />
      <FieldRow label='Auto Renew Period' value={contractCreate.autoRenewPeriod} />
      <FieldRow
        label='Staked Account ID'
        value={contractCreate.stakedAccountId}
        isMono
      />
      <FieldRow label='Staked Node ID' value={contractCreate.stakedNodeId} />
      <FieldRow
        label='Decline Reward'
        value={contractCreate.declineReward ? 'Yes' : 'No'}
      />
      <FieldRow
        label='Max Token Associations'
        value={contractCreate.maxAutomaticTokenAssociations}
      />
      <FieldRow label='Initcode Source' value={contractCreate.initcodeSource} />
      {contractCreate.constructorParameters && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Constructor Parameters
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
            {contractCreate.constructorParameters}
          </div>
        </div>
      )}
      {contractCreate.initcode && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Initcode
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
            {contractCreate.initcode.length > 100
              ? `${contractCreate.initcode.substring(0, 100)}...`
              : contractCreate.initcode}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const ContractUpdateSection: React.FC<{
  contractUpdate: ContractUpdateData;
}> = ({ contractUpdate }) => (
  <TransactionSection title='Contract Update Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Contract ID'
        value={contractUpdate.contractIdToUpdate}
        isMono
      />
      <FieldRow
        label='Admin Key'
        value={contractUpdate.adminKey ? 'Updated' : undefined}
      />
      <FieldRow label='Expiration Time' value={contractUpdate.expirationTime} />
      <FieldRow label='Auto Renew Period' value={contractUpdate.autoRenewPeriod} />
      <FieldRow label='Memo' value={contractUpdate.memo} />
      <FieldRow
        label='Staked Account ID'
        value={contractUpdate.stakedAccountId}
        isMono
      />
      <FieldRow label='Staked Node ID' value={contractUpdate.stakedNodeId} />
      <FieldRow
        label='Decline Reward'
        value={contractUpdate.declineReward ? 'Yes' : 'No'}
      />
      <FieldRow
        label='Max Token Associations'
        value={contractUpdate.maxAutomaticTokenAssociations}
      />
      <FieldRow
        label='Auto Renew Account'
        value={contractUpdate.autoRenewAccountId}
        isMono
      />
    </div>
  </TransactionSection>
);

export const ContractDeleteSection: React.FC<{
  contractDelete: ContractDeleteData;
}> = ({ contractDelete }) => (
  <TransactionSection title='Contract Deletion Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Contract ID'
        value={contractDelete.contractIdToDelete}
        isMono
      />
      <FieldRow
        label='Transfer Account ID'
        value={contractDelete.transferAccountId}
        isMono
      />
      <FieldRow
        label='Transfer Contract ID'
        value={contractDelete.transferContractId}
        isMono
      />
    </div>
  </TransactionSection>
);