/**
 * The route registry, resolved without a Vite build: `ssg/build.ts` writes
 * exactly the pages `resolve()` returns, so a registration that resolves to
 * nothing, or a data change that quietly empties a `getStaticPaths`, ships a
 * site missing those pages with a green build.
 */

import { describe, expect, it } from 'bun:test'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { outputPathFor } from '../outputPath'
import { routes } from '../routes'

/** Well under the ~1,040 pages the site emits: a collapse detector, not a budget. */
const PAGE_FLOOR = 900

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands.js'],
  styles: ['/assets/styles.css'],
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

describe('route registry', () => {
  const resolved = routes.map((r) => ({
    pattern: r.pattern,
    sitemap: r.sitemap,
    pages: r.resolve(),
  }))

  it('emits at least one page for every registered route', () => {
    expect(resolved.filter((r) => r.pages.length === 0).map((r) => r.pattern)).toEqual([])
  })

  it(`emits at least ${PAGE_FLOOR} pages, each to its own file`, () => {
    const pages = resolved.flatMap((r) => r.pages.map((p) => outputPathFor(p.route)))
    expect(new Set(pages).size).toBe(pages.length)
    expect(pages.length).toBeGreaterThanOrEqual(PAGE_FLOOR)
  })

  it.each(routes.map((r) => r.pattern))('renders the first %s page to a document', (pattern) => {
    const first = resolved.find((r) => r.pattern === pattern)?.pages[0]
    expect(first?.render(ASSETS)).toStartWith('<!doctype html>')
  })

  it('keeps every noindexed page out of the sitemap', () => {
    const noindexedInSitemap = resolved
      .filter((r) => r.sitemap)
      .filter((r) => r.pages[0]?.render(ASSETS).includes('<meta name="robots" content="noindex'))
      .map((r) => r.pattern)
    expect(noindexedInSitemap).toEqual([])
  })
})
