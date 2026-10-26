import type { Page } from '@playwright/test'
import { at } from './_base'
import type { JsTotals } from './_bundle'
import { captureJsTotals } from './_bundle'
import { waitForReady } from './_helpers'
import { expect, test } from './fixtures'

// Anonymous on purpose: bundle bytes do not depend on who is signed in.
test.use({ account: 'anonymous' })

/**
 * Bundle-size budget suite — the app's counterpart to
 * `reference-bundle-budget.e2e.ts`, and the regression guard for the
 * route-level code splitting turned on in `astro.config.ts`
 * (`TanStackRouterVite({ autoCodeSplitting: true })`).
 *
 * ## What this measures, and why it differs from the reference site's suite
 *
 * the reference site's budget proves that per-route *data* preload lists keep large schema
 * chunks off pages that don't need them. The app cannot make that claim and
 * deliberately doesn't try: `GameDataReady` calls
 * `SalvageUnionReference.preload('all')` on every route by design (see the
 * long rationale in `src/components/shared/GameDataReady.tsx` — the entity
 * display layer resolves traits/actions/keywords inline, so per-route
 * preload lists reintroduce the "Schema 'traits' not loaded" footgun). The
 * whole reference corpus therefore loads on every route, and is the same
 * ~1.4 MB floor under every budget below.
 *
 * What IS route-dependent is the *app* code, and that is what
 * `autoCodeSplitting` moves: each route's component now ships as its own
 * chunk instead of being linked into one monolithic entry bundle.
 *
 * ## Why `decodedBodySize` (`e2e/_bundle.ts`)
 *
 * `bun run preview` (`wrangler dev`, the CI target) gzips, so
 * `transferSize`/`encodedBodySize` report compressed bytes, while the local
 * dev server this suite also runs against does not compress. A transport-size
 * budget would depend on which server answered. `decodedBodySize` is the
 * uncompressed byte count the browser parses either way, so it is stable
 * across both AND directly comparable to the file sizes in `dist/assets/`,
 * which is how the ceilings below were derived.
 *
 * ## How the ceilings were set
 *
 * From the build CI's `build-web` job serves, each ceiling ~20% above the
 * route's measured value when it was set. A budget pinned at today's size is a
 * tripwire, not a budget; 20% absorbs dependency churn while still failing on
 * a real regression (a newly-eager heavy import, or a jump in the data
 * corpus).
 *
 * ## What keeps the routes small
 *
 * A route file exports no page body, so `autoCodeSplitting` splits it and the
 * live-sheet tree stays out of the entry; `astro.config.ts` names the
 * `codeSplitting` groups (react, vendor, zod, reference, ui) of the initial
 * graph; and the reference package's trusted load path keeps Zod's entity
 * schemas and locales out of the app's client.
 *
 * ## Current baseline
 *
 * The `[bundle-budget]` lines of the 4.5.0 CI run (the Worker-backed build):
 *
 *   route                          measured      ceiling
 *   roster                         2,211,380 B   2,440,000 B
 *   wizard                         2,198,339 B   2,390,000 B
 *   sheet                          2,397,687 B   2,590,000 B
 *   /play/pilots/:pilotId          2,515,698 B   2,920,000 B
 *   /play/games/:gameId/mediate    2,541,798 B   2,920,000 B
 *
 * The largest chunk measures 511,029 B against the 530 KB tripwire. The
 * ceilings were set on the older build and were not raised with it, so the
 * margins are now 8% to 16%: re-take them from a CI run before loosening one.
 *
 * A route file that exports its page body pins ~200 KB back into the entry,
 * which the route margins may not catch; `routeExports.test.ts` and the
 * `Sheet-` forbidden-chunk check below do.
 */

/** `path` under the app's base, ready, with its JS totalled. */
async function captureRouteJs(page: Page, path: string): Promise<JsTotals> {
  return await captureJsTotals(page, async () => {
    await page.goto(at(path))
    await waitForReady(page)
  })
}

/** Print the real numbers into the CI log so the measured-vs-ceiling margin
 *  stays reviewable on a PASSING run too (the Playwright HTML report is only
 *  uploaded on failure), and so the ceilings can be re-tightened from an
 *  actual run rather than re-derived by hand from `dist/`. `console.warn`
 *  rather than `.log` because biome.jsonc's `noConsole` allowlist for this
 *  workspace is `["warn", "error"]` — this is informational output, not a
 *  problem report. Also recorded as a test annotation so it survives into the
 *  HTML report when the budget does fail. */
function report(label: string, totals: JsTotals, ceiling: number): void {
  const line =
    `[bundle-budget] ${label}: ${totals.bytes} B across ${totals.count} chunks ` +
    `(largest ${totals.largest} B) — ceiling ${ceiling} B`
  console.warn(line)
  test.info().annotations.push({ type: 'bundle-budget', description: line })
}

test.describe('bundle-size budget', { tag: '@pr' }, () => {
  test('roster stays under budget and route components are split out', async ({ page }) => {
    const CEILING = 2_440_000
    const totals = await captureRouteJs(page, '/')
    report('/ (roster)', totals, CEILING)

    // The single-largest-chunk tripwire (~511 KB measured, see the table
    // above). Turning either splitting mechanism off re-forms a chunk well
    // past it (a ~615 KB shared chunk before the `codeSplitting` groups, one
    // ~1.24 MB entry before autoCodeSplitting), so it asserts against the app
    // bundle without classifying chunks by name.
    expect(totals.largest).toBeLessThan(530_000)

    // Other routes' component chunks must not ride along on the roster.
    // These two route chunks have unambiguous names, so a future eager
    // import of the changelog or the encounter tray into shared code
    // fails here instead of silently widening every route.
    //
    // `Sheet-` is the live-sheet tree. It rode along on EVERY route — share
    // links included — while two route files exported page bodies that kept
    // autoCodeSplitting from splitting them (see routes/__tests__/
    // routeExports.test.ts, the unit-level guard for the same thing).
    for (const forbidden of ['changelog-', 'encounter-', 'Sheet-']) {
      expect(totals.names.some((n) => n.startsWith(forbidden))).toBe(false)
    }

    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('the pilot wizard stays under budget', async ({ page }) => {
    // `?mode=guided` is load-bearing, not decoration: bare `/pilots/new` renders
    // the CreateModeChooser (two doors), NOT the wizard, so without it this
    // measures the chooser's chunk and reports it under the wizard's name — a
    // budget that would sit green while the thing it claims to guard grew
    // unwatched. `mode=guided` is what mounts PilotWizard (NewEntityScreen.tsx).
    const CEILING = 2_390_000
    const totals = await captureRouteJs(page, '/pilots/new?mode=guided')
    report('/pilots/new?mode=guided (wizard)', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('a live sheet stays under budget', async ({ page }) => {
    // An unknown id on purpose: the sheet route renders its own "not found"
    // state (src/build/sheet/Sheet.tsx) *after* downloading the whole
    // route chunk, so this measures the route's real JS cost without paying
    // for a full wizard run to seed an entity first.
    const CEILING = 2_590_000
    const totals = await captureRouteJs(page, '/pilots/budget-probe')
    report('/pilots/:id', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('Play stays under budget', async ({ page }) => {
    // Same unknown-id probe as the sheet test. This run is signed out, so
    // PlayGate renders its "Sign in to play" shell, but only after the route
    // chunk has loaded, and that chunk imports the whole Cockpit (`PlayGate`
    // imports `PlayCockpit` statically). The byte count is the route's true
    // cost.
    const CEILING = 2_920_000
    const totals = await captureRouteJs(page, '/play/pilots/budget-probe')
    report('/play/pilots/:pilotId', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('the Mediator’s Play stays under budget', async ({ page }) => {
    // The same probe through `PlayMediatorGate`'s "Sign in to run your Game".
    const CEILING = 2_920_000
    const totals = await captureRouteJs(page, '/play/games/budget-probe/mediate')
    report('/play/games/:gameId/mediate', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })
})
