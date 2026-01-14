// Stub for fs/promises module in Tauri bridge environment
export const stat = () => Promise.reject(new Error('fs.stat not available in bridge'));
export const readFile = () => Promise.reject(new Error('fs.readFile not available in bridge'));
export const writeFile = () => Promise.reject(new Error('fs.writeFile not available in bridge'));
export const mkdir = () => Promise.reject(new Error('fs.mkdir not available in bridge'));
export const readdir = () => Promise.reject(new Error('fs.readdir not available in bridge'));
export const unlink = () => Promise.reject(new Error('fs.unlink not available in bridge'));
export const rm = () => Promise.reject(new Error('fs.rm not available in bridge'));
export const access = () => Promise.reject(new Error('fs.access not available in bridge'));

export default {
  stat,
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rm,
  access,
};