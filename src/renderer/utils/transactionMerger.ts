import { ParsedTransaction } from '../types/transaction';

type TransactionMergeableField = keyof Pick<
  ParsedTransaction,
  | 'tokenCreation'
  | 'tokenAirdrop'
  | 'consensusCreateTopic'
  | 'consensusSubmitMessage'
  | 'consensusUpdateTopic'
  | 'consensusDeleteTopic'
  | 'cryptoCreateAccount'
  | 'contractCreate'
  | 'scheduleCreate'
  | 'fileCreate'
  | 'details'
>;

const MERGEABLE_FIELDS: TransactionMergeableField[] = [
  'tokenCreation',
  'tokenAirdrop', 
  'consensusCreateTopic',
  'consensusSubmitMessage',
  'consensusUpdateTopic',
  'consensusDeleteTopic',
  'cryptoCreateAccount',
  'contractCreate',
  'scheduleCreate',
  'fileCreate',
  'details',
];

export const mergeTransactionDetails = (
  enhancedTransaction: ParsedTransaction,
  originalTransaction: ParsedTransaction | null
): ParsedTransaction => {
  if (!originalTransaction) {
    return enhancedTransaction;
  }

  const mergedTransaction = { ...enhancedTransaction };

  for (const field of MERGEABLE_FIELDS) {
    const originalField = originalTransaction[field];
    const enhancedField = enhancedTransaction[field];

    if (originalField && enhancedField) {
      mergedTransaction[field] = {
        ...originalField,
        ...enhancedField,
      } as NonNullable<ParsedTransaction[typeof field]>;
    } else if (originalField && !enhancedField) {
      mergedTransaction[field] = originalField;
    }
  }

  return mergedTransaction;
};