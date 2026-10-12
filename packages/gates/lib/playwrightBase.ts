/**
 * The one Playwright configuration both apps run (`apps/srd/playwright.config.ts`
 * and `apps/itun/playwright.config.ts` pass only what differs).
 *
 * - Specs are `e2e/*.e2e.ts`, not `.spec.ts`, so Bun's test runner — which
 *   auto-discovers `.spec.ts` and `.test.ts` — never tries to execute them.
 * - CI serves the BUILT app with `bun run preview`: `wrangler dev` over the
 *   app's own `wrangler.jsonc`, so the specs run against the Worker, the
 *   `not_found_handling` mode and the `_headers` production serves, in workerd.
 *   An existing `dist/` is reused (the PR jobs have just built it). Locally
 *   the running dev server on the same port is reused.
 * - `E2E_BASE_URL` runs the same suite against a deployed origin and boots
 *   nothing; per-test budgets widen to `external` there, because every test
 *   pays real network round trips.
 * - In CI a test that fails and then passes on a retry FAILS the run
 *   (`failOnFlakyTests`). Retries stay, so a flake still records its trace,
 *   but they never hide it.
 * - The page's CSP is bypassed (`bypassCSP`). The specs test behaviour and
 *   accessibility, not the policy, and two things they need sit outside the
 *   production CSP: ITUN's throwaway Convex backend on `127.0.0.1`, and the axe
 *   script the a11y spec injects. `tools/smoke-production.sh` asserts the CSP
 *   that reaches the browser in production.
 * - Service workers are blocked: activating one mid-navigation can abort
 *   `page.goto` with `net::ERR_ABORTED`. A spec about offline opts back in with
 *   `test.use({ serviceWorkers: 'allow' })`.
 * - Chromium runs every spec; a Pixel 7 runs the smoke spec again, because
 *   phone layouts (the nav drawer, stacked cards) are what most players see.
 */
import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

type Budget = { timeout: number; expect: number }

export type AppE2E = {
  /** The port the app's dev server and `preview` listen on. */
  port: number
  /** Per-test and per-assertion budgets against the local server. */
  local: Budget
  /** The same against a deployed origin (`E2E_BASE_URL`); defaults to `local`. */
  external?: Budget
}

export function e2eConfig({ port, local, external = local }: AppE2E): PlaywrightTestConfig {
  const ci = Boolean(process.env.CI)
  const externalBaseURL = process.env.E2E_BASE_URL
  const budget = externalBaseURL ? external : local
  const url = `http://localhost:${port}`

  return defineConfig({
    testDir: './e2e',
    testMatch: /.*\.e2e\.ts$/,
    timeout: budget.timeout,
    expect: { timeout: budget.expect },
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    failOnFlakyTests: ci,
    workers: ci ? 2 : undefined,
    reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
      baseURL: externalBaseURL ?? url,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      serviceWorkers: 'block',
      bypassCSP: true,
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.e2e\.ts$/ },
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
}
