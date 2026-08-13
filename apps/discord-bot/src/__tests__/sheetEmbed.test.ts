/**
 * `/su sheet` — the live sheet folded into an embed.
 *
 * Exercised against the REAL dataset rather than fixtures of it, because the
 * whole point of the change is that slugs stored on an entity body resolve to
 * the names the book prints. A test that stubbed the lookup would pass while
 * the embed said `armour-plating`.
 */
import { describe, expect, test } from 'bun:test'
import { buildSheetEmbed } from '../gameEmbed.js'
import type { EntityBody, SheetResult, SheetTable } from '../itun/types.js'

const WEB = 'https://intheunionnow.com'

function sheet(table: SheetTable, body: EntityBody, overrides: Partial<SheetResult> = {}) {
  return buildSheetEmbed(
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

/** Every field's value, joined — for "does this embed mention X anywhere". */
function allText(embed: ReturnType<typeof buildSheetEmbed>): string {
  return [
    embed.title,
    embed.description ?? '',
    ...embed.fields.map((f) => `${f.name}\n${f.value}`),
  ].join('\n')
}

describe('slug resolution', () => {
  test('renders a class by its printed name, not its slug', () => {
    const embed = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    expect(allText(embed)).toContain('Salvager')
    expect(allText(embed)).not.toContain('salvager')
  })

  test('renders equipment as links to the reference site', () => {
    const embed = sheet('pilots', { callsign: 'Vex', equipment: ['first-aid-kit'] })
    const inventory = embed.fields.find((f) => f.name.startsWith('Inventory'))
    expect(inventory?.value).toContain('First Aid Kit')
    expect(inventory?.value).toContain('salvageunion.io')
  })

  test('keeps an unknown slug visible rather than dropping the row', () => {
    // A slug the dataset does not know is still something the player owns.
    // Hiding it would make the embed disagree with the app about the sheet.
    const embed = sheet('pilots', { callsign: 'Vex', equipment: ['not-a-real-item'] })
    expect(allText(embed)).toContain('not-a-real-item')
  })

  test('says so plainly when a collection is empty', () => {
    const embed = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule', systems: [] })
    const systems = embed.fields.find((f) => f.name.startsWith('Systems'))
    expect(systems?.value).toBe('_None._')
  })
})

describe('pilot sheet', () => {
  test('groups abilities by tree, as the live sheet does', () => {
    // The sheet renders one dashed sub-slab per ability tree. Carrying that
    // over is what keeps a 12-ability Salvager under the 1024-char field cap.
    const embed = sheet('pilots', {
      callsign: 'Vex',
      classRef: 'salvager',
      abilities: ['engineering-expertise', 'talk-shop'],
    })
    const trees = embed.fields.filter((f) => f.name.includes('known'))
    expect(trees.length).toBeGreaterThan(0)
    expect(trees.some((f) => f.name.includes('Mechanical Knowledge'))).toBe(true)
  })

  test('leads with the vitals rail', () => {
    const embed = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    expect(embed.fields.slice(0, 2).map((f) => f.name)).toEqual(['HP', 'AP'])
  })

  test('carries the motto as a quote, like the identity band', () => {
    const embed = sheet('pilots', {
      callsign: 'Vex',
      classRef: 'salvager',
      motto: 'Never met a wreck',
    })
    expect(embed.description).toContain('> Never met a wreck')
  })

  test('omits conditions entirely when there are none', () => {
    const embed = sheet('pilots', { callsign: 'Vex', classRef: 'salvager', conditions: [] })
    expect(embed.fields.some((f) => f.name === 'Conditions')).toBe(false)
  })
})

describe('mech sheet', () => {
  test('marks a damaged system without hiding it', () => {
    const embed = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      systems: ['armour-plating'],
      systemConditions: { 'armour-plating': 'damaged' },
    })
    const systems = embed.fields.find((f) => f.name.startsWith('Systems'))
    expect(systems?.value).toContain('Armour Plating')
    expect(systems?.value).toContain('damaged')
  })

  test('strikes through a destroyed system', () => {
    const embed = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      systems: ['armour-plating'],
      systemConditions: { 'armour-plating': 'destroyed' },
    })
    const systems = embed.fields.find((f) => f.name.startsWith('Systems'))
    expect(systems?.value).toContain('~~')
    expect(systems?.value).toContain('destroyed')
  })

  test('surfaces shutdown and vulnerable as status chips', () => {
    const embed = sheet('mechs', {
      name: 'Rustjaw',
      chassisRef: 'mule',
      shutdown: true,
      vulnerable: true,
    })
    const status = embed.fields.find((f) => f.name === 'Status')
    expect(status?.value).toContain('Shutdown')
    expect(status?.value).toContain('Vulnerable')
  })
})

describe('crawler sheet', () => {
  test('renders bays from their structured refs', () => {
    // Bays are `{ bayRef }` objects, not bare slugs like systems are.
    const embed = sheet('crawlers', {
      name: 'The Ossuary',
      techLevel: '3',
      crawlerBays: [{ bayRef: 'command-bay' }, { bayRef: 'mech-bay' }],
    })
    const bays = embed.fields.find((f) => f.name.startsWith('Bays'))
    expect(bays?.name).toContain('2')
    expect(bays?.value).toContain('Command Bay')
    expect(bays?.value).toContain('Mech Bay')
  })

  test('is communal, so it never claims an owner', () => {
    const embed = sheet('crawlers', { name: 'The Ossuary' }, { ownerName: null })
    expect(embed.description).toContain('Communal')
    expect(embed.description).not.toContain('Unclaimed')
  })

  test('links into the Game view as a crawler', () => {
    const embed = sheet('crawlers', { name: 'The Ossuary' })
    expect(embed.url).toBe(`${WEB}/games/g1/view/crawler/cx1`)
  })
})

describe('accent colour', () => {
  test('gives each sheet its own strip', () => {
    const pilot = sheet('pilots', { callsign: 'Vex', classRef: 'salvager' })
    const mech = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule' })
    const crawler = sheet('crawlers', { name: 'The Ossuary' })
    expect(new Set([pilot.color, mech.color, crawler.color]).size).toBe(3)
  })

  test('a destroyed mech takes the critical colour instead of its accent', () => {
    // Both apply; wrecked wins. A wrecked mech is wrecked before it is a mech.
    const healthy = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule' })
    const wrecked = sheet('mechs', { name: 'Rustjaw', chassisRef: 'mule', destroyed: true })
    expect(wrecked.color).not.toBe(healthy.color)
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
    const embed = sheet('mechs', {
      name: 'Rustjaw',
      systems: 'not-an-array',
      systemConditions: 42,
    })
    expect(embed.title).toBe('Rustjaw')
  })

  test('drops the link rather than throwing when the server sends no gameId', () => {
    // An older `botClient` deployment sends no `gameId` at all.
    const embed = buildSheetEmbed(
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
    expect(embed.url).toBeUndefined()
    expect(embed.title).toBe('Vex')
  })
})
