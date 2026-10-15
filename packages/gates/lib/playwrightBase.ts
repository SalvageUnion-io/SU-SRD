/**
 * The one Playwright configuration both suites run (`apps/web`'s
 * `playwright.config.ts` and `playwright.cantina.config.ts` pass only what differs).
 *
 * - Specs are `e2e/*.e2e.ts`, not `.spec.ts`, so Bun's test runner — which
 *   auto-discovers `.spec.ts` and `.test.ts` — never tries to execute them.
 * - CI serves the BUILT app with `bun run preview`: `wrangler dev` over
 *   srd's `wrangler.jsonc` (one Worker serves both apps), so the specs run
 *   against the Worker and the `not_found_handling` mode production serves,
 *   in workerd.
 *   An existing `dist/` is reused (the PR jobs have just built it). Locally
 *   both suites run against the one dev server (`bun run dev`), reused when
 *   running, on the checkout's own port (`ports.ts`: offset in a linked
 *   worktree), so a worktree's suite boots and reuses its own server, never
 *   another checkout's.
 * - `E2E_BASE_URL` runs the same suite against a deployed origin and boots
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
 * - Chromium runs every spec; a Pixel 7 runs the smoke spec again, because
 *   phone layouts (the nav drawer, stacked cards) are what most players see.
 */
import type { PlaywrightTestConfig } from '@playwright/test'
import { defineConfig, devices } from '@playwright/test'

type Budget = { timeout: number; expect: number }

export type AppE2E = {
  /**
   * Which suite: its specs are `e2e/<suite>/`, its results and report go under
   * `test-results/<suite>/` and `playwright-report/<suite>/`. `apps/web` holds
   * two, `srd` and `cantina`.
   */
  suite: string
  /**
   * The workspace scripts that serve it, when not `dev`, `build` and `preview`,
   * and the folder `build` writes, when not `dist` (the Cantina's build and
   * preview are suffixed `:cantina` and it builds into `dist-cantina`).
   */
  scripts?: { dev: string; build: string; preview: string; dist: string }
  /** The port the app's dev server listens on (and `preview`, in CI). */
  port: number
  /**
   * The path the app is served under, when not the root (The Cantina's `/build/`,
   * ADR-048): where the readiness check asks, since its dev server answers
   * nothing above it. `baseURL` stays the origin; specs put the path on.
   */
  basePath?: string
  /** Per-test and per-assertion budgets against the local server. */
  local: Budget
  /** The same against a deployed origin (`E2E_BASE_URL`); defaults to `local`. */
  external?: Budget
}

const DEFAULT_SCRIPTS = { dev: 'dev', build: 'build', preview: 'preview', dist: 'dist' }

export function e2eConfig({
  suite,
  scripts = DEFAULT_SCRIPTS,
  port,
  basePath = '/',
  local,
  external = local,
}: AppE2E): PlaywrightTestConfig {
  const ci = Boolean(process.env.CI)
  const externalBaseURL = process.env.E2E_BASE_URL
  const budget = externalBaseURL ? external : local
  const url = `http://localhost:${port}`

  return defineConfig({
    testDir: `./e2e/${suite}`,
    outputDir: `./test-results/${suite}`,
    testMatch: /.*\.e2e\.ts$/,
    timeout: budget.timeout,
    expect: { timeout: budget.expect },
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    failOnFlakyTests: ci,
    workers: ci ? 2 : undefined,
    reporter: ci
      ? [['github'], ['html', { open: 'never', outputFolder: `playwright-report/${suite}` }]]
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
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.e2e\.ts$/ },
    ],
    webServer: externalBaseURL
      ? undefined
      : {
          command: ci
            ? `[ -d ${scripts.dist} ] || bun run ${scripts.build}; bun run ${scripts.preview}`
            : `bun run ${scripts.dev}`,
          url: `${url}${basePath}`,
          reuseExistingServer: !ci,
          timeout: 240_000,
          // wrangler logs every request to stdout; a failure to start is stderr.
          stdout: 'ignore',
          stderr: 'pipe',
        },
  })
}
