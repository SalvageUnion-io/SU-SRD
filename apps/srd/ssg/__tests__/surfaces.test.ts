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
    expect(html).toContain('href="/chassis/"')
  })

  it('hands a new player to ITUN', () => {
    expect(html).toContain('New to the Union?')
    expect(html).toContain('Build a pilot')
    expect(html).toContain('href="/guides/create-a-pilot/"')
  })

  it('sets "At the table" as a section of the index, and offers the Discord bot after it', () => {
    const index = html.slice(html.indexOf('srd-home__index'), html.indexOf('srd-home__discord'))
    expect(index).toContain('<span>At the table</span>')
    expect(index).toContain('href="/roll-tables/core-mechanic/"')
    const aside = html.slice(html.indexOf('srd-home__aside'), html.indexOf('srd-home__index'))
    expect(aside).toContain('id="new-to-the-union"')
    expect(aside).not.toContain('Add to Discord')
    const discord = html.slice(html.indexOf('srd-home__discord'))
    expect(discord).toContain('Add to Discord')
    expect(discord).toContain('href="https://discord.com/oauth2/authorize?client_id=')
  })

  it('opens Pilot Bay, Mech Workshop and Denizens on su-assets artwork', () => {
    const art = [...html.matchAll(/class="srd-contents__art"><img src="([^"]+)"/g)].map(
      ([, src]) => src
    )
    expect(art).toEqual([
      'https://assets.salvageunion.io/classes/hacker.webp',
      'https://assets.salvageunion.io/chassis/mule.webp',
      'https://assets.salvageunion.io/bio-titans/tyrant.webp',
    ])
  })

  it('puts first-timer content first: title, search, "New to the Union?", the index, then Discord', () => {
    const at = (needle: string) => html.indexOf(needle)
    expect(at('<h1')).toBeGreaterThan(-1)
    expect(at('<h1')).toBeLessThan(at('action="/search/"'))
    expect(at('action="/search/"')).toBeLessThan(at('id="new-to-the-union"'))
    expect(at('id="new-to-the-union"')).toBeLessThan(at('id="pilot-bay"'))
    expect(at('id="at-the-table"')).toBeLessThan(at('id="discord-bot"'))
  })
})

describe('a listing (compact cards under a visible heading)', () => {
  const html = page('/chassis')

  it('has a visible heading — the chapter band — and no count stamp beside it', () => {
    expect(h1s(html)).toEqual(['Chassis'])
    expect(html).not.toContain('class="sr-only">Chassis</h1>')
    expect(html).not.toMatch(/\d+ Chassis/)
  })

  it('first paints the index, not a blank band', () => {
    expect(html).toContain('srd-listing__fallback-row')
  })

  it('first paints the island’s rail and default groups, so the mount moves nothing', () => {
    const groups = [...html.matchAll(/class="srd-listing__group" aria-label="([^"]+)"/g)].map(
      (match) => match[1]
    )
    expect(groups).toEqual([
      'Tech Level 1',
      'Tech Level 2',
      'Tech Level 3',
      'Tech Level 4',
      'Tech Level 5',
      'Tech Level 6',
      'Bio-tech',
      'Nanite',
    ])
    // The rail is its inert placeholder, above the first group.
    expect(html).toContain('<div class="srd-rail" inert="">')
    expect(html.indexOf('srd-rail')).toBeLessThan(html.indexOf('srd-listing__group'))
    // The skeleton takes the same groups from the island's props.
    expect(html).toContain('"groups":[{"key":"1","label":"Tech Level 1","count":')
  })

  it('trails Contents / Mech Workshop / Chassis', () => {
    expect(html).toContain('>Contents<')
    expect(html).toContain('>Mech Workshop<')
  })
})

describe('an entity page (boards 07, 08)', () => {
  const html = page('/chassis/gopher')

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

describe('a pattern page names and links its base chassis', () => {
  const html = page('/chassis/mazona/pattern/buzzard')

  it('links back to the chassis in the band, above the title', () => {
    const link = html.indexOf('<a class="srd-parent-link" href="/chassis/mazona/">')
    expect(link).toBeGreaterThan(-1)
    expect(html.slice(link, link + 300)).toContain('Pattern of')
    expect(link).toBeLessThan(html.indexOf('<h1'))
    expect(h1s(html)).toEqual(['“Buzzard”'])
  })

  it('leads with the pattern, then the base chassis under its own slab', () => {
    // The body only: the head's meta description quotes the pattern too.
    const body = html.slice(html.indexOf('<h1'))
    const patternProse = body.indexOf('Buzzards of the wastes')
    const chassisSlab = body.indexOf('Mazona chassis')
    const chassisProse = body.indexOf('The Mazona')
    expect(patternProse).toBeGreaterThan(-1)
    expect(chassisSlab).toBeGreaterThan(patternProse)
    expect(chassisProse).toBeGreaterThan(chassisSlab)
  })

  it('links the chassis from the no-JS fallback too, as an inline reference', () => {
    const fallback = page('/chassis/jackhammer/pattern/auger')
    expect(fallback).toContain('data-static-fallback')
    expect(fallback).toMatch(
      /<a href="\/chassis\/jackhammer\/" class="su-inline-ref su-inline-ref--link">Jackhammer<\/a>/
    )
  })
})

describe('a class page links its abilities', () => {
  const html = page('/classes/hacker')

  it('as same-tab links to each ability’s page', () => {
    const links = [...html.matchAll(/<a href="(\/abilities\/[^"]+)"([^>]*)>/g)]
    expect(links.length).toBeGreaterThan(0)
    expect(links.map(([, href]) => href)).toContain('/abilities/hacking-kit/')
    expect(links.every(([, , attrs]) => !attrs?.includes('target='))).toBe(true)
  })
})

describe('a roll table rolls on its own page (board 08b)', () => {
  const html = page('/roll-tables/core-mechanic')

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
    ['a Pilot Bay entity', firstUnder('/classes/')],
    ['a Mech Workshop entity', '/chassis/gopher'],
    ['a pattern', firstUnder('/chassis/gopher/pattern/')],
    ['a Union Crawler entity', firstUnder('/crawlers/')],
    ['a Denizens entity', firstUnder('/bio-titans/')],
    ['a roll table', '/roll-tables/core-mechanic'],
    ['a guide', firstUnder('/guides/')],
  ] as const
  const listings = [
    ['a Mech Workshop listing', '/chassis'],
    ['a Union Crawler listing', '/crawlers'],
  ] as const
  const site = [
    ['home', '/'],
    ['about', '/about'],
    ['changelog', '/changelog'],
    ['the 404', '/404'],
  ] as const

  for (const [name, path] of [...book, ...listings, ...site]) {
    it(`${name} has exactly one footer landmark, carrying the licence`, () => {
      const html = page(path)
      expect(html.match(/<footer\b/g)?.length).toBe(1)
      expect(html).toContain('Salvage Union is copyrighted by Leyline Press.')
    })
  }

  /** The licence row: the Union bar's ink, the same on every page. */
  const licence = () => backgrounds(page('/'), 'su-chapter-foot')[0]

  for (const [name, path] of book) {
    it(`${name} cites itself in its own chapter’s band, over the one licence row`, () => {
      const html = page(path)
      const [head] = backgrounds(html, 'su-chapter-band')
      const feet = backgrounds(html, 'su-chapter-foot')
      expect(feet).toHaveLength(2)
      if (path.startsWith('/crawlers/')) {
        // The foot carries text, so it takes the deeper crawler pink (§3.8).
        expect(feet[0]).not.toBe(head)
      } else {
        expect(feet[0]).toBe(head)
      }
      expect(feet[1]).toBe(licence())
      expect(feet[0]).not.toBe(feet[1])
    })
  }

  it('the Gopher cites its page in that band', () => {
    const html = page('/chassis/gopher')
    expect(html).toMatch(/<footer[^>]*>[\s\S]*p\.112[\s\S]*<\/footer>/)
  })

  for (const [name, path] of [...listings, ...site]) {
    it(`${name} ends on the one licence row, citing nothing`, () => {
      const feet = backgrounds(page(path), 'su-chapter-foot')
      expect(feet).toHaveLength(1)
      expect(feet[0]).toBe(licence())
    })
  }
})
