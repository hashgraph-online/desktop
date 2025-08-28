import React, { useState, useEffect } from 'react';
import {
  FiHash,
  FiExternalLink,
  FiFile,
  FiLoader,
} from 'react-icons/fi';
import { Logger } from '@hashgraphonline/standards-sdk';
import { TransactionSection, FieldRow } from './CommonFields';
import {
  TokenCreationData,
  TokenMintData,
  TokenBurnData,
  TokenUpdateData,
  TokenDeleteData,
  TokenAssociateData,
  TokenDissociateData,
  TokenFreezeData,
  TokenUnfreezeData,
  TokenGrantKycData,
  TokenRevokeKycData,
  TokenPauseData,
  TokenUnpauseData,
  TokenWipeAccountData,
  TokenFeeScheduleUpdateData,
} from './types';

const logger = new Logger({ module: 'TokenTransactions' });

interface TokenCreationSectionProps {
  tokenCreationData: TokenCreationData;
  executedTransactionEntityId?: string | null;
  type: string;
  executedTransactionType?: string | null;
  network?: string;
}

export const TokenCreationSection: React.FC<TokenCreationSectionProps> = ({
  tokenCreationData,
  executedTransactionEntityId,
  type,
  executedTransactionType,
  network = 'testnet',
}) => (
  <TransactionSection title='Token Creation Details'>
    <div className='p-4 space-y-1'>
      {executedTransactionEntityId &&
        (type === 'TOKENCREATE' ||
          type === 'TOKENCREATION' ||
          executedTransactionType === 'TOKENCREATE' ||
          executedTransactionType === 'TOKENCREATION') && (
          <div className='mb-3 p-3 bg-white/10 dark:bg-white/10 border border-white/20 rounded-lg'>
            <div className='flex items-center gap-2'>
              <FiHash className='h-4 w-4 text-white' />
              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                Created Token ID:
              </span>
              <span className='text-sm font-mono font-bold text-white'>
                {executedTransactionEntityId}
              </span>
              <a
                href={`https://hashscan.io/${network === 'testnet' ? 'testnet/' : ''}token/${executedTransactionEntityId}`}
                target='_blank'
                rel='noopener noreferrer'
                className='ml-auto text-white hover:text-white/80'
              >
                <FiExternalLink className='w-3.5 h-3.5' />
              </a>
            </div>
          </div>
        )}
      <FieldRow label='Token Name' value={tokenCreationData.tokenName} />
      <FieldRow label='Symbol' value={tokenCreationData.tokenSymbol} isMono />
      <FieldRow
        label='Initial Supply'
        value={
          tokenCreationData.initialSupply
            ? Number(tokenCreationData.initialSupply).toLocaleString()
            : undefined
        }
      />
      <FieldRow label='Decimals' value={tokenCreationData.decimals} />
      <FieldRow
        label='Max Supply'
        value={
          tokenCreationData.maxSupply
            ? Number(tokenCreationData.maxSupply).toLocaleString()
            : undefined
        }
      />
      <FieldRow label='Supply Type' value={tokenCreationData.supplyType} />
      <FieldRow label='Token Type' value={tokenCreationData.tokenType} />
      <FieldRow
        label='Treasury Account'
        value={tokenCreationData.treasuryAccountId}
        isMono
      />
      <FieldRow
        label='Admin Key'
        value={tokenCreationData.adminKey ? 'Set' : undefined}
      />
      <FieldRow
        label='KYC Key'
        value={tokenCreationData.kycKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Freeze Key'
        value={tokenCreationData.freezeKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Wipe Key'
        value={tokenCreationData.wipeKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Supply Key'
        value={tokenCreationData.supplyKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Fee Schedule Key'
        value={tokenCreationData.feeScheduleKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Pause Key'
        value={tokenCreationData.pauseKey ? 'Set' : undefined}
      />
      <FieldRow
        label='Auto Renew Account'
        value={tokenCreationData.autoRenewAccount}
        isMono
      />
      <FieldRow
        label='Auto Renew Period'
        value={tokenCreationData.autoRenewPeriod}
      />
      {tokenCreationData.memo && (
        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Token Memo
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'>
            {tokenCreationData.memo}
          </div>
        </div>
      )}
      {tokenCreationData.customFees &&
        tokenCreationData.customFees.length > 0 && (
          <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Custom Fees ({tokenCreationData.customFees.length})
            </div>
            <div className='space-y-1'>
              {tokenCreationData.customFees.map((fee, idx) => (
                <div
                  key={idx}
                  className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                >
                  {fee.feeType}: {fee.amount}{' '}
                  {fee.denominatingTokenId
                    ? `(Token: ${fee.denominatingTokenId})`
                    : '(HBAR)'}{' '}
                  → {fee.feeCollectorAccountId}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  </TransactionSection>
);

interface MetadataViewerProps {
  hrl: string;
  network?: string;
}

const MetadataViewer: React.FC<MetadataViewerProps> = ({
  hrl,
  network = 'testnet',
}) => {
  const [metadata, setMetadata] = useState<{
    name?: string;
    description?: string;
    creator?: string;
    type?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logger.debug('MetadataViewer loading HRL', { hrl });
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(null);

        const match = hrl.match(/hcs:\/\/\d+\/(0\.0\.\d+)/);
        if (!match || !match[1]) {
          throw new Error('Invalid HRL format');
        }
        logger.debug('MetadataViewer HRL match found', { match: match[1] });

        const topicId = match[1];
        logger.debug('MetadataViewer fetching metadata', { topicId, network });
        const cdnUrl = `https://kiloscribe.com/api/inscription-cdn/${topicId}?network=${network || 'testnet'}`;
        const response = await fetch(cdnUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch metadata');
        }

        const data = await response.json();
        logger.debug('MetadataViewer metadata loaded', { data });
        setMetadata(data);

        if (data.image) {
          logger.debug('MetadataViewer processing image', { imageUrl: data.image });
          if (data.image.startsWith('hcs://')) {
            const imageMatch = data.image.match(/hcs:\/\/\d+\/(0\.0\.\d+)/);
            if (imageMatch && imageMatch[1]) {
              setImageUrl(
                `https://kiloscribe.com/api/inscription-cdn/${imageMatch[1]}?network=${network || 'testnet'}`
              );
            }
          } else if (data.image.startsWith('https://')) {
            setImageUrl(data.image);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load metadata'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [hrl, network]);

  if (loading) {
    return (
      <div className='flex items-center gap-2 p-3 text-xs text-gray-500'>
        <FiLoader className='w-3 h-3 animate-spin' />
        Loading metadata...
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-xs text-red-500 p-2'>
        Failed to load metadata: {error}
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  return (
    <div className='mt-3 p-3 bg-white/5 rounded-lg border border-white/10'>
      {imageUrl && (
        <div className='mb-3'>
          <img
            src={imageUrl}
            alt={metadata.name || 'NFT Image'}
            className='w-full max-w-[200px] h-auto rounded-lg'
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className='space-y-2'>
        {metadata.name && (
          <div>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              Name:
            </span>
            <p className='text-sm font-medium text-white'>{metadata.name}</p>
          </div>
        )}

        {metadata.description && (
          <div>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              Description:
            </span>
            <p className='text-xs text-gray-300'>{metadata.description}</p>
          </div>
        )}

        {metadata.creator && (
          <div>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              Creator:
            </span>
            <p className='text-xs font-mono text-gray-300'>
              {metadata.creator}
            </p>
          </div>
        )}

        {metadata.type && (
          <div>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              Type:
            </span>
            <p className='text-xs text-gray-300'>{metadata.type}</p>
          </div>
        )}

        {metadata.attributes && metadata.attributes.length > 0 && (
          <div>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              Attributes:
            </span>
            <div className='mt-1 grid grid-cols-2 gap-2'>
              {metadata.attributes.map((attr, idx: number) => (
                <div key={idx} className='bg-white/5 rounded p-2'>
                  <p className='text-xs text-gray-400'>{attr.trait_type}</p>
                  <p className='text-xs font-medium text-white'>{attr.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const TokenMintSection: React.FC<{ tokenMint: TokenMintData }> = ({
  tokenMint,
}) => {
  const decodeMetadata = (meta: string): string => {
    try {
      return atob(meta);
    } catch {
      return meta;
    }
  };

  return (
    <TransactionSection title='Token Mint Details'>
      <div className='p-4 space-y-1'>
        <FieldRow label='Token ID' value={tokenMint.tokenId} isMono />
        <FieldRow label='Amount' value={tokenMint.amount} />
        {tokenMint.metadata && tokenMint.metadata.length > 0 && (
          <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Metadata ({tokenMint.metadata.length} items)
            </div>
            <div className='space-y-2'>
              {tokenMint.metadata.map((meta, idx) => {
                const decodedMeta = decodeMetadata(meta);
                const isHRL = decodedMeta.startsWith('hcs://');

                return (
                  <div
                    key={idx}
                    className='bg-gray-50 dark:bg-gray-700 p-3 rounded'
                  >
                    <div className='text-sm text-gray-600 dark:text-gray-400 font-mono text-xs break-all'>
                      {decodedMeta}
                    </div>
                    {isHRL && (
                      <MetadataViewer hrl={decodedMeta} network='testnet' />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TransactionSection>
  );
};

export const TokenBurnSection: React.FC<{ tokenBurn: TokenBurnData }> = ({
  tokenBurn,
}) => (
  <TransactionSection title='Token Burn Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenBurn.tokenId} isMono />
      <FieldRow label='Amount' value={tokenBurn.amount} />
      {tokenBurn.serialNumbers && tokenBurn.serialNumbers.length > 0 && (
        <FieldRow
          label='Serial Numbers'
          value={tokenBurn.serialNumbers.join(', ')}
        />
      )}
    </div>
  </TransactionSection>
);

export const TokenUpdateSection: React.FC<{
  tokenUpdate: TokenUpdateData;
}> = ({ tokenUpdate }) => (
  <TransactionSection title='Token Update Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenUpdate.tokenId} isMono />
      <FieldRow label='Name' value={tokenUpdate.name} />
      <FieldRow label='Symbol' value={tokenUpdate.symbol} isMono />
      <FieldRow
        label='Treasury Account'
        value={tokenUpdate.treasuryAccountId}
        isMono
      />
      <FieldRow
        label='Admin Key'
        value={tokenUpdate.adminKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='KYC Key'
        value={tokenUpdate.kycKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Freeze Key'
        value={tokenUpdate.freezeKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Wipe Key'
        value={tokenUpdate.wipeKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Supply Key'
        value={tokenUpdate.supplyKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Fee Schedule Key'
        value={tokenUpdate.feeScheduleKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Pause Key'
        value={tokenUpdate.pauseKey ? 'Updated' : undefined}
      />
      <FieldRow
        label='Auto Renew Account'
        value={tokenUpdate.autoRenewAccountId}
        isMono
      />
      <FieldRow label='Auto Renew Period' value={tokenUpdate.autoRenewPeriod} />
      <FieldRow label='Memo' value={tokenUpdate.memo} />
      <FieldRow label='Expiry' value={tokenUpdate.expiry} />
    </div>
  </TransactionSection>
);

export const TokenDeleteSection: React.FC<{
  tokenDelete: TokenDeleteData;
}> = ({ tokenDelete }) => (
  <TransactionSection title='Token Delete Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenDelete.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenAssociateSection: React.FC<{
  tokenAssociate: TokenAssociateData;
}> = ({ tokenAssociate }) => (
  <TransactionSection title='Token Association Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Account ID' value={tokenAssociate.accountId} isMono />
      {tokenAssociate.tokenIds && (
        <div>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Token IDs ({tokenAssociate.tokenIds.length})
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 font-mono'>
            {tokenAssociate.tokenIds.join(', ')}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const TokenDissociateSection: React.FC<{
  tokenDissociate: TokenDissociateData;
}> = ({ tokenDissociate }) => (
  <TransactionSection title='Token Dissociation Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Account ID' value={tokenDissociate.accountId} isMono />
      {tokenDissociate.tokenIds && (
        <div>
          <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Token IDs ({tokenDissociate.tokenIds.length})
          </div>
          <div className='text-sm text-gray-600 dark:text-gray-400 font-mono'>
            {tokenDissociate.tokenIds.join(', ')}
          </div>
        </div>
      )}
    </div>
  </TransactionSection>
);

export const TokenFreezeSection: React.FC<{
  tokenFreeze: TokenFreezeData;
}> = ({ tokenFreeze }) => (
  <TransactionSection title='Token Freeze Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenFreeze.tokenId} isMono />
      <FieldRow
        label='Account ID'
        value={tokenFreeze.accountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const TokenUnfreezeSection: React.FC<{
  tokenUnfreeze: TokenUnfreezeData;
}> = ({ tokenUnfreeze }) => (
  <TransactionSection title='Token Unfreeze Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenUnfreeze.tokenId} isMono />
      <FieldRow
        label='Account ID'
        value={tokenUnfreeze.accountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const TokenGrantKycSection: React.FC<{
  tokenGrantKyc: TokenGrantKycData;
}> = ({ tokenGrantKyc }) => (
  <TransactionSection title='Token Grant KYC Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenGrantKyc.tokenId} isMono />
      <FieldRow
        label='Account ID'
        value={tokenGrantKyc.accountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const TokenRevokeKycSection: React.FC<{
  tokenRevokeKyc: TokenRevokeKycData;
}> = ({ tokenRevokeKyc }) => (
  <TransactionSection title='Token Revoke KYC Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenRevokeKyc.tokenId} isMono />
      <FieldRow
        label='Account ID'
        value={tokenRevokeKyc.accountId}
        isMono
        isLast
      />
    </div>
  </TransactionSection>
);

export const TokenPauseSection: React.FC<{ tokenPause: TokenPauseData }> = ({
  tokenPause,
}) => (
  <TransactionSection title='Token Pause Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenPause.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenUnpauseSection: React.FC<{
  tokenUnpause: TokenUnpauseData;
}> = ({ tokenUnpause }) => (
  <TransactionSection title='Token Unpause Details'>
    <div className='p-4'>
      <FieldRow label='Token ID' value={tokenUnpause.tokenId} isMono isLast />
    </div>
  </TransactionSection>
);

export const TokenWipeSection: React.FC<{
  tokenWipeAccount: TokenWipeAccountData;
}> = ({ tokenWipeAccount }) => (
  <TransactionSection title='Token Wipe Details'>
    <div className='p-4 space-y-1'>
      <FieldRow label='Token ID' value={tokenWipeAccount.tokenId} isMono />
      <FieldRow label='Account ID' value={tokenWipeAccount.accountId} isMono />
      <FieldRow label='Amount' value={tokenWipeAccount.amount} />
      {tokenWipeAccount.serialNumbers &&
        tokenWipeAccount.serialNumbers.length > 0 && (
          <FieldRow
            label='Serial Numbers'
            value={tokenWipeAccount.serialNumbers.join(', ')}
          />
        )}
    </div>
  </TransactionSection>
);

export const TokenFeeScheduleUpdateSection: React.FC<{
  tokenFeeScheduleUpdate: TokenFeeScheduleUpdateData;
}> = ({ tokenFeeScheduleUpdate }) => (
  <TransactionSection title='Token Fee Schedule Update Details'>
    <div className='p-4 space-y-1'>
      <FieldRow
        label='Token ID'
        value={tokenFeeScheduleUpdate.tokenId}
        isMono
      />
      {tokenFeeScheduleUpdate.customFees &&
        tokenFeeScheduleUpdate.customFees.length > 0 && (
          <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
            <div className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Custom Fees ({tokenFeeScheduleUpdate.customFees.length})
            </div>
            <div className='space-y-1'>
              {tokenFeeScheduleUpdate.customFees.map((fee, idx) => (
                <div
                  key={idx}
                  className='text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded'
                >
                  {fee.feeType}: {fee.amount}{' '}
                  {fee.denominatingTokenId
                    ? `(Token: ${fee.denominatingTokenId})`
                    : '(HBAR)'}{' '}
                  → {fee.feeCollectorAccountId}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  </TransactionSection>
);
