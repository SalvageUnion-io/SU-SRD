/**
 * Each Starter Set build's page has its own title, in the site's format, so
 * a tab, a bookmark and a search result say which build it is.
 */

import { describe, expect, test } from 'bun:test'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from 'itun-domain/starterSet/starterSet'
import { starterPage, starterPages, starterPageTitle } from '../starterTemplates'

describe('starterPageTitle', () => {
  test("names the build and its kind, then the site's name", () => {
    expect(starterPageTitle('pilot', 'starter-pilot-bonesaw')).toBe(
      'Bonesaw · Starter Set Pilot · The Cantina'
    )
    expect(starterPageTitle('crawler', STARTER_CRAWLERS[0]?.id ?? '')).toBe(
      "Crawler #430 'Tenacity' · Starter Set Union Crawler · The Cantina"
    )
  })

  test("falls back to the Starter Set's own title for a build it does not hold", () => {
    expect(starterPageTitle('pilot', 'starter-pilot-nobody')).toBe('Starter Set · The Cantina')
    expect(starterPageTitle('npc', 'starter-pilot-bonesaw')).toBe('Starter Set · The Cantina')
  })

  test('gives every build a title of its own', () => {
    const titles = starterPages().map((page) => page.title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})

describe('starterPages', () => {
  test('lists every template once, at its own route', () => {
    const ids = [...STARTER_PILOTS, ...STARTER_MECHS, ...STARTER_CRAWLERS].map((t) => t.id)
    const paths = starterPages().map((page) => page.path)
    expect(paths).toHaveLength(ids.length)
    expect(paths).toContain('/starter/pilot/starter-pilot-bonesaw')
    expect(paths.every((path) => /^\/starter\/(pilot|mech|crawler)\/starter-/.test(path))).toBe(
      true
    )
  })

  test("describes a build as the Starter Set's, then in its own words", () => {
    const page = starterPage('pilot', 'starter-pilot-bonesaw')
    expect(page?.description).toStartWith(
      'Bonesaw, a pre-generated Pilot from the Salvage Union Starter Set, Reclamation of the Wastes by Leyline Press. '
    )
    expect(page?.description.length).toBeGreaterThan(120)
  })
})
