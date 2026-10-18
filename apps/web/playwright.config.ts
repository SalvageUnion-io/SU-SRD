import { defineConfig, devices } from '@playwright/test'
import { portFor } from 'gates/ports'

/**
 * The app's end-to-end specs: one tree (`e2e/`), one server, one run.
 *
 * - Specs are `e2e/*.e2e.ts`, not `.spec.ts`, so Bun's test runner — which
 *   auto-discovers `.spec.ts` and `.test.ts` — never tries to execute them.
 *   `_`-prefixed modules and `fixtures.ts` are shared helpers. A file filter is
 *   a pattern, so `smoke.e2e.ts` runs `reference-smoke.e2e.ts` and
 *   `app-smoke.e2e.ts` both.
 * - CI serves the BUILT app with `bun run preview`: `wrangler dev` over
 *   `wrangler.jsonc` (one Worker serves the whole site), so the specs run
 *   against the Worker and the `not_found_handling` mode production serves, in
 *   workerd. An existing `dist/` is reused (the PR jobs have just built it).
 *   Locally every spec runs against the one dev server (`bun run dev`),
 *   reused when running, on the checkout's own port
 *   (`packages/gates/lib/ports.ts`: offset in a linked worktree), so a
 *   worktree's run boots and reuses its own server, never another checkout's.
 * - `E2E_BASE_URL` runs the same specs against a deployed origin and boots
 *   nothing; the assertion budget widens there, because every test pays real
 *   network round trips.
 * - In CI a test that fails and then passes on a retry FAILS the run
 *   (`failOnFlakyTests`). Retries stay, so a flake still records its trace,
 *   but they never hide it.
 * - The page's CSP is bypassed (`bypassCSP`). The specs test behaviour and
 *   accessibility, not the policy, and two things they need sit outside the
 *   production CSP: the Cantina's throwaway Convex backend on `127.0.0.1`, and
 *   the axe script the a11y spec injects. `tools/smoke-production.sh` asserts
 *   the CSP that reaches the browser in production.
 * - Service workers are blocked: activating one mid-navigation can abort
 *   `page.goto` with `net::ERR_ABORTED`. A spec about offline opts back in with
 *   `test.use({ serviceWorkers: 'allow' })`.
 * - Chromium runs every spec (`desktop`); a Pixel 7 runs the smoke specs again
 *   (`phone`), because phone layouts (the nav drawer, stacked cards) are what
 *   most players see.
 *
 * One budget for every test: a reference page's islands download the
 * salvageunion-reference data chunks on first intent, so a cold navigation can
 * take a while; 60 s leaves headroom without masking a real hang. A slower spec
 * sets its own: the Cantina's `test` (`e2e/fixtures.ts`) gives each of its
 * tests 90 s, and the a11y and perf specs set theirs.
 *
 * Signed out, the Cantina is read-only, so every spec that builds something
 * signs in through `e2e/fixtures.ts`. Both CI builds that run them, ci.yml's
 * `build-web` (the PR tier, its listed specs) and the nightly `e2e` job (the
 * whole suite), carry the seam against a throwaway Convex backend; a build
 * without it SKIPS those specs. Locally, `bun run dev` always carries the seam on a local Convex
 * deployment, so those specs need the one-time "Local backend" setup in
 * .claude/skills/convex-ops/SKILL.md and FAIL without it.
 */

const ci = Boolean(process.env.CI)
const externalBaseURL = process.env.E2E_BASE_URL
const url = `http://localhost:${portFor()}`

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: externalBaseURL ? 20_000 : 15_000 },
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  failOnFlakyTests: ci,
  workers: ci ? 2 : undefined,
  reporter: ci
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: externalBaseURL ?? url,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
    bypassCSP: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.e2e\.ts$/ },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: ci ? '[ -d dist ] || bun run build; bun run preview' : 'bun run dev',
        url,
        reuseExistingServer: !ci,
        timeout: 240_000,
        // wrangler logs every request to stdout; a failure to start is stderr.
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
