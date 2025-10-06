import { Logger } from '@hashgraphonline/standards-sdk';

const ALLOWED_SCHEMES = [
  'https:',
  'http:',
  'ipfs:',
  'ipns:',
  'file:',
  'hashpack:',
  'hashconnect:',
  'hedera-wallet-connect:',
  'wc:',
];

const DEEPLINK_SCHEMES = [
  'hashpack:',
  'hashconnect:',
  'hedera-wallet-connect:',
  'wc:',
];

const logger = new Logger({ module: 'MoonscapeBridge' });
const INTERCEPTOR_FLAG = '__moonscapeDeepLinkInterceptorInstalled__' as const;

const sanitizeUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    if (ALLOWED_SCHEMES.includes(url.protocol)) {
      return url.toString();
    }
    return rawUrl;
  } catch (error) {
    return rawUrl;
  }
};

const openExternal = (rawUrl: string): void => {
  const sanitized = sanitizeUrl(rawUrl);
  if (typeof window !== 'undefined' && window.desktop?.openExternal) {
    window.desktop.openExternal(sanitized).catch(() => undefined);
  } else {
    window.open(sanitized, '_blank', 'noopener,noreferrer');
  }
};

const isDeepLink = (value: string): boolean => {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return DEEPLINK_SCHEMES.includes(parsed.protocol.toLowerCase());
  } catch (error) {
    const lowered = value.toLowerCase();
    return DEEPLINK_SCHEMES.some((scheme) => {
      if (lowered.startsWith(scheme)) {
        return true;
      }
      if (scheme.endsWith(':')) {
        const schemeWithSlashes = `${scheme}//`;
        return lowered.startsWith(schemeWithSlashes);
      }
      return false;
    });
  }
};

const openDeepLink = (value: string): boolean => {
  if (!isDeepLink(value)) {
    return false;
  }
  openExternal(value);
  return true;
};

const isHashpackLink = (value: string): boolean => {
  if (!value) {
    return false;
  }
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'link.hashpack.app' || host.endsWith('.link.hashpack.app');
  } catch (_error) {
    const lowered = value.toLowerCase();
    return (
      lowered.startsWith('https://link.hashpack.app') ||
      lowered.startsWith('http://link.hashpack.app')
    );
  }
};

const shouldInterceptLink = (value: string): boolean =>
  isDeepLink(value) || isHashpackLink(value);

const findAnchorFromEvent = (event: MouseEvent): HTMLAnchorElement | null => {
  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    for (const entry of path) {
      if (entry instanceof HTMLAnchorElement && entry.href) {
        return entry;
      }
      if (entry instanceof Element) {
        const anchor = entry.closest('a[href]');
        if (anchor instanceof HTMLAnchorElement && anchor.href) {
          return anchor;
        }
      }
    }
  }
  const target = event.target;
  if (target instanceof Element) {
    const anchor = target.closest('a[href]');
    if (anchor instanceof HTMLAnchorElement && anchor.href) {
      return anchor;
    }
  }
  return null;
};

const installClickInterceptor = (): void => {
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      const anchor = findAnchorFromEvent(event);
      if (!anchor) {
        return;
      }
      const candidate = anchor.href;
      if (!candidate || !shouldInterceptLink(candidate)) {
        return;
      }
      event.preventDefault();
      openExternal(candidate);
    },
    true
  );
};

const extractUriFromMessage = (payload: unknown): string | null => {
  if (!payload) {
    return null;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload !== 'object') {
    return null;
  }
  const maybeUri = (payload as Record<string, unknown>).uri;
  if (typeof maybeUri === 'string') {
    return maybeUri;
  }
  const data = (payload as Record<string, unknown>).data;
  if (typeof data === 'object' && data !== null) {
    const nestedUri = (data as Record<string, unknown>).uri;
    if (typeof nestedUri === 'string') {
      return nestedUri;
    }
  }
  const params = (payload as Record<string, unknown>).params;
  if (Array.isArray(params)) {
    for (const entry of params) {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry && typeof entry === 'object') {
        const nested = extractUriFromMessage(entry);
        if (nested) {
          return nested;
        }
      }
    }
  }
  return null;
};

const installMessageInterceptor = (): void => {
  window.addEventListener(
    'message',
    (event: MessageEvent) => {
      logger.info('Moonscape message event received', event.data);
      const candidate = extractUriFromMessage(event.data);
      if (!candidate) {
        return;
      }
      if (!shouldInterceptLink(candidate)) {
        return;
      }
      logger.info('Moonscape message deep link detected');
      openExternal(candidate);
    },
    false
  );
};

const WALLETCONNECT_STORAGE_KEY = 'WALLETCONNECT_DEEPLINK_CHOICE';

const installStorageInterceptor = (): void => {
  try {
    const storage = window.localStorage;
    if (!storage) {
      logger.warn('Moonscape deep-link intercept: localStorage unavailable');
      return;
    }

    const originalSetItem = storage.setItem.bind(storage);
    const originalRemoveItem = storage.removeItem.bind(storage);

    storage.setItem = (key: string, value: string): void => {
      logger.info('Moonscape storage setItem', { key, value });
      if (key === WALLETCONNECT_STORAGE_KEY) {
        try {
          const parsed = JSON.parse(value) as { href?: string | null };
          if (
            typeof parsed?.href === 'string' &&
            parsed.href.trim().length > 0
          ) {
            const href = parsed.href.trim();
            logger.info('Moonscape storage deep link detected', { href });
            openExternal(href);
          }
        } catch (error) {
          logger.warn(
            'Moonscape deep-link intercept: failed to parse storage value',
            error
          );
        }
      }
      originalSetItem(key, value);
    };

    storage.removeItem = (key: string): void => {
      logger.info('Moonscape storage removeItem', { key });
      if (key === WALLETCONNECT_STORAGE_KEY) {
        logger.info('Moonscape storage deep link cleared');
      }
      originalRemoveItem(key);
    };
  } catch (error) {
    logger.warn('Moonscape deep-link intercept: storage hook failed', error);
  }
};

const getLocationPrototype = (): Location | undefined => {
  const locationPrototype = window.Location?.prototype;
  if (!locationPrototype) {
    logger.warn(
      'Moonscape deep-link intercept: Location prototype unavailable'
    );
    return undefined;
  }
  return locationPrototype;
};

type FlaggedWindow = Window & Partial<Record<typeof INTERCEPTOR_FLAG, boolean>>;

const installDeepLinkInterceptors = (): void => {
  const flaggedWindow = window as FlaggedWindow;

  if (flaggedWindow[INTERCEPTOR_FLAG]) {
    return;
  }

  const originalOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const candidate = typeof url === 'string' ? url : url?.toString();
    if (candidate && openDeepLink(candidate)) {
      return null;
    }
    return (
      originalOpen(url as string | URL | undefined, target, features) ?? null
    );
  };
  installClickInterceptor();
  const locationPrototype = getLocationPrototype();
  if (!locationPrototype) {
    return;
  }

  const originalAssign = locationPrototype.assign;
  const assignDescriptor = Object.getOwnPropertyDescriptor(
    locationPrototype,
    'assign'
  );
  if (typeof originalAssign === 'function') {
    if (!assignDescriptor || assignDescriptor.configurable !== false) {
      try {
        Object.defineProperty(locationPrototype, 'assign', {
          configurable: true,
          value(this: Location, url: string | URL) {
            const candidate = typeof url === 'string' ? url : url.toString();
            if (candidate && openDeepLink(candidate)) {
              return;
            }
            return originalAssign.call(this, url);
          },
        });
      } catch (_error) {
        logger.warn(
          'Moonscape deep-link intercept: failed to override location.assign'
        );
      }
    } else {
      logger.warn(
        'Moonscape deep-link intercept: location.assign not configurable'
      );
    }
  } else {
    logger.warn('Moonscape deep-link intercept: location.assign unavailable');
  }

  const originalReplace = locationPrototype.replace;
  const replaceDescriptor = Object.getOwnPropertyDescriptor(
    locationPrototype,
    'replace'
  );
  if (typeof originalReplace === 'function') {
    if (!replaceDescriptor || replaceDescriptor.configurable !== false) {
      try {
        Object.defineProperty(locationPrototype, 'replace', {
          configurable: true,
          value(this: Location, url: string | URL) {
            const candidate = typeof url === 'string' ? url : url.toString();
            if (candidate && openDeepLink(candidate)) {
              return;
            }
            return originalReplace.call(this, url);
          },
        });
      } catch (_error) {
        logger.warn(
          'Moonscape deep-link intercept: failed to override location.replace'
        );
      }
    } else {
      logger.warn(
        'Moonscape deep-link intercept: location.replace not configurable'
      );
    }
  } else {
    logger.warn('Moonscape deep-link intercept: location.replace unavailable');
  }

  const hrefDescriptor = Object.getOwnPropertyDescriptor(
    locationPrototype,
    'href'
  );
  if (hrefDescriptor?.set && hrefDescriptor.get) {
    if (hrefDescriptor.configurable !== false) {
      try {
        Object.defineProperty(locationPrototype, 'href', {
          configurable: true,
          get(this: Location) {
            return hrefDescriptor.get!.call(this);
          },
          set(this: Location, value: string) {
            if (openDeepLink(value)) {
              return;
            }
            hrefDescriptor.set!.call(this, value);
          },
        });
      } catch (_error) {
        logger.warn(
          'Moonscape deep-link intercept: failed to override location.href'
        );
      }
    } else {
      logger.warn(
        'Moonscape deep-link intercept: location.href not configurable'
      );
    }
  } else {
    logger.warn(
      'Moonscape deep-link intercept: location.href descriptor unavailable'
    );
  }

  flaggedWindow[INTERCEPTOR_FLAG] = true;
};

declare global {
  interface Window {
    moonscape?: {
      openExternal: (url: string) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  if (!window.moonscape) {
    window.moonscape = {
      openExternal,
    };
  }
  installDeepLinkInterceptors();
  installMessageInterceptor();
  installStorageInterceptor();
}

export { openExternal };
