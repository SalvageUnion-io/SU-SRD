import { describe, expect, test } from 'bun:test'
import {
  craftables,
  findCraftables,
  installPatch,
  spendFor,
  storePatch,
  tradeOffers,
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
