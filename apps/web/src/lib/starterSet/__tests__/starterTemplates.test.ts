/**
 * Each Starter Set build's page has its own title, in the site's format, so
 * a tab, a bookmark and a search result say which build it is.
 */

import { describe, expect, test } from 'bun:test'
import { QUICKSTART_MECHS, QUICKSTART_PILOTS } from 'game-domain/starterSet/quickstart'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from 'game-domain/starterSet/starterSet'
import { starterPage, starterPages, starterPageTitle } from '../starterTemplates'

describe('starterPageTitle', () => {
  test("names the build and its kind, then the site's name", () => {
    expect(starterPageTitle('pilot', 'starter-pilot-bonesaw')).toBe(
      'Bonesaw · Starter Set Pilot · SalvageUnion.io'
    )
    expect(starterPageTitle('crawler', STARTER_CRAWLERS[0]?.id ?? '')).toBe(
      "Crawler #430 'Tenacity' · Starter Set Union Crawler · SalvageUnion.io"
    )
  })

  test("names a Quickstart build as the Quickstart's", () => {
    expect(starterPageTitle('mech', 'quickstart-mech-magpie')).toBe(
      'Magpie · Quickstart Mech · SalvageUnion.io'
    )
  })

  test("falls back to the Starter Set's own title for a build it does not hold", () => {
    expect(starterPageTitle('pilot', 'starter-pilot-nobody')).toBe(
      'Starter Set · Training Bay · SalvageUnion.io'
    )
    expect(starterPageTitle('npc', 'starter-pilot-bonesaw')).toBe(
      'Starter Set · Training Bay · SalvageUnion.io'
    )
  })

  test('gives every build a title of its own', () => {
    const titles = starterPages().map((page) => page.title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})

describe('starterPages', () => {
  test('lists every template once, at its own route', () => {
    const ids = [
      ...STARTER_PILOTS,
      ...STARTER_MECHS,
      ...STARTER_CRAWLERS,
      ...QUICKSTART_PILOTS,
      ...QUICKSTART_MECHS,
    ].map((t) => t.id)
    const paths = starterPages().map((page) => page.path)
    expect(paths).toHaveLength(ids.length)
    expect(paths).toContain('/starter/pilot/starter-pilot-bonesaw')
    expect(paths).toContain('/starter/pilot/quickstart-pilot-twitch')
    expect(
      paths.every((path) => /^\/starter\/(pilot|mech|crawler)\/(starter|quickstart)-/.test(path))
    ).toBe(true)
  })

  test("describes a build as the Starter Set's, then in its own words", () => {
    const page = starterPage('pilot', 'starter-pilot-bonesaw')
    expect(page?.description).toStartWith(
      'Bonesaw, a pre-generated Pilot from the Salvage Union Starter Set, Reclamation of the Wastes by Leyline Press. '
    )
    expect(page?.description.length).toBeGreaterThan(120)
  })

  test("describes a Quickstart build as the Quickstart's", () => {
    expect(starterPage('pilot', 'quickstart-pilot-twitch')?.description).toStartWith(
      'Twitch, a pre-generated Pilot from the Salvage Union Quickstart by Leyline Press. '
    )
  })
})
