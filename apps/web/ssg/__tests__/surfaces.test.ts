/**
 * The SRD's surfaces as the design system draws them (`docs/design-system/`),
 * asserted on the built HTML each route emits — what a crawler, a no-JS
 * reader and the first paint all get.
 */

import { describe, expect, it } from 'bun:test'
import { CHAPTER_BAND_COLOR } from '../../src/components/index'
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

/** The names in a page's breadcrumb trail, in order. */
const crumbs = (html: string) => {
  const list = html.match(/<ol class="su-crumbs__list"[^>]*>(.*?)<\/ol>/s)?.[1] ?? ''
  return [...list.matchAll(/<li class="su-crumbs__item">(.*?)<\/li>/gs)].map(([, inner]) =>
    (inner ?? '').replace(/<[^>]+>/g, '')
  )
}

/** The names in a page's structured-data BreadcrumbList, in order. */
const ldCrumbs = (html: string) =>
  [...html.matchAll(/"@type":"ListItem","position":\d+,"name":"([^"]+)"/g)].map(([, name]) => name)

const islands = (html: string, name: string) =>
  html.match(new RegExp(`data-island="${name}"`, 'g'))?.length ?? 0

describe('home: the manual’s Contents page', () => {
  const html = page('/')

  it('is titled "The Salvage Union SRD", in the Contents band', () => {
    expect(h1s(html)).toEqual(['The Salvage Union SRD'])
    expect(html).toContain('su-chapter-band')
  })

  it('searches from the Union bar, as every page does: one search island, no hero', () => {
    expect(islands(html, 'SearchIsland')).toBe(1)
    expect(html).not.toContain('su-hero-search')
  })

  it('quotes the legacy tagline on the band, credited to Stumpy', () => {
    const band = html.slice(html.indexOf('su-home__band'), html.indexOf('su-home__body'))
    expect(band).toContain('su-tagline')
    expect(band).toContain('You’re in The Union, now!')
    expect(band).toContain('Lester “Stumpy” Owens')
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
    const startHere = html.slice(
      html.indexOf('su-home__aside'),
      html.indexOf('<a href="https://discord.com/')
    )
    expect(startHere).toContain('>Start here<')
    for (const guide of ['create-a-pilot', 'create-a-mech', 'create-a-crawler']) {
      expect(startHere).toContain(`href="/guides/${guide}/"`)
    }
    expect(startHere).not.toContain('Ready to build')
    expect(startHere).not.toContain('Build a pilot')
    expect(startHere).not.toContain('target="_blank"')
  })

  it('sets "At the table" as a section of the index', () => {
    const index = html.slice(html.indexOf('su-home__index'), html.indexOf('su-home__aside'))
    expect(index).toContain('<span>At the table</span>')
    expect(index).toContain('href="/roll-tables/core-mechanic/"')
    expect(index).not.toContain('On Discord')
  })

  it('offers the Discord bot as one button straight under "Start here"', () => {
    const aside = html.slice(html.indexOf('su-home__aside'), html.indexOf('<footer'))
    const discord = aside.slice(aside.indexOf('<a href="https://discord.com/'))
    expect(aside.indexOf('id="start-here"')).toBeLessThan(aside.indexOf('id="discord-bot"'))
    expect(discord).toContain('SalvageUnion.io On Discord')
    expect(discord).toContain('<svg')
    expect(discord).toContain('href="https://discord.com/oauth2/authorize?client_id=')
  })

  it('opens each chapter on its band alone, with no artwork', () => {
    const index = html.slice(html.indexOf('su-home__index'), html.indexOf('<footer'))
    expect(index).not.toContain('<img')
  })

  it('reads title, tagline, the index, then "Start here" and Discord below it', () => {
    const at = (needle: string) => html.indexOf(needle)
    expect(at('<h1')).toBeGreaterThan(-1)
    expect(at('<h1')).toBeLessThan(at('su-tagline'))
    expect(at('su-tagline')).toBeLessThan(at('id="pilot-bay"'))
    expect(at('id="pilot-bay"')).toBeLessThan(at('id="start-here"'))
    expect(at('id="start-here"')).toBeLessThan(at('id="discord-bot"'))
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
    expect(html).not.toContain('su-listing__fallback-row')
    expect(html.match(/class="su-entity-index[ "]/g)?.length).toBeGreaterThan(40)
    expect(html).toContain('href="/chassis/mule/"')
  })

  it('first paints the island’s rail and its one flat Catalog, so the mount moves nothing', () => {
    // The Catalog has one group, with no heading.
    expect(html.match(/class="su-listing__group"/g)).toHaveLength(1)
    expect(html).not.toMatch(/class="su-listing__group" aria-label=/)
    expect(html).toContain('data-view="catalog"')
    // The rail is the island's, without its actions, above the group. It is
    // not inert: a press on it wakes the island, which plays the press back.
    expect(html).toContain('<div class="su-rail">')
    expect(html.indexOf('su-rail')).toBeLessThan(html.indexOf('su-listing__group'))
    // The skeleton takes the same group from the island's props.
    expect(html).toContain('"groups":[{"key":"all","count":')
  })

  it('trails Reference // Chassis, without the home page’s chapter', () => {
    expect(crumbs(html)).toEqual(['Reference', 'Chassis'])
    expect(ldCrumbs(html)).toEqual(['Reference', 'Chassis'])
  })
})

describe('an entity page', () => {
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

  it('trails Reference // Chassis // Gopher, without the home page’s chapter', () => {
    expect(crumbs(html)).toEqual(['Reference', 'Chassis', 'Gopher'])
    expect(ldCrumbs(html)).toEqual(['Reference', 'Chassis', 'Gopher'])
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
    const link = html.indexOf('aria-label="Pattern of: Mazona"')
    expect(link).toBeGreaterThan(-1)
    expect(html.slice(html.lastIndexOf('<a ', link), link)).toContain('href="/chassis/mazona/"')
    expect(html.slice(link, link + 600)).toContain('su-stat-plate--label')
    // The title leads the heading order; the band's cluster follows it.
    expect(link).toBeGreaterThan(html.indexOf('<h1'))
    // Nothing but the page's trail sits above the title, on its plate (EDL E20).
    expect(html).not.toContain('su-chapter-band__eyebrow')
    expect(html).toContain(
      '<div class="su-chapter-band__plate" data-fill-name="" style="background-color:rgb(239, 236, 230);color:rgb(40, 32, 25);display:flex;flex-direction:column;max-width:100%;min-width:0"><div class="su-chapter-band__trail">'
    )
    // The ancestors, each followed by `//`; the title names the page.
    const trail = html.slice(html.indexOf('su-crumbs--band'), html.indexOf('<h1'))
    expect(trail.match(/<a [^>]*>([^<]*)<\/a>/g)?.map((a) => a.replace(/<[^>]*>/g, ''))).toEqual([
      'Reference',
      'Chassis',
      'Mazona',
    ])
    expect(trail.match(/>\/\/</g)).toHaveLength(3)
    expect(h1s(html)).toEqual(['“Buzzard” (Pattern)'])
  })

  it('wears no standalone "Pattern" stamp', () => {
    expect(html).not.toMatch(/su-stat-plate--label">Pattern</)
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
      /<a href="\/chassis\/jackhammer\/" class="su-inline-ref su-inline-ref--link su-focus-ring">Jackhammer<\/a>/
    )
  })

  it('stamps a legal starting pattern in the band, and offers to build it', () => {
    // The band's mark: a chip of its strip, at the strip's Size (`labelChips`).
    expect(html).toMatch(/data-chip-class="mark"[^>]*>(?:<[^>]*>)*Legal Starting Pattern<\/span>/)
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

describe('a roll table rolls on its own page', () => {
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
    expect(html).toMatch(
      /class="su-roll__stamp su-roll__roll[^"]*"( data-roll-pending="")?>Roll the (Die|Dice):</
    )
    expect(html).not.toMatch(/<button[^>]*su-roll__roll/)
  })
})

describe('a columns table rolls on its own page too', () => {
  const html = page('/roll-tables/callsign-table')

  it('is the same instrument, banded in the page band’s tone', () => {
    expect(h1s(html)).toEqual(['Callsign Table (Roll Table)'])
    expect(html).toMatch(
      /class="su-roll__stamp su-roll__roll[^"]*"( data-roll-pending="")?>Roll the Dice:</
    )
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

describe('every page ends on one footer', () => {
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

  /** The page's foot bands, by their class (the footer has its own). */
  const feet = (html: string) => html.match(/class="su-chapter-foot"/g) ?? []
  /** Whether the page's band serves the footer its colour (`footerMatchCss`). */
  const matched = (html: string) => {
    const key = /data-band="([\w-]+)"/.exec(html)?.[1]
    return !!key && html.includes(`[data-band='${key}']) .su-chapter-foot{`)
  }

  // Rulings 2026-10-19: one footer, the citation on one line in it, in the
  // leading band's colour, no kind, no ink rule on a show page.
  for (const [name, path] of book) {
    it(`${name} cites itself on one line in the one footer, in its band's colour`, () => {
      const html = page(path)
      expect(feet(html)).toHaveLength(1)
      expect(html).toMatch(/<p class="su-footer__citation">[^<]+<\/p>/)
      expect(html).not.toContain('Also in')
      expect(html).not.toContain('su-footer__kind')
      expect(matched(html)).toBe(true)
    })
  }

  it('the Gopher cites its page in that footer', () => {
    const html = page('/chassis/gopher')
    expect(html).toMatch(/<footer[^>]*>[\s\S]*p\.112[\s\S]*<\/footer>/)
  })

  for (const [name, path] of [...listings, ...site]) {
    it(`${name} ends on the one licence row, citing nothing`, () => {
      const html = page(path)
      expect(feet(html)).toHaveLength(1)
      expect(html).not.toContain('su-footer__citation')
    })
  }

  // The footer matches the leading band on every page that leads with one.
  for (const [name, path] of [...listings, ['home', '/']] as const) {
    it(`${name} wears its leading band on its footer`, () => {
      expect(matched(page(path))).toBe(true)
    })
  }
})

describe('/bot documents the bot it installs', () => {
  const html = page('/bot')

  it('lists every /su subcommand the bot registers, under the name Discord shows', () => {
    for (const command of DISCORD_COMMANDS) {
      expect(html).toContain(`/su ${command.name}`)
      if (command.needsAccount) expect(html).toContain(command.description)
    }
  })

  it('says what needs an account, and opens the app in the same tab', () => {
    expect(html).not.toContain('no-account character builder')
    expect(html).toContain('sign in with Discord to build')
    expect(html).not.toMatch(/href="https:\/\/salvageunion\.io\/build\/"[^>]*target="_blank"/)
  })
})
