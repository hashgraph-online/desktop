import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main/index.ts'),
      output: {
        entryFileNames: 'main.js',
      },
      external: [
        'electron',
        'better-sqlite3'
      ],
    },
    outDir: '.vite/build',
    target: 'node20', // Electron 37 uses Node 22, but node20 is safer for compatibility
  },
  resolve: {
    conditions: ['node'],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      pino: path.resolve(__dirname, './src/lib/pino-stub.ts'),
      'thread-stream': path.resolve(
        __dirname,
        './src/lib/thread-stream-stub.ts'
      ),
    },
  },
});
