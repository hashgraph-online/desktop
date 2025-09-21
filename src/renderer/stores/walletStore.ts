import { create } from 'zustand';
import { Logger, NetworkType } from '@hashgraphonline/standards-sdk';
import { LedgerId } from '@hashgraph/sdk';
import type { SignClientTypes } from '@walletconnect/types';
import { walletService } from '../services/walletService';
import { useConfigStore } from './configStore';
import { telemetry } from '../services/telemetryService';

const DEFAULT_WC_PROJECT_ID = '610b20415692c366e3bf97b8208cada5';

export interface WalletState {
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  accountId: string | null;
  network: 'mainnet' | 'testnet';
  balance: string | null;
  projectId: string;
  init: () => Promise<void>;
  initAccount: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  executeFromBytes: (base64: string) => Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
  executeScheduleSign: (scheduleId: string) => Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
  executeScheduleDelete?: (scheduleId: string) => Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
  service: typeof walletService;
}

const logger = new Logger({ module: 'WalletStore' });

const DEFAULT_METADATA = {
  name:
    (typeof process !== 'undefined' && process?.env?.WALLET_APP_NAME) ||
    'Hashgraph Online',
  description: 'HOL Desktop',
  url:
    (typeof process !== 'undefined' && process?.env?.WALLET_APP_URL) ||
    'https://hashgraphonline.com',
  icons: [
    (typeof process !== 'undefined' && process?.env?.WALLET_APP_ICON) ||
      'https://hashgraphonline.com/logo.png',
  ],
};

async function resolveProjectId(): Promise<string> {
  try {
    const env = await window.electron.getEnvironmentConfig?.();
    const maybe = String(env?.walletConnect?.projectId || '').trim();
    return maybe || DEFAULT_WC_PROJECT_ID;
  } catch {
    return DEFAULT_WC_PROJECT_ID;
  }
}

async function buildMetadata(): Promise<SignClientTypes.Metadata> {
  let _meta: SignClientTypes.Metadata = {
    name: DEFAULT_METADATA.name,
    description: DEFAULT_METADATA.description,
    url: DEFAULT_METADATA.url,
    icons: [DEFAULT_METADATA.icons[0]],
  };
  try {
    const envConfig = await window.electron.getEnvironmentConfig?.();
    const wc = envConfig?.walletConnect;
    if (wc) {
      _meta = {
        name: wc.appName || DEFAULT_METADATA.name,
        description: DEFAULT_METADATA.description,
        url: wc.appUrl || DEFAULT_METADATA.url,
        icons: [wc.appIcon || DEFAULT_METADATA.icons[0]],
      };
    }
  } catch {}
  return _meta;
}

function ledgerIdFromConfig(): LedgerId {
  const cfg = useConfigStore.getState().config;
  const appNet = (cfg?.hedera?.network || 'testnet') as NetworkType;
  return appNet === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET;
}

async function applyInfoToState(
  set: (state: Partial<WalletState>) => void,
  info: { accountId: string; network: LedgerId }
): Promise<void> {
  set({
    isConnected: true,
    accountId: info.accountId,
    network: info.network.toString() === 'mainnet' ? 'mainnet' : 'testnet',
  });
  try {
    const balance = await walletService.getBalance();
    set({ balance });
  } catch {}
  try {
    await window.electron.setCurrentWallet({
      accountId: info.accountId,
      network: info.network.toString() === 'mainnet' ? 'mainnet' : 'testnet',
    });
  } catch {}
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isConnected: false,
  isInitializing: false,
  error: null,
  accountId: null,
  network: 'testnet',
  balance: null,
  projectId: '',
  init: async () => {
    if (get().isInitializing) return;
    set({ isInitializing: true, error: null });
    try {
      let pid = DEFAULT_WC_PROJECT_ID;
      try {
        const env = await window.electron.getEnvironmentConfig?.();
        const maybe = String(env?.walletConnect?.projectId || '').trim();
        if (maybe) pid = maybe;
      } catch {}
      set({ projectId: pid });

      await get().initAccount();
    } catch {
    } finally {
      set({ isInitializing: false });
    }
  },

  initAccount: async () => {
    try {
      try {
        console.debug(
          '[WalletStore] initAccount() start',
          new Date().toISOString()
        );
      } catch {}
      const _ledgerId = ledgerIdFromConfig();
      const projectId = get().projectId || (await resolveProjectId());
      const _meta = await buildMetadata();

      try {
        await walletService.getSDK().init(projectId, _meta, _ledgerId);
      } catch {}

      const info = walletService.getAccountInfo();
      if (info?.accountId) {
        await applyInfoToState(set, info);
        try {
          console.debug(
            '[WalletStore] initAccount() restored session ->',
            { accountId: info.accountId },
            new Date().toISOString()
          );
        } catch {}
      } else {
        try {
          console.debug('[WalletStore] initAccount() no existing session');
        } catch {}
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn?.('initAccount restore failed', msg as any);
    }
  },

  connect: async () => {
    set({ error: null });
    try {
      try {
        console.debug(
          '[WalletStore] connect() start',
          new Date().toISOString()
        );
      } catch {}
      const _ledgerId = ledgerIdFromConfig();
      const projectId = get().projectId || (await resolveProjectId());
      const _meta = await buildMetadata();

      await walletService.connect(_ledgerId, projectId, _meta);
      const info = walletService.getAccountInfo();
      await applyInfoToState(set, info as any);

      try {
        console.debug(
          '[WalletStore] connect() done ->',
          { accountId: info?.accountId },
          new Date().toISOString()
        );
      } catch {}
      if (info?.accountId) {
        telemetry.emit('wallet_connect', {
          accountId: info.accountId,
          network: info.network.toString(),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('connect error', msg);
      set({ error: msg });
    }
  },

  disconnect: async () => {
    set({ error: null });
    try {
      await walletService.disconnect();
      set({ isConnected: false, accountId: null, balance: null });
      telemetry.emit('wallet_disconnect', {});
      try {
        await window.electron.setCurrentWallet(null);
      } catch {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
    }
  },

  refreshBalance: async () => {
    try {
      const bal = await walletService.getBalance();
      set({ balance: bal });
    } catch (_e) {}
  },

  executeFromBytes: async (base64: string) => {
    try {
      const out = await walletService.executeFromBytes(base64);
      if (!out.success) {
        telemetry.emit('wallet_error', {
          message: out.error || 'Wallet error',
        });
        return { success: false, error: out.error || 'Wallet error' };
      }
      telemetry.emit('wallet_approve', {});
      return { success: true, transactionId: out.transactionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      telemetry.emit('wallet_error', { message: msg });
      return { success: false, error: msg };
    }
  },
  executeScheduleSign: async (scheduleId: string) => {
    try {
      const out = await walletService.executeScheduleSign(scheduleId);
      if (!out.success) {
        telemetry.emit('wallet_error', {
          message: out.error || 'Wallet error',
        });
        return { success: false, error: out.error || 'Wallet error' };
      }
      telemetry.emit('wallet_approve', { txType: 'schedule_sign' });
      return { success: true, transactionId: out.transactionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      telemetry.emit('wallet_error', { message: msg });
      return { success: false, error: msg };
    }
  },
  executeScheduleDelete: async (scheduleId: string) => {
    try {
      const out = await walletService.executeScheduleDelete(scheduleId);
      if (!out.success) {
        telemetry.emit('wallet_error', {
          message: out.error || 'Wallet error',
        });
        return { success: false, error: out.error || 'Wallet error' };
      }
      telemetry.emit('wallet_approve', { txType: 'schedule_delete' });
      return { success: true, transactionId: out.transactionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      telemetry.emit('wallet_error', { message: msg });
      return { success: false, error: msg };
    }
  },
  service: walletService,
}));
