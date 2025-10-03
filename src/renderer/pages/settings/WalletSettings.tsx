import React, { useEffect, useState, useCallback } from 'react';
import Typography from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { useWalletStore } from '../../stores/walletStore';
import { useConfigStore } from '../../stores/configStore';
import { Logger } from '@hashgraphonline/standards-sdk';

interface WalletSettingsProps {}

/**
 * Wallet settings panel for connecting HashPack via WalletConnect.
 */
export const WalletSettings: React.FC<WalletSettingsProps> = () => {
  const {
    isConnected,
    isInitializing,
    error,
    accountId,
    network,
    balance,
    connect,
    disconnect,
    refreshBalance,
  } = useWalletStore();

  const appNet = useConfigStore((s) => s.config?.hedera?.network || 'testnet');

  const mismatched = isConnected && network !== appNet;
  const [projectId, setProjectId] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    window.desktop
      .getEnvironmentConfig()
      .then((envCfg: any) => {
        if (!mounted) return;
        const id = envCfg?.walletConnect?.projectId
          ? String(envCfg.walletConnect.projectId)
          : '';
        setProjectId(id.trim());
      })
      .catch(() => {
        setProjectId('');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className='space-y-4'>
      <Typography variant='h4' noMargin>
        Wallet
      </Typography>
      <Typography variant='body1' className='text-muted-foreground'>
        Connect HashPack via WalletConnect to approve transactions without
        storing private keys locally.
      </Typography>

      <div className='flex items-center gap-3'>
        {isConnected ? (
          <Button onClick={() => disconnect()} variant='outline'>
            Disconnect
          </Button>
        ) : (
          <Button onClick={() => connect()} disabled={isInitializing}>
            {isInitializing ? 'Initializing…' : 'Connect Wallet'}
          </Button>
        )}
        {isConnected ? (
          <Button onClick={() => refreshBalance()} variant='secondary'>
            Refresh Balance
          </Button>
        ) : null}
      </div>

      {!projectId && !isConnected && !isInitializing && (
        <Typography
          variant='caption'
          className='text-amber-700 dark:text-amber-300'
        >
          WalletConnect project ID is not set. Add WALLETCONNECT_PROJECT_ID to
          your environment to enable connection.
        </Typography>
      )}

      {error ? (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {error}
        </Typography>
      ) : null}

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 pt-2'>
        <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
          <Typography variant='overline' className='text-muted-foreground'>
            Status
          </Typography>
          <Typography variant='body1' className='text-foreground'>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Typography>
        </div>
        <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
          <Typography variant='overline' className='text-muted-foreground'>
            Account
          </Typography>
          <Typography variant='body1' className='text-foreground'>
            {accountId || '—'}
          </Typography>
        </div>
        <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
          <Typography variant='overline' className='text-muted-foreground'>
            Network
          </Typography>
          <Typography
            variant='body1'
            className={
              mismatched
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-foreground'
            }
          >
            {network}
          </Typography>
          {mismatched ? (
            <Typography
              variant='caption'
              className='text-amber-700 dark:text-amber-300'
            >
              Wallet network differs from app network ({appNet}). Update one
              before approving.
            </Typography>
          ) : null}
        </div>
        <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
          <Typography variant='overline' className='text-muted-foreground'>
            Balance (HBAR)
          </Typography>
          <Typography variant='body1' className='text-foreground'>
            {balance ?? '—'}
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default WalletSettings;
