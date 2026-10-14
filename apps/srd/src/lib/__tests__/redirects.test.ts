/**
 * The generated `_redirects`: the sitemap alias, and a 301 for every former
 * slug (ADR-043) to a page the build actually emits — a redirect to a page
 * that does not exist would trade one dead link for another.
 */
import { describe, expect, it } from 'bun:test'
import type { RouteContext } from '../../../ssg/types'
import { redirectRules, redirectsEndpoint } from '../../endpoints/redirects'
import { ogImagePath } from '../ogCard'
import { getPatternStaticPaths } from '../staticPaths'

describe('_redirects', () => {
  const rules = redirectRules()

  it('keeps the sitemap alias', () => {
    expect(rules).toContainEqual({ from: '/sitemap.xml', to: '/sitemap-index.xml' })
  })

  it('sends the Hill Worm’s old Bio-Titan page to its pattern page', () => {
    const to = '/bio-titans/typhon/pattern/hill-worm/'
    // As it was published, under the pre-N4 grammar, in one hop…
    expect(rules).toContainEqual({ from: '/schema/bio-titans/item/hill-worm-pattern-typhon/', to })
    expect(rules).toContainEqual({ from: '/schema/bio-titans/item/hill-worm-pattern-typhon', to })
    // …and as the current grammar would spell the former slug.
    expect(rules).toContainEqual({ from: '/bio-titans/hill-worm-pattern-typhon/', to })
    expect(rules).toContainEqual({ from: '/bio-titans/hill-worm-pattern-typhon', to })
    // Its unfurl image, which old embeds still fetch, under both grammars.
    const image = '/bio-titans/typhon/pattern/hill-worm.og.png'
    expect(rules).toContainEqual({
      from: '/schema/bio-titans/item/hill-worm-pattern-typhon.og.png',
      to: image,
    })
    expect(rules).toContainEqual({ from: '/bio-titans/hill-worm-pattern-typhon.og.png', to: image })
    // The JSON API keeps its own grammar.
    expect(rules).toContainEqual({
      from: '/schema/bio-titans/item/hill-worm-pattern-typhon.json',
      to: '/schema/bio-titans/item/typhon.json',
    })
  })

  it('points every page redirect at a generated pattern page', () => {
    const pages = new Set(
      getPatternStaticPaths().map(
        (p) => `/${p.params.schemaId}/${p.params.itemId}/pattern/${p.params.patternId}/`
      )
    )
    const toPages = rules.filter((r) => r.to.includes('/pattern/') && r.to.endsWith('/'))
    expect(toPages.length).toBeGreaterThan(0)
    for (const rule of toPages) expect(pages.has(rule.to)).toBe(true)
  })

  it('points every image redirect at a generated pattern’s unfurl image', () => {
    const images = new Set(
      getPatternStaticPaths().map((p) =>
        ogImagePath(p.params.schemaId, p.params.itemId, p.params.patternId)
      )
    )
    const toImages = rules.filter((r) => r.to.endsWith('.og.png'))
    expect(toImages.length).toBeGreaterThan(0)
    for (const rule of toImages) expect(images.has(rule.to)).toBe(true)
  })

  it('writes one 301 line per rule', () => {
    const lines = redirectsEndpoint
      .body({} as RouteContext<Record<string, string>, unknown>)
      .split('\n')
      .filter((line) => line.startsWith('/'))
    expect(lines).toHaveLength(rules.length)
    for (const line of lines) expect(line).toMatch(/^\S+ {2}\S+ {2}301$/)
  })
})
