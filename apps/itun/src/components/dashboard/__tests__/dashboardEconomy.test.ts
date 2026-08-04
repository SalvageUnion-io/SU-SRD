/**
 * Downtime economy patch builders (F2/F3/F4, #599).
 *
 * `crafting`, `salvage` and `scrapMech` were fully implemented and tested with
 * ZERO non-test importers — the maths was never the problem, the seam was. These
 * assert the seam: that a legal action produces the right write, and that an
 * illegal one produces NO write plus a reason.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  areaSalvageOutcome,
  craftOutcome,
  crawlerTechLevelOf,
  scrapMechOutcome,
} from '../dashboardEconomy'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

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
  test('scrap found is deposited at the area Tech Level', () => {
    const { result, patch } = areaSalvageOutcome(crawler(), { areaTl: 2, roll: () => 11 })
    if (!patch) throw new Error('expected a patch')
    expect(result.scrapQty).toBeGreaterThan(0)
    // deposited into the area's TL bucket, on top of what was there
    expect(patch.scrapPool?.tl2).toBe(10 + result.scrapQty)
  })

  test('a nothing result makes NO write — a no-op would log a change that changed nothing', () => {
    const { result, patch } = areaSalvageOutcome(crawler(), { areaTl: 2, roll: () => 1 })
    expect(result.scrapQty).toBe(0)
    expect(patch).toBeNull()
  })

  test('a jackpot yields an item choice, not scrap — so also no pool write', () => {
    const { result, patch } = areaSalvageOutcome(crawler(), { areaTl: 2, roll: () => 20 })
    expect(result.requiresPlayerChoice).toBe(true)
    expect(patch).toBeNull()
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
