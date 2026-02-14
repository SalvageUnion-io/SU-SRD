import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { base } from '../../eslint.base.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  ...base,
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
    },
  },
]
