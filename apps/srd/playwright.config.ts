import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for srd end-to-end tests.
 *
 * srd is a fully static site (the in-house SSG in `ssg/`, no SSR, no backend).
 * The e2e suite therefore runs against a locally-served build — the same
 * static-preview approach ITUN uses, NOT a Netlify Deploy-Preview target
 * (there is no server-side behaviour to exercise against a live deployment).
 *
 * - CI: `bun ssg/build.ts` produces `dist/`, then `bun ssg/preview.ts` serves it
 *   as static files on port 4321 (no per-request compile — first navigation is
 *   fast). The `build` package script is invoked directly rather than
 *   `og:generate`, which chains the slow OG-screenshot pass (headless browser
 *   over ~1,500 pages) that the smoke suite does not need.
 * - Local: reuse the already-running dev server on 4321 (the dev experience
 *   expectation; see the "restart in place on 4321" convention).
 */
export default defineConfig({
  testDir: './e2e',
  // Spec files use the `.e2e.ts` extension (instead of the default
  // `.spec.ts`) so Bun's test runner — which auto-discovers `.spec.ts` and
  // `.test.ts` — does not try to execute them. Playwright is told here to
  // look for `*.e2e.ts`.
  testMatch: /.*\.e2e\.ts$/,
  // Islands lazily download the salvageunion-reference data chunks on first
  // intent; a cold preview navigation can take a while, so give generous
  // headroom without masking real hangs.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The site registers a PWA service worker (workbox generateSW, autoUpdate).
    // Its activation triggers a reload that can abort an in-flight navigation
    // mid-test; no e2e here exercises offline/installability, so block SW
    // registration to remove the race.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable on demand:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
  ],
  // webServer.cwd defaults to this config file's directory (apps/srd), so the
  // ssg/ scripts and dist/ resolve without a `cd`.
  webServer: {
    // REUSE an existing `dist` under CI, build only if there isn't one.
    //
    // This used to build unconditionally. The PR-blocking specs now run inside
    // `build-srd`, which has already produced `dist` — so an unconditional
    // build meant the app was built TWICE per PR, and the "folding e2e into the
    // build job reuses the build" rationale was simply false. The nightly
    // workflow runs `playwright test` with no build step of its own, so the
    // fallback is load-bearing: keep both halves.
    command: process.env.CI
      ? '[ -d dist ] || bun ssg/build.ts; bun ssg/preview.ts --port 4321'
      : 'bun run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: process.env.CI ? 'pipe' : 'ignore',
    stderr: 'pipe',
  },
})
