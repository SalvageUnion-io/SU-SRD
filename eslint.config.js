import { base } from './eslint.base.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Root-level eslint config. Each workspace (apps/*, packages/*) has its own
// eslint.config.js and is linted with cwd set to that workspace (`bun run
// lint` / `bun --filter "*" lint`), so this config is never consulted there.
// It exists for the one thing that isn't a workspace: root-level tools/**/*.ts
// (e.g. tools/check-bun-version.ts, tools/coverage-report.ts), which the
// Lefthook pre-commit hook (`bunx eslint --fix {staged_files}`, run from repo
// root) needs a config to find — without this file it hard-errors on any
// staged root-level .ts file.
export default [
  {
    ignores: ['**/node_modules/**', 'apps/**', 'packages/**', '**/*.d.ts'],
  },
  ...base,
  {
    files: ['tools/**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
  },
]
