import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

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
    const CEILING = 3_000_000
    const totals = await captureJsTotals(page, '/')
    report('/ (roster)', totals, CEILING)

    // The single-largest-chunk tripwire. With autoCodeSplitting the biggest
    // app chunk is the shared vendor/component-lib chunk (~615 KB) and the
    // entry is ~274 KB; with it OFF every route is linked into one ~1.24 MB
    // entry chunk, which blows this ceiling immediately. The biggest
    // reference-data chunk (actions, ~369 KB) sits well under it too, so
    // this asserts against the app bundle without needing to classify
    // chunks by name.
    expect(totals.largest).toBeLessThan(800_000)

    // Other routes' component chunks must not ride along on the roster.
    // These two route chunks have unambiguous names, so a future eager
    // import of the changelog parser or the encounter tray into shared code
    // fails here instead of silently widening every route.
    for (const forbidden of ['changelog-', 'encounter-']) {
      expect(totals.names.some((n) => n.startsWith(forbidden))).toBe(false)
    }

    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('the pilot wizard stays under budget', async ({ page }) => {
    const CEILING = 3_000_000
    const totals = await captureJsTotals(page, '/pilots/new')
    report('/pilots/new (wizard)', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('a live sheet stays under budget', async ({ page }) => {
    // An unknown id on purpose: the sheet route renders its own "not found"
    // state (src/components/sheet/Sheet.tsx) *after* downloading the whole
    // route chunk, so this measures the route's real JS cost without paying
    // for a full wizard run to seed IndexedDB first.
    const CEILING = 2_950_000
    const totals = await captureJsTotals(page, '/sheet/pilot/budget-probe')
    report('/sheet/pilot/:id', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })

  test('the dashboard stays under budget', async ({ page }) => {
    // Same unknown-id probe as the sheet test — Dashboard.tsx renders
    // "Mech not found" only after its chunk (instruments, dial, display) has
    // loaded, so the byte count is the route's true cost.
    const CEILING = 3_000_000
    const totals = await captureJsTotals(page, '/dashboard/budget-probe')
    report('/dashboard/:id', totals, CEILING)
    expect(totals.bytes).toBeLessThan(CEILING)
  })
})
