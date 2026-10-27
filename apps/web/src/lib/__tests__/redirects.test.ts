/**
 * The moved-path table (`lib/redirects.ts`) and its answerers.
 *
 * The generated `_redirects`: the sitemap alias, and a 301 for every former
 * slug (ADR-043) to a page the build actually emits — a redirect to a page
 * that does not exist would trade one dead link for another.
 *
 * The old page grammar (`/schema/<schema>/item/<slug>/`) and where each of its
 * paths lives now. The Worker answers a miss with this mapping, so every page
 * the build emits must be reachable from its old address.
 */
import { describe, expect, it } from 'bun:test'
import { actionMoves, redirectRules, redirectsEndpoint } from '../../reference/endpoints/redirects'
import type { RouteContext } from '../../reference/types'
import { DOC_PAGES } from '../docPages'
import { itemHref, patternHref, schemaHref } from '../entityHref'
import { ogImagePath } from '../ogCard'
import {
  currentPathFor,
  FIXED_MOVES,
  formerSitePath,
  legacyItemHref,
  retiredDocPage,
  retiredSitePage,
  retiredTarget,
} from '../redirects'
import { getItemStaticPaths, getPatternStaticPaths, getSchemaStaticPaths } from '../staticPaths'

describe('_redirects', () => {
  const rules = redirectRules()

  it('sends an action’s old page to the one entity that has it', () => {
    expect(rules).toContainEqual({
      from: '/actions/hauling-all-day/',
      to: '/abilities/hauling-all-day/',
    })
    expect(rules).toContainEqual({
      from: '/actions/armour-plating-genbu/',
      to: '/bio-titans/genbu/',
    })
    // Several entities list it: the Worker sends it to the search instead.
    expect(actionMoves().some(({ from }) => from === '/actions/system-repair/')).toBe(false)
  })

  it('sends a renamed page to its current name, with or without the slash', () => {
    for (const from of ['/equipment/knife-missle/', '/equipment/knife-missle']) {
      expect(rules).toContainEqual({ from, to: '/equipment/knife-missile/' })
    }
  })

  it('keeps the sitemap alias', () => {
    expect(rules).toContainEqual({ from: '/sitemap.xml', to: '/sitemap-index.xml' })
  })

  it('opens with the fixed moves', () => {
    expect(rules.slice(0, FIXED_MOVES.length)).toEqual([...FIXED_MOVES])
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

describe('currentPathFor', () => {
  it('maps every emitted page from its old address to its current one', () => {
    for (const { params } of getSchemaStaticPaths()) {
      expect(currentPathFor(`/schema/${params.schemaId}/`)).toBe(schemaHref(params.schemaId))
    }
    for (const { params } of getItemStaticPaths()) {
      expect(currentPathFor(legacyItemHref(params.schemaId, params.itemId))).toBe(
        itemHref(params.schemaId, params.itemId)
      )
    }
    for (const { params } of getPatternStaticPaths()) {
      const old = `/schema/${params.schemaId}/item/${params.itemId}/pattern/${params.patternId}/`
      expect(currentPathFor(old)).toBe(
        patternHref(params.schemaId, params.itemId, params.patternId)
      )
    }
  })

  it('moves an unfurl with its page', () => {
    expect(currentPathFor('/schema/chassis/item/mule.og.png')).toBe(ogImagePath('chassis', 'mule'))
    expect(currentPathFor('/schema/chassis/item/mule/pattern/hauler.og.png')).toBe(
      ogImagePath('chassis', 'mule', 'hauler')
    )
  })

  it('adds the trailing slash a page wants, so the 301 is the only hop', () => {
    expect(currentPathFor('/schema/chassis/item/mule')).toBe('/chassis/mule/')
    expect(currentPathFor('/schema/chassis')).toBe('/chassis/')
  })

  it('leaves the JSON API and anything else alone', () => {
    for (const path of [
      '/schema/chassis.json',
      '/schema/chassis.schema.json',
      '/schema/chassis/item/mule.json',
      '/schema/',
      '/schema/chassis/item/',
      '/chassis/mule/',
      '/about/',
    ]) {
      expect(currentPathFor(path)).toBeUndefined()
    }
  })
})

describe('retiredDocPage', () => {
  it('sends the app doc pages to the site pages, with or without a slash', () => {
    for (const path of ['/about', '/about/', 'about']) {
      expect(retiredDocPage(path)).toBe(DOC_PAGES.about.href)
    }
    expect(retiredDocPage('/changelog/')).toBe(DOC_PAGES.changelog.href)
  })

  it('leaves every other path alone', () => {
    for (const path of ['/', '/api', '/discord', '/about/team', '/constructor']) {
      expect(retiredDocPage(path)).toBeNull()
    }
  })
})

describe('retiredTarget', () => {
  it('maps each retired shape', () => {
    expect(retiredTarget('/games')).toBe('/play/')
    expect(retiredTarget('/games/g1/view/pilot/row-1')).toBe('/pilots/row-1')
    expect(retiredTarget('/join/ABCD')).toBe('/play/invite/ABCD')
    expect(retiredTarget('/games/g1')).toBe('/play/games/g1')
    expect(retiredTarget('/games/g1/')).toBe('/play/games/g1')
    expect(retiredTarget('/dashboard/p1')).toBe('/play/pilots/p1')
    expect(retiredTarget('/mediator/g1')).toBe('/play/games/g1/mediate')
  })

  it('moves the app-era addresses Play and the sheets left behind', () => {
    expect(retiredTarget('/play')).toBe('/play/')
    expect(retiredTarget('/play/')).toBe('/play/')
    expect(retiredTarget('/play/p1')).toBe('/play/pilots/p1')
    expect(retiredTarget('/play/game/g1')).toBe('/play/games/g1/mediate')
    expect(retiredTarget('/play/games/g1')).toBe('/play/games/g1')
    expect(retiredTarget('/invite/t1')).toBe('/play/invite/t1')
    expect(retiredTarget('/sheet/pilot/x')).toBe('/pilots/x')
    expect(retiredTarget('/sheet/npc/x')).toBe('/npcs/x')
    expect(retiredTarget('/mechs/patterns')).toBe('/patterns/')
    expect(retiredTarget('/mechs/patterns/')).toBe('/patterns/')
  })

  it('leaves a live route under a retired prefix alone', () => {
    for (const path of [
      '/games/g1/view',
      '/join/a/b',
      '/dashboard',
      '/sheet/nope/x',
      '/pilots/x',
    ]) {
      expect(retiredTarget(path)).toBeNull()
    }
  })
})

describe('retired site pages', () => {
  it('sends the bot’s old page to /bot/, with or without its slash', () => {
    expect(retiredSitePage('/discord')).toBe('/bot/')
    expect(retiredSitePage('/discord/')).toBe('/bot/')
    expect(retiredSitePage('/bot/')).toBeUndefined()
  })
})

describe('formerSitePath', () => {
  it('moves the site’s earlier page addresses', () => {
    expect(formerSitePath('/titans/apophis/')).toBe('/bio-titans/apophis/')
    expect(formerSitePath('/titans')).toBe('/bio-titans/')
    expect(formerSitePath('/actions/portable-cryopod/')).toBe('/?q=portable+cryopod')
    expect(formerSitePath('/catalog-categories/guides/')).toBe('/guides/')
    expect(formerSitePath('/sheets/pilot')).toBe('/build/pilots/new')
    expect(formerSitePath('/roll-tables/salvage-cache-table/')).toBe('/?q=salvage+cache+table')
  })

  it('sends the touch icon’s conventional names to the one the page links', () => {
    for (const path of [
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png',
      '/apple-touch-icon-152x152.png',
      '/build/apple-touch-icon-120x120-precomposed.png',
    ]) {
      expect(formerSitePath(path)).toBe('/favicons/su/favicon-180.png')
    }
    expect(formerSitePath('/build/favicons/su/favicon.svg')).toBe('/favicons/su/favicon.svg')
  })

  it('leaves every other path alone', () => {
    for (const path of [
      '/favicons/missing.png',
      '/sheets/robot',
      '/actions/',
      '/actions/a/b/',
      '/roll-tables/core-mechanic-table/',
      '/nope/',
    ]) {
      expect(formerSitePath(path)).toBeUndefined()
    }
  })
})
