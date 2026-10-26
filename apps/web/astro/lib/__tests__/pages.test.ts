/**
 * The pages, resolved without a build: Astro writes exactly the pages each
 * shell's `getStaticPaths` returns, so a shell that resolves to nothing, or
 * a data change that quietly empties a `getStaticPaths`, ships a site missing
 * those pages with a green build.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getModel } from 'salvageunion-reference'
import { APP_BASE } from '../../../src/lib/appBase'
import { listingEntries } from '../../../src/lib/listingEntries'
import { executableInlineScripts } from '../../build/inlineScripts'
import { NOT_IN_SITEMAP } from '../../build/sitemap'
import { shells } from './pages'

const PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url))

/** Well under the ~1,040 pages the site emits: a collapse detector, not a budget. */
const PAGE_FLOOR = 900

/** The shell file Astro routes a module pattern from: `/[schemaId]` -> `[schemaId]/index.astro` or `[schemaId].astro`. */
const shellFilesFor = (pattern: string): string[] =>
  pattern === '/'
    ? ['index.astro']
    : [`${pattern.slice(1)}.astro`, `${pattern.slice(1)}/index.astro`]

describe('the page shells', () => {
  const resolved = shells.map((shell) => ({
    pattern: shell.module.pattern,
    file: shell.file,
    pages: shell.pages,
  }))

  it('sit where Astro routes each module’s own pattern', () => {
    const misplaced = resolved.filter((r) => !shellFilesFor(r.pattern).includes(r.file))
    expect(misplaced.map((r) => `${r.file} wraps ${r.pattern}`)).toEqual([])
  })

  it('emits at least one page for every registered route', () => {
    expect(resolved.filter((r) => r.pages.length === 0).map((r) => r.pattern)).toEqual([])
  })

  it(`emits at least ${PAGE_FLOOR} pages, each to its own file`, () => {
    const pages = resolved.flatMap((r) => r.pages.map((p) => p.route))
    expect(new Set(pages).size).toBe(pages.length)
    expect(pages.length).toBeGreaterThanOrEqual(PAGE_FLOOR)
  })

  it.each(resolved.map((r) => r.pattern))('renders the first %s page to a document', (pattern) => {
    const first = resolved.find((r) => r.pattern === pattern)?.pages[0]
    const html = first?.render() ?? ''
    expect(html).toStartWith('<!doctype html>')
    // A page's only inline script is its speculation rules, which the build
    // hashes into the CSP with Astro's island scripts (`inlineScripts.ts`).
    const own = executableInlineScripts(html).filter((body) => !body.startsWith('{"prefetch"'))
    expect(own).toEqual([])
  })

  it('server-renders a /<id>/ listing as links, without inlining its entities', () => {
    const listings = resolved.find((r) => r.pattern === '/[schemaId]')?.pages ?? []
    expect(listings.length).toBeGreaterThan(0)
    for (const listing of listings) {
      const schemaId = listing.route.split('/')[1] ?? ''
      // What the listing lists: the roll tables only their top-level ones.
      const entities = listingEntries(schemaId, getModel(schemaId)?.all() ?? [])
      const html = listing.render()
      const viewer = Object.values(listing.document().islands).find(
        (island) => island.name === 'SchemaViewerIsland'
      )
      // The island reads its entities from the ORM; inlined, they were up to 162 KB.
      expect(viewer).toBeDefined()
      expect(JSON.stringify(viewer?.props).length).toBeLessThan(4096)
      const links = html.match(new RegExp(`href="/${schemaId}/[^"]`, 'g')) ?? []
      expect(links.length).toBeGreaterThanOrEqual(entities.length)
    }
  })

  // Pages sit at the root (`/chassis/mule/`), so a schema id shares one
  // namespace with every other top-level path: a schema named `about`, a
  // public directory named `chassis`, or a schema under the app's `/build/` or
  // the JSON API's `/schema/` would shadow one or the other.
  it('gives no schema listing a first segment another route, a public file or a sibling app owns', () => {
    const listingPattern = '/[schemaId]'
    const schemaIds = (resolved.find((r) => r.pattern === listingPattern)?.pages ?? []).map(
      (p) => p.route.split('/')[1] ?? ''
    )
    expect(schemaIds.length).toBeGreaterThan(0)
    const taken = new Set([
      ...resolved
        .filter((r) => !r.pattern.startsWith('/[schemaId]'))
        .flatMap((r) => r.pages.map((p) => p.route.split('/')[1] ?? '')),
      ...readdirSync(PUBLIC_DIR),
      APP_BASE.slice(1),
      'schema',
      'assets',
    ])
    expect(schemaIds.filter((id) => taken.has(id))).toEqual([])
  })

  it('keeps every noindexed page out of the sitemap', () => {
    const noindexedInSitemap = resolved
      .filter((r) => !NOT_IN_SITEMAP.has(r.pages[0]?.route ?? ''))
      .filter((r) => r.pages[0]?.render().includes('<meta name="robots" content="noindex'))
      .map((r) => r.pattern)
    expect(noindexedInSitemap).toEqual([])
  })
})
