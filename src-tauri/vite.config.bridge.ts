import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [wasm(), nodePolyfills()],
  resolve: {
    alias: {
      'fs/promises': path.resolve(__dirname, './bridge/stubs/fs-promises-stub.ts'),
      'node:readline': path.resolve(__dirname, './bridge/stubs/readline-stub.ts'),
      '@noble/curves': path.resolve(rootDir, 'node_modules/@noble/curves'),
    },
    dedupe: [
      '@hashgraph/sdk',
      '@hashgraph/cryptography',
      '@hashgraph/proto',
      '@hashgraphonline/standards-sdk',
      '@hashgraphonline/hashinal-wc',
      '@noble/curves',
      '@noble/hashes',
    ],
  },
  build: {
    outDir: 'resources',
    lib: {
      entry: 'src-tauri/bridge/index.ts',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@tauri-apps/api'],
    },
  },
});
