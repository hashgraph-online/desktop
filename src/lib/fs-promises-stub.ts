/**
 * Stub for fs/promises module in browser/renderer context
 * The standards-agent-kit imports fs/promises which doesn't exist in browser environments
 */

export const readFile = async (): Promise<Buffer> => {
  throw new Error('fs.promises.readFile is not available in the browser context');
};

export const writeFile = async (): Promise<void> => {
  throw new Error('fs.promises.writeFile is not available in the browser context');
};

export const readdir = async (): Promise<string[]> => {
  throw new Error('fs.promises.readdir is not available in the browser context');
};

export const stat = async (): Promise<unknown> => {
  throw new Error('fs.promises.stat is not available in the browser context');
};

export const mkdir = async (): Promise<void> => {
  throw new Error('fs.promises.mkdir is not available in the browser context');
};

export const unlink = async (): Promise<void> => {
  throw new Error('fs.promises.unlink is not available in the browser context');
};

export const access = async (): Promise<void> => {
  throw new Error('fs.promises.access is not available in the browser context');
};

export const rm = async (): Promise<void> => {
  throw new Error('fs.promises.rm is not available in the browser context');
};

export const copyFile = async (): Promise<void> => {
  throw new Error('fs.promises.copyFile is not available in the browser context');
};

export const rename = async (): Promise<void> => {
  throw new Error('fs.promises.rename is not available in the browser context');
};

export default {
  readFile,
  writeFile,
  readdir,
  stat,
  mkdir,
  unlink,
  access,
  rm,
  copyFile,
  rename,
};