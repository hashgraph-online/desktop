import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: 'preload.js',
        dir: '.vite/build'
      },
    },
    minify: false,
    emptyOutDir: false,
    outDir: '.vite/build'
  },
  resolve: {
    alias: {
      pino: path.resolve(__dirname, './src/lib/pino-stub.ts'),
      'thread-stream': path.resolve(
        __dirname,
        './src/lib/thread-stream-stub.ts'
      ),
    },
  },
});
