import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

const __dirname = path.resolve();

export default defineConfig({
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
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@noble/hashes/keccak': path.resolve(
        __dirname,
        './node_modules/@noble/hashes/sha3.js'
      ),
      pino: path.resolve(__dirname, './src/lib/pino-stub.ts'),
      'thread-stream': path.resolve(
        __dirname,
        './src/lib/thread-stream-stub.ts'
      ),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
});
