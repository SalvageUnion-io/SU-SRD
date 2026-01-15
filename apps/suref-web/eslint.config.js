import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default [
  {
    ignores: [
      '.netlify',
      'dist',
      'node_modules',
      '.git',
      'coverage',
      'build',
      '.vite',
      'src/types/database-generated.types.ts',
      'src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      semi: ['error', 'never'],
      'no-extra-semi': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['happydom.ts', 'testing-library.ts', 'src/lib/logger.ts'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.recommended.rules,
      // Prevent direct console usage - use logger utility instead
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      // Disallow any types - use unknown or proper types instead
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
]
