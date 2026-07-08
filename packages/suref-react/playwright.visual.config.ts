import { defineConfig, devices } from '@playwright/test'

/**
 * Visual-regression Playwright config for the suref-react Ladle stories
 * (issue #30).
 *
 * This is SEPARATE from any functional Playwright config: it points at the
 * static Ladle build and diffs full-page screenshots of each story against
 * committed baselines. Spec files use the `.visual.ts` extension (not
 * `.spec.ts`/`.test.ts`) so Bun's own test runner — which auto-discovers
 * `*.test.ts`/`*.spec.ts` — never tries to execute them.
 *
 * Workflow (per Ladle's official visual-snapshot guide):
 *   `ladle build`  -> writes the static bundle + meta.json to build-ladle/
 *   `ladle preview` -> serves build-ladle/ on :61000
 *   this suite     -> reads build-ladle/meta.json, screenshots each story
 *
 * @playwright/test is NOT a direct dependency of this package; it resolves from
 * the hoisted workspace install (apps/in-the-union-now pins it). If resolution
 * ever fails, a maintainer runs `bun add -d @playwright/test` here.
 */
const PORT = 61000
// `localhost` (not a hardcoded 127.0.0.1) — `ladle preview`'s underlying Vite
// preview server binds per-OS loopback defaults (IPv6-only `::1` on some
// macOS/Node combinations), so a literal IPv4 address can fail to connect
// even though the server is up. `localhost` resolves correctly wherever the
// server actually listens.
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './visual',
  testMatch: /.*\.visual\.ts$/,
  // Keep baselines beside the spec, in a committed directory.
  snapshotDir: './visual/__screenshots__',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    // Small tolerance for sub-pixel / font-hinting noise between runs.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serve the pre-built Ladle bundle. In CI the `ladle build` step runs first;
  // locally the maintainer runs `ladle:build` (or `test:visual` after building).
  webServer: {
    command: `bunx ladle preview --port ${PORT}`,
    cwd: '.',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
