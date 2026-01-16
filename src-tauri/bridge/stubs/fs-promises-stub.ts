/**
 * Stub for fs/promises - provides no-op implementations for browser environment
 */

export async function stat(): Promise<never> {
  throw new Error('fs/promises stat is not available in browser environment');
}

export async function readFile(): Promise<never> {
  throw new Error('fs/promises readFile is not available in browser environment');
}

export async function writeFile(): Promise<void> {
  throw new Error('fs/promises writeFile is not available in browser environment');
}

export async function mkdir(): Promise<void> {
  throw new Error('fs/promises mkdir is not available in browser environment');
}

export async function readdir(): Promise<string[]> {
  throw new Error('fs/promises readdir is not available in browser environment');
}

export async function unlink(): Promise<void> {
  throw new Error('fs/promises unlink is not available in browser environment');
}

export async function rmdir(): Promise<void> {
  throw new Error('fs/promises rmdir is not available in browser environment');
}

export async function access(): Promise<void> {
  throw new Error('fs/promises access is not available in browser environment');
}

export default {
  stat,
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rmdir,
  access,
};
