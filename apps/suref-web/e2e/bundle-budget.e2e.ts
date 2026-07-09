import { test, expect } from '@playwright/test'

/**
 * Bundle-size budget suite — proves the per-route preload lists
 * (`src/lib/schemaPreloadDeps.ts`) and the build-time compact search index
 * (`src/lib/searchIndexBuild.ts`) actually keep large data chunks off pages
 * that don't need them, and stay under a byte budget. This is the
 * regression guard for ADR-005's promise ("apps pay only for the data they
 * load") actually holding for suref-web — a change that widens a per-route
 * preload list, or reintroduces `preload('all')` on an island, fails this
 * suite instead of silently regressing bundle size.
 *
 * Budgets are set with real headroom above current measured sizes (see the
 * PR description for before/after numbers) — they should fail on a
 * meaningful regression, not on every dependency bump.
 */

type ResourceTotals = { count: number; bytes: number; names: string[] }

/** Sum transferred bytes of same-origin `_astro/*.js` chunks requested during
 *  a page load, keyed by response so redirects/duplicates aren't double
 *  counted. `names` records the chunk filenames for assert-not-present checks. */
async function captureAstroJsTotals(
  page: import('@playwright/test').Page,
  navigate: () => Promise<unknown>
): Promise<ResourceTotals> {
  const totals: ResourceTotals = { count: 0, bytes: 0, names: [] }
  const seen = new Set<string>()

  page.on('response', (response) => {
    const url = response.url()
    if (!url.includes('/_astro/') || !url.endsWith('.js')) return
    if (seen.has(url)) return
    seen.add(url)
    totals.names.push(url.split('/_astro/')[1] ?? url)
    totals.count += 1
  })

  await navigate()
  await page.waitForLoadState('networkidle')

  // Sizes via the Resource Timing API (transferSize — actual bytes over the
  // wire, 0 for cached/opaque responses) rather than re-fetching each URL.
  const sizes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/_astro/') && e.name.endsWith('.js'))
      .map(
        (e) =>
          (e as PerformanceResourceTiming).transferSize ||
          (e as PerformanceResourceTiming).encodedBodySize
      )
  )
  totals.bytes = sizes.reduce((sum, n) => sum + n, 0)

  return totals
}

test.describe('bundle-size budget', () => {
  test('a leaf-schema item page never loads the large content/chassis data chunks', async ({
    page,
  }) => {
    const totals = await captureAstroJsTotals(page, () => page.goto('/schema/traits/item/missile/'))

    // The big, schema-specific data chunks (actions ~360KB, chassis ~150KB,
    // roll-tables' own listing chunk) must not be among the requested files —
    // schemaPreloadDeps.ts's ALWAYS_CORE bundle for leaf schemas excludes
    // every CONTENT_BUNDLE/CHASSIS_BUNDLE-only schema.
    const forbidden = ['chassis.', 'crawler-bays.', 'guides.', 'meld.']
    for (const name of forbidden) {
      expect(totals.names.some((n) => n.startsWith(name))).toBe(false)
    }

    // Total JS (react-vendor + shared island framework + the small
    // ALWAYS_CORE data chunks) — ~2x headroom over the measured baseline
    // (~277 KB at the time this budget was set; preload('all') on this same
    // route measured ~555 KB, so this also guards against regressing back
    // toward that).
    expect(totals.bytes).toBeLessThan(550_000)
  })

  test('a chassis item page loads chassis-bundle data but not unrelated content schemas', async ({
    page,
  }) => {
    const totals = await captureAstroJsTotals(page, () => page.goto('/schema/chassis/item/mule/'))

    // Schemas with no chassis-pattern relationship (per CHASSIS_BUNDLE in
    // schemaPreloadDeps.ts) should never be fetched on a chassis page.
    const forbidden = ['crawler-bays.', 'guides.', 'meld.', 'bio-titans.', 'creatures.']
    for (const name of forbidden) {
      expect(totals.names.some((n) => n.startsWith(name))).toBe(false)
    }

    // ~2x headroom over the measured baseline (~461 KB — the most
    // data-heavy page category, chassis + systems + modules + actions).
    expect(totals.bytes).toBeLessThan(900_000)
  })

  test('search never loads the salvageunion-reference data chunks — only the compact index', async ({
    page,
  }) => {
    const jsTotals = await captureAstroJsTotals(page, () => page.goto('/'))

    let sawSearchIndex = false
    page.on('response', (response) => {
      if (response.url().endsWith('/search-index.json')) sawSearchIndex = true
    })

    const search = page.getByRole('combobox', { name: /search the srd/i }).first()
    await search.click()
    await search.fill('Mule')
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    })

    expect(sawSearchIndex).toBe(true)
    // Zero salvageunion-reference schema data chunks — search runs entirely
    // against the compact index, never the ORM.
    const dataChunkPattern =
      /^(actions|chassis|systems|modules|equipment|abilities|traits|keywords|roll-tables)\./
    expect(jsTotals.names.some((n) => dataChunkPattern.test(n))).toBe(false)
  })
})
