/**
 * The SRD's surfaces as the design system draws them (`docs/design-system/`),
 * asserted on the built HTML each route emits — what a crawler, a no-JS
 * reader and the first paint all get.
 */

import { describe, expect, it } from 'bun:test'
import { CHAPTER_BAND_COLOR } from '../../../src/components/index'
import { DISCORD_COMMANDS } from '../../../src/generated/discordCommands'
import { renderRoute as page, routeIslands, shells } from './pages'

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

describe('home: the front door, its slideshow alone', () => {
  const html = page('/')
  const show = html.slice(html.indexOf('su-front__show'), html.indexOf('<footer'))

  it('is titled with the site’s name, on the slideshow’s cut-out', () => {
    expect(h1s(html)).toEqual(['SalvageUnion.io'])
    expect(html).toContain('su-front__show-name')
    expect(html).not.toContain('su-chapter-band')
  })

  it('carries no search: that is the Reference’s (desktop field and phone trigger alike)', () => {
    expect(islands(html, 'SearchIsland')).toBe(0)
    expect(islands(html, 'MobileSearchIsland')).toBe(0)
    expect(html).not.toContain('su-hero-search')
  })

  it('carries no area rail: the chapters are the Reference’s', () => {
    expect(html).not.toContain('su-union-bar__rail"')
  })

  it('says the tagline in its hand, beside the site’s name', () => {
    const head = html.slice(html.indexOf('su-front__show-head'), html.indexOf('<footer'))
    expect(head).toMatch(/su-front__show-quote"><figure class="su-tagline"/)
    expect(head).not.toContain('su-tagline--plain')
  })

  it('pitches the site under its name, flush on the same cut-out', () => {
    const head = html.slice(html.indexOf('su-front__show-head'), html.indexOf('<footer'))
    expect(head).toContain('su-front__show-name')
    expect(head).toContain('su-front__show-value')
  })

  it('shows five slides, each one action to one part of the site', () => {
    expect(show.match(/class="su-front__show-slide"/g)).toHaveLength(5)
    expect(show.match(/su-btn--primary/g)).toHaveLength(5)
    for (const href of ['/reference/', '/build/', '/games/']) {
      expect(show).toContain(`href="${href}"`)
    }
    expect(show).toContain('href="https://discord.com/oauth2/authorize?client_id=')
  })

  it('names each slide on its button, with no heading of its own: the outline is the one h1', () => {
    expect(show).not.toMatch(/<h[2-6]/)
    for (const title of [
      'Know the rules',
      'Build your crew',
      'Play at the table',
      'Get the books',
      'Roll in Discord',
    ]) {
      expect(show).toMatch(new RegExp(`su-btn--primary[^>]*>(?:<[^>]+>)*${title}<`))
    }
  })

  it('draws each slide’s art as a decorative image (empty alt, so art not yet uploaded draws nothing), the first one first', () => {
    const arts = show.match(/<img[^>]*su-front__show-art[^>]*>/g) ?? []
    expect(arts).toHaveLength(5)
    for (const art of arts) {
      expect(art).toContain('alt=""')
      expect(art).toMatch(/src="https:\/\/assets\.salvageunion\.io\/hero\//)
      // A phone takes the 880px derivative, never the print-size master.
      expect(art).toMatch(/hero\/[a-z-]+-880q80\.webp 880w/)
    }
    expect(arts[0]).toMatch(/fetchpriority="high"/i)
    expect(arts.slice(1).every((art) => /fetchpriority="low"/i.test(art))).toBe(true)
    // The rest wait for layout, so they never share the first one's bandwidth.
    expect(arts.slice(1).every((art) => /loading="lazy"/.test(art))).toBe(true)
    expect(arts[0]).not.toMatch(/loading="lazy"/)
  })

  it('holds no Contents: the book’s index is the Reference’s home', () => {
    expect(html).not.toContain('su-home__index')
    expect(html).not.toContain('id="pilot-bay"')
  })
})

describe('the Reference’s home: the manual’s Contents', () => {
  const html = page('/reference')

  it('is titled Reference', () => {
    expect(h1s(html)).toEqual(['Reference'])
  })

  it('searches from the Union bar: one search island, the phone its trigger', () => {
    expect(islands(html, 'SearchIsland')).toBe(1)
    expect(islands(html, 'MobileSearchIsland')).toBe(1)
  })

  it('says the tagline on its band, as every landing page does', () => {
    expect(html).toMatch(/su-tagline"[^>]*>.*You’re in The Union/s)
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

  it('sets "At the table" as a section of the index', () => {
    const index = html.slice(html.indexOf('su-home__index'), html.indexOf('<footer'))
    expect(index).toContain('<span>At the table</span>')
    expect(index).toContain('href="/roll-tables/core-mechanic/"')
    expect(index).not.toContain('On Discord')
  })

  it('opens each chapter on its band alone, with no artwork', () => {
    const index = html.slice(html.indexOf('su-home__index'), html.indexOf('<footer'))
    expect(index).not.toContain('<img')
  })
})

describe('a chapter’s own page: its band, then its every listing', () => {
  const chapters = [
    ['/pilots', 'Pilot Bay', '/classes/'],
    ['/mechs', 'Mech Workshop', '/chassis/'],
    ['/union-crawler', 'Union Crawler', '/crawlers/'],
    ['/wasteland', 'Denizens of the Wasteland', '/creatures/'],
    ['/rules', 'Rules & Reference', '/guides/'],
  ] as const

  for (const [route, title, listing] of chapters) {
    it(`${route}/ is titled ${title}, says the tagline and indexes its listings`, () => {
      const html = page(route)
      expect(h1s(html)).toEqual([title.replace('&', '&amp;')])
      expect(html).toContain('su-tagline')
      expect(html).toContain(`href="${listing}"`)
      expect(html).toContain('su-contents__chapter')
    })
  }

  it('lists each listing’s entries as links to their pages', () => {
    expect(page('/mechs')).toContain('href="/chassis/mule/"')
  })

  it('is where the area rail’s chapters land', () => {
    const html = page('/reference')
    for (const [route] of chapters) expect(html).toContain(`href="${route}/"`)
  })
})

describe('a listing (a Ledger under a visible heading)', () => {
  const html = page('/chassis')

  it('has a visible heading — the chapter band — and no count stamp beside it', () => {
    expect(h1s(html)).toEqual(['Chassis'])
    expect(html).not.toContain('class="sr-only">Chassis</h1>')
    expect(html).not.toMatch(/\d+ Chassis/)
  })

  it('first paints the listing itself, so the mount draws nothing new', () => {
    // The island's own List from build-time data, not a stand-in: one Ledger,
    // a line per chassis, each linking to its page.
    expect(html).not.toContain('su-listing__fallback-row')
    expect(html.match(/su-ledger__table/g)).toHaveLength(1)
    expect(html.match(/<tr\b/g)?.length).toBeGreaterThan(40)
    expect(html).toContain('href="/chassis/mule/"')
  })

  it('first paints the island’s rail and its one flat List, so the mount moves nothing', () => {
    // The List has one group, with no heading.
    expect(html.match(/class="su-listing__group"/g)).toHaveLength(1)
    expect(html).not.toMatch(/class="su-listing__group" aria-label=/)
    expect(html).toContain('data-view="list"')
    // The rail is the island's, without its actions: the view toggle on the
    // band, the filter bar above the group (L10). It is not inert: a press on
    // it wakes the island, which plays the press back.
    expect(html).toContain('<div class="su-rail" data-part="view">')
    expect(html).toContain('<div class="su-rail" data-part="filters">')
    expect(html.indexOf('data-part="filters"')).toBeLessThan(html.indexOf('su-listing__group'))
    // The skeleton takes the same group from the island's props.
    const viewer = Object.values(routeIslands('/chassis')).find(
      (island) => island.name === 'SchemaViewerIsland'
    )
    expect(JSON.stringify(viewer?.props)).toContain('"groups":[{"key":"all","count":')
  })

  it('trails Reference // Chassis, without the home page’s chapter', () => {
    expect(crumbs(html)).toEqual(['Reference', 'Chassis'])
    expect(ldCrumbs(html)).toEqual(['Reference', 'Chassis'])
  })
})

describe('a sparse Page fills its side track (EDL form 5)', () => {
  it('a trait wears Used by first, its users as Mentions, then its neighbours under its list’s name', () => {
    const html = page('/traits/hacking')
    const rail = html.slice(html.indexOf('su-sparse-rail'), html.indexOf('<footer'))
    expect(rail).toContain('Used by')
    expect(rail.indexOf('Used by')).toBeLessThan(rail.indexOf('>Traits<'))
    expect(rail).toContain('Hacking Kit')
    // Every user, each with its kind, under the full count: never "and N more".
    expect(rail).toContain('22 uses')
    expect(rail.match(/su-sparse-rail__row"/g)?.length).toBe(22)
    expect(rail).toContain('>Equipment<')
    expect(rail).not.toMatch(/and \d+ more/)
  })

  it('a keyword nothing names draws no empty Used by', () => {
    const html = page('/keywords/corporate-scrip')
    expect(html).toContain('su-sparse-rail')
    expect(html).not.toContain('>Used by<')
    expect(html).toContain('>Keywords<')
  })

  it('a Page with art and actions has no sparse rail', () => {
    expect(page('/bio-titans/typhon')).not.toContain('su-sparse-rail')
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

  it('lists its patterns as one Ledger, each a link, and cites its page on the foot band', () => {
    expect(html.match(/su-ledger__table/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Gopher patterns"')
    expect(html.match(/href="\/chassis\/gopher\/pattern\/[a-z-]+\/"/g)).toHaveLength(5)
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
      '<div class="su-chapter-band__plate" data-fill-name="" style="background-color:var(--cutout-ground, rgb(239, 236, 230));color:rgb(40, 32, 25);display:flex;flex-direction:column;max-width:100%;min-width:0"><div class="su-chapter-band__trail">'
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

  it("opens with the pattern's own words; the chassis ability is its own section", () => {
    // The body only: the head's meta description quotes the pattern too.
    const body = html.slice(html.indexOf('<h1'))
    const opening = body.indexOf('su-entity-page__opening')
    expect(opening).toBeGreaterThan(-1)
    expect(body.slice(opening, opening + 600)).toContain('Buzzards of the wastes')
    const ability = body.indexOf('su-chassis-ability')
    expect(body.slice(ability, ability + 800)).toContain('The Mazona')
  })

  it('serves an interactive pattern its whole card, the chassis linked, with no JS', () => {
    const served = page('/chassis/jackhammer/pattern/auger')
    expect(served).not.toContain('data-static-fallback')
    expect(served).toContain('su-entity-page')
    expect(served).toMatch(
      /<a href="\/chassis\/jackhammer\/" class="su-crumbs__link[^"]*">Jackhammer<\/a>/
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
  for (const shell of shells) {
    const found = shell.pages.find((p) => p.route.startsWith(prefix))
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
      // One line of text; only a printing's bold `//` (CiteLine) breaks it,
      // and each printing links its book's page (Source 2).
      expect(html).toMatch(
        /<p class="su-footer__citation">(?:[^<]|<span style="font-weight:[^"]+">\/\/<\/span>|<a [^>]*href="\/sources\/[^"]+"[^>]*>[^<]*<\/a>)+<\/p>/
      )
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
  for (const [name, path] of [...listings, ['the Reference’s home', '/reference']] as const) {
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
