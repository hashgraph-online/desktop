import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'preload.cjs',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: 'preload.cjs',
        dir: '.vite/build',
      },
    },
    outDir: '.vite/build',
  },
  resolve: {
    alias: {
      pino: resolve(currentDir, './src/lib/pino-stub.ts'),
      'thread-stream': resolve(currentDir, './src/lib/thread-stream-stub.ts'),
    },
  },
});
