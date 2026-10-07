/**
 * The route registry, resolved without a Vite build: `ssg/build.ts` writes
 * exactly the pages `resolve()` returns, so a registration that resolves to
 * nothing, or a data change that quietly empties a `getStaticPaths`, ships a
 * site missing those pages with a green build.
 */

import { describe, expect, it } from 'bun:test'
import { getModel } from 'salvageunion-reference'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { outputPathFor } from '../outputPath'
import { routes } from '../routes'

/** Well under the ~1,040 pages the site emits: a collapse detector, not a budget. */
const PAGE_FLOOR = 900

/**
 * The only inline `<script>` types srd may emit. `public/_headers` gives
 * `script-src` no hashes and no 'unsafe-inline', so an inline script of any
 * other type is blocked in production: load it by URL instead. JSON and
 * JSON-LD are data blocks `script-src` never gates; speculation rules are
 * allowed by `'inline-speculation-rules'`.
 */
const INLINE_SCRIPT_TYPES = new Set(['application/json', 'application/ld+json', 'speculationrules'])

/** Every `<script>` opening tag with no `src` whose type the CSP would block. */
function blockedInlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?=[\s/>])[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => !/\bsrc\s*=/i.test(tag))
    .filter((tag) => !INLINE_SCRIPT_TYPES.has(tag.match(/\btype="([^"]*)"/i)?.[1] ?? ''))
}

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
    const html = first?.render(ASSETS) ?? ''
    expect(html).toStartWith('<!doctype html>')
    expect(blockedInlineScripts(html)).toEqual([])
  })

  it('server-renders a /schema/<id>/ listing as links, without inlining its entities', () => {
    const listings = resolved.find((r) => r.pattern === '/schema/[schemaId]')?.pages ?? []
    expect(listings.length).toBeGreaterThan(0)
    for (const listing of listings) {
      const schemaId = listing.route.split('/')[2] ?? ''
      const entities = getModel(schemaId)?.all() ?? []
      const html = listing.render(ASSETS)
      const props = html.match(
        /<script type="application\/json" data-island-props>(.*?)<\/script>/s
      )
      // The island reads its entities from the ORM; inlined, they were up to 162 KB.
      expect(props?.[1]).toBeString()
      expect(props?.[1]?.length ?? 0).toBeLessThan(4096)
      const links = html.match(new RegExp(`href="/schema/${schemaId}/item/`, 'g')) ?? []
      expect(links.length).toBeGreaterThanOrEqual(entities.length)
    }
  })

  it('keeps every noindexed page out of the sitemap', () => {
    const noindexedInSitemap = resolved
      .filter((r) => r.sitemap)
      .filter((r) => r.pages[0]?.render(ASSETS).includes('<meta name="robots" content="noindex'))
      .map((r) => r.pattern)
    expect(noindexedInSitemap).toEqual([])
  })
})
