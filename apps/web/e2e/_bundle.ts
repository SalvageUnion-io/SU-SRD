import type { Page } from '@playwright/test'

/**
 * The JS a page has pulled in, for the bundle-budget specs
 * (`reference-bundle-budget.e2e.ts`, `app-bundle-budget.e2e.ts`).
 */
export type JsTotals = {
  /** Distinct chunks requested. */
  count: number
  /** Their uncompressed bytes, summed. */
  bytes: number
  /** Their file names under `/assets/`, for assert-not-present checks. */
  names: string[]
  /** The biggest single chunk, the code-splitting tripwire. */
  largest: number
}

/**
 * Every same-origin `/assets/*.js` chunk the page has requested so far, read
 * from the Resource Timing API rather than re-fetched, keyed by file name so a
 * duplicate is not counted twice.
 *
 * `decodedBodySize` is the uncompressed byte count the browser parses, so the
 * budget does not move with the server's compression: CI's `bun run preview`
 * (wrangler dev) gzips, the dev server does not, and the ceilings were measured
 * uncompressed, against `dist/assets/` file sizes. `encodedBodySize` is the
 * fallback for a response that reports neither.
 *
 * Keep the `/assets/` prefix in step with `build.assetsDir` in vite.config.ts,
 * and the `name-HASH.js` separator in step with Vite's chunk naming: if either
 * drifts, this matches NOTHING, every budget sums 0 bytes and every assertion
 * passes vacuously. The reference spec's zero-chunk test guards that.
 */
export async function jsChunkTotals(page: Page): Promise<JsTotals> {
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/assets/') && e.name.endsWith('.js'))
      .map((e) => ({
        name: e.name.split('/assets/')[1] ?? e.name,
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

/** Navigate, let the network settle, then total the JS the load pulled in. */
export async function captureJsTotals(
  page: Page,
  navigate: () => Promise<unknown>
): Promise<JsTotals> {
  await navigate()
  await page.waitForLoadState('networkidle')
  return await jsChunkTotals(page)
}
