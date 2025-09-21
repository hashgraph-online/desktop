import { contextBridge, ipcRenderer } from 'electron';

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
const DEEPLINK_SCHEMES = ['hashpack:', 'hashconnect:', 'hedera-wallet-connect:', 'wc:'];

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

const moonscapeBridge = {
  openExternal: (rawUrl: string) => {
    const sanitizedUrl = sanitizeUrl(rawUrl);
    ipcRenderer.send('moonscape:open-external', sanitizedUrl);
  },
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
    return DEEPLINK_SCHEMES.some((scheme) => lowered.startsWith(scheme));
  }
};

const openDeepLink = (value: string): boolean => {
  if (!isDeepLink(value)) {
    return false;
  }
  moonscapeBridge.openExternal(value);
  return true;
};

const installDeepLinkInterceptors = () => {
  const originalOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string | undefined) => {
    const candidate = typeof url === 'string' ? url : url?.toString();
    if (candidate && openDeepLink(candidate)) {
      return null;
    }
    return originalOpen(url as string | URL | undefined, target, features) ?? null;
  };

  const originalAssign = window.location.assign.bind(window.location);
  window.location.assign = (url: string | URL) => {
    const candidate = typeof url === 'string' ? url : url.toString();
    if (candidate && openDeepLink(candidate)) {
      return;
    }
    originalAssign(url);
  };

  const originalReplace = window.location.replace.bind(window.location);
  window.location.replace = (url: string | URL) => {
    const candidate = typeof url === 'string' ? url : url.toString();
    if (candidate && openDeepLink(candidate)) {
      return;
    }
    originalReplace(url);
  };

  const hrefDescriptor = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
  if (hrefDescriptor?.set && hrefDescriptor.get) {
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      enumerable: true,
      get: hrefDescriptor.get.bind(window.location),
      set: (value: string) => {
        if (openDeepLink(value)) {
          return;
        }
        hrefDescriptor.set!.call(window.location, value);
      },
    });
  }
};

contextBridge.exposeInMainWorld('moonscape', moonscapeBridge);

installDeepLinkInterceptors();
