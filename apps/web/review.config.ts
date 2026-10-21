import { chromium, defineConfig, devices } from '@playwright/test'
import { chromeExecutable } from 'gates/lib/chromium'

/**
 * The whole-site review shoot (`e2e/review/site.review.ts`), behind the
 * "SalvageUnion.io 4.0 review" deck: see tools/review-deck/README.md. It runs
 * against a server already up (`bun run dev:backend`), never in the suite.
 */
export default defineConfig({
  testDir: './e2e/review',
  outputDir: process.env.REVIEW_OUT ? `${process.env.REVIEW_OUT}/pw-results` : './test-results',
  timeout: 90 * 60_000,
  expect: { timeout: 20_000 },
  testMatch: /\.review\.ts$/,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL,
    serviceWorkers: 'block',
    bypassCSP: true,
    // The cloud image's Chromium when the pinned Playwright's is not installed.
    launchOptions: { executablePath: chromeExecutable(chromium.executablePath()) },
  },
})
