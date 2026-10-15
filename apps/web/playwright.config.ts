import { defineConfig, devices } from '@playwright/test'
import { portFor } from 'gates/ports'

/**
 * The app's end-to-end specs: one server, one run, a project per spec tree
 * (`srd`, `cantina`) and its phone pass.
 *
 * - Specs are `e2e/<tree>/*.e2e.ts`, not `.spec.ts`, so Bun's test runner —
 *   which auto-discovers `.spec.ts` and `.test.ts` — never tries to execute
 *   them. `--project=<tree>` runs one tree's; a file filter runs it in every
 *   tree that has it (`smoke.e2e.ts` is both trees' smoke).
 * - CI serves the BUILT app with `bun run preview`: `wrangler dev` over
 *   `wrangler.jsonc` (one Worker serves the whole site), so the specs run
 *   against the Worker and the `not_found_handling` mode production serves, in
 *   workerd. An existing `dist/` is reused (the PR jobs have just built it).
 *   Locally every project runs against the one dev server (`bun run dev`),
 *   reused when running, on the checkout's own port
 *   (`packages/gates/lib/ports.ts`: offset in a linked worktree), so a
 *   worktree's run boots and reuses its own server, never another checkout's.
 * - `E2E_BASE_URL` runs the same specs against a deployed origin and boots
 *   nothing; per-test budgets widen to `external` there, because every test
 *   pays real network round trips.
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
 * - Chromium runs every spec; a Pixel 7 runs each tree's smoke spec again
 *   (`<tree>-phone`), because phone layouts (the nav drawer, stacked cards) are
 *   what most players see.
 *
 * The budgets, per tree:
 *
 * - **srd**: islands download the salvageunion-reference data chunks on first
 *   intent, so a cold navigation can take a while; 60 s leaves headroom
 *   without masking a real hang.
 * - **cantina** (at `/build/`, ADR-048; specs open `at(route)`,
 *   `e2e/cantina/_base.ts`): the first navigation per test pulls in
 *   salvageunion-reference (a large JSON dataset) and, against the dev
 *   server, Vite's lazy compile of the dashboard and builder routes: 30-60 s
 *   on GHA Ubuntu runners. 90 s leaves headroom without masking a real hang.
 *
 * Signed out, the Cantina is read-only, so every spec that builds something
 * signs in through `e2e/cantina/fixtures.ts`. The PR bundle (ci.yml's
 * `build-web`) has a Convex URL but no `VITE_TEST_AUTH`, so it SKIPS those
 * specs, by design; the nightly `e2e` job provisions a throwaway Convex
 * backend and runs them for real. Locally, `bun run dev` always carries the
 * seam on a local Convex deployment, so those specs need the one-time "Local
 * backend" setup in .claude/skills/convex-ops/SKILL.md and FAIL without it.
 */

type Budget = { timeout: number; expect: number }

/** One spec tree: `e2e/<name>/`, results under `test-results/<name>/`. */
type SpecTree = {
  name: string
  /** Per-test and per-assertion budgets against the local server. */
  local: Budget
  /** The same against a deployed origin (`E2E_BASE_URL`); defaults to `local`. */
  external?: Budget
}

const TREES: readonly SpecTree[] = [
  { name: 'srd', local: { timeout: 60_000, expect: 15_000 } },
  {
    name: 'cantina',
    local: { timeout: 90_000, expect: 15_000 },
    external: { timeout: 150_000, expect: 20_000 },
  },
]

const ci = Boolean(process.env.CI)
const externalBaseURL = process.env.E2E_BASE_URL
const url = `http://localhost:${portFor()}`

export default defineConfig({
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
  projects: TREES.flatMap(({ name, local, external = local }) => {
    const budget = externalBaseURL ? external : local
    const tree = {
      testDir: `./e2e/${name}`,
      outputDir: `./test-results/${name}`,
      timeout: budget.timeout,
      expect: { timeout: budget.expect },
    }
    return [
      { ...tree, name, use: { ...devices['Desktop Chrome'] } },
      {
        ...tree,
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
