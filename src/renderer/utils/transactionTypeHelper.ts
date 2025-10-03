export const getHumanReadableTransactionType = (transactionType?: string): string => {
  if (!transactionType || typeof transactionType !== 'string') return 'Unknown Transaction';

  const typeMap: Record<string, string> = {
    CRYPTOCREATEACCOUNT: 'Account Creation',
    CRYPTOTRANSFER: 'Transfer',
    CONTRACTCALL: 'Smart Contract Call',
    CONTRACTCREATEINSTANCE: 'Smart Contract Deployment',
    TOKENCREATION: 'Token Creation',
    TOKENASSOCIATE: 'Token Association',
    TOKENDISSOCIATE: 'Token Dissociation',
    TOKENMINT: 'Token Mint',
    TOKENBURN: 'Token Burn',
    CONSENSUSSUBMITMESSAGE: 'Topic Message',
    SCHEDULECREATE: 'Schedule Creation',
    SCHEDULESIGN: 'Schedule Signing',
    TOKENUPDATE: 'Token Update',
    ACCOUNTUPDATE: 'Account Update',
    FILEUPDATE: 'File Update',
    SYSTEMDELETE: 'System Delete',
    FREEZE: 'Network Freeze',
    CONSENSUSCREATETOPIC: 'Topic Creation',
    CONSENSUSUPDATETOPIC: 'Topic Update',
    CONSENSUSDELETETOPIC: 'Topic Deletion',
  };

  return typeMap[transactionType.toUpperCase()] || transactionType;
};