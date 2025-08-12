import React from 'react';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  ScheduleCreateData,
  ScheduleSignData,
  ScheduleDeleteData,
} from './types';

export const ScheduleCreateSection: React.FC<{
  scheduleCreate: ScheduleCreateData;
}> = ({ scheduleCreate }) => (
  <TransactionSection title='Schedule Creation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Memo' value={scheduleCreate.memo} />
      <FieldRow
        label='Admin Key'
        value={scheduleCreate.adminKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Payer Account'
        value={scheduleCreate.payerAccountId}
        isMono
      />
      <FieldRow label='Expiration Time' value={scheduleCreate.expirationTime} />
      <FieldRow
        label='Wait For Expiry'
        value={scheduleCreate.waitForExpiry ? 'Yes' : 'No'}
      />
      {scheduleCreate.scheduledTransactionBody && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Scheduled Transaction Body
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all'>
            {scheduleCreate.scheduledTransactionBody.length > 100
              ? `${scheduleCreate.scheduledTransactionBody.substring(0, 100)}...`
              : scheduleCreate.scheduledTransactionBody}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const ScheduleSignSection: React.FC<{
  scheduleSign: ScheduleSignData;
}> = ({ scheduleSign }) => (
  <TransactionSection title='Schedule Sign Details'>
    <div className='p-4'>
      <FieldRow
        label='Schedule ID'
        value={scheduleSign.scheduleId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const ScheduleDeleteSection: React.FC<{
  scheduleDelete: ScheduleDeleteData;
}> = ({ scheduleDelete }) => (
  <TransactionSection title='Schedule Deletion Details'>
    <div className='p-4'>
      <FieldRow
        label='Schedule ID'
        value={scheduleDelete.scheduleId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);