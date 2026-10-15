import { e2eConfig } from 'gates/playwright'
import { portFor } from 'gates/ports'

/**
 * The app's end-to-end specs, one run against one server
 * (`packages/gates/lib/playwrightBase.ts`): a project per app, with its budgets.
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
export default e2eConfig({
  port: portFor('web'),
  apps: [
    { name: 'srd', local: { timeout: 60_000, expect: 15_000 } },
    {
      name: 'cantina',
      local: { timeout: 90_000, expect: 15_000 },
      external: { timeout: 150_000, expect: 20_000 },
    },
  ],
})
