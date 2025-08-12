export interface TransactionTransfer {
  accountId: string;
  amount: number;
  isDecimal?: boolean;
}

export interface TokenTransfer {
  tokenId: string;
  accountId: string;
  amount: number;
}

export interface TokenCreationData {
  tokenName?: string;
  tokenSymbol?: string;
  initialSupply?: string;
  decimals?: number;
  maxSupply?: string;
  tokenType?: string;
  supplyType?: string;
  memo?: string;
  treasuryAccountId?: string;
  adminKey?: string;
  kycKey?: string;
  freezeKey?: string;
  wipeKey?: string;
  supplyKey?: string;
  feeScheduleKey?: string;
  pauseKey?: string;
  metadataKey?: string;
  autoRenewAccount?: string;
  autoRenewPeriod?: string;
  expiry?: string;
  customFees?: Array<{
    feeCollectorAccountId: string;
    feeType: string;
    amount?: string;
    denominatingTokenId?: string;
  }>;
}

export interface TokenMintData {
  tokenId: string;
  amount: number;
  metadata?: string[];
}

export interface TokenBurnData {
  tokenId: string;
  amount: number;
  serialNumbers?: number[];
}

export interface TokenUpdateData {
  tokenId?: string;
  name?: string;
  symbol?: string;
  treasuryAccountId?: string;
  adminKey?: string;
  kycKey?: string;
  freezeKey?: string;
  wipeKey?: string;
  supplyKey?: string;
  feeScheduleKey?: string;
  pauseKey?: string;
  autoRenewAccountId?: string;
  autoRenewPeriod?: string;
  memo?: string;
  expiry?: string;
}

export interface TokenDeleteData {
  tokenId?: string;
}

export interface TokenAssociateData {
  accountId?: string;
  tokenIds?: string[];
}

export interface TokenDissociateData {
  accountId?: string;
  tokenIds?: string[];
}

export interface TokenFreezeData {
  tokenId?: string;
  accountId?: string;
}

export interface TokenUnfreezeData {
  tokenId?: string;
  accountId?: string;
}

export interface TokenGrantKycData {
  tokenId?: string;
  accountId?: string;
}

export interface TokenRevokeKycData {
  tokenId?: string;
  accountId?: string;
}

export interface TokenPauseData {
  tokenId?: string;
}

export interface TokenUnpauseData {
  tokenId?: string;
}

export interface TokenWipeAccountData {
  tokenId?: string;
  accountId?: string;
  serialNumbers?: string[];
  amount?: string;
}

export interface TokenFeeScheduleUpdateData {
  tokenId?: string;
  customFees?: Array<{
    feeCollectorAccountId: string;
    feeType: string;
    amount?: string;
    denominatingTokenId?: string;
  }>;
}

export interface AirdropData {
  tokenTransfers?: Array<{
    tokenId: string;
    transfers: Array<{
      accountId: string;
      amount: string;
    }>;
  }>;
}

export interface CryptoCreateAccountData {
  initialBalance?: string;
  key?: string;
  receiverSigRequired?: boolean;
  autoRenewPeriod?: string;
  memo?: string;
  maxAutomaticTokenAssociations?: number;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  alias?: string;
}

export interface CryptoUpdateAccountData {
  accountIdToUpdate?: string;
  key?: string;
  expirationTime?: string;
  receiverSigRequired?: boolean;
  autoRenewPeriod?: string;
  memo?: string;
  maxAutomaticTokenAssociations?: number;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
}

export interface CryptoDeleteData {
  deleteAccountId?: string;
  transferAccountId?: string;
}

export interface CryptoApproveAllowanceData {
  hbarAllowances?: Array<{
    ownerAccountId?: string;
    spenderAccountId?: string;
    amount?: string;
  }>;
  tokenAllowances?: Array<{
    tokenId?: string;
    ownerAccountId?: string;
    spenderAccountId?: string;
    amount?: string;
  }>;
  nftAllowances?: Array<{
    tokenId?: string;
    ownerAccountId?: string;
    spenderAccountId?: string;
    serialNumbers?: string[];
    approvedForAll?: boolean;
    delegatingSpender?: string;
  }>;
}

export interface CryptoDeleteAllowanceData {
  nftAllowancesToRemove?: Array<{
    ownerAccountId?: string;
    tokenId?: string;
    serialNumbers?: string[];
  }>;
}

export interface ContractCallInfo {
  contractId: string;
  gas?: number;
  amount?: number;
  functionParameters?: string;
  functionName?: string;
}

export interface ContractCreateData {
  initialBalance?: string;
  gas?: string;
  adminKey?: string;
  constructorParameters?: string;
  memo?: string;
  autoRenewPeriod?: string;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  maxAutomaticTokenAssociations?: number;
  initcodeSource?: 'fileID' | 'bytes';
  initcode?: string;
}

export interface ContractUpdateData {
  contractIdToUpdate?: string;
  adminKey?: string;
  expirationTime?: string;
  autoRenewPeriod?: string;
  memo?: string;
  stakedAccountId?: string;
  stakedNodeId?: string;
  declineReward?: boolean;
  maxAutomaticTokenAssociations?: number;
  autoRenewAccountId?: string;
}

export interface ContractDeleteData {
  contractIdToDelete?: string;
  transferAccountId?: string;
  transferContractId?: string;
}

export interface FileCreateData {
  expirationTime?: string;
  keys?: string;
  contents?: string;
  memo?: string;
  maxSize?: string;
}

export interface FileAppendData {
  fileId?: string;
  contents?: string;
}

export interface FileUpdateData {
  fileId?: string;
  expirationTime?: string;
  keys?: string;
  contents?: string;
  memo?: string;
}

export interface FileDeleteData {
  fileId?: string;
}

export interface ConsensusCreateTopicData {
  topicId?: string;
  memo?: string;
  adminKey?: string;
  submitKey?: string;
  autoRenewPeriod?: string;
  autoRenewAccountId?: string;
}

export interface ConsensusSubmitMessageData {
  topicId?: string;
  message?: string;
  messageEncoding?: 'utf8' | 'base64';
  chunkInfoInitialTransactionID?: string;
  chunkInfoNumber?: number;
  chunkInfoTotal?: number;
}

export interface ConsensusUpdateTopicData {
  topicId?: string;
  memo?: string;
  adminKey?: string;
  submitKey?: string;
  autoRenewPeriod?: string;
  autoRenewAccountId?: string;
  clearAdminKey?: boolean;
  clearSubmitKey?: boolean;
}

export interface ConsensusDeleteTopicData {
  topicId?: string;
}

export interface ScheduleCreateData {
  scheduledTransactionBody?: string;
  memo?: string;
  adminKey?: string;
  payerAccountId?: string;
  expirationTime?: string;
  waitForExpiry?: boolean;
}

export interface ScheduleSignData {
  scheduleId?: string;
}

export interface ScheduleDeleteData {
  scheduleId?: string;
}

export interface UtilPrngData {
  range?: number;
  prngBytes?: string;
}

export interface FreezeData {
  startTime?: string;
  fileId?: string;
  fileHash?: string;
}

export interface SystemDeleteData {
  fileId?: string;
  contractId?: string;
  expirationTime?: string;
}

export interface SystemUndeleteData {
  fileId?: string;
  contractId?: string;
}

export interface TransactionDetailsProps {
  type: string;
  humanReadableType: string;
  transfers: TransactionTransfer[];
  tokenTransfers: TokenTransfer[];
  memo?: string;
  expirationTime?: string;
  scheduleId?: string;
  className?: string;
  hideHeader?: boolean;
  executedTransactionEntityId?: string | null;
  executedTransactionType?: string | null;
  network?: string;
  variant?: 'default' | 'embedded';

  tokenCreationInfo?: TokenCreationData;
  tokenCreation?: TokenCreationData;
  tokenMint?: TokenMintData;
  tokenBurn?: TokenBurnData;
  tokenUpdate?: TokenUpdateData;
  tokenDelete?: TokenDeleteData;
  tokenAssociate?: TokenAssociateData;
  tokenDissociate?: TokenDissociateData;
  tokenFreeze?: TokenFreezeData;
  tokenUnfreeze?: TokenUnfreezeData;
  tokenGrantKyc?: TokenGrantKycData;
  tokenRevokeKyc?: TokenRevokeKycData;
  tokenPause?: TokenPauseData;
  tokenUnpause?: TokenUnpauseData;
  tokenWipeAccount?: TokenWipeAccountData;
  tokenFeeScheduleUpdate?: TokenFeeScheduleUpdateData;
  airdrop?: AirdropData;
  tokenAirdrop?: AirdropData;

  cryptoCreateAccount?: CryptoCreateAccountData;
  cryptoUpdateAccount?: CryptoUpdateAccountData;
  cryptoDelete?: CryptoDeleteData;
  cryptoApproveAllowance?: CryptoApproveAllowanceData;
  cryptoDeleteAllowance?: CryptoDeleteAllowanceData;

  contractCall?: ContractCallInfo;
  contractCreate?: ContractCreateData;
  contractUpdate?: ContractUpdateData;
  contractDelete?: ContractDeleteData;

  fileCreate?: FileCreateData;
  fileAppend?: FileAppendData;
  fileUpdate?: FileUpdateData;
  fileDelete?: FileDeleteData;

  consensusCreateTopic?: ConsensusCreateTopicData;
  consensusSubmitMessage?: ConsensusSubmitMessageData;
  consensusUpdateTopic?: ConsensusUpdateTopicData;
  consensusDeleteTopic?: ConsensusDeleteTopicData;

  scheduleCreate?: ScheduleCreateData;
  scheduleSign?: ScheduleSignData;
  scheduleDelete?: ScheduleDeleteData;

  utilPrng?: UtilPrngData;
  freeze?: FreezeData;
  systemDelete?: SystemDeleteData;
  systemUndelete?: SystemUndeleteData;
}