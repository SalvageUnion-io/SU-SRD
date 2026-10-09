/**
 * `/su sheet` — the live sheet folded into a card.
 *
 * Exercised against the REAL dataset rather than fixtures of it, because the
 * whole point is that slugs stored on an entity body resolve to the names the
 * book prints. A test that stubbed the lookup would pass while the card said
 * `armour-plating`.
 */
import { describe, expect, test } from 'bun:test'
import { ITUN_ORIGIN, sheetCard } from '../gameCards.js'
import type { EntityBody, SheetResult, SheetTable } from '../itun/types.js'
import { blockStarting, cardHeading, cardText, cardTexts, cardUrl } from './cardText.js'

const WEB = ITUN_ORIGIN

function sheet(table: SheetTable, body: EntityBody, overrides: Partial<SheetResult> = {}) {
  return sheetCard(
    {
      table,
      id: 'cx1',
      appId: 'app1',
      gameId: 'g1',
      publicRead: false,
      ownerName: 'alxjrvs',
      body,
      ...overrides,
    },
    WEB
  )
}

describe('slug resolution', () => {
  test('renders a class by its printed name, not its slug', () => {
    const card = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    expect(cardText(card)).toContain('Salvager')
    expect(cardText(card)).not.toContain('salvager')
  })

  test('renders equipment as links to the reference site', () => {
    const card = sheet('pilots', { callsign: 'Vex', equipment: ['first-aid-kit'] })
    const inventory = blockStarting(card, '**Inventory')
    expect(inventory).toContain('First Aid Kit')
    expect(inventory).toContain('salvageunion.io')
  })

  test('keeps an unknown slug visible rather than dropping the row', () => {
    // A slug the dataset does not know is still something the player owns.
    // Hiding it would make the card disagree with the app about the sheet.
    const card = sheet('pilots', { callsign: 'Vex', equipment: ['not-a-real-item'] })
    expect(cardText(card)).toContain('not-a-real-item')
  })

  test('says so plainly when a collection is empty', () => {
    const card = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule', systems: [] })
    expect(blockStarting(card, '**Systems')).toBe('**Systems — 0**\n_None._')
  })
})

describe('pilot sheet', () => {
  test('groups abilities by tree, as the live sheet does', () => {
    // The sheet renders one dashed sub-slab per ability tree. Carrying that
    // over is what makes a 12-ability Salvager read like the sheet does.
    const card = sheet('pilots', {
      callsign: 'Vex',
      classRef: 'salvager',
      abilities: ['engineering-expertise', 'talk-shop'],
    })
    const trees = cardTexts(card).filter((t) => /^\*\*.* known\*\*\n/.test(t))
    expect(trees.length).toBeGreaterThan(0)
    expect(trees.some((t) => t.startsWith('**Mechanical Knowledge'))).toBe(true)
  })

  test('leads with the vitals rail', () => {
    const card = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    // The first block after the identity band is the rail, HP then AP.
    const rail = blockStarting(card, '**HP** ')
    expect(
      rail
        ?.split('\n')
        .slice(0, 2)
        .map((line) => line.split(' ')[0])
    ).toEqual(['**HP**', '**AP**'])
  })

  test('carries the motto as a quote, like the identity band', () => {
    const card = sheet('pilots', {
      callsign: 'Vex',
      classRef: 'salvager',
      motto: 'Never met a wreck',
    })
    expect(cardText(card)).toContain('> Never met a wreck')
  })

  test('omits conditions entirely when there are none', () => {
    const card = sheet('pilots', { callsign: 'Vex', classRef: 'salvager', conditions: [] })
    expect(cardText(card)).not.toContain('**Conditions**')
  })
})

describe('mech sheet', () => {
  test('marks a damaged system without hiding it', () => {
    const card = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      systems: ['armour-plating'],
      systemConditions: { 'armour-plating': 'damaged' },
    })
    const systems = blockStarting(card, '**Systems')
    expect(systems).toContain('Armour Plating')
    expect(systems).toContain('damaged')
  })

  test('strikes through a destroyed system', () => {
    const card = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      systems: ['armour-plating'],
      systemConditions: { 'armour-plating': 'destroyed' },
    })
    const systems = blockStarting(card, '**Systems')
    expect(systems).toContain('~~')
    expect(systems).toContain('destroyed')
  })

  test('surfaces shutdown and vulnerable as status chips', () => {
    const card = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      shutdown: true,
      vulnerable: true,
    })
    const status = cardText(card)
      .split('\n')
      .find((line) => line.startsWith('**Status** '))
    expect(status).toContain('Shutdown')
    expect(status).toContain('Vulnerable')
  })
})

describe('crawler sheet', () => {
  test('renders bays from their structured refs', () => {
    // Bays are `{ bayRef }` objects, not bare slugs like systems are.
    const card = sheet('crawlers', {
      name: 'The Ossuary',
      techLevel: '3',
      crawlerBays: [{ bayRef: 'command-bay' }, { bayRef: 'mech-bay' }],
    })
    const bays = blockStarting(card, '**Bays')
    expect(bays?.split('\n')[0]).toContain('2')
    expect(bays).toContain('Command Bay')
    expect(bays).toContain('Mech Bay')
  })

  test('is communal, so it never claims an owner', () => {
    const card = sheet('crawlers', { name: 'The Ossuary' }, { ownerName: null })
    expect(cardText(card)).toContain('Communal')
    expect(cardText(card)).not.toContain('Unclaimed')
  })

  test('links into the Game view as a crawler', () => {
    const card = sheet('crawlers', { name: 'The Ossuary' })
    expect(cardUrl(card)).toBe(`${WEB}/games/g1/view/crawler/cx1`)
  })
})

describe('accent colour', () => {
  test('gives each sheet its own strip', () => {
    const pilot = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    const mech = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule' })
    const crawler = sheet('crawlers', { name: 'The Ossuary' })
    expect(new Set([pilot.accent, mech.accent, crawler.accent]).size).toBe(3)
  })

  test('a destroyed mech takes the critical colour instead of its accent', () => {
    // Both apply; wrecked wins. A wrecked mech is wrecked before it is a mech.
    const healthy = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule' })
    const wrecked = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule', destroyed: true })
    expect(wrecked.accent).not.toBe(healthy.accent)
  })
})

describe('robustness', () => {
  test('renders an entirely empty body without throwing', () => {
    // The body is `v.any()` on the server, so this is a real shape.
    expect(() => sheet('pilots', {})).not.toThrow()
    expect(() => sheet('mechs', {})).not.toThrow()
    expect(() => sheet('crawlers', {})).not.toThrow()
  })

  test('survives wrong-typed fields', () => {
    const card = sheet('mechs', {
      name: 'Rustjaw',
      systems: 'not-an-array',
      systemConditions: 42,
    })
    expect(cardHeading(card)).toContain('Rustjaw')
  })

  test('drops the link rather than throwing when the server sends no gameId', () => {
    // An older `botClient` deployment sends no `gameId` at all.
    const card = sheetCard(
      {
        table: 'pilots',
        id: 'cx1',
        appId: 'app1',
        gameId: undefined as unknown as string,
        publicRead: false,
        ownerName: 'alxjrvs',
        body: { callsign: 'Vex' },
      },
      WEB
    )
    expect(cardUrl(card)).toBeUndefined()
    expect(cardHeading(card)).toBe('## Vex')
  })
})
