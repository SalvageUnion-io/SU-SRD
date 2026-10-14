/**
 * The SRD's surfaces as the brand refresh draws them (boards 06–08b),
 * asserted on the built HTML each route emits — what a crawler, a no-JS
 * reader and the first paint all get.
 */

import { describe, expect, it } from 'bun:test'
import { CHAPTER_BAND_COLOR } from 'component-lib'
import { DISCORD_COMMANDS } from '../../src/generated/discordCommands'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { routes } from '../routes'

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands.js'],
  styles: ['/assets/styles.css'],
  fonts: [],
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

  it('starts a new player on the shared "Start here" block, each step opening its guide', () => {
    const aside = html.slice(html.indexOf('srd-home__aside'), html.indexOf('srd-home__index'))
    expect(aside).toContain('>Start here<')
    for (const guide of ['create-a-pilot', 'create-a-mech', 'create-a-crawler']) {
      expect(aside).toContain(`href="/guides/${guide}/"`)
    }
    expect(aside).not.toContain('Ready to build')
    expect(aside).not.toContain('Build a pilot')
    expect(aside).not.toContain('target="_blank"')
  })

  it('sets "At the table" as a section of the index, and offers the Discord bot after it', () => {
    const index = html.slice(html.indexOf('srd-home__index'), html.indexOf('srd-home__discord'))
    expect(index).toContain('<span>At the table</span>')
    expect(index).toContain('href="/roll-tables/core-mechanic/"')
    const aside = html.slice(html.indexOf('srd-home__aside'), html.indexOf('srd-home__index'))
    expect(aside).toContain('id="start-here"')
    expect(aside).not.toContain('Add to Discord')
    const discord = html.slice(html.indexOf('srd-home__discord'))
    expect(discord).toContain('Add to Discord')
    expect(discord).toContain('href="https://discord.com/oauth2/authorize?client_id=')
  })

  it('opens each chapter on its band alone, with no artwork', () => {
    const index = html.slice(html.indexOf('srd-home__index'), html.indexOf('srd-home__discord'))
    expect(index).not.toContain('<img')
  })

  it('puts first-timer content first: title, search, "Start here", the index, then Discord', () => {
    const at = (needle: string) => html.indexOf(needle)
    expect(at('<h1')).toBeGreaterThan(-1)
    expect(at('<h1')).toBeLessThan(at('action="/search/"'))
    expect(at('action="/search/"')).toBeLessThan(at('id="start-here"'))
    expect(at('id="start-here"')).toBeLessThan(at('id="pilot-bay"'))
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

  it('first paints the listing itself, so the mount draws nothing new', () => {
    // The island's own cards from build-time data, not a stand-in: one tile
    // per chassis, each linking to its page.
    expect(html).not.toContain('srd-listing__fallback-row')
    expect(html.match(/class="su-entity-tile[ "]/g)?.length).toBeGreaterThan(40)
    expect(html).toContain('href="/chassis/mule/"')
  })

  it('first paints the island’s rail and its one flat Catalog, so the mount moves nothing', () => {
    // The Catalog has one group, with no heading.
    expect(html.match(/class="srd-listing__group"/g)).toHaveLength(1)
    expect(html).not.toMatch(/class="srd-listing__group" aria-label=/)
    expect(html).toContain('data-view="catalog"')
    // The rail is the island's, without its actions, above the group. It is
    // not inert: a press on it wakes the island, which plays the press back.
    expect(html).toContain('<div class="srd-rail">')
    expect(html.indexOf('srd-rail')).toBeLessThan(html.indexOf('srd-listing__group'))
    // The skeleton takes the same group from the island's props.
    expect(html).toContain('"groups":[{"key":"all","count":')
  })

  it('trails Contents / Mech Workshop / Chassis', () => {
    expect(html).toContain('>Contents<')
    expect(html).toContain('>Mech Workshop<')
  })
})

describe('an entity page (boards 07, 08)', () => {
  const html = page('/chassis/gopher')

  it('notches the name into the chapter band, the page’s one h1', () => {
    // The kind is never stamped (E9): the h1 reads it out after the name.
    expect(h1s(html)).toEqual(['Gopher (Chassis)'])
  })

  it('sets the stats in the book’s stat column, under their full names', () => {
    expect(html).toContain('su-stat-column')
    expect(html).toContain('Structure Points')
    expect(html).toContain('Heat Capacity')
    expect(html).not.toContain('Structure Pts.')
  })

  it('lists its patterns as link rows, and cites its page on the foot band', () => {
    expect(html).toContain('su-pattern-rows')
    expect(html).toContain('su-chapter-foot')
    expect(html).toContain('p.112')
  })
})

describe('a pattern page names and links its base chassis', () => {
  const html = page('/chassis/mazona/pattern/buzzard')

  it('links back to the chassis in the band, beside the title and never above it', () => {
    const link = html.indexOf('href="/chassis/mazona/" aria-label="Pattern of: Mazona"')
    expect(link).toBeGreaterThan(-1)
    expect(html.slice(link, link + 600)).toContain('su-stat-plate--label')
    // The title leads the heading order; the band's cluster follows it.
    expect(link).toBeGreaterThan(html.indexOf('<h1'))
    expect(html.indexOf('su-chapter-band__eyebrow')).toBe(-1)
    expect(h1s(html)).toEqual(['“Buzzard” (Pattern)'])
  })

  it('wears no standalone "Pattern" stamp', () => {
    expect(html).not.toMatch(/su-entity-stamp"[^>]*>Pattern</)
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

  it('stamps a legal starting pattern in the band, and offers to build it', () => {
    expect(html).toMatch(/<span class="[^"]*su-entity-stamp"[^>]*>Legal Starting Pattern<\/span>/)
    expect(html).toMatch(
      /<a href="[^"]*mechs\/new\?mode=guided&amp;chassis=mazona&amp;pattern=buzzard"[^>]*>Build With This<\/a>/
    )
  })

  it('stamps nothing and offers no build on a pattern the book does not mark legal', () => {
    const untagged = page('/chassis/jackhammer/pattern/auger')
    expect(untagged).not.toContain('Legal Starting Pattern')
    expect(untagged).not.toContain('mechs/new')
    expect(untagged).not.toContain('Build With This')
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

/**
 * A roll-table page is in the Rules chapter, so its table bands in the rules
 * band's colour cut into paper (`rollBandColor`), as the instrument writes it.
 */
const RULES_ROLL_BAND = `--su-roll-band:color-mix(in srgb, ${CHAPTER_BAND_COLOR.rules} 25%, var(--color-paper))`

describe('a roll table rolls on its own page (board 08b)', () => {
  const html = page('/roll-tables/core-mechanic')

  it('mounts the roll island over its server-rendered bands', () => {
    expect(h1s(html)).toEqual(['Core Mechanic (Roll Table)'])
    expect(islands(html, 'RollTableIsland')).toBe(1)
    expect(islands(html, 'ReferenceEntityIsland')).toBe(0)
    expect(html).toContain('Roll the Die:')
    expect(html).toContain('11–19')
  })

  it('bands its rows in the page band’s tone, not the tone-less cream', () => {
    expect(html).toContain(RULES_ROLL_BAND)
    expect(html).not.toContain('--su-roll-band:var(--color-band-cream)')
  })
})

/**
 * The roll is the Roll the Die button, but only once a script can run
 * it: the static HTML prints the plain ROLL THE DIE: stamp, never a dead button.
 */
describe('static HTML prints the roll stamp as a label, not a button', () => {
  it.each(['/roll-tables/core-mechanic', '/roll-tables/callsign-table'])('%s', (route) => {
    const html = page(route)
    expect(html).toMatch(/class="su-roll__stamp su-roll__roll">Roll (the Die|twice):</)
    expect(html).not.toMatch(/<button[^>]*su-roll__roll/)
  })
})

describe('a columns table rolls on its own page too', () => {
  const html = page('/roll-tables/callsign-table')

  it('is the same instrument, banded in the page band’s tone', () => {
    expect(h1s(html)).toEqual(['Callsign Table (Roll Table)'])
    expect(html).toContain('class="su-roll__stamp su-roll__roll">Roll twice:<')
    expect(html).toContain(RULES_ROLL_BAND)
    expect(html).not.toContain('--su-roll-band:var(--color-band-cream)')
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

describe('/discord documents the bot it installs', () => {
  const html = page('/discord')

  it('lists every /su subcommand the bot registers, under the name Discord shows', () => {
    for (const command of DISCORD_COMMANDS) {
      expect(html).toContain(`/su ${command.name}`)
      if (command.needsAccount) expect(html).toContain(command.description)
    }
  })

  it('says what needs an account, and opens In the Union now in the same tab', () => {
    expect(html).not.toContain('no-account character builder')
    expect(html).toContain('sign in with Discord to build')
    expect(html).not.toMatch(/href="https:\/\/salvageunion\.io\/build\/"[^>]*target="_blank"/)
  })
})
