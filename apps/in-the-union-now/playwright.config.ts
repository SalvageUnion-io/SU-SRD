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
// When E2E_BASE_URL is set (e.g. a Netlify Deploy Preview), run the suite
// against that live URL — which serves the real Netlify Functions + Blobs, so
// the snapshot publish→retrieve round-trip is exercised for real. In that mode
// Playwright must NOT boot a local server. Unset → local dev/preview as before.
const externalBaseURL = process.env.E2E_BASE_URL

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
    baseURL: externalBaseURL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The app is a PWA (vite-plugin-pwa, registerType: 'autoUpdate'). When the
    // service worker activates it triggers a page reload; if that reload lands
    // mid-navigation, page.goto/page.reload abort with
    // `net::ERR_ABORTED; maybe frame was detached?`. This flaked the preview
    // suite (E2E_BASE_URL) where a real SW registers. No e2e here exercises
    // offline/installability, so block SW registration to remove the race.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable on demand:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
  ],
  // In CI we want a production preview server (built bundle, served as
  // static files) — Vite's dev mode pays a 30-60 s lazy compile cost on
  // first request and that cost lands inside per-test timeouts.
  // Locally we still reuse the dev server when one is already running on
  // 5173 (the dev experience expectation).
  // Skip the local server entirely when targeting an external deployed URL
  // (E2E_BASE_URL) — there is nothing to boot.
  webServer: externalBaseURL
    ? undefined
    : {
        // Both paths run from the repo root so the workspace bun scripts
        // resolve consistently. CI builds a static bundle and serves it with
        // `vite preview` (no per-request compile); locally we reuse the
        // running dev server when one exists.
        command: process.env.CI
          ? 'bun --filter salvageunion-reference build:ci && bun --filter in-the-union-now build && cd apps/in-the-union-now && bunx --bun vite preview --port 5173 --strictPort'
          : 'bun run dev:itun',
        cwd: '../..',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: process.env.CI ? 'pipe' : 'ignore',
        stderr: 'pipe',
      },
})
