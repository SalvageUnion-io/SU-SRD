import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default [
  {
    ignores: [
      '.netlify',
      '.ladle',
      'dist',
      'node_modules',
      '.git',
      'coverage',
      'build',
      'build-ladle',
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
    ignores: ['happydom.ts', 'testing-library.ts'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
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
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
]
