import { describe, expect, test } from 'bun:test'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture, mechFixture } from '../../components/__tests__/fixtures'
import {
  craftables,
  craftUpdates,
  findCraftables,
  installPatch,
  spendFor,
  storePatch,
  tradeOffers,
  uncraftUpdates,
  waresAt,
} from '../craftTrade.model'

/** Solo Downtime's Crafting and Trading Bays (Core Book pp.222-223, r6 D5, D6). */
describe('crafting', () => {
  test('a Crafting Bay makes Systems and Modules of its Tech Level or lower', () => {
    expect(craftables(1).every((w) => w.tl === 1)).toBe(true)
    expect(craftables(2).some((w) => w.tl === 2)).toBe(true)
    expect(craftables(2).some((w) => w.kind === 'chassis')).toBe(false)
    expect(findCraftables(6, '')).toEqual([])
    expect(findCraftables(1, 'armour plating').map((w) => w.name)).toContain('Armour Plating')
  })

  test('crafting spends its Salvage Value in Scrap of its Tech Level or higher, or says the shortfall', () => {
    const ware = { tl: 2, salvageValue: 5 }
    expect(spendFor({ tl1: 9, tl2: 3, tl3: 4 }, ware)).toMatchObject({
      ok: true,
      pool: { tl1: 9, tl2: 0, tl3: 2 },
    })
    expect(spendFor({ tl1: 9, tl2: 3 }, ware)).toEqual({ ok: false, short: 2, tl: 2 })
  })

  test('a crafted ware mounts on the mech, or goes into the hold', () => {
    const [ware] = findCraftables(1, 'armour plating')
    if (!ware) throw new Error('no Armour Plating')
    expect(installPatch({ systems: ['a'], modules: [] }, ware)).toEqual({
      systems: ['a', ware.slug],
    })
    const stored = storePatch({ cargoLots: [] }, { tl1: 1 }, ware)
    expect(stored.scrapPool).toEqual({ tl1: 1 })
    expect(stored.cargoLots?.[0]).toMatchObject({ name: ware.name, cat: 'SYSTEM', tl: ware.tl })
  })
})

// r7 D6 (SB7-15): undoing a craft took the item back and kept the Scrap spent.
describe('a craft is one change', () => {
  const [ware] = findCraftables(1, 'armour plating')
  if (!ware) throw new Error('no Armour Plating')
  const crawler = crawlerFixture({ id: 'c', name: 'Calypso', techLevel: 1, scrapPool: { tl1: 8 } })
  const mech = mechFixture({ id: 'm', name: 'Reaver', systems: ['x'] })

  test('mounted, the Scrap and the item go in one batch; its Undo takes both back', () => {
    const done = craftUpdates(crawler, mech, ware, true)
    if (!done.ok) throw new Error('short')
    expect(done.updates).toEqual([
      { type: 'crawler', id: 'c', patch: { scrapPool: { tl1: 8 - ware.salvageValue } } },
      { type: 'mech', id: 'm', patch: { systems: ['x', ware.slug] } },
    ])
    const after = { ...crawler, scrapPool: { tl1: 8 - ware.salvageValue } }
    const back = uncraftUpdates(after, { ...mech, systems: ['x', ware.slug] }, done.crafted)
    expect(back).toEqual([
      { type: 'crawler', id: 'c', patch: { scrapPool: { tl1: 8 } } },
      { type: 'mech', id: 'm', patch: { systems: ['x'] } },
    ])
  })

  test('stored, its Undo puts the Scrap back and takes the lot out of the hold', () => {
    const done = craftUpdates(crawler, null, ware, false)
    if (!done.ok) throw new Error('short')
    expect(done.updates).toHaveLength(1)
    const stored = done.updates[0]?.patch as Pick<Crawler, 'cargoLots' | 'scrapPool'>
    const back = uncraftUpdates({ ...crawler, ...stored }, null, done.crafted)
    expect(back).toEqual([
      { type: 'crawler', id: 'c', patch: { scrapPool: { tl1: 8 }, cargoLots: [] } },
    ])
  })

  test('short, nothing is written', () => {
    expect(craftUpdates({ ...crawler, scrapPool: {} }, mech, ware, true)).toMatchObject({
      ok: false,
    })
  })
})

describe('the Trading Bay’s wares', () => {
  test('one ware of each kind the band offers, at random at the rolled Tech Level', () => {
    const offers = tradeOffers('system-and-module', 3, () => 1)
    expect(offers.map((w) => w.kind)).toEqual(['system', 'module'])
    expect(offers.every((w) => w.tl === 3)).toBe(true)
    expect(offers[0]?.slug).toBe(waresAt('system', 3)[0]?.slug)
    const last = waresAt('module', 3).length
    expect(tradeOffers('module', 3, (n) => n)[0]?.slug).toBe(waresAt('module', 3)[last - 1]?.slug)
    expect(tradeOffers('nothing', 3, () => 1)).toEqual([])
    expect(tradeOffers('chassis', 2, () => 1)[0]?.kind).toBe('chassis')
  })
})
