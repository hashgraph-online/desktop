import {
  HashinalsWalletConnectSDK,
  HashgraphSDK,
} from '@hashgraphonline/hashinal-wc';
import type { DAppSigner } from '@hashgraph/hedera-wallet-connect';
import type { LedgerId } from '@hashgraph/sdk';
import { SessionTypes, type SignClientTypes } from '@walletconnect/types';
import { EventsCtrl, OptionsCtrl, RouterCtrl } from '@walletconnect/modal-core';
import { Logger } from '@hashgraphonline/standards-sdk';

type ExecResult = { success: boolean; transactionId?: string; error?: string };

const HASHPACK_ID = 'hashpack';
const logger = new Logger({ module: 'WalletService' });

const WALLETCONNECT_DEEPLINK_KEY = 'WALLETCONNECT_DEEPLINK_CHOICE';
let deepLinkPollTimer: number | null = null;
let lastDeepLinkRecord: string | null = null;

type ExtensionFocusInfo = {
  readonly id: string;
  readonly viaIframe: boolean;
};

let latestWalletConnectUri: string | null = null;
let lastHashpackUri: string | null = null;
let eventsUnsubscribe: (() => void) | null = null;
let optionsUnsubscribe: (() => void) | null = null;
let routerUnsubscribe: (() => void) | null = null;
let domListenerInstalled = false;
let lastExtensionInfo: ExtensionFocusInfo | null = null;

const handleWalletButtonDomClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  const button = target.closest('[data-wallet-id]') as HTMLElement | null;
  if (!button) {
    return;
  }
  const walletIdRaw = button.getAttribute('data-wallet-id');
  if (!walletIdRaw) {
    logger.info('WalletService DOM listener found wallet button without id');
    console.info('[WalletService] DOM listener button missing wallet id');
    return;
  }
  const walletId = walletIdRaw.toLowerCase();
  logger.info('WalletService DOM listener detected wallet selection', {
    walletId,
  });
  console.info('[WalletService] DOM wallet selection', walletId);
  if (walletId.includes(HASHPACK_ID)) {
    focusExtension();
    const uri = OptionsCtrl.state.walletConnectUri ?? latestWalletConnectUri;
    if (typeof uri === 'string' && uri.trim().length > 0) {
      latestWalletConnectUri = uri;
      lastHashpackUri = uri;
      triggerHashpackDeepLink(uri);
    }
  } else {
    lastHashpackUri = null;
  }
};

const ensureDomListener = (): void => {
  if (domListenerInstalled) {
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  document.addEventListener('click', handleWalletButtonDomClick, true);
  domListenerInstalled = true;
  logger.info('WalletService installed DOM wallet button listener');
  console.info('[WalletService] DOM wallet button listener installed');
};

const startDeepLinkPolling = (): void => {
  if (deepLinkPollTimer !== null) {
    return;
  }
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  logger.info('WalletService starting deep link polling');
  console.info('[WalletService] starting deep link polling');
  deepLinkPollTimer = window.setInterval(() => {
    try {
      const raw = localStorage.getItem(WALLETCONNECT_DEEPLINK_KEY);
      if (!raw || raw === lastDeepLinkRecord) {
        return;
      }
      lastDeepLinkRecord = raw;
      logger.info('WalletService detected deep link change', { raw });
      console.info('[WalletService] deep link record changed', raw);
      try {
        const parsed = JSON.parse(raw) as {
          href?: string;
          name?: string;
        };
        const name = parsed?.name?.toLowerCase?.();
        const candidateUri =
          typeof OptionsCtrl.state.walletConnectUri === 'string' &&
          OptionsCtrl.state.walletConnectUri.trim().length > 0
            ? OptionsCtrl.state.walletConnectUri.trim()
            : typeof latestWalletConnectUri === 'string' &&
              latestWalletConnectUri.trim().length > 0
            ? latestWalletConnectUri.trim()
            : null;

        const href = parsed?.href;
        const hrefLooksHashpack =
          typeof href === 'string' && href.toLowerCase().includes(HASHPACK_ID);
        const nameLooksHashpack =
          typeof name === 'string' && name.includes(HASHPACK_ID);

        if (candidateUri && (hrefLooksHashpack || nameLooksHashpack)) {
          lastHashpackUri = candidateUri;
          triggerHashpackDeepLink(candidateUri);
        } else if (
          hrefLooksHashpack &&
          typeof href === 'string' &&
          href.includes('uri=')
        ) {
          lastHashpackUri = href;
          triggerHashpackDeepLink(href);
        } else {
          lastHashpackUri = null;
        }
      } catch (error) {
        logger.warn('WalletService failed to parse deep link record', {
          error,
        });
        console.warn('[WalletService] failed to parse deep link record', error);
      }
    } catch (error) {
      logger.warn('WalletService deep link polling error', { error });
      console.warn('[WalletService] deep link polling error', error);
    }
  }, 500);
};

const stopDeepLinkPolling = (): void => {
  if (deepLinkPollTimer !== null) {
    window.clearInterval(deepLinkPollTimer);
    deepLinkPollTimer = null;
    logger.info('WalletService stopped deep link polling');
    console.info('[WalletService] stopped deep link polling');
  }
};

export const triggerHashpackDeepLink = (uri?: string | null): void => {
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  let universalLink = 'https://link.hashpack.app';
  if (trimmed) {
    if (trimmed.startsWith('wc:')) {
      universalLink = `https://link.hashpack.app/wc?uri=${encodeURIComponent(
        trimmed
      )}`;
    } else if (
      trimmed.startsWith('https://link.hashpack.app/wc?uri=') ||
      trimmed.startsWith('http://link.hashpack.app/wc?uri=')
    ) {
      universalLink = trimmed;
    }
  }

  try {
    logger.info('WalletService attempting HashPack deep link', {
      link: universalLink,
    });
    void window?.desktop?.openExternal?.(universalLink);
  } catch (error) {
    logger.warn('WalletService failed to open HashPack deep link', {
      link: universalLink,
      error,
    });
  }
};

const focusExtension = (): boolean => {
  if (!lastExtensionInfo) {
    return false;
  }
  const { id, viaIframe } = lastExtensionInfo;
  const messageType = `hedera-extension-open-${id}`;
  try {
    logger.info('WalletService focusing extension', { id, viaIframe });
    console.info('[WalletService] focusing extension', { id, viaIframe });
    window.postMessage({ type: messageType }, '*');
    if (viaIframe && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: messageType }, '*');
    }
    return true;
  } catch (error) {
    logger.warn('WalletService focusExtension failed', { error });
    console.warn('[WalletService] focus extension failed', error);
  }
  return false;
};

const updateExtensionInfoFromSession = (
  session: SessionTypes.Struct | null
): void => {
  if (!session) {
    return;
  }
  const props = session.sessionProperties as
    | Record<string, unknown>
    | undefined;
  const rawId = props?.extensionId;
  if (typeof rawId !== 'string' || rawId.trim().length === 0) {
    return;
  }
  const viaIframeRaw =
    props?.extensionIsIframe ??
    props?.extensionAvailableInIframe ??
    props?.extensionIframe;
  const viaIframe =
    typeof viaIframeRaw === 'string'
      ? viaIframeRaw === 'true'
      : Boolean(viaIframeRaw);
  lastExtensionInfo = {
    id: rawId,
    viaIframe,
  };
  logger.info(
    'WalletService stored extension info from session',
    lastExtensionInfo
  );
  console.info('[WalletService] stored extension info', lastExtensionInfo);
};

const wakeHashpack = (): void => {
  if (focusExtension()) {
    return;
  }
  const uri = lastHashpackUri ?? latestWalletConnectUri;
  triggerHashpackDeepLink(uri);
};

const ensureHashpackTracking = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!optionsUnsubscribe) {
      logger.info('WalletService subscribing to OptionsCtrl');
      console.info('[WalletService] subscribe OptionsCtrl');
      latestWalletConnectUri = OptionsCtrl.state.walletConnectUri ?? null;
      if (latestWalletConnectUri) {
        logger.info('WalletService detected initial WalletConnect URI', {
          uri: latestWalletConnectUri,
        });
        console.info(
          '[WalletService] initial walletConnectUri',
          latestWalletConnectUri
        );
      }
      optionsUnsubscribe = OptionsCtrl.subscribe((state) => {
        if (
          typeof state.walletConnectUri === 'string' &&
          state.walletConnectUri.trim().length > 0
        ) {
          latestWalletConnectUri = state.walletConnectUri;
          logger.info('WalletService OptionsCtrl walletConnectUri updated', {
            uri: latestWalletConnectUri,
          });
          console.info(
            '[WalletService] walletConnectUri updated',
            latestWalletConnectUri
          );
        }
      });
    }

    if (!eventsUnsubscribe) {
      logger.info('WalletService subscribing to EventsCtrl');
      console.info('[WalletService] subscribe EventsCtrl', EventsCtrl.state);
      eventsUnsubscribe = EventsCtrl.subscribe((event) => {
        logger.info('WalletService received modal event', {
          type: event.type,
          name: event.name,
          data: event.data,
        });
        console.info('[WalletService] modal event', event);
        if (event.type !== 'CLICK' || event.name !== 'WALLET_BUTTON') {
          return;
        }

        const data = event.data as { walletId?: string } | undefined;
        const walletId = data?.walletId?.toLowerCase();
        if (!walletId) {
          logger.info('WalletService modal event missing walletId');
          console.info('[WalletService] modal event missing walletId');
          return;
        }

        if (walletId.includes(HASHPACK_ID)) {
          logger.info('WalletService detected HashPack selection', {
            walletId,
          });
          console.info('[WalletService] HashPack selected', walletId);
          setTimeout(() => {
            const uri =
              OptionsCtrl.state.walletConnectUri ?? latestWalletConnectUri;
            if (typeof uri === 'string' && uri.trim().length > 0) {
              latestWalletConnectUri = uri;
              lastHashpackUri = uri;
              logger.info(
                'WalletService storing HashPack URI and triggering deeplink',
                {
                  uri,
                }
              );
              console.info(
                '[WalletService] triggering HashPack deep link',
                uri
              );
              triggerHashpackDeepLink(uri);
            }
          }, 0);
          return;
        }

        logger.info(
          'WalletService selection was not HashPack, clearing cached URI',
          {
            walletId,
          }
        );
        console.info(
          '[WalletService] selection not HashPack, clearing URI',
          walletId
        );
        lastHashpackUri = null;
      });
    }

    if (!routerUnsubscribe) {
      logger.info('WalletService subscribing to RouterCtrl');
      console.info('[WalletService] subscribe RouterCtrl', RouterCtrl.state);
      routerUnsubscribe = RouterCtrl.subscribe((state) => {
        const wallet = state?.data?.Wallet;
        const walletId = wallet?.id?.toLowerCase();
        logger.info('WalletService router update', {
          view: state?.view,
          wallet,
        });
        console.info('[WalletService] router update', state);
        if (!walletId) {
          return;
        }
        if (walletId.includes(HASHPACK_ID)) {
          logger.info('WalletService RouterCtrl detected HashPack', {
            walletId,
          });
          console.info('[WalletService] RouterCtrl HashPack', walletId);
          const uri =
            OptionsCtrl.state.walletConnectUri ?? latestWalletConnectUri;
          if (typeof uri === 'string' && uri.trim().length > 0) {
            latestWalletConnectUri = uri;
            lastHashpackUri = uri;
            triggerHashpackDeepLink(uri);
          }
        } else {
          logger.info('WalletService RouterCtrl wallet not HashPack', {
            walletId,
          });
          console.info(
            '[WalletService] RouterCtrl wallet not HashPack',
            walletId
          );
          lastHashpackUri = null;
        }
      });
    }

    ensureDomListener();
    startDeepLinkPolling();
  } catch (error) {
    logger.warn('WalletService failed to configure HashPack tracking', {
      error,
    });
    console.warn(
      '[WalletService] failed to configure HashPack tracking',
      error
    );
  }
};

export const walletService = {
  async connect(
    network: LedgerId,
    projectId: string,
    metadata: SignClientTypes.Metadata
  ): Promise<{
    accountId: string;
    balance: string;
    session: SessionTypes.Struct;
  }> {
    const sdk = HashinalsWalletConnectSDK.getInstance(undefined, network);
    const pid = projectId.trim();
    if (!pid) throw new Error('WalletConnect projectId missing');

    await sdk.init(pid, metadata, network);

    ensureHashpackTracking();

    try {
      await sdk.connectViaDappBrowser();
    } catch (error) {
      logger.warn('WalletService connectViaDappBrowser failed', { error });
    }

    const connector = sdk.dAppConnector;

    const sessionAware = sdk as HashinalsWalletConnectSDK & {
      handleNewSession?: (session: SessionTypes.Struct) => void;
      saveConnectionInfo?: (accountId?: string, network?: string) => void;
      getNetworkPrefix?: () => string;
    };

    let session: SessionTypes.Struct | null = null;

    try {
      session = await connector.connect((uri: string) => {
        latestWalletConnectUri = uri;
        if (lastHashpackUri) {
          lastHashpackUri = uri;
        }
        try {
          connector.walletConnectModal?.openModal?.({ uri });
        } catch (error) {
          logger.warn('WalletService openModal failed', { error });
        }
      });
    } finally {
      try {
        connector.walletConnectModal?.closeModal?.();
      } catch (error) {
        logger.warn('WalletService closeModal failed', { error });
      }
    }

    if (!session) {
      throw new Error('WalletConnect session unavailable');
    }

    sessionAware.handleNewSession?.(session);

    const accountInfo = sdk.getAccountInfo();
    const accountId = accountInfo?.accountId ?? '';
    const balance = await sdk.getAccountBalance();

    const networkPrefix = sessionAware.getNetworkPrefix?.();
    sessionAware.saveConnectionInfo?.(accountId, networkPrefix);

    return {
      accountId,
      balance,
      session,
    };
  },

  async disconnect(): Promise<void> {
    await HashinalsWalletConnectSDK.getInstance().disconnectWallet(true);
    lastHashpackUri = null;
    lastDeepLinkRecord = null;
    stopDeepLinkPolling();
  },

  getSDK(): HashinalsWalletConnectSDK {
    return HashinalsWalletConnectSDK.getInstance();
  },

  getAccountInfo(): { accountId: string; network: LedgerId } | null {
    const info = HashinalsWalletConnectSDK.getInstance().getAccountInfo();
    return info || null;
  },

  async getBalance(): Promise<string> {
    return await HashinalsWalletConnectSDK.getInstance().getAccountBalance();
  },

  async executeFromBytes(base64: string): Promise<ExecResult> {
    try {
      wakeHashpack();
      const bytes = Buffer.from(base64, 'base64');
      const tx = HashgraphSDK.Transaction.fromBytes(bytes);
      const txFrozenChecker = tx as unknown as { isFrozen?: () => boolean };
      const isFrozen =
        typeof txFrozenChecker.isFrozen === 'function'
          ? txFrozenChecker.isFrozen()
          : false;
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          isFrozen
        );
      if (out?.error) return { success: false, error: out.error };
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async executeScheduleSign(scheduleId: string): Promise<ExecResult> {
    try {
      wakeHashpack();
      const tx = new HashgraphSDK.ScheduleSignTransaction().setScheduleId(
        HashgraphSDK.ScheduleId.fromString(scheduleId)
      );
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          false
        );
      if (out?.error) return { success: false, error: out.error };
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async executeScheduleDelete(scheduleId: string): Promise<ExecResult> {
    try {
      wakeHashpack();
      const tx = new HashgraphSDK.ScheduleDeleteTransaction().setScheduleId(
        HashgraphSDK.ScheduleId.fromString(scheduleId)
      );
      const out =
        await HashinalsWalletConnectSDK.getInstance().executeTransactionWithErrorHandling(
          tx,
          false
        );
      if (out?.error) {
        return { success: false, error: out.error };
      }
      const txId = tx.transactionId?.toString();
      return txId
        ? { success: true, transactionId: String(txId) }
        : { success: false, error: 'Missing transactionId' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },

  async getSigner(): Promise<DAppSigner | null> {
    const sdk = HashinalsWalletConnectSDK.getInstance();
    const info = sdk.getAccountInfo();
    if (!info?.accountId) {
      return null;
    }
    const signer = sdk.dAppConnector.signers.find(
      (s) => s.getAccountId().toString() === info.accountId
    );
    return (signer as DAppSigner | undefined) || null;
  },
};

export type { ExecResult };
