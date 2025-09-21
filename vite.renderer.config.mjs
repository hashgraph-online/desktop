import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export default defineConfig({
  root: currentDir,
  base: './',
  assetsInclude: ['**/*.md'],
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
    monacoEditorPlugin({
      languageWorkers: [
        'editorWorkerService',
        'typescript',
        'json',
        'html',
        'css',
      ],
      customWorkers: [],
      forceBuildCDN: false,
    }),
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
      'fs/promises': resolve(currentDir, './src/lib/fs-promises-stub.ts'),
      tiktoken: resolve(currentDir, './src/lib/tiktoken-compat.ts'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'monaco-editor', '@monaco-editor/react'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT) || 5173,
    strictPort: false,
  },
});
