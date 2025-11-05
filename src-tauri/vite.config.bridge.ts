import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [wasm(), nodePolyfills()],
  resolve: {
    alias: {
      'fs/promises': path.resolve(__dirname, './bridge/stubs/fs-promises-stub.ts'),
      'node:readline': path.resolve(__dirname, './bridge/stubs/readline-stub.ts'),
    },
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
