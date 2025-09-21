import React, { useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { InscriberBuilder } from '@hashgraphonline/standards-agent-kit';
import useWalletOperationalMode from '../hooks/useWalletOperationalMode';
type DAppSigner = {
  getAccountId(): { toString(): string };
  [key: string]: unknown;
};

interface Props {
  children: React.ReactNode;
}

export const WalletInitProvider: React.FC<Props> = ({ children }) => {
  const init = useWalletStore((s) => s.init);
  const service = useWalletStore((s) => s.service);
  const initializedRef = React.useRef(false);
  useWalletOperationalMode();

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    void init();

    InscriberBuilder.setSignerProvider(async (): Promise<DAppSigner | null> => {
      const signer = await service.getSigner();
      if (!signer) {
        console.error('No signer found');
        return null;
      }
      return signer as unknown as DAppSigner;
    });

    return () => {
      initializedRef.current = false;
    };
  }, [init, service]);

  return <>{children}</>;
};

export default WalletInitProvider;
