/**
 * The route registry, resolved without a Vite build: `ssg/build.ts` writes
 * exactly the pages `resolve()` returns, so a registration that resolves to
 * nothing, or a data change that quietly empties a `getStaticPaths`, ships a
 * site missing those pages with a green build.
 */

import { describe, expect, it } from 'bun:test'
import { outputPathFor } from '../outputPath'
import { routes } from '../routes'

/** Well under the ~1,040 pages the site emits: a collapse detector, not a budget. */
const PAGE_FLOOR = 900

describe('route registry', () => {
  const resolved = routes.map((r) => ({ pattern: r.pattern, pages: r.resolve() }))

  it('emits at least one page for every registered route', () => {
    expect(resolved.filter((r) => r.pages.length === 0).map((r) => r.pattern)).toEqual([])
  })

  it(`emits at least ${PAGE_FLOOR} pages, each to its own file`, () => {
    const pages = resolved.flatMap((r) => r.pages.map((p) => outputPathFor(p.route)))
    expect(new Set(pages).size).toBe(pages.length)
    expect(pages.length).toBeGreaterThanOrEqual(PAGE_FLOOR)
  })
})
