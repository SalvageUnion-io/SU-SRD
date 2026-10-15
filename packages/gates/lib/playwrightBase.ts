/**
 * The one Playwright configuration (`apps/web/playwright.config.ts`): one
 * server, one run, a project per app (`srd`, `cantina`) and its phone pass.
 *
 * - Specs are `e2e/<app>/*.e2e.ts`, not `.spec.ts`, so Bun's test runner — which
 *   auto-discovers `.spec.ts` and `.test.ts` — never tries to execute them.
 *   `--project=<app>` runs one app's; a file filter runs it in every app that
 *   has it (`smoke.e2e.ts` is both apps' smoke).
 * - CI serves the BUILT app with `bun run preview`: `wrangler dev` over
 *   the workspace's `wrangler.jsonc` (one Worker serves both apps), so the
 *   specs run against the Worker and the `not_found_handling` mode production
 *   serves, in workerd. An existing `dist/` is reused (the PR jobs have just
 *   built it). Locally every project runs against the one dev server
 *   (`bun run dev`), reused when running, on the checkout's own port
 *   (`ports.ts`: offset in a linked worktree), so a worktree's run boots and
 *   reuses its own server, never another checkout's.
 * - `E2E_BASE_URL` runs the same specs against a deployed origin and boots
 *   nothing; per-test budgets widen to `external` there, because every test
 *   pays real network round trips.
 * - In CI a test that fails and then passes on a retry FAILS the run
 *   (`failOnFlakyTests`). Retries stay, so a flake still records its trace,
 *   but they never hide it.
 * - The page's CSP is bypassed (`bypassCSP`). The specs test behaviour and
 *   accessibility, not the policy, and two things they need sit outside the
 *   production CSP: The Cantina's throwaway Convex backend on `127.0.0.1`, and the axe
 *   script the a11y spec injects. `tools/smoke-production.sh` asserts the CSP
 *   that reaches the browser in production.
 * - Service workers are blocked: activating one mid-navigation can abort
 *   `page.goto` with `net::ERR_ABORTED`. A spec about offline opts back in with
 *   `test.use({ serviceWorkers: 'allow' })`.
 * - Chromium runs every spec; a Pixel 7 runs each app's smoke spec again
 *   (`<app>-phone`), because phone layouts (the nav drawer, stacked cards) are
 *   what most players see.
 */
import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

type Budget = { timeout: number; expect: number }

/** One app's specs: a project, and its phone pass. */
type AppSpecs = {
  /**
   * The app: its specs are `e2e/<name>/`, its results go under
   * `test-results/<name>/`, and its projects are `<name>` and `<name>-phone`.
   */
  name: string
  /** Per-test and per-assertion budgets against the local server. */
  local: Budget
  /** The same against a deployed origin (`E2E_BASE_URL`); defaults to `local`. */
  external?: Budget
}

export type AppE2E = {
  /** The port the dev server listens on (and `preview`, in CI). */
  port: number
  apps: readonly AppSpecs[]
}

export function e2eConfig({ port, apps }: AppE2E): PlaywrightTestConfig {
  const ci = Boolean(process.env.CI)
  const externalBaseURL = process.env.E2E_BASE_URL
  const url = `http://localhost:${port}`

  return defineConfig({
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
    projects: apps.flatMap(({ name, local, external = local }) => {
      const budget = externalBaseURL ? external : local
      const app = {
        testDir: `./e2e/${name}`,
        outputDir: `./test-results/${name}`,
        timeout: budget.timeout,
        expect: { timeout: budget.expect },
      }
      return [
        { ...app, name, use: { ...devices['Desktop Chrome'] } },
        {
          ...app,
          name: `${name}-phone`,
          use: { ...devices['Pixel 7'] },
          testMatch: /smoke\.e2e\.ts$/,
        },
      ]
    }),
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
