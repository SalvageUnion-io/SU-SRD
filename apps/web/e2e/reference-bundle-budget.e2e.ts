import { captureJsTotals, jsChunkTotals } from './_bundle'
import { expect, test } from './fixtures'

/**
 * Bundle-size budget suite — proves the per-route preload lists
 * (`src/lib/schemaPreloadDeps.ts`) and the build-time compact search index
 * (`src/lib/searchIndexBuild.ts`) actually keep large data chunks off pages
 * that don't need them, and stay under a byte budget. This is the
 * regression guard for ADR-005's promise ("apps pay only for the data they
 * load") actually holding for the reference site — a change that widens a per-route
 * preload list, or reintroduces `preload('all')` on an island, fails this
 * suite instead of silently regressing bundle size.
 *
 * Budgets are set with real headroom above current measured sizes (see the
 * PR description for before/after numbers) — they should fail on a
 * meaningful regression, not on every dependency bump.
 */

/**
 * This suite is only meaningful against a PRODUCTION BUILD, and locally it does
 * not get one by default.
 *
 * `playwright.config.ts` starts `bun run dev` outside CI (and reuses an existing
 * server on 4321). The dev server serves ES modules straight from source under
 * `/src/…`, `/@fs/…` and `/node_modules/.vite/…` — the `/assets/…` prefix that
 * this file measures exists ONLY in a Rollup build. So a plain local
 * `bunx playwright test` would report two confusing failures here: the
 * dead-selector guard sees zero chunks, and the byte budget sums zero.
 *
 * That is a harness mismatch, not a payload regression, and it should not read
 * as one. Detect it up front and fail with the command that fixes it, rather
 * than letting each test fail on its own misleading assertion. CI always builds
 * (`bun run build && bun run preview`), so this never trips there.
 */

// What any visitor sees: nothing here needs an account.
test.use({ account: 'anonymous' })

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  try {
    await page.goto('/traits/missile/', { waitUntil: 'domcontentloaded' })
    const built = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).some((s) =>
        (s as HTMLScriptElement).src.includes('/assets/')
      )
    )
    if (!built) {
      throw new Error(
        'bundle-budget requires a production build — the server on this port is ' +
          'serving unbundled dev modules, so there are no /assets/*.js chunks to ' +
          'measure.\n\nRun the suite against a real build instead:\n' +
          '  cd apps/web && bun run build && bun run preview\n' +
          '  bunx playwright test bundle-budget.e2e.ts\n'
      )
    }
  } finally {
    await page.close()
  }
})

test.describe('bundle-size budget', { tag: '@pr' }, () => {
  // Every assertion in this file is of the form "these chunks are absent" or
  // "the total is under N". Both are trivially satisfied when the capture
  // matches nothing at all — a changed asset prefix once left this suite green
  // while guarding nothing.
  //
  // So assert the capture is non-empty FIRST. A budget guard that cannot fail
  // is worse than no guard, because it is also reassuring.
  test('the capture actually sees JS chunks (guards against a dead selector)', async ({ page }) => {
    const totals = await captureJsTotals(page, () => page.goto('/traits/missile/'))
    expect(totals.count).toBeGreaterThan(0)
    expect(totals.bytes).toBeGreaterThan(0)
  })

  test('a leaf-schema item page never loads the large content/chassis data chunks', async ({
    page,
  }) => {
    const totals = await captureJsTotals(page, () => page.goto('/traits/missile/'))
    expect(totals.count).toBeGreaterThan(0)

    // The big, schema-specific data chunks (actions ~360KB, chassis ~150KB,
    // roll-tables' own listing chunk) must not be among the requested files —
    // schemaPreloadDeps.ts's ALWAYS_CORE bundle for leaf schemas excludes
    // every CONTENT_BUNDLE/CHASSIS_BUNDLE-only schema.
    const forbidden = ['chassis-', 'crawler-bays-', 'guides-', 'meld-']
    for (const name of forbidden) {
      expect(totals.names.some((n) => n.startsWith(name))).toBe(false)
    }

    // Total JS on a page nobody has touched: the island entry and its runtime.
    // Every island here waits for a reader (`interaction`), so React and the
    // data chunks load only when one is reached for.
    //
    // A ratchet: it fails on any growth past the measured ~26 KB (the island
    // entry, the chip lanes, the overflow, the bottom-right fill's runtime
    // and its watch, which fits off-screen heads in later turns). Something
    // loading React or game data at page load again lands far above it.
    // Measured 27,098 with the Homebrew island registered (ADR-061): one hop
    // away (`runtime/homebrewLoad.ts`), it costs the island entry 161 bytes.
    // Measured 27,212 once the island lists patterns as the book does
    // (`PatternListing` on the game-data surface): its lazy chunk's preload
    // list names more chunks, 42 bytes more in the island entry.
    // Measured 27,517 on Vite 8.3.5, which Astro 7 needs (ADR-065): its
    // preload helper dedupes in-flight preloads, 323 bytes more. Measured
    // 27,697 built by Astro: its client build keeps the helper's `relList`
    // check, 146 bytes more. Measured 27,570 once sign-in moved to the
    // Worker: the bar's hint reads one key instead of scanning for Convex
    // Auth's.
    expect(totals.bytes).toBeLessThan(27_800)
  })

  test('a chassis item page loads chassis-bundle data but not unrelated content schemas', async ({
    page,
  }) => {
    const totals = await captureJsTotals(page, () => page.goto('/chassis/mule/'))

    // Schemas with no chassis-pattern relationship (per CHASSIS_BUNDLE in
    // schemaPreloadDeps.ts) should never be fetched on a chassis page.
    const forbidden = ['crawler-bays-', 'guides-', 'meld-', 'bio-titans-', 'creatures-']
    for (const name of forbidden) {
      expect(totals.names.some((n) => n.startsWith(name))).toBe(false)
    }

    // The same ratchet as the leaf page: a chassis page's card is static HTML,
    // and nothing on it loads React or data until a reader reaches for it.
    expect(totals.bytes).toBeLessThan(27_800)
  })

  test('search never loads the salvageunion-reference data chunks — only the compact index', async ({
    page,
  }) => {
    await page.goto('/')

    let sawSearchIndex = false
    page.on('response', (response) => {
      if (response.url().endsWith('/search-index.json')) sawSearchIndex = true
    })

    // Served as a plain field; it becomes the combobox when reached for.
    const name = /search the reference/i
    const search = page
      .getByRole('combobox', { name })
      .or(page.getByRole('searchbox', { name }))
      .first()
    await search.click()
    await search.fill('Mule')
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    })

    expect(sawSearchIndex).toBe(true)
    const jsTotals = await jsChunkTotals(page)
    // Zero salvageunion-reference schema data chunks — search runs entirely
    // against the compact index, never the ORM.
    const dataChunkPattern =
      /^(actions|chassis|systems|modules|equipment|abilities|traits|keywords|roll-tables)-/
    expect(jsTotals.names.some((n) => dataChunkPattern.test(n))).toBe(false)
  })
})
