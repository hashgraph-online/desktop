import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export default defineConfig({
  root: currentDir,
  base: './',
  assetsInclude: ['**/*.md'],
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      react: resolve(currentDir, './node_modules/react'),
      'react-dom': resolve(currentDir, './node_modules/react-dom'),
      '@noble/hashes/keccak': resolve(
        currentDir,
        './node_modules/@noble/hashes/sha3.js'
      ),
      pino: resolve(currentDir, './src/lib/pino-stub.ts'),
      'thread-stream': resolve(currentDir, './src/lib/thread-stream-stub.ts'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
