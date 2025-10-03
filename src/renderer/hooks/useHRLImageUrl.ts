import { useState, useEffect } from 'react';
import { HRLResolver, NetworkType } from '@hashgraphonline/standards-sdk';

interface UseHRLImageUrlReturn {
  resolvedUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for resolving HRL URLs to HTTPS URLs
 */
export const useHRLImageUrl = (
  imageUrl: string | undefined,
  network: NetworkType = 'mainnet'
): UseHRLImageUrlReturn => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!imageUrl.startsWith('hcs://')) {
      setResolvedUrl(imageUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    const resolveHRL = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const hrlResolver = new HRLResolver();
        const parsed = hrlResolver.parseHRL(imageUrl);

        if (!parsed) {
          throw new Error('Invalid HRL format');
        }

        const cdnUrl = `https://kiloscribe.com/api/inscription-cdn/${parsed.topicId}?network=${network}`;
        setResolvedUrl(cdnUrl);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to resolve HRL';
        setError(errorMessage);
        setResolvedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    resolveHRL();
  }, [imageUrl, network]);

  return { resolvedUrl, isLoading, error };
};
