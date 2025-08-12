import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { FiHash, FiClock, FiExternalLink } from 'react-icons/fi';
import { cn } from '../../../lib/utils';
import { useTokenInfoBatch } from '../../../hooks/useTokenInfo';
import { TransactionDetailsProps } from './types';
import { TransactionSummary } from './CommonFields';
import {
  HbarTransfersSection,
  TokenTransfersSection,
  AirdropSection,
} from './TransferComponents';
import {
  TokenCreationSection,
  TokenMintSection,
  TokenBurnSection,
  TokenUpdateSection,
  TokenDeleteSection,
  TokenAssociateSection,
  TokenDissociateSection,
  TokenFreezeSection,
  TokenUnfreezeSection,
  TokenGrantKycSection,
  TokenRevokeKycSection,
  TokenPauseSection,
  TokenUnpauseSection,
  TokenWipeSection,
  TokenFeeScheduleUpdateSection,
} from './TokenTransactions';
import {
  CryptoCreateAccountSection,
  CryptoUpdateAccountSection,
  CryptoDeleteSection,
  CryptoApproveAllowanceSection,
  CryptoDeleteAllowanceSection,
} from './AccountTransactions';
import {
  ContractCallSection,
  ContractCreateSection,
  ContractUpdateSection,
  ContractDeleteSection,
} from './ContractTransactions';
import {
  ConsensusCreateTopicSection,
  ConsensusSubmitMessageSection,
  ConsensusUpdateTopicSection,
  ConsensusDeleteTopicSection,
} from './ConsensusTransactions';
import {
  ScheduleCreateSection,
  ScheduleSignSection,
  ScheduleDeleteSection,
} from './ScheduleTransactions';
import { UtilPrngSection, FreezeSection } from './UtilityTransactions';

const hasValidContent = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      (typeof value !== 'object' || hasValidContent(value))
  );
};

export const TransactionDetails: React.FC<TransactionDetailsProps> = (
  props
) => {
  const {
    type,
    humanReadableType,
    transfers,
    tokenTransfers,
    memo,
    expirationTime,
    scheduleId,
    className,
    hideHeader,
    executedTransactionEntityId,
    executedTransactionType,
    network = 'testnet',
    variant = 'default',
    tokenCreationInfo,
    tokenCreation,
    tokenMint,
    tokenBurn,
    tokenUpdate,
    tokenDelete,
    tokenAssociate,
    tokenDissociate,
    tokenFreeze,
    tokenUnfreeze,
    tokenGrantKyc,
    tokenRevokeKyc,
    tokenPause,
    tokenUnpause,
    tokenWipeAccount,
    tokenFeeScheduleUpdate,
    airdrop,
    tokenAirdrop,
    cryptoCreateAccount,
    cryptoUpdateAccount,
    cryptoDelete,
    cryptoApproveAllowance,
    cryptoDeleteAllowance,
    contractCall,
    contractCreate,
    contractUpdate,
    contractDelete,
    consensusCreateTopic,
    consensusSubmitMessage,
    consensusUpdateTopic,
    consensusDeleteTopic,
    scheduleCreate,
    scheduleSign,
    scheduleDelete,
    utilPrng,
    freeze,
  } = props;

  const hasTransfers = transfers.length > 0;
  const hasTokenTransfers = tokenTransfers.length > 0;
  const tokenCreationData = tokenCreationInfo || tokenCreation;
  const hasTokenCreation = !!tokenCreationData;

  const tokenIds = useMemo(() => {
    const ids = new Set<string>();

    tokenTransfers.forEach((transfer) => ids.add(transfer.tokenId));

    if (airdrop?.tokenTransfers) {
      airdrop.tokenTransfers.forEach((t) => ids.add(t.tokenId));
    }
    if (tokenAirdrop?.tokenTransfers) {
      tokenAirdrop.tokenTransfers.forEach((t) => ids.add(t.tokenId));
    }

    return Array.from(ids);
  }, [tokenTransfers, airdrop, tokenAirdrop]);

  const tokenInfoMap = useTokenInfoBatch(tokenIds);

  let airdropData = airdrop || tokenAirdrop;
  if (!airdropData && type === 'TOKENAIRDROP' && hasTokenTransfers) {
    const tokenMap = new Map<
      string,
      Array<{ accountId: string; amount: string }>
    >();
    tokenTransfers.forEach((transfer) => {
      if (!tokenMap.has(transfer.tokenId)) {
        tokenMap.set(transfer.tokenId, []);
      }
      tokenMap.get(transfer.tokenId)!.push({
        accountId: transfer.accountId,
        amount: transfer.amount.toString(),
      });
    });

    airdropData = {
      tokenTransfers: Array.from(tokenMap.entries()).map(
        ([tokenId, transfers]) => ({
          tokenId,
          transfers,
        })
      ),
    };
  }

  const hasAirdrop = !!airdropData?.tokenTransfers?.length;

  const formattedExpirationTime = expirationTime
    ? (() => {
        try {
          return format(new Date(expirationTime), 'PPpp');
        } catch {
          return expirationTime;
        }
      })()
    : undefined;

  return (
    <div
      className={cn(
        variant === 'default' &&
          'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/40 rounded-lg p-4 border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm',
        variant === 'embedded' && 'p-0',
        className
      )}
    >
      <TransactionSummary
        type={type}
        humanReadableType={humanReadableType}
        transfers={transfers}
        hideHeader={hideHeader}
      />

      <div className='space-y-3'>
        {scheduleId && (
          <div className='flex items-center justify-between gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center gap-2'>
              <FiHash className='h-3.5 w-3.5 text-brand-blue' />
              <span>Schedule ID: {scheduleId}</span>
            </div>
            <a
              href={`https://hashscan.io/${network}/schedule/${scheduleId}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-brand-blue hover:text-brand-purple'
            >
              <FiExternalLink className='w-3.5 h-3.5' />
            </a>
          </div>
        )}

        {formattedExpirationTime && (
          <div className='flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <FiClock className='h-3.5 w-3.5 text-brand-purple' />
            <span>Expires: {formattedExpirationTime}</span>
          </div>
        )}

        {memo && (
          <div className='text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700'>
            <div className='font-medium mb-1'>Transaction Memo</div>
            <div className='leading-relaxed'>{memo}</div>
          </div>
        )}

        {hasTransfers && <HbarTransfersSection transfers={transfers} />}

        {hasTokenTransfers && (
          <TokenTransfersSection
            tokenTransfers={tokenTransfers}
            tokenInfoMap={tokenInfoMap}
          />
        )}

        {hasTokenCreation &&
          tokenCreationData &&
          hasValidContent(tokenCreationData) && (
            <TokenCreationSection
              tokenCreationData={tokenCreationData}
              executedTransactionEntityId={executedTransactionEntityId}
              type={type}
              executedTransactionType={executedTransactionType}
              network={network}
            />
          )}

        {tokenMint && <TokenMintSection tokenMint={tokenMint} />}
        {tokenBurn && <TokenBurnSection tokenBurn={tokenBurn} />}
        {tokenUpdate && <TokenUpdateSection tokenUpdate={tokenUpdate} />}
        {tokenDelete && <TokenDeleteSection tokenDelete={tokenDelete} />}
        {tokenAssociate && (
          <TokenAssociateSection tokenAssociate={tokenAssociate} />
        )}
        {tokenDissociate && (
          <TokenDissociateSection tokenDissociate={tokenDissociate} />
        )}
        {tokenFreeze && <TokenFreezeSection tokenFreeze={tokenFreeze} />}
        {tokenUnfreeze && (
          <TokenUnfreezeSection tokenUnfreeze={tokenUnfreeze} />
        )}
        {tokenGrantKyc && (
          <TokenGrantKycSection tokenGrantKyc={tokenGrantKyc} />
        )}
        {tokenRevokeKyc && (
          <TokenRevokeKycSection tokenRevokeKyc={tokenRevokeKyc} />
        )}
        {tokenPause && <TokenPauseSection tokenPause={tokenPause} />}
        {tokenUnpause && <TokenUnpauseSection tokenUnpause={tokenUnpause} />}
        {tokenWipeAccount && (
          <TokenWipeSection tokenWipeAccount={tokenWipeAccount} />
        )}
        {tokenFeeScheduleUpdate && (
          <TokenFeeScheduleUpdateSection
            tokenFeeScheduleUpdate={tokenFeeScheduleUpdate}
          />
        )}

        {hasAirdrop && airdropData && (
          <AirdropSection
            airdropData={airdropData}
            tokenInfoMap={tokenInfoMap}
          />
        )}

        {cryptoCreateAccount && (
          <CryptoCreateAccountSection
            cryptoCreateAccount={cryptoCreateAccount}
          />
        )}
        {cryptoUpdateAccount && (
          <CryptoUpdateAccountSection
            cryptoUpdateAccount={cryptoUpdateAccount}
          />
        )}
        {cryptoDelete && <CryptoDeleteSection cryptoDelete={cryptoDelete} />}
        {cryptoApproveAllowance && (
          <CryptoApproveAllowanceSection
            cryptoApproveAllowance={cryptoApproveAllowance}
          />
        )}
        {cryptoDeleteAllowance && (
          <CryptoDeleteAllowanceSection
            cryptoDeleteAllowance={cryptoDeleteAllowance}
          />
        )}

        {contractCall && <ContractCallSection contractCall={contractCall} />}
        {contractCreate && (
          <ContractCreateSection contractCreate={contractCreate} />
        )}
        {contractUpdate && (
          <ContractUpdateSection contractUpdate={contractUpdate} />
        )}
        {contractDelete && (
          <ContractDeleteSection contractDelete={contractDelete} />
        )}

        {hasValidContent(consensusCreateTopic) && consensusCreateTopic && (
          <ConsensusCreateTopicSection
            consensusCreateTopic={consensusCreateTopic}
          />
        )}
        {hasValidContent(consensusSubmitMessage) && consensusSubmitMessage && (
          <ConsensusSubmitMessageSection
            consensusSubmitMessage={consensusSubmitMessage}
          />
        )}
        {hasValidContent(consensusUpdateTopic) && consensusUpdateTopic && (
          <ConsensusUpdateTopicSection
            consensusUpdateTopic={consensusUpdateTopic}
          />
        )}
        {hasValidContent(consensusDeleteTopic) && consensusDeleteTopic && (
          <ConsensusDeleteTopicSection
            consensusDeleteTopic={consensusDeleteTopic}
          />
        )}

        {scheduleCreate && (
          <ScheduleCreateSection scheduleCreate={scheduleCreate} />
        )}
        {scheduleSign && <ScheduleSignSection scheduleSign={scheduleSign} />}
        {scheduleDelete && (
          <ScheduleDeleteSection scheduleDelete={scheduleDelete} />
        )}

        {utilPrng && <UtilPrngSection utilPrng={utilPrng} />}
        {freeze && <FreezeSection freeze={freeze} />}
      </div>
    </div>
  );
};

export default TransactionDetails;
