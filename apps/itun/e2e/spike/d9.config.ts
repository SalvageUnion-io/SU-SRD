import { defineConfig, devices } from '@playwright/test'

/**
 * D9 spike measurement (docs/spikes/d9-offline-cache.md) — not part of the
 * suite. Needs a built `dist` served on :4173 against a backend carrying
 * `ITUN_TEST_AUTH`; see the doc's "Reproduce" section.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /d9-measure\.ts$/,
  timeout: 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.D9_BASE_URL ?? 'http://localhost:4173',
    serviceWorkers: 'allow',
    // A container whose Chromium differs from the pinned Playwright's.
    launchOptions: process.env.D9_CHROMIUM ? { executablePath: process.env.D9_CHROMIUM } : {},
  },
})
