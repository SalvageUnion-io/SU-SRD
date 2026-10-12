/**
 * NO RAW MARKUP (entity display language E4). The corpus-wide scan is
 * a post-render assertion in `ssg/build.ts` (`build-srd` renders every page
 * anyway); this suite covers the scan itself and one page's Mention, without
 * rendering the corpus a second time.
 */

import { describe, expect, it } from 'bun:test'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { assertNoRawMarkup, findRawMarkup, renderedBody } from '../rawMarkup'
import { routes } from '../routes'

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands.js'],
  styles: ['/assets/styles.css'],
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

describe('the raw-markup scan', () => {
  it('finds [[ in a page body, with its context', () => {
    const html = '<html><head></head><body><p>Deals [[Burn (X)]] damage.</p></body></html>'
    expect(findRawMarkup(html)).toContain('[[Burn (X)]]')
  })

  it('ignores [[ in the head and in script blocks (island props are data)', () => {
    const html =
      '<html><head><title>[[x]]</title></head><body><p>Clean.</p>' +
      '<script type="application/json">{"text":"[[Burn]]"}</script></body></html>'
    expect(findRawMarkup(html)).toBeUndefined()
  })

  it('refuses the build when any page carried raw markup', () => {
    expect(() => assertNoRawMarkup([])).not.toThrow()
    expect(() => assertNoRawMarkup(['/a/: …[[Burn]]…'])).toThrow(/1 page\(s\) render raw/)
  })
})

const pages = routes.flatMap((route) => route.resolve())
const renderRoute = (route: string): string =>
  pages.find((p) => p.route === route)?.render(ASSETS) ?? ''

describe('rendered pages', () => {
  it('draws a rules-text trait as a Mention linked to its page, with its Peek', () => {
    const html = renderRoute('/schema/roll-tables/item/mechapult')
    expect(renderedBody(html)).toMatch(
      /<a href="\/schema\/traits\/item\/burn\/" class="su-inline-ref su-inline-ref--link" data-peek="traits:[^"]+">Burn \(X\)<\/a>/
    )
    expect(findRawMarkup(html)).toBeUndefined()
  })

  // One page per render path the sample above does not reach: the build scan
  // covers every page, these keep each path's markup under test.
  it.each([
    [
      'a hybrid class, its trees and their owners',
      '/schema/classes/item/fabricator',
      '<dt>Hybrid</dt>',
    ],
    [
      'a two-roll columns table',
      '/schema/roll-tables/item/callsign-table',
      'data-island="ColumnsTableIsland"',
    ],
    [
      'a static fallback with a Traits line',
      '/schema/abilities/item/auto-turret',
      'srd-static__label">Traits:',
    ],
  ])('renders %s without raw markup', (_label, route, marker) => {
    const html = renderRoute(route)
    expect(renderedBody(html)).toContain(marker)
    expect(findRawMarkup(html)).toBeUndefined()
  })
})
