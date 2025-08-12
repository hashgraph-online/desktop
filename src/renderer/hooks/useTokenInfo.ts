import { useState, useEffect } from 'react';
import { HederaMirrorNode } from '@hashgraphonline/standards-sdk';
import { useConfigStore } from '../stores/configStore';

interface TokenInfo {
  tokenId: string;
  name?: string;
  symbol?: string;
  decimals: number;
  loading: boolean;
  error?: string;
}

const tokenInfoCache = new Map<string, { info: TokenInfo; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export function useTokenInfo(tokenId: string | undefined): TokenInfo | null {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const config = useConfigStore((state) => state.config);
  const network = config?.hedera?.network || 'testnet';

  useEffect(() => {
    if (!tokenId) {
      setTokenInfo(null);
      return;
    }

    const cached = tokenInfoCache.get(tokenId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setTokenInfo(cached.info);
      return;
    }

    setTokenInfo({
      tokenId,
      decimals: 0,
      loading: true,
    });

    const fetchTokenInfo = async () => {
      try {
        const mirrorNode = new HederaMirrorNode(
          network === 'mainnet' ? 'mainnet' : 'testnet'
        );
        
        const info = await mirrorNode.getTokenInfo(tokenId);
        
        if (info) {
          const tokenData: TokenInfo = {
            tokenId,
            name: info.name,
            symbol: info.symbol,
            decimals: parseInt(info.decimals) || 0,
            loading: false,
          };
          
          // Cache the result
          tokenInfoCache.set(tokenId, {
            info: tokenData,
            timestamp: Date.now(),
          });
          
          setTokenInfo(tokenData);
        } else {
          setTokenInfo({
            tokenId,
            decimals: 0,
            loading: false,
            error: 'Token info not found',
          });
        }
      } catch (error) {
        setTokenInfo({
          tokenId,
          decimals: 0,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch token info',
        });
      }
    };

    fetchTokenInfo();
  }, [tokenId, network]);

  return tokenInfo;
}

// Batch fetch multiple token infos
export function useTokenInfoBatch(tokenIds: string[]): Map<string, TokenInfo> {
  const [tokenInfoMap, setTokenInfoMap] = useState<Map<string, TokenInfo>>(new Map());
  const config = useConfigStore((state) => state.config);
  const network = config?.hedera?.network || 'testnet';

  useEffect(() => {
    if (!tokenIds || tokenIds.length === 0) {
      setTokenInfoMap(new Map());
      return;
    }

    const fetchTokenInfos = async () => {
      const mirrorNode = new HederaMirrorNode(
        network === 'mainnet' ? 'mainnet' : 'testnet'
      );
      
      const newMap = new Map<string, TokenInfo>();
      
      // Process unique token IDs
      const uniqueTokenIds = [...new Set(tokenIds)];
      
      for (const tokenId of uniqueTokenIds) {
        // Check cache first
        const cached = tokenInfoCache.get(tokenId);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          newMap.set(tokenId, cached.info);
          continue;
        }
        
        // Set loading state
        newMap.set(tokenId, {
          tokenId,
          decimals: 0,
          loading: true,
        });
        
        try {
          const info = await mirrorNode.getTokenInfo(tokenId);
          
          if (info) {
            const tokenData: TokenInfo = {
              tokenId,
              name: info.name,
              symbol: info.symbol,
              decimals: parseInt(info.decimals) || 0,
              loading: false,
            };
            
            // Cache the result
            tokenInfoCache.set(tokenId, {
              info: tokenData,
              timestamp: Date.now(),
            });
            
            newMap.set(tokenId, tokenData);
          } else {
            newMap.set(tokenId, {
              tokenId,
              decimals: 0,
              loading: false,
              error: 'Token info not found',
            });
          }
        } catch (error) {
          newMap.set(tokenId, {
            tokenId,
            decimals: 0,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch token info',
          });
        }
      }
      
      setTokenInfoMap(newMap);
    };

    fetchTokenInfos();
  }, [JSON.stringify(tokenIds), network]);

  return tokenInfoMap;
}

// Helper function to format token amount with decimals
export function formatTokenAmount(amount: string | number, decimals: number): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : BigInt(Math.floor(amount));
  
  if (decimals === 0) {
    return amountBigInt.toString();
  }
  
  const divisor = BigInt(10 ** decimals);
  const wholePart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;
  
  if (fractionalPart === 0n) {
    return wholePart.toString();
  }
  
  // Format fractional part with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}