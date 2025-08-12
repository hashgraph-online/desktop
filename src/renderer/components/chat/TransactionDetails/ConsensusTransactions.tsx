import React from 'react';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  ConsensusCreateTopicData,
  ConsensusSubmitMessageData,
  ConsensusUpdateTopicData,
  ConsensusDeleteTopicData,
} from './types';

export const ConsensusCreateTopicSection: React.FC<{
  consensusCreateTopic: ConsensusCreateTopicData;
}> = ({ consensusCreateTopic }) => {
  const topicId = consensusCreateTopic.topicId;

  return (
    <TransactionSection title='Topic Creation Details'>
      <div className='p-4 space-y-1'>
        <FieldRow label='Topic ID' value={topicId} isMono />
        <FieldRow label='Memo' value={consensusCreateTopic.memo} />
        <FieldRow
          label='Admin Key'
          value={consensusCreateTopic.adminKey}
          isMono
        />
        <FieldRow
          label='Submit Key'
          value={consensusCreateTopic.submitKey}
          isMono
        />
        <FieldRow
          label='Auto Renew Period'
          value={consensusCreateTopic.autoRenewPeriod}
        />
        <FieldRow
          label='Auto Renew Account'
          value={consensusCreateTopic.autoRenewAccountId}
          isMono
        />
      </div>
    </TransactionSection>
  );
};

export const ConsensusSubmitMessageSection: React.FC<{
  consensusSubmitMessage: ConsensusSubmitMessageData;
}> = ({ consensusSubmitMessage }) => (
  <TransactionSection title='Submit Message Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Topic ID'
        value={consensusSubmitMessage.topicId}
        isMono
      />
      <FieldRow
        label='Message Encoding'
        value={consensusSubmitMessage.messageEncoding}
      />
      {consensusSubmitMessage.chunkInfoNumber &&
        consensusSubmitMessage.chunkInfoTotal && (
          <FieldRow
            label='Chunk Info'
            value={`${consensusSubmitMessage.chunkInfoNumber}/${consensusSubmitMessage.chunkInfoTotal}`}
          />
        )}
      {consensusSubmitMessage.message && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Message Content
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'>
            {consensusSubmitMessage.messageEncoding === 'utf8' ? (
              <span>
                {consensusSubmitMessage.message.length > 200
                  ? `${consensusSubmitMessage.message.substring(0, 200)}...`
                  : consensusSubmitMessage.message}
              </span>
            ) : (
              <span className='font-mono text-xs break-all'>
                {consensusSubmitMessage.message.length > 100
                  ? `${consensusSubmitMessage.message.substring(0, 100)}...`
                  : consensusSubmitMessage.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const ConsensusUpdateTopicSection: React.FC<{
  consensusUpdateTopic: ConsensusUpdateTopicData;
}> = ({ consensusUpdateTopic }) => (
  <TransactionSection title='Topic Update Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Topic ID' value={consensusUpdateTopic.topicId} isMono />
      <FieldRow label='Memo' value={consensusUpdateTopic.memo} />
      <FieldRow
        label='Admin Key'
        value={consensusUpdateTopic.adminKey}
        isMono
      />
      <FieldRow
        label='Submit Key'
        value={consensusUpdateTopic.submitKey}
        isMono
      />
      <FieldRow
        label='Auto Renew Period'
        value={consensusUpdateTopic.autoRenewPeriod}
      />
      <FieldRow
        label='Auto Renew Account'
        value={consensusUpdateTopic.autoRenewAccountId}
        isMono
      />
      <FieldRow
        label='Clear Admin Key'
        value={consensusUpdateTopic.clearAdminKey ? 'Yes' : undefined}
      />
      <FieldRow
        label='Clear Submit Key'
        value={consensusUpdateTopic.clearSubmitKey ? 'Yes' : undefined}
      />
    </div>
  </TransactionSection>
);

export const ConsensusDeleteTopicSection: React.FC<{
  consensusDeleteTopic: ConsensusDeleteTopicData;
}> = ({ consensusDeleteTopic }) => (
  <TransactionSection title='Topic Deletion Details'>
    <div className='p-4'>
      <FieldRow
        label='Topic ID'
        value={consensusDeleteTopic.topicId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);
