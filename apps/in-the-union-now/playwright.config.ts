import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for ITUN end-to-end tests.
 *
 * Tests live in `apps/in-the-union-now/e2e/` and run against a local dev
 * server on port 5173. The `webServer` block boots `bun run dev:itun` from
 * the repo root automatically (so `bun --filter in-the-union-now exec
 * playwright test` Just Works locally).
 *
 * IndexedDB persists across tabs and reloads inside one browser context.
 * Each test gets a fresh `browser.newContext()` (Playwright default), which
 * means a fresh IndexedDB — no per-test reset script needed.
 *
 * In CI we pin to Chromium only by default. Local devs can `--project=firefox`
 * or `--project=webkit` against the same suite when investigating cross-
 * engine regressions (covers REQ-NF-15: evergreen browsers only).
 */
export default defineConfig({
  testDir: './e2e',
  // Spec files use the `.e2e.ts` extension (instead of the default
  // `.spec.ts`) so Bun's test runner — which auto-discovers `.spec.ts` and
  // `.test.ts` — does not try to execute them. Playwright is told here to
  // look for `*.e2e.ts`.
  testMatch: /.*\.e2e\.ts$/,
  // Vite's dev server lazily compiles modules on first request. Dashboard
  // + builder routes pull in salvageunion-reference (large JSON dataset) so
  // the first navigation per test takes ~30-60 s on GHA Ubuntu runners.
  // 90 s gives enough headroom without masking real hangs.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable on demand:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
  ],
  webServer: {
    command: 'bun run dev:itun',
    cwd: '../..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
