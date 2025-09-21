import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
  ],
  build: {
    lib: {
      entry: resolve(currentDir, 'src/main/index.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        preserveModules: false,
      },
    },
    outDir: '.vite/build',
  },
  ssr: {
    noExternal: [
      '@hashgraph/sdk',
      'js-tiktoken',
    ],
  },
  resolve: {
    conditions: ['node'],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      pino: resolve(currentDir, './src/lib/pino-stub.ts'),
      'thread-stream': resolve(currentDir, './src/lib/thread-stream-stub.ts'),
      tiktoken: resolve(currentDir, './src/lib/tiktoken-compat.ts'),
      'tiktoken/lite': resolve(currentDir, './src/lib/tiktoken-compat.ts'),
      'tiktoken/load': resolve(currentDir, './src/lib/tiktoken-compat.ts'),
    },
  },
});
