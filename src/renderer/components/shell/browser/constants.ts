export const SAFE_PROTOCOL = /^(https?:|ipfs:|ipns:|file:)/i;

export const MIN_ASSISTANT_WIDTH = 320;
export const MAX_ASSISTANT_WIDTH = 560;
export const MIN_ASSISTANT_HEIGHT = 260;
export const MAX_ASSISTANT_HEIGHT = 520;
export const DEFAULT_ASSISTANT_WIDTH = 392;
export const DEFAULT_ASSISTANT_HEIGHT = 320;

export type TrafficLightVariant = 'close' | 'minimize' | 'maximize';

export interface Bookmark {
  label: string;
  url: string;
  description?: string;
}

export const BOOKMARKS: Bookmark[] = [
  {
    label: 'KiloScribe',
    url: 'https://hedera.kiloscribe.com',
    description: 'On-chain file storage and NFT platform',
  },
  {
    label: 'SaucerSwap',
    url: 'https://saucerswap.finance',
    description: 'Decentralized exchange on Hedera',
  },
  {
    label: 'Bonzo Finance',
    url: 'https://bonzo.finance',
    description: 'DeFi lending and borrowing platform',
  },
  {
    label: 'hGraph.io',
    url: 'https://hgraph.com',
    description: 'Hedera network explorer and analytics',
  },
  {
    label: 'SentX',
    url: 'https://sentx.io',
    description: 'Hedera wallet and DeFi services',
  },
];

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const normalizeUrl = (value: string, fallback: string): string => {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};
