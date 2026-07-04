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
      'dist',
      'node_modules',
      '.git',
      'coverage',
      'build',
      '.vite',
      'src/routeTree.gen.ts',
      // Playwright lives outside the app tsconfig project (it has its own
      // TypeScript pipeline at `playwright test` time), so exclude its
      // config + spec dirs from the app-level ESLint pass.
      'playwright.config.ts',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
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
  {
    // TanStack Router file-based routes export a `Route` (from
    // createFileRoute()) and keep their page component LOCAL, referenced via
    // `component:`. Under eslint-plugin-react-refresh 0.5, that trips
    // only-export-components' `localComponents` check (a module with exports
    // but no *exported* component). `allowExportNames: ['Route']` silences the
    // Route export itself but not that structural check, and exporting every
    // route component purely to satisfy the linter would break TanStack's
    // local-component convention. Fast refresh of route modules is a non-issue
    // in practice, so disable the rule for the routes glob.
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]
