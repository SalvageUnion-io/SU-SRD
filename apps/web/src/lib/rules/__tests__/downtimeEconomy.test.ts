/**
 * Downtime economy patch builders.
 *
 * `crafting`, `salvage` and `scrapMech` were fully implemented and tested with
 * ZERO non-test importers — the maths was never the problem, the seam was. These
 * assert the seam: that a legal action produces the right write, and that an
 * illegal one produces NO write plus a reason.
 */

import { describe, expect, test } from 'bun:test'
import { makeScrapLot } from 'game-domain/schemas/cargoLot'
import { areaSalvageResult } from 'salvageunion-reference/rules'
import type { WreckPart } from '../downtimeEconomy'
import {
  areaSalvageToMech,
  areaSalvageToPilot,
  craftOutcome,
  crawlerTechLevelOf,
  scrapMechOutcome,
  wreckSalvageOutcome,
  wreckScrapOutcome,
} from '../downtimeEconomy'

const crawler = (over: Record<string, unknown> = {}) => ({
  techLevel: 'tech-3',
  scrapPool: { tl1: 10, tl2: 10, tl3: 10 },
  cargoLots: [],
  ...over,
})

describe('crawlerTechLevelOf', () => {
  test('parses the slug', () => {
    expect(crawlerTechLevelOf({ techLevel: 'tech-4' })).toBe(4)
  })
  test('returns undefined for an unparseable slug rather than guessing', () => {
    expect(crawlerTechLevelOf({ techLevel: 'bio' })).toBeUndefined()
  })
})

describe('crafting (F3)', () => {
  const item = { name: 'Cargo Pod', techLevel: 1, salvageValue: 1 }

  test('a legal, affordable craft pays the pool and adds the item to the hold', () => {
    const c = crawler()
    const { patch, quote } = craftOutcome(c, item)
    if (!patch) throw new Error('expected a patch')
    expect(quote.eligible).toBe(true)
    expect(quote.affordable).toBe(true)
    // paid from the pool
    expect(patch.scrapPool).toEqual(quote.pool)
    // and the crafted item lands in the hold
    expect(patch.cargoLots).toHaveLength(1)
    expect(patch.cargoLots?.[0]?.name).toBe('Cargo Pod')
  })

  test('an item above the crawler Tech Level is BLOCKED with a reason, not written', () => {
    const { patch, blocked } = craftOutcome(crawler({ techLevel: 'tech-1' }), {
      name: 'Heavy Thing',
      techLevel: 5,
      salvageValue: 1,
    })
    expect(patch).toBeNull()
    expect(blocked).toBe('tech-level')
  })

  test('an unaffordable craft is BLOCKED with a reason, not written', () => {
    const { patch, blocked, quote } = craftOutcome(crawler({ scrapPool: {} }), item)
    expect(patch).toBeNull()
    expect(blocked).toBe('scrap')
    expect(quote.shortfall).toBeGreaterThan(0)
  })

  test('a blocked craft never mutates the input pool', () => {
    const c = crawler({ scrapPool: {} })
    craftOutcome(c, item)
    expect(Object.keys(c.scrapPool)).toHaveLength(0)
  })
})

describe('area salvage (F2)', () => {
  const found = (d20: number, areaTl = 2) => areaSalvageResult({ areaTl, d20 })

  test("a mech's Scrap lands in its Cargo Slots at the area Tech Level", () => {
    const { carried, leftBehind, patch } = areaSalvageToMech({ cargoLots: [] }, 6, found(11))
    expect(carried).toBe(3)
    expect(leftBehind).toBe(0)
    expect(patch?.cargoLots).toHaveLength(1)
    expect(patch?.cargoLots?.[0]).toMatchObject({ cat: 'SCRAP', tl: 2, qty: 3, units: 3 })
  })

  test("it stacks on the hold's Scrap of the same Tech Level", () => {
    const held = makeScrapLot(2, 2)
    const { patch } = areaSalvageToMech({ cargoLots: [held] }, 6, found(8))
    expect(patch?.cargoLots).toEqual([{ ...held, qty: 4, units: 4 }])
  })

  test('what has no Slot stays in the area', () => {
    const full = makeScrapLot(1, 5)
    const { carried, leftBehind } = areaSalvageToMech({ cargoLots: [full] }, 6, found(15))
    expect(carried).toBe(1)
    expect(leftBehind).toBe(2)
  })

  test('on foot it takes three Inventory Slots a Scrap, so a full pilot carries none', () => {
    const pilot = { equipment: [], genericInventory: [] }
    const two = areaSalvageToPilot(pilot, 6, found(11))
    expect(two.carried).toBe(2)
    expect(two.leftBehind).toBe(1)
    expect(two.patch?.genericInventory?.[0]).toMatchObject({
      name: 'Tech 2 Scrap',
      slotCost: 3,
      qty: 2,
    })
    const none = areaSalvageToPilot(pilot, 2, found(11))
    expect(none.patch).toBeNull()
    expect(none.leftBehind).toBe(3)
  })

  test('a nothing result makes NO write — a no-op would log a change that changed nothing', () => {
    expect(areaSalvageToMech({ cargoLots: [] }, 6, found(1)).patch).toBeNull()
  })

  test('a jackpot yields an item choice, not scrap — so also no cargo write', () => {
    const result = found(20)
    expect(result.requiresPlayerChoice).toBe(true)
    expect(areaSalvageToMech({ cargoLots: [] }, 6, result).patch).toBeNull()
  })
})

describe('mech salvage of a wreck (F2)', () => {
  const parts: WreckPart[] = [
    { key: 'c', kind: 'chassis', name: 'Mule', techLevel: 1, salvageValue: 7 },
    { key: 's', kind: 'system', name: 'Red Laser', techLevel: 1, salvageValue: 3 },
    { key: 'm', kind: 'module', name: 'Targeting Module', techLevel: 2, salvageValue: 2 },
  ]

  test('a 2–5 pays half the Chassis Salvage Value in Scrap of its Tech Level', () => {
    const { patch, taken } = wreckSalvageOutcome(crawler(), parts, 'nuts', [])
    expect(patch?.scrapPool?.tl1).toBe(13)
    expect(taken).toEqual(['3 Tech 1 Scrap'])
  })

  test('a pick lands in the hold, Damaged, at its Salvage Value in Slots', () => {
    const { patch, taken } = wreckSalvageOutcome(crawler(), parts, 'meat', ['c'])
    expect(taken).toEqual(['Mule'])
    expect(patch?.cargoLots?.[0]).toMatchObject({ name: 'Mule (Damaged)', units: 7, tl: 1 })
  })

  test('picks the band does not allow write nothing', () => {
    expect(wreckSalvageOutcome(crawler(), parts, 'bits', ['c']).patch).toBeNull()
    expect(wreckSalvageOutcome(crawler(), parts, 'meat', ['c', 's']).patch).toBeNull()
    expect(wreckSalvageOutcome(crawler(), parts, 'ashes', ['s']).patch).toBeNull()
  })

  test('a 20 takes the Chassis, a System and a Module', () => {
    const { patch } = wreckSalvageOutcome(crawler(), parts, 'lions', ['c', 's', 'm'])
    expect(patch?.cargoLots).toHaveLength(3)
  })

  test('a downed Vehicle scraps for its Salvage Value at its Tech Level', () => {
    expect(wreckScrapOutcome(crawler(), { techLevel: 2, salvageValue: 4 })?.scrapPool?.tl2).toBe(14)
  })
})

describe('scrap mech (F4)', () => {
  const PLATING = {
    id: 'l1',
    kind: 'unit' as const,
    name: 'Spare Plating',
    cat: 'SYSTEM' as const,
    units: 2,
    code: 'PLT',
  }

  const mech = {
    id: 'm1',
    chassisRef: 'unknown-chassis',
    systems: [],
    modules: [],
    cargoLots: [],
  }

  test('deposits the breakdown into the crawler pool and marks the mech destroyed', () => {
    const c = crawler()
    const { crawlerPatch, mechPatch, breakdown } = scrapMechOutcome(mech, c)
    expect(mechPatch.destroyed).toBe(true)
    // the pool only ever grows by the breakdown total
    const before = Object.values(c.scrapPool).reduce((a, b) => a + b, 0)
    const after = Object.values(crawlerPatch.scrapPool ?? {}).reduce((a, b) => a + b, 0)
    expect(after - before).toBe(breakdown.total)
  })

  test('marks destroyed rather than deleting — the record keeps its history', () => {
    const { mechPatch } = scrapMechOutcome(mech, crawler())
    expect(mechPatch.destroyed).toBe(true)
  })

  test('a deliberately scrapped mech hands its hold to the crawler', () => {
    // Nothing in the hold was ever part of the mech — losing it is data loss.
    const withCargo = {
      ...mech,
      cargoLots: [PLATING],
    }
    const { crawlerPatch, mechPatch, cargoHandedOff } = scrapMechOutcome(withCargo, crawler())
    expect(cargoHandedOff).toBe(true)
    expect(crawlerPatch.cargoLots?.some((l) => l.name === 'Spare Plating')).toBe(true)
    // and it leaves the mech, so it cannot be counted twice
    expect(mechPatch.cargoLots).toEqual([])
  })

  test('an ALREADY-DESTROYED mech loses its cargo — meltdown destroys it (p.234/p.240)', () => {
    const destroyed = {
      ...mech,
      destroyed: true,
      cargoLots: [PLATING],
    }
    const { crawlerPatch, cargoHandedOff } = scrapMechOutcome(destroyed, crawler())
    expect(cargoHandedOff).toBe(false)
    expect(crawlerPatch.cargoLots).toBeUndefined()
  })
})
