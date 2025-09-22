import React, { useCallback } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

const WalletDisplay: React.FC = () => {
  const {
    isConnected,
    accountId,
    balance,
    network,
    isInitializing,
    connect,
    disconnect,
  } = useWalletStore();
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';

  const formatBalance = (balance: string | null): string => {
    if (!balance) return '0 ℏ';
    const num = parseFloat(balance);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k ℏ`;
    }
    return `${num.toFixed(2)} ℏ`;
  };

  const formatAccountId = (accountId: string): string => {
    if (accountId.length <= 12) return accountId;
    return `${accountId.slice(0, 6)}...${accountId.slice(-4)}`;
  };

  const handleConnect = useCallback(() => {
    void connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    void disconnect();
  }, [disconnect]);

  if (!isConnected || !accountId) {
    return (
      <Button
        size='sm'
        onClick={handleConnect}
        disabled={isInitializing}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200',
          isDark
            ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
            : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
        )}
      >
        {isInitializing ? 'Connecting…' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs font-semibold transition-colors duration-200',
        isDark ? 'text-white/80' : 'text-brand-ink/85'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-sm transition-colors duration-200',
          isDark ? 'border-white/15 bg-white/10' : 'border-gray-200 bg-white/90 shadow-sm'
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', network === 'mainnet' ? 'bg-brand-green' : 'bg-brand-blue')} />
        <span className='font-mono' style={{ fontFamily: 'Roboto Mono, monospace' }}>
          {formatAccountId(accountId)}
        </span>
        <span className='font-mono text-[10px] opacity-70' style={{ fontFamily: 'Roboto Mono, monospace' }}>
          {formatBalance(balance)}
        </span>
        <button
          type='button'
          onClick={handleDisconnect}
          className={cn(
            'rounded-full px-2 py-1 text-[10px] font-semibold transition-all duration-200',
            isDark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default WalletDisplay;
