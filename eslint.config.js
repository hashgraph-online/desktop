import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.vite/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '*.config.cjs',
      'out/**',
      '.yalc/**',
      '.pnpmfile.cjs',
      'src-tauri/target/**',
      'src-tauri/resources/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/__mocks__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        module: 'writable',
        jest: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx,js}', '**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-empty': 'warn'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        MAIN_WINDOW_VITE_DEV_SERVER_URL: 'readonly',
        MAIN_WINDOW_VITE_NAME: 'readonly'
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false
        }
      ],
      'no-console': 'error',
      'no-debugger': 'error'
    }
  }
);
