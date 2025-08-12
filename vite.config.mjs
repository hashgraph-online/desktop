import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import path from 'path';

export default defineConfig({
  plugins: [
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
      react: path.resolve(process.cwd(), './node_modules/react'),
      'react-dom': path.resolve(process.cwd(), './node_modules/react-dom'),
    },
  },
  server: {
    port: 5173,
  },
});
