import { convertFileSrc } from '@tauri-apps/api/core';

const isConvertible = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const internals = (window as typeof window & {
    __TAURI_INTERNALS?: { convertFileSrc?: (path: string, protocol?: string) => string };
  }).__TAURI_INTERNALS;
  return typeof internals?.convertFileSrc === 'function';
};

export function getAssetUrl(assetPath: string): string {
  if (!assetPath) {
    return assetPath;
  }
  if (!isConvertible()) {
    return assetPath;
  }
  try {
    return convertFileSrc(assetPath);
  } catch (error) {
    return assetPath;
  }
}
