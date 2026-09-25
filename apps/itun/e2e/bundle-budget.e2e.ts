import { waitForReady } from './_helpers'
import { expect, test } from './fixtures'

// Anonymous on purpose: bundle bytes do not depend on who is signed in.
test.use({ account: 'anonymous' })

/**
 * Bundle-size budget suite — ITUN's counterpart to
 * `apps/srd/e2e/bundle-budget.e2e.ts`, and the regression guard for the
 * route-level code splitting turned on in `vite.config.ts`
 * (`TanStackRouterVite({ autoCodeSplitting: true })`).
 *
 * ## What this measures, and why it differs from srd's suite
 *
 * srd's budget proves that per-route *data* preload lists keep large schema
 * chunks off pages that don't need them. ITUN cannot make that claim and
 * deliberately doesn't try: `GameDataReady` calls
 * `SalvageUnionReference.preload('all')` on every route by design (see the
 * long rationale in `src/components/shared/GameDataReady.tsx` — the entity
 * display layer resolves traits/actions/keywords inline, so per-route
 * preload lists reintroduce the "Schema 'traits' not loaded" footgun). The
 * whole reference corpus therefore loads on every route, and is the same
 * ~1.4 MB floor under all four budgets below.
 *
 * What IS route-dependent is the *app* code, and that is what
 * `autoCodeSplitting` moves: each route's component now ships as its own
 * chunk instead of being linked into one monolithic entry bundle.
 *
 * ## Why `decodedBodySize` rather than srd's `transferSize`
 *
 * `vite preview` (the CI target, see playwright.config.ts) serves through
 * `@polka/compression`, so `transferSize`/`encodedBodySize` report *gzipped*
 * bytes — while the local dev server this suite also has to run against does
 * not compress. That makes a transport-size budget depend on which server
 * answered. `decodedBodySize` is the uncompressed byte count the browser
 * parses either way, so it is stable across dev/preview AND directly
 * comparable to the file sizes in `dist/assets/`, which is how the ceilings
 * below were derived.
 *
 * ## How the ceilings were set
 *
 * From the real `dist/` output of `bun --filter itun build` plus the Vite
 * manifest's module graph (eager entry closure + the route's own chunk
 * closure + the full reference-data corpus). Every ceiling sits ~20% above
 * its measured value — see the PR that added this file for the
 * measured-vs-ceiling table. A budget pinned at today's size is a tripwire,
 * not a budget; 20% absorbs dependency churn while still failing on a real
 * regression (a newly-eager heavy import, or a jump in the data corpus).
 *
 * ## Re-baselined 2026-09-25 (audit AP-11)
 *
 * Three changes moved the numbers down together: `/s/$id` and `/p/$kind/$appId`
 * stopped exporting page bodies from their route files, which had kept
 * `autoCodeSplitting` from splitting them and so pinned the whole live-sheet
 * tree into the entry; `vite.config.ts` gained named `codeSplitting` groups
 * (react, vendor, zod, reference, component-lib) for the initial graph; and
 * the reference package's trusted load path dropped Zod's entity schemas and
 * locales from itun's client. App JS per route fell by roughly: roster
 * −202 KB, pilot wizard −199 KB, dashboard −199 KB, live sheet −44 KB.
 *
 * The ceilings were then re-derived from scratch, not by subtracting that
 * saving from the old numbers (which had drifted to ~39% headroom). Measured
 * by this suite in CI on the AP-11 head, each ceiling ≈ measured × 1.2:
 *
 *   route      measured      ceiling
 *   roster     1,961,545 B   2,360,000 B
 *   wizard     1,962,337 B   2,360,000 B
 *   dashboard  1,972,449 B   2,370,000 B
 *   sheet      2,090,713 B   2,510,000 B
 *
 * Bringing the whole ~200 KB back (roster → ~2.16 MB) still fits under 20%,
 * so this does not catch a revert of AP-11 on its own — `routeExports.test.ts`
 * and the `Sheet-` forbidden-chunk check below do. What the margin catches is
 * growth beyond ~400 KB. The largest-chunk tripwire moved from 800 KB to
 * 450 KB: the biggest chunk is now the `actions` data chunk (~363 KB), not a
 * ~615 KB app chunk.
 */

type JsTotals = { count: number; bytes: number; names: string[]; largest: number }

/** Sum uncompressed bytes of every same-origin `/assets/*.js` chunk the page
 *  pulled in, keyed by URL so duplicates aren't double counted. `names`
 *  records the chunk filenames for assert-not-present checks; `largest` is
 *  the biggest single chunk (the code-splitting tripwire below). */
async function captureJsTotals(
  page: import('@playwright/test').Page,
  path: string
): Promise<JsTotals> {
  await page.goto(path)
  await waitForReady(page)
  await page.waitForLoadState('networkidle')

  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/assets/') && e.name.endsWith('.js'))
      .map((e) => ({
        name: e.name.split('/assets/')[1] ?? e.name,
        // decodedBodySize is the uncompressed size regardless of Content-
        // Encoding; encodedBodySize is the fallback for the (unexpected)
        // case of a response that reports neither.
        size:
          (e as PerformanceResourceTiming).decodedBodySize ||
          (e as PerformanceResourceTiming).encodedBodySize,
      }))
  )

  const seen = new Map<string, number>()
  for (const e of entries) if (!seen.has(e.name)) seen.set(e.name, e.size)

  const sizes = [...seen.values()]
  return {
    count: seen.size,
    bytes: sizes.reduce((sum, n) => sum + n, 0),
    names: [...seen.keys()],
    largest: sizes.length ? Math.max(...sizes) : 0,
  }
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

test.describe('bundle-size budget', () => {
  test('roster stays under budget and route components are split out', async ({ page }) => {
    const CEILING = 2_360_000
    const totals = await captureJsTotals(page, '/')
    report('/ (roster)', totals, CEILING)

    // The single-largest-chunk tripwire. With autoCodeSplitting and the
    // `codeSplitting` groups, the biggest app chunk is `vendor` (~343 KB) and
    // the entry is ~29 KB; the biggest chunk of all is the `actions` data
    // chunk (~363 KB). Turning either splitting mechanism off re-forms a
    // 600 KB+ chunk (it was a ~615 KB shared chunk before the groups, and one
    // ~1.24 MB entry before autoCodeSplitting), which blows this immediately —
    // so it asserts against the app bundle without classifying chunks by name.
    expect(totals.largest).toBeLessThan(450_000)

    // Other routes' component chunks must not ride along on the roster.
    // These two route chunks have unambiguous names, so a future eager
    // import of the changelog parser or the encounter tray into shared code
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
    const CEILING = 2_360_000
    const totals = await captureJsTotals(page, '/pilots/new?mode=guided')
    report('/pilots/new?mode=guided (wizard)', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('a live sheet stays under budget', async ({ page }) => {
    // An unknown id on purpose: the sheet route renders its own "not found"
    // state (src/components/sheet/Sheet.tsx) *after* downloading the whole
    // route chunk, so this measures the route's real JS cost without paying
    // for a full wizard run to seed IndexedDB first.
    const CEILING = 2_510_000
    const totals = await captureJsTotals(page, '/sheet/pilot/budget-probe')
    report('/sheet/pilot/:id', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('the dashboard stays under budget', async ({ page }) => {
    // Same unknown-id probe as the sheet test — Dashboard.tsx renders
    // "Mech not found" only after its chunk (instruments, dial, display) has
    // loaded, so the byte count is the route's true cost.
    const CEILING = 2_370_000
    const totals = await captureJsTotals(page, '/dashboard/budget-probe')
    report('/dashboard/:id', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })
})
