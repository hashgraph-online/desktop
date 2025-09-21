import React from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';

const WalletDisplay: React.FC = () => {
  const { isConnected, accountId, balance, network } = useWalletStore();
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';

  if (!isConnected || !accountId) {
    return null;
  }

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

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm transition-colors duration-300',
        isDark ? 'text-white' : 'text-brand-ink'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs backdrop-blur-sm transition-colors duration-300',
          isDark ? 'bg-white/10 text-white/90' : 'border border-brand-blue/20 bg-white/90 text-brand-ink'
        )}
        style={{ fontFamily: 'Roboto Mono, monospace' }}
      >
        <div className={cn('h-2 w-2 rounded-full', network === 'mainnet' ? 'bg-brand-green' : 'bg-brand-blue')} />
        <span>{formatAccountId(accountId)}</span>
      </div>
      <div
        className={cn(
          'font-mono text-xs transition-colors duration-300',
          isDark ? 'text-white/70' : 'text-brand-ink/70'
        )}
        style={{ fontFamily: 'Roboto Mono, monospace' }}
      >
        {formatBalance(balance)}
      </div>
    </div>
  );
};

export default WalletDisplay;
