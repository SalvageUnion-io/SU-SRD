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
