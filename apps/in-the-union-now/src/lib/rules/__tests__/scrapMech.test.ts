/**
 * Unit tests for scrapMech.ts — the retire-a-mech helper (design-review R-7;
 * Core Book p.248 "Scrap" ability, p.245 destroyed-condition rule).
 *
 * Breakdown/deposit/hand-off tests are pure arithmetic on hand-crafted
 * components; the component resolver runs against REAL reference data
 * (chassis/systems/modules), asserting relative to the resolved entities so
 * the test survives data edits.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import { makeScrapLot, makeUnitLot } from '../../schemas/cargoLot'
import type { ScrapPool } from '../../schemas/crawler'
import {
  depositScrapDeposits,
  handOffCargo,
  mechScrapComponents,
  scrapMechBreakdown,
} from '../scrapMech'
import type { ScrapMechComponent } from '../scrapMech'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])
})

const component = (over: Partial<ScrapMechComponent>): ScrapMechComponent => ({
  kind: 'system',
  name: 'Test Item',
  techLevel: 1,
  salvageValue: 3,
  condition: 'intact',
  ...over,
})

describe('scrapMechBreakdown (p.248 — full SV per component at its own TL)', () => {
  it('deposits each component at full Salvage Value in its own TL bucket', () => {
    const breakdown = scrapMechBreakdown([
      component({ kind: 'chassis', name: 'Mule', techLevel: 1, salvageValue: 7 }),
      component({ name: 'Heavy Laser', techLevel: 2, salvageValue: 4 }),
    ])
    expect(breakdown.deposits).toEqual([
      { tl: 1, count: 7 },
      { tl: 2, count: 4 },
    ])
    expect(breakdown.total).toBe(11)
    expect(breakdown.skipped).toEqual([])
  })

  it('merges same-TL components into one bucket, ascending', () => {
    const breakdown = scrapMechBreakdown([
      component({ techLevel: 2, salvageValue: 4 }),
      component({ techLevel: 1, salvageValue: 3 }),
      component({ techLevel: 2, salvageValue: 5 }),
    ])
    expect(breakdown.deposits).toEqual([
      { tl: 1, count: 3 },
      { tl: 2, count: 9 },
    ])
  })

  it('Damaged components still yield full SV (Scrap works on Intact or Damaged)', () => {
    const breakdown = scrapMechBreakdown([component({ condition: 'damaged', salvageValue: 3 })])
    expect(breakdown.total).toBe(3)
  })

  it('destroyed components yield nothing and are reported (p.245)', () => {
    const breakdown = scrapMechBreakdown([
      component({ name: 'Fried Laser', condition: 'destroyed' }),
      component({ name: 'Good Laser', salvageValue: 3 }),
    ])
    expect(breakdown.total).toBe(3)
    expect(breakdown.skipped).toEqual([{ name: 'Fried Laser', reason: 'destroyed' }])
  })

  it('components without a numeric TL are reported, never silently dropped', () => {
    const breakdown = scrapMechBreakdown([
      component({ name: 'Bio Blade', techLevel: undefined, salvageValue: 3 }),
      component({ name: 'ghost-slug', techLevel: undefined, salvageValue: 0 }),
    ])
    expect(breakdown.total).toBe(0)
    expect(breakdown.skipped).toEqual([
      { name: 'Bio Blade', reason: 'no-tech-level' },
      { name: 'ghost-slug', reason: 'unresolved' },
    ])
  })
})

describe('depositScrapDeposits', () => {
  it('adds every deposit bucket onto the pool', () => {
    const pool: ScrapPool = { tl1: 2 }
    const next = depositScrapDeposits(pool, [
      { tl: 1, count: 7 },
      { tl: 2, count: 4 },
    ])
    expect(next).toEqual({ tl1: 9, tl2: 4 })
    // Pure — the input pool is untouched.
    expect(pool).toEqual({ tl1: 2 })
  })
})

describe('handOffCargo (stow semantics before the mech record is deleted)', () => {
  it('SCRAP lots deposit their TL bucket; other lots move to the crawler hold', () => {
    const scrap = makeScrapLot(2, 3)
    const crate = makeUnitLot('Sealed Crate')
    const existing = makeUnitLot('Old Lot')
    const result = handOffCargo([scrap, crate], [existing], { tl2: 1 })
    expect(result.pool).toEqual({ tl2: 4 })
    expect(result.crawlerLots.map((l) => l.name)).toEqual(['Sealed Crate', 'Old Lot'])
  })

  it('is a no-op on an empty mech hold', () => {
    const result = handOffCargo([], [], {})
    expect(result.crawlerLots).toEqual([])
    expect(result.pool).toEqual({})
  })
})

describe('mechScrapComponents (real reference data)', () => {
  it('resolves the chassis by name and installed items by slug, carrying conditions', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]!
    const system = SalvageUnionReference.Systems.all().find(
      (s) => typeof s.techLevel === 'number' && typeof s.salvageValue === 'number'
    )!
    const module = SalvageUnionReference.Modules.all()[0]!

    const components = mechScrapComponents({
      chassisRef: chassis.name,
      systems: [system.id],
      modules: [module.id],
      systemConditions: { [system.id]: 'destroyed' },
      moduleConditions: {},
    })

    expect(components).toHaveLength(3)
    expect(components[0]).toMatchObject({
      kind: 'chassis',
      name: chassis.name,
      salvageValue: chassis.salvageValue,
      condition: 'intact',
    })
    expect(components[1]).toMatchObject({
      kind: 'system',
      name: system.name,
      salvageValue: system.salvageValue,
      condition: 'destroyed',
    })
    expect(components[2]).toMatchObject({
      kind: 'module',
      name: module.name,
      condition: 'intact',
    })
  })

  it('marks the chassis destroyed when the mech itself is destroyed', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]!
    const components = mechScrapComponents({
      chassisRef: chassis.name,
      systems: [],
      modules: [],
      destroyed: true,
    })
    expect(components[0]!.condition).toBe('destroyed')
  })

  it('keeps unresolved refs with SV 0 so the breakdown can report them', () => {
    const components = mechScrapComponents({
      chassisRef: 'No Such Chassis',
      systems: ['no-such-system'],
      modules: [],
    })
    expect(components[0]).toMatchObject({ name: 'No Such Chassis', salvageValue: 0 })
    expect(components[1]).toMatchObject({ name: 'no-such-system', salvageValue: 0 })
    const breakdown = scrapMechBreakdown(components)
    expect(breakdown.total).toBe(0)
    expect(breakdown.skipped.map((s) => s.reason)).toEqual(['unresolved', 'unresolved'])
  })
})
