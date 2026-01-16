import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm';
import wasm from 'vite-plugin-wasm';
import path from 'node:path';

const resolvePath = (value: string) => path.resolve(__dirname, value);

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.md'],
  plugins: [
    wasm(),
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css'],
      customWorkers: [],
      forceBuildCDN: false
    }),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  resolve: {
    alias: {
      react: resolvePath('./node_modules/react'),
      'react-dom': resolvePath('./node_modules/react-dom'),
      '@noble/hashes/keccak': resolvePath('./node_modules/@noble/hashes/sha3.js'),
      '@noble/curves/secp256k1.js': resolvePath('./node_modules/@noble/curves/esm/secp256k1.js'),
      '@noble/curves/secp256k1': resolvePath('./node_modules/@noble/curves/esm/secp256k1.js'),
      '@reown/walletkit': resolvePath('./src/lib/reown-walletkit-stub.ts'),
      pino: resolvePath('./src/lib/pino-stub.ts'),
      'thread-stream': resolvePath('./src/lib/thread-stream-stub.ts'),
      'fs/promises': resolvePath('./src/lib/fs-promises-stub.ts'),
      tiktoken: resolvePath('./src/lib/tiktoken-compat.ts')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'monaco-editor', '@monaco-editor/react'],
    exclude: ['@reown/walletkit'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    port: 5175,
    strictPort: true
  },
  preview: {
    port: 5176,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor']
        }
      }
    }
  }
});
