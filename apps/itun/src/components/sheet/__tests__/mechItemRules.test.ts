/**
 * mechItemRules — pure helper tests (plan 4.5, S12).
 *
 * itemEconomy mines EP cost / Hot heat / Uses from real reference data;
 * repairScrapCost is half SV rounded up (min 1); repairPoolTl finds the
 * lowest qualifying TL bucket (Scrap TL ≥ item TL, higher allowed);
 * mechConditionsPatch maps unified-list edits back onto conditions[] + the
 * boolean flags (removing a flag label clears the flag — the manual clear).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../__tests__/must'
import {
  cycleCondition,
  itemEconomy,
  mechConditionsPatch,
  repairPoolTl,
  repairScrapCost,
  resolveModule,
  resolveSystem,
} from '../mechItemRules'

beforeAll(async () => {
  await SalvageUnionReference.preload(['systems', 'modules', 'actions'])
})

describe('itemEconomy', () => {
  test('Smoke Machine: EP cost 2, no heat, no uses', () => {
    const entity = resolveSystem('Smoke Machine')
    expect(entity).toBeTruthy()
    expect(itemEconomy(must(entity))).toEqual({ epCost: 2, heat: 0, maxUses: 0 })
  })

  test('AFF Coolant Foam: EP cost 1 with Uses 5', () => {
    const entity = resolveSystem('AFF Coolant Foam')
    expect(entity).toBeTruthy()
    expect(itemEconomy(must(entity))).toEqual({ epCost: 1, heat: 0, maxUses: 5 })
  })

  test('Mini Mortar: no EP cost, Uses 5', () => {
    const entity = resolveSystem('Mini Mortar')
    expect(entity).toBeTruthy()
    const economy = itemEconomy(must(entity))
    expect(economy.epCost).toBe(0)
    expect(economy.maxUses).toBe(5)
  })

  test('Green Laser: Hot weapon — no EP cost, +2 heat per use', () => {
    const entity = resolveSystem('Green Laser')
    expect(entity).toBeTruthy()
    const economy = itemEconomy(must(entity))
    expect(economy.epCost).toBe(0)
    expect(economy.heat).toBe(2)
  })
})

describe('resolveSystem / resolveModule ref forms', () => {
  // Installed loadout refs are stored as slugs (e.g. Starter Set mechs), so
  // slug resolution is the load-bearing case — id/name are legacy-tolerated.
  test('resolveSystem matches a slug ref', () => {
    const bySlug = resolveSystem('mini-mortar')
    expect(bySlug).toBeTruthy()
    expect(bySlug?.name).toBe('Mini Mortar')
    expect(resolveSystem('Mini Mortar')?.id).toBe(bySlug?.id)
  })

  test('resolveModule matches a slug ref', () => {
    const bySlug = resolveModule('comms-module')
    expect(bySlug).toBeTruthy()
    expect(bySlug?.name).toBe('Comms Module')
  })

  test('unresolvable ref returns null (no throw)', () => {
    expect(resolveSystem('not-a-real-system')).toBeNull()
  })
})

describe('repairScrapCost', () => {
  test('half SV rounded up', () => {
    expect(repairScrapCost(5)).toBe(3)
    expect(repairScrapCost(4)).toBe(2)
  })

  test('minimum 1, even for SV 0/undefined', () => {
    expect(repairScrapCost(0)).toBe(1)
    expect(repairScrapCost(1)).toBe(1)
    expect(repairScrapCost(undefined)).toBe(1)
  })
})

describe('repairPoolTl', () => {
  test('picks the item-TL bucket when funded', () => {
    expect(repairPoolTl({ tl2: 3 }, 2, 3)).toBe(2)
  })

  test('falls through to a HIGHER funded bucket (Scrap TL ≥ item TL)', () => {
    expect(repairPoolTl({ tl2: 1, tl4: 5 }, 2, 3)).toBe(4)
  })

  test('never picks a bucket BELOW the item TL', () => {
    expect(repairPoolTl({ tl1: 99 }, 3, 2)).toBeNull()
  })

  test('null when nothing is funded — repair still proceeds without deduction', () => {
    expect(repairPoolTl({}, 1, 1)).toBeNull()
  })
})

describe('cycleCondition', () => {
  test('Intact → Damaged → Destroyed → Intact', () => {
    expect(cycleCondition('intact')).toBe('damaged')
    expect(cycleCondition('damaged')).toBe('destroyed')
    expect(cycleCondition('destroyed')).toBe('intact')
  })
})

describe('mechConditionsPatch', () => {
  test('removing a flag label clears the boolean flag (manual clear)', () => {
    const patch = mechConditionsPatch(
      {
        conditions: ['Prone'],
        shutdown: true,
        vulnerable: true,
        destroyed: false,
      },
      ['Prone', 'Vulnerable'] // 'Shutdown' chip removed
    )
    expect(patch.shutdown).toBe(false)
    expect(patch.vulnerable).toBeUndefined() // still true — untouched
    expect(patch.conditions).toEqual(['Prone']) // 'Vulnerable' stays flag-backed
  })

  test('adding a free-form condition lands in conditions[]', () => {
    const patch = mechConditionsPatch({ conditions: [], shutdown: false }, ['Burn 2'])
    expect(patch.conditions).toEqual(['Burn 2'])
    expect(patch.shutdown).toBeUndefined()
  })

  test('removing a free-form condition leaves flags alone', () => {
    const patch = mechConditionsPatch(
      {
        conditions: ['Prone', 'Pinned'],
        shutdown: true,
        vulnerable: false,
        destroyed: false,
      },
      ['Pinned', 'Shutdown']
    )
    expect(patch.conditions).toEqual(['Pinned'])
    expect(patch.shutdown).toBeUndefined()
  })

  test('clearing Destroyed un-bricks the mech', () => {
    const patch = mechConditionsPatch({ conditions: [], destroyed: true }, [])
    expect(patch.destroyed).toBe(false)
    expect(patch.conditions).toEqual([])
  })
})
