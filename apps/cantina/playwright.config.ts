import { e2eConfig } from 'gates/playwright'
import { SITE } from './src/lib/site'

/**
 * The Cantina's end-to-end suite: `packages/gates/lib/playwrightBase.ts` with the Cantina's port and
 * budgets.
 *
 * The first navigation per test pulls in salvageunion-reference (a large JSON
 * dataset) and, against the dev server, Vite's lazy compile of the dashboard
 * and builder routes: 30-60 s on GHA Ubuntu runners. 90 s leaves headroom
 * without masking a real hang.
 *
 * Signed out, the Cantina is read-only, so every spec that builds something signs in
 * through `e2e/fixtures.ts`. The PR bundle (ci.yml's `build-cantina`) has a Convex
 * URL but no `VITE_TEST_AUTH`, so it SKIPS those specs, by design; the nightly
 * `e2e-cantina` job provisions a throwaway Convex backend and runs them for real.
 * Locally, `bun run dev` always carries the seam on a local Convex deployment,
 * so those specs need the one-time "Local backend" setup in
 * .claude/skills/convex-ops/SKILL.md and FAIL without it.
 */
export default e2eConfig({
  port: 5173,
  // The Cantina at salvageunion.io/build (ADR-048); specs open `at(route)` (e2e/_base.ts).
  basePath: SITE.base,
  local: { timeout: 90_000, expect: 15_000 },
  external: { timeout: 150_000, expect: 20_000 },
})
