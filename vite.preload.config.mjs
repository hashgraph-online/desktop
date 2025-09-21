import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

const inputEntries = {
  preload: resolve(currentDir, './src/preload/index.ts'),
  'moonscape-preload': resolve(currentDir, './src/preload/moonscape-preload.ts'),
};

const inlineDynamicImports = Object.keys(inputEntries).length === 1;

export default defineConfig({
  build: {
    rollupOptions: {
      input: inputEntries,
      external: ['electron'],
      output: {
        format: 'cjs',
        inlineDynamicImports,
        entryFileNames: '[name].cjs',
        dir: '.vite/build',
      },
    },
    outDir: '.vite/build',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      pino: resolve(currentDir, './src/lib/pino-stub.ts'),
      'thread-stream': resolve(currentDir, './src/lib/thread-stream-stub.ts'),
    },
  },
});
