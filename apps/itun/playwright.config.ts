import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for ITUN end-to-end tests.
 *
 * Tests live in `apps/itun/e2e/` and run against a local dev
 * server on port 5173. The `webServer` block boots `bun run dev:itun` from
 * the repo root automatically (so `bun --filter itun exec
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
  //
  // Against an external Netlify Deploy Preview (E2E_BASE_URL) every test pays
  // cold-load costs (preview cold start + real Functions/Blobs round-trips), so
  // widen the per-test and per-assertion budgets ONLY in that mode. The local
  // static-preview path keeps the tighter budgets so it stays fast and still
  // surfaces real hangs.
  timeout: externalBaseURL ? 150_000 : 90_000,
  expect: { timeout: externalBaseURL ? 20_000 : 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 2 CI workers (was 1): the suite is fullyParallel and targets a static
  // preview / Netlify deploy that handles concurrency fine; retries: 2 stays
  // as the flake net. Halve back to 1 if flake telemetry regresses.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The app is a PWA (vite-plugin-pwa, registerType: **'prompt'** — this said
    // 'autoUpdate' until 2026-08-20, which had not been true since the share-link
    // outage that changed it). A worker activating mid-navigation can abort
    // page.goto/page.reload with `net::ERR_ABORTED; maybe frame was detached?`,
    // which flaked the preview suite (E2E_BASE_URL) where a real SW registers.
    //
    // So workers stay blocked by default. `e2e/offline.e2e.ts` opts back in for
    // itself with `test.use({ serviceWorkers: 'allow' })` — it is the one spec
    // that exercises offline, and it is where the claim that this app works
    // offline stops being an assertion and starts being a test.
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
        // REUSE an existing `apps/itun/dist` under CI, build only if absent.
        // Same reasoning as apps/srd's config: the PR-blocking specs run inside
        // `build-itun`, which has already built. Unconditionally rebuilding
        // meant a second `vite build` AND a second `tsc --noEmit` (itun's
        // `build` is both) on every PR. The nightly workflow has no build step,
        // so the fallback stays.
        // VITE_REQUIRE_ACCOUNT=false, EXPLICITLY, and this line is the whole
        // reason the nightly was red for a month.
        //
        // `apps/itun/.env.production` turns the ADR-034 account gate on, and
        // Vite loads that file for any `mode=production` build — which this is.
        // So an anonymous run resolved `backendForMode('solo', true, 'absent')`
        // to the MEMORY backend: nothing reached IndexedDB, the roster dropped
        // each entity on its next hydrate, and all 12 specs that build an entity
        // and read it back failed. The failure reads as a missing selector, so
        // it looks like UI drift rather than a storage mode.
        //
        // That file's own comment reasons about `bun test`, `bun run dev` and a
        // fresh checkout, and never considered that the e2e suite builds a
        // production bundle. ADR-034 P1 predicted this exact blast radius and
        // its gate — "the full e2e suite passes with VITE_CONVEX_URL unset" —
        // was marked done without being met.
        //
        // A process env var beats a .env file in Vite, so this restores what the
        // suite is written to assert. The account-required shape is covered
        // separately by the `e2e-itun-signin` job.
        //
        // `scripts/preview.ts`, NOT `vite preview`. The latter loads the whole
        // Vite config — React plugin, PWA plugin, TanStack Router's filesystem
        // route generation — before it serves a byte, and it intermittently
        // never reached `listen` after that pass: the job printed the router
        // plugin's output and then sat until this 240 s timeout, with no spec
        // run. Measured on #958 and #962, roughly one run in two, never
        // reproducible locally. Serving an already-built directory needs none
        // of that machinery, so the replacement has nothing left to hang on and
        // starts in milliseconds. It reproduces the Worker's own routing rules
        // — see its header.
        command: process.env.CI
          ? '[ -d apps/itun/dist ] || VITE_REQUIRE_ACCOUNT=false bun --filter itun build; bun apps/itun/scripts/preview.ts --port 5173'
          : 'bun run dev:itun',
        cwd: '../..',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: process.env.CI ? 'pipe' : 'ignore',
        stderr: 'pipe',
      },
})
