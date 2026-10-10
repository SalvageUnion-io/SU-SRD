/**
 * The SRD's surfaces as the brand refresh draws them (#1254, boards 06–08b),
 * asserted on the built HTML each route emits — what a crawler, a no-JS
 * reader and the first paint all get.
 */

import { describe, expect, it } from 'bun:test'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { routes } from '../routes'

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands.js'],
  styles: ['/assets/styles.css'],
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

/** The HTML one route emits. */
function page(path: string): string {
  for (const route of routes) {
    const found = route.resolve().find((p) => p.route === path)
    if (found) return found.render(ASSETS)
  }
  throw new Error(`no page at ${path}`)
}

const h1s = (html: string) =>
  [...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)].map(([, inner]) =>
    (inner ?? '').replace(/<[^>]+>/g, '')
  )

const islands = (html: string, name: string) =>
  html.match(new RegExp(`data-island="${name}"`, 'g'))?.length ?? 0

describe('home: the manual’s Contents page (board 06)', () => {
  const html = page('/')

  it('is titled "The Salvage Union SRD", in the Contents band', () => {
    expect(h1s(html)).toEqual(['The Salvage Union SRD'])
    expect(html).toContain('su-chapter-band')
  })

  it('searches from the band: one search island, server-rendered as a GET form', () => {
    expect(islands(html, 'SearchIsland')).toBe(1)
    expect(html).toContain('action="/search/"')
  })

  it('indexes the book’s five chapters, with counts', () => {
    for (const chapter of [
      'Pilot Bay',
      'Mech Workshop',
      'Union Crawler',
      'Denizens of the Wasteland',
      'Rules &amp; Reference',
    ]) {
      expect(html).toContain(`<span>${chapter}</span>`)
    }
    expect(html).toContain('href="/schema/chassis/"')
  })

  it('hands a new player to ITUN', () => {
    expect(html).toContain('New to the Union?')
    expect(html).toContain('Build a pilot')
    expect(html).toContain('href="/schema/guides/item/create-a-pilot/"')
  })
})

describe('a listing (header-only rows, a visible heading with its count)', () => {
  const html = page('/schema/chassis')

  it('has a visible heading — the chapter band — with its count', () => {
    expect(h1s(html)).toEqual(['Chassis'])
    expect(html).not.toContain('class="sr-only">Chassis</h1>')
    expect(html).toMatch(/\d+ Chassis/)
  })

  it('first paints the index, not a blank band', () => {
    expect(html).toContain('srd-listing__fallback-row')
  })

  it('trails Contents / Mech Workshop / Chassis', () => {
    expect(html).toContain('>Contents<')
    expect(html).toContain('>Mech Workshop<')
  })
})

describe('an entity page (boards 07, 08)', () => {
  const html = page('/schema/chassis/item/gopher')

  it('notches the name into the chapter band, the page’s one h1', () => {
    expect(h1s(html)).toEqual(['Gopher'])
  })

  it('sets the stats in the book’s stat column, in its words', () => {
    expect(html).toContain('su-stat-column')
    expect(html).toContain('Structure Pts.')
    expect(html).toContain('Heat Cap.')
  })

  it('lists its patterns as link rows, and cites its page on the foot band', () => {
    expect(html).toContain('su-pattern-rows')
    expect(html).toContain('su-chapter-foot')
    expect(html).toContain('p.112')
  })
})

describe('a roll table rolls on its own page (board 08b)', () => {
  const html = page('/schema/roll-tables/item/core-mechanic')

  it('mounts the roll island over its server-rendered bands', () => {
    expect(h1s(html)).toEqual(['Core Mechanic'])
    expect(islands(html, 'RollTableIsland')).toBe(1)
    expect(islands(html, 'ReferenceEntityIsland')).toBe(0)
    expect(html).toContain('Roll the die:')
    expect(html).toContain('11–19')
  })
})

/** The first route under a prefix, so the check follows the data rather than a slug. */
function firstUnder(prefix: string): string {
  for (const route of routes) {
    const found = route.resolve().find((p) => p.route.startsWith(prefix))
    if (found) return found.route
  }
  throw new Error(`no page under ${prefix}`)
}

/** Inline `background-color`s of a class's elements, in document order. */
const backgrounds = (html: string, className: string) =>
  [...html.matchAll(new RegExp(`class="${className}"[^>]*background-color: ?([^;"]+)`, 'g'))].map(
    ([, bg]) => bg
  )

describe('every page ends on one footer (boards 06, 07)', () => {
  const book = [
    ['a Pilot Bay entity', firstUnder('/schema/classes/item/')],
    ['a Mech Workshop entity', '/schema/chassis/item/gopher'],
    ['a pattern', firstUnder('/schema/chassis/item/gopher/pattern/')],
    ['a Union Crawler entity', firstUnder('/schema/crawlers/item/')],
    ['a Denizens entity', firstUnder('/schema/bio-titans/item/')],
    ['a roll table', '/schema/roll-tables/item/core-mechanic'],
    ['a guide', firstUnder('/schema/guides/item/')],
  ] as const
  const site = [
    ['home', '/'],
    ['a listing', '/schema/chassis'],
    ['about', '/about'],
    ['changelog', '/changelog'],
    ['the 404', '/404'],
  ] as const

  for (const [name, path] of [...book, ...site]) {
    it(`${name} has exactly one footer landmark, carrying the licence`, () => {
      const html = page(path)
      expect(html.match(/<footer\b/g)?.length).toBe(1)
      expect(html).toContain('Salvage Union is copyrighted by Leyline Press.')
    })
  }

  for (const [name, path] of book) {
    it(`${name} ends in its own chapter’s band, not a second one`, () => {
      const html = page(path)
      const [head] = backgrounds(html, 'su-chapter-band')
      const feet = backgrounds(html, 'su-chapter-foot')
      expect(feet.length).toBeGreaterThan(0)
      expect(new Set(feet).size).toBe(1)
      if (path.startsWith('/schema/crawlers/')) {
        // The foot carries text, so it takes the deeper crawler pink (§3.8).
        expect(feet[0]).not.toBe(head)
        expect(feet[0]).not.toBe(backgrounds(page('/'), 'su-chapter-foot')[0])
      } else {
        expect(feet[0]).toBe(head)
      }
    })
  }

  it('the Gopher cites its page in that band', () => {
    const html = page('/schema/chassis/item/gopher')
    expect(html).toMatch(/<footer[^>]*>[\s\S]*p\.112[\s\S]*<\/footer>/)
  })

  for (const [name, path] of site) {
    it(`${name} ends on the one rules-blue band, citing nothing`, () => {
      const feet = backgrounds(page(path), 'su-chapter-foot')
      expect(feet).toHaveLength(1)
      expect(feet[0]).toBe(backgrounds(page('/'), 'su-chapter-foot')[0])
    })
  }
})
