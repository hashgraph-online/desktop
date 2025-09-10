export type WalletBridgeInfo = {
  accountId: string;
  network: 'mainnet' | 'testnet';
} | null;

let currentWallet: WalletBridgeInfo = null;

export function setCurrentWallet(info: WalletBridgeInfo) {
  currentWallet = info;
}

export function getCurrentWallet(): WalletBridgeInfo {
  return currentWallet;
}

